import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import {
  errorMessage,
  type PublisherSettings,
  type PublishWarning,
} from "./types";

export class GitHubService {
  private octokit: Octokit;
  private settings: PublisherSettings;

  constructor(settings: PublisherSettings) {
    this.settings = settings;
    this.octokit = new Octokit({
      auth: settings.githubToken,
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
   * Get the full repository URL
   */
  getRepoUrl(): string {
    return `https://github.com/${this.settings.repoOwner}/${this.settings.repoName}`;
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
      if (error instanceof Error) {
        throw new Error(
          `Failed to get SHA for branch ${branch}: ${error.message}`,
        );
      }
      throw error;
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
      if (error instanceof RequestError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(
          `Failed to create branch ${branchName}: ${error.message}`,
        );
      }
      throw error;
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
  ): Promise<{ url: string; number: number; warnings: PublishWarning[] }> {
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
      if (error instanceof Error) {
        throw new Error(`Failed to create pull request: ${error.message}`);
      }
      throw error;
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
      number: response.data.number,
      warnings,
    };
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
      const branchSha = await this.getBranchSha(branch);

      const commitData = await this.octokit.rest.git.getCommit({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        commit_sha: branchSha,
      });

      const treeEntries = [];
      for (const file of files) {
        const base64 = this.toBase64(file.content);

        const blob = await this.octokit.rest.git.createBlob({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          content: base64,
          encoding: "base64",
        });

        treeEntries.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.data.sha,
        });
      }

      const newTree = await this.octokit.rest.git.createTree({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        base_tree: commitData.data.tree.sha,
        tree: treeEntries,
      });

      const newCommit = await this.octokit.rest.git.createCommit({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        message,
        tree: newTree.data.sha,
        parents: [branchSha],
      });

      await this.octokit.rest.git.updateRef({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        ref: `heads/${branch}`,
        sha: newCommit.data.sha,
      });
    } catch (error) {
      if (error instanceof RequestError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to commit files: ${error.message}`);
      }
      throw error;
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
    for (let i = 0; i < maxRetries; i++) {
      const suffix = i > 0 ? `-${i}` : "";
      const branchName = this.generateBranchName(basePrefix) + suffix;

      try {
        await this.createBranch(branchName, baseBranch);
        return branchName;
      } catch (error) {
        // Check if error is 422 (branch already exists)
        if (error instanceof RequestError && error.status === 422) {
          // Branch already exists, try again with suffix
          continue;
        }
        // Re-throw if it's a different error
        throw error;
      }
    }

    throw new Error(`Failed to create branch after ${maxRetries} attempts`);
  }
}
