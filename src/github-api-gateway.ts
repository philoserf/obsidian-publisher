import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import {
  errorMessage,
  type PublisherSettings,
  type PublishWarning,
} from "./types";

/**
 * Rethrow from an Octokit call site with a consistent narrowing:
 * RequestError passes through (caller gets the status code); generic
 * Error gets wrapped with a descriptive prefix; anything else rethrows
 * as-is.
 */
function rethrowWithPrefix(error: unknown, prefix: string): never {
  if (error instanceof RequestError) throw error;
  if (error instanceof Error) throw new Error(`${prefix}: ${error.message}`);
  throw error;
}

/** Per-request budget for GitHub API calls; a stalled connection on
 * mobile must surface as an error rather than hang a publish forever. */
/**
 * Is this failure worth retrying the same request for?
 *
 * 429 and 5xx are transient by definition. 403 is ambiguous: GitHub uses
 * it for secondary rate limiting AND for "token lacks scope", so it only
 * counts when the response looks rate-limit shaped — otherwise a genuine
 * permission error would burn every attempt before surfacing.
 *
 * 422 is deliberately absent. On branch creation it means "ref already
 * exists", which is resolved by trying a DIFFERENT name (see
 * createBranchWithRetry) rather than repeating this one; elsewhere it is
 * a hard validation error, and updateRef is non-forced so a 422 there is
 * a non-fast-forward that retrying cannot fix.
 */
export function isTransient(error: unknown): boolean {
  if (!(error instanceof RequestError)) return false;
  if (error.status === 429 || error.status >= 500) return true;
  if (error.status !== 403) return false;
  const headers = error.response?.headers ?? {};
  return (
    headers["retry-after"] !== undefined ||
    headers["x-ratelimit-remaining"] === "0"
  );
}

/** A git tree entry names its content one of two ways, never both:
 * `content` for text GitHub should blob itself, or `sha` for a blob
 * already uploaded. */
type TreeEntry = {
  path: string;
  mode: "100644";
  type: "blob";
} & ({ content: string; sha?: never } | { sha: string; content?: never });

/** Attempts, then backoff delays between them. */
const COMMIT_MAX_ATTEMPTS = 3;

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * fetch with an abort timeout, composed with whatever signal the caller
 * passed rather than replacing it — Octokit forwards a per-request
 * `request.signal`, and overwriting it would silently make a caller's
 * cancellation impossible.
 *
 * Rewraps the opaque DOMException so errorMessage() surfaces "timed out"
 * instead of "signal is aborted", but only when the timeout is what
 * fired: a caller-initiated abort must not be reported as a timeout.
 *
 * Exported for testing; Octokit is mocked wholesale in the suite, so
 * this is unreachable through the gateway.
 */
export async function fetchWithTimeout(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    const aborted =
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    if (aborted && timeout.aborted) {
      throw new Error(
        `GitHub API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }
    throw error;
  }
}

/** Pause between retry attempts. Injectable so tests assert attempt
 * counts without sleeping — same trade as the debounce stub in
 * test-preload.ts ("Tests don't exercise timing"). */
export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class GitHubApiGateway {
  private octokit: Octokit;
  private settings: PublisherSettings;
  private sleep: Sleep;

  constructor(settings: PublisherSettings, sleep: Sleep = realSleep) {
    this.settings = settings;
    this.sleep = sleep;
    this.octokit = new Octokit({
      auth: settings.githubToken,
      request: { fetch: fetchWithTimeout },
    });
  }

  /**
   * Validate that the GitHub connection and repository access works
   */
  async validateConnection(): Promise<void> {
    try {
      await this.octokit.repos.get({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
      });
    } catch (error) {
      // Deliberately not rethrowWithPrefix: that passes RequestError
      // through untouched, and this message is user-facing guidance in
      // the settings connection test. A bare "Not Found" helps nobody.
      if (error instanceof Error) {
        throw new Error(
          `Failed to access repository: ${error.message}. Check your token and repository settings.`,
        );
      }
      throw error;
    }
  }

  /**
   * Convert string or ArrayBuffer to base64 (cross-platform, chunked for large payloads)
   */
  private toBase64(input: string | ArrayBuffer): string {
    const bytes =
      typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return btoa(chunks.join(""));
  }

  /**
   * Get the latest commit SHA for a branch
   */
  async getBranchSha(branch: string): Promise<string> {
    try {
      const response = await this.octokit.rest.git.getRef({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        ref: `heads/${branch}`,
      });
      return response.data.object.sha;
    } catch (error) {
      rethrowWithPrefix(error, `Failed to get SHA for branch ${branch}`);
    }
  }

  /**
   * Create a new branch from a base branch
   * Returns the branch name
   */
  async createBranch(branchName: string, baseBranch = "main"): Promise<string> {
    try {
      // Get the SHA of the base branch
      const baseSha = await this.getBranchSha(baseBranch);

      // Create new reference
      await this.octokit.rest.git.createRef({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      return branchName;
    } catch (error) {
      rethrowWithPrefix(error, `Failed to create branch ${branchName}`);
    }
  }

  /**
   * Create a pull request and (optionally) apply labels.
   * Label-apply failure is non-fatal — the PR exists and is the user's
   * primary artifact; surfacing the failure as a warning avoids the
   * orphaned-PR side effect of throwing here.
   */
  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string,
    labels?: string[],
  ): Promise<{ url: string; warnings: PublishWarning[] }> {
    let response: Awaited<ReturnType<typeof this.octokit.rest.pulls.create>>;
    try {
      response = await this.octokit.rest.pulls.create({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        title,
        head,
        base,
        body,
      });
    } catch (error) {
      rethrowWithPrefix(error, "Failed to create pull request");
    }

    const warnings: PublishWarning[] = [];
    if (labels && labels.length > 0) {
      try {
        await this.octokit.rest.issues.addLabels({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          issue_number: response.data.number,
          labels,
        });
      } catch (error) {
        const message = errorMessage(error);
        console.warn(
          `PR labels not applied (${labels.join(", ")}): ${message}`,
        );
        warnings.push({ kind: "pr-label-failed", labels, error: message });
      }
    }

    return {
      url: response.data.html_url,
      warnings,
    };
  }

  /**
   * Repeat an idempotent request while it keeps failing transiently.
   * Every call this wraps is safe to repeat: blobs and trees are
   * content-addressed, and updateRef with an unchanged SHA is a no-op.
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < COMMIT_MAX_ATTEMPTS; i++) {
      try {
        return await operation();
      } catch (error) {
        if (!isTransient(error)) throw error;
        lastError = error;
        await this.sleep(2 ** i * 500 + Math.random() * 250);
      }
    }
    throw lastError;
  }

  /**
   * Commit multiple files in a single atomic commit using the Git Trees API
   */
  async commitFiles(
    files: Array<{ path: string; content: string | ArrayBuffer }>,
    message: string,
    branch: string,
  ): Promise<void> {
    try {
      const branchSha = await this.withRetry(() => this.getBranchSha(branch));

      const commitData = await this.withRetry(() =>
        this.octokit.rest.git.getCommit({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          commit_sha: branchSha,
        }),
      );

      // Text goes inline: GitHub writes the blob as part of createTree,
      // so a 167-note batch is one request instead of 167. Binary has no
      // encoding parameter on a tree entry, so images still need a
      // base64 blob of their own.
      const treeEntries: TreeEntry[] = [];
      for (const file of files) {
        if (typeof file.content === "string") {
          treeEntries.push({
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            content: file.content,
          });
          continue;
        }

        const base64 = this.toBase64(file.content);
        const blob = await this.withRetry(() =>
          this.octokit.rest.git.createBlob({
            owner: this.settings.repoOwner,
            repo: this.settings.repoName,
            content: base64,
            encoding: "base64",
          }),
        );

        treeEntries.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.data.sha,
        });
      }

      const newTree = await this.withRetry(() =>
        this.octokit.rest.git.createTree({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          base_tree: commitData.data.tree.sha,
          tree: treeEntries,
        }),
      );

      const newCommit = await this.withRetry(() =>
        this.octokit.rest.git.createCommit({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          message,
          tree: newTree.data.sha,
          parents: [branchSha],
        }),
      );

      await this.withRetry(() =>
        this.octokit.rest.git.updateRef({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          ref: `heads/${branch}`,
          sha: newCommit.data.sha,
        }),
      );
    } catch (error) {
      rethrowWithPrefix(error, "Failed to commit files");
    }
  }

  /**
   * Delete a branch from the repository
   */
  async deleteBranch(branchName: string): Promise<void> {
    await this.octokit.rest.git.deleteRef({
      owner: this.settings.repoOwner,
      repo: this.settings.repoName,
      ref: `heads/${branchName}`,
    });
  }

  /**
   * Generate a unique branch name for publishing
   */
  generateBranchName(prefix = "publish"): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    return `${prefix}/${timestamp}`;
  }

  /**
   * Create a branch with retry logic for name collisions
   */
  async createBranchWithRetry(
    basePrefix: string,
    baseBranch = "main",
    maxRetries = 3,
  ): Promise<string> {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
      const suffix = i > 0 ? `-${i}` : "";
      const branchName = this.generateBranchName(basePrefix) + suffix;

      try {
        await this.createBranch(branchName, baseBranch);
        return branchName;
      } catch (error) {
        // 422 means the name is taken, so the next attempt uses a
        // different one; isTransient covers the failures worth repeating
        // the same request for.
        const collision = error instanceof RequestError && error.status === 422;
        if (!collision && !isTransient(error)) throw error;

        lastError = error;
        // Exponential backoff with jitter so retries are never instant
        // and a rate-limited batch doesn't hammer in lockstep.
        await this.sleep(2 ** i * 500 + Math.random() * 250);
      }
    }

    throw lastError;
  }
}
