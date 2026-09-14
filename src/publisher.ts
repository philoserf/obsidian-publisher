import type { MetadataCache, TFile, Vault } from "obsidian";
import { GitHubApiGateway } from "./github-api-gateway";
import { NoteTransformer } from "./note-transformer";
import {
  type Frontmatter,
  hasPublishFlag,
  splitFrontmatter,
  validateFrontmatter,
} from "./schema";
import { validatePublish } from "./settings";
import { sanitizeFilename, sanitizeSlug, vaultBasename } from "./slug";
import {
  type BatchPublishResult,
  errorMessage,
  type PublisherSettings,
  type PublishResult,
  type PublishWarning,
} from "./types";

/** The gateway surface `Publisher` uses. A port rather than the class
 * itself because `GitHubApiGateway`'s private fields make it nominal, so
 * no fake can satisfy it; the constructor's default argument is where the
 * real class is checked against these four. */
export type PublishGateway = Pick<
  GitHubApiGateway,
  "commitFiles" | "createBranchWithRetry" | "createPullRequest" | "deleteBranch"
>;

type ProgressCallback = (done: number, total: number) => void;

type FileEntry = { path: string; content: string | ArrayBuffer };

/**
 * The outcome of preparing one note: transformed, its images resolved,
 * nothing committed.
 *
 * Deliberately not a `PublishResult`. A `PublishResult` with
 * `success: true` means "this note was published" everywhere else in the
 * system — it is what `buildBatchResult` counts, what `formatBatchNotice`
 * announces, and what `main.ts` prints under "Successful publishes". At
 * preparation time no branch has been written to, so minting one here
 * made every path from preparation to a returned batch responsible for
 * remembering to rewrite it, and the compiler could not help because the
 * two were the same type (#309).
 *
 * A note's entries hang off its own `Prepared`, built and attached
 * together, so a note that failed cannot own entries — which is what
 * dissolves #295 rather than reordering two statements.
 */
type Prepared =
  | {
      filePath: string;
      ok: true;
      entries: FileEntry[];
      warnings: PublishWarning[];
    }
  | { filePath: string; ok: false; error: string; warnings: PublishWarning[] };

type PublishableFile = { file: TFile; frontmatter: Frontmatter; body: string };

type WorkflowOpts = {
  branchPrefix: string;
  readFailures: PublishResult[];
  files: PublishableFile[];
  commitMessage: (successCount: number) => string;
  prTitle: (succeeded: PublishResult[]) => string;
  prBody: (succeeded: PublishResult[]) => string;
};

function failedResult(filePath: string, error: string): PublishResult {
  return { filePath, success: false, error, warnings: [] };
}

/**
 * One failed result per file, so a batch's total count reflects attempted
 * publishes. Without this a collision-only failure (no read failures)
 * produces total=0, which main.ts's "No publishable notes found" guard
 * swallows.
 */
function failedResults(
  files: Array<{ file: TFile }>,
  error: string,
): PublishResult[] {
  return files.map(({ file }) => failedResult(file.path, error));
}

/**
 * Return a copy of results with every successful entry converted to a
 * failed one carrying the given error. Failures keep their original error.
 */
/**
 * The only place a `PublishResult` is made from a `Prepared`, and so the
 * only place a publish outcome is decided.
 *
 * `commitError` is the commit that never landed: a prepared success
 * becomes a failure carrying that error, and a note that failed during
 * preparation keeps the reason it failed for. This replaces three exits
 * that each had to remember to rewrite a value that was already wrong.
 */
function toResults(
  prepared: Prepared[],
  commitError?: { error: unknown; prefix?: string },
): PublishResult[] {
  const formatted = commitError
    ? commitError.prefix
      ? `${commitError.prefix}: ${errorMessage(commitError.error)}`
      : errorMessage(commitError.error)
    : undefined;

  return prepared.map((p) => {
    if (!p.ok) {
      return {
        filePath: p.filePath,
        success: false,
        error: p.error,
        warnings: p.warnings,
      };
    }
    return formatted === undefined
      ? { filePath: p.filePath, success: true, warnings: p.warnings }
      : {
          filePath: p.filePath,
          success: false,
          error: formatted,
          warnings: p.warnings,
        };
  });
}

/**
 * The commit's file entries, from the notes that actually prepared.
 *
 * Deduplicates by target path in note order, reproducing what the shared
 * `entryMap` did: two notes referencing one image share a buffer through
 * `imageReadCache`, so a later write of the same path is the same bytes.
 */
function flattenEntries(prepared: Prepared[]): FileEntry[] {
  const byPath = new Map<string, string | ArrayBuffer>();
  for (const p of prepared) {
    if (!p.ok) continue;
    for (const entry of p.entries) byPath.set(entry.path, entry.content);
  }
  return Array.from(byPath.entries()).map(([path, content]) => ({
    path,
    content,
  }));
}

function buildBatchResult(
  results: PublishResult[],
  extras: {
    error?: string;
    prUrl?: string;
    warnings?: PublishWarning[];
  } = {},
): BatchPublishResult {
  const successful = results.filter((r) => r.success).length;
  return {
    total: results.length,
    successful,
    failed: results.length - successful,
    results,
    ...extras,
    warnings: extras.warnings ?? [],
  };
}

// Summary surfaces in the user-facing Notice when no commit was attempted
// and read failures are the only cause; per-file errors otherwise live in
// console.log, which mobile users can't see.
function summarizeReadFailures(
  readFailures: PublishResult[],
): string | undefined {
  if (readFailures.length === 0) return undefined;
  if (readFailures.length === 1) return readFailures[0].error;
  return `Failed to read ${readFailures.length} files`;
}

export class Publisher {
  private vault: Vault;
  private settings: PublisherSettings;
  private noteTransformer: NoteTransformer;
  private githubApiGateway: PublishGateway;
  private onProgress?: ProgressCallback;
  private metadataCache?: MetadataCache;

  constructor(
    vault: Vault,
    settings: PublisherSettings,
    onProgress?: ProgressCallback,
    metadataCache?: MetadataCache,
    githubApiGateway: PublishGateway = new GitHubApiGateway(settings),
  ) {
    this.vault = vault;
    this.settings = settings;
    this.noteTransformer = new NoteTransformer(settings);
    this.githubApiGateway = githubApiGateway;
    this.onProgress = onProgress;
    this.metadataCache = metadataCache;
  }

  /**
   * Can this file be ruled out without reading it?
   *
   * Only one answer is safe to trust: the cache parsed the frontmatter and
   * it carries no publish flag. Everything else — a cold cache, or parsed
   * frontmatter that came back absent — has to be read, because
   * metadataCache reports MALFORMED frontmatter as simply missing, and a
   * malformed block hides publish intent. Skipping those would silently
   * reintroduce #129.
   */
  private isDefinitelyNotPublishable(file: TFile): boolean {
    if (!this.metadataCache) return false;
    const cache = this.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return false;
    return !hasPublishFlag(cache.frontmatter as Frontmatter);
  }

  private async cleanupBranch(branchName: string): Promise<void> {
    try {
      await this.githubApiGateway.deleteBranch(branchName);
    } catch (error) {
      // Best-effort; don't mask the original publish error.
      console.warn(
        `Failed to clean up branch ${branchName}:`,
        errorMessage(error),
      );
    }
  }

  /**
   * Index the vault by every suffix of each file's path, which is how
   * Obsidian's own shortest-unique-path resolution works: `a/b/pic.png`
   * is reachable as `pic.png`, `b/pic.png` and `a/b/pic.png`.
   *
   * Keying on the basename alone was #308 — a path-qualified reference
   * never matched, so the note published with a broken image URL and
   * nothing uploaded. Bare-basename lookups are unchanged: the shortest
   * suffix is the basename, and it still maps to every file with that
   * name, so an ambiguous reference still reports `image-collision`.
   */
  private buildFilesByPathSuffix(): Map<string, TFile[]> {
    const map = new Map<string, TFile[]>();
    for (const f of this.vault.getFiles()) {
      const segments = f.path.split("/");
      for (let i = 0; i < segments.length; i++) {
        const key = segments.slice(i).join("/");
        const existing = map.get(key);
        if (existing) existing.push(f);
        else map.set(key, [f]);
      }
    }
    return map;
  }

  /**
   * Build the set of slugs being published in this run. Links to notes
   * outside this set degrade to plain text during content processing.
   */
  private buildPublishSet(files: Array<{ file: TFile }>): Set<string> {
    const set = new Set<string>();
    for (const { file } of files) {
      set.add(sanitizeSlug(file.basename));
    }
    return set;
  }

  /**
   * Detect all filename collisions before transforming. Returns an array
   * of collision groups, each with the sanitized filename and the source
   * paths that produce it. Empty array means all sanitized filenames are
   * unique. Groups are sorted by filename for stable output across runs.
   */
  private detectFilenameCollisions(
    files: Array<{ file: TFile }>,
  ): Array<{ filename: string; paths: string[] }> {
    const byFilename = new Map<string, string[]>();
    for (const { file } of files) {
      const sanitizedFilename = sanitizeFilename(file.name);
      const paths = byFilename.get(sanitizedFilename) ?? [];
      paths.push(file.path);
      byFilename.set(sanitizedFilename, paths);
    }
    const collisions: Array<{ filename: string; paths: string[] }> = [];
    for (const [filename, paths] of byFilename) {
      if (paths.length > 1) collisions.push({ filename, paths: paths.sort() });
    }
    return collisions.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  private filenameCollisionError(
    collisions: Array<{ filename: string; paths: string[] }>,
  ): string {
    const lines = collisions.map(
      (c) => `  ${c.paths.join(", ")} all publish as "${c.filename}"`,
    );
    return `Filename collision${collisions.length > 1 ? "s" : ""}:\n${lines.join("\n")}`;
  }

  private async resolveImages(
    imageNames: string[],
    filesByPathSuffix: Map<string, TFile[]>,
    readCache: Map<string, ArrayBuffer>,
    targetPathOwners: Map<string, string>,
  ): Promise<{
    entries: Array<{ path: string; content: ArrayBuffer }>;
    warnings: PublishWarning[];
  }> {
    const entries: Array<{ path: string; content: ArrayBuffer }> = [];
    const warnings: PublishWarning[] = [];
    const seen = new Set<string>();

    for (const imageName of imageNames) {
      if (seen.has(imageName)) continue;
      seen.add(imageName);

      const matches = filesByPathSuffix.get(imageName) ?? [];

      if (matches.length === 0) {
        console.warn(`Image not found in vault: ${imageName}`);
        warnings.push({ kind: "image-failed", name: imageName });
        continue;
      }

      if (matches.length > 1) {
        const paths = matches.map((f) => f.path).sort();
        console.warn(
          `Image basename collision for ${imageName}: ${paths.join(", ")}`,
        );
        warnings.push({ kind: "image-collision", name: imageName, paths });
        continue;
      }

      const sourceFile = matches[0];
      // The committed name comes from the file, not from the spelling the
      // author used: `![[pic.png]]` and `![[folder/pic.png]]` name one
      // image and must land on one target path, matching the URL the
      // transformer emits.
      const sanitizedName = sanitizeFilename(vaultBasename(imageName));
      const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
      // Owned by the resolved vault path, so two spellings of one file are
      // one image rather than a collision. A genuine collision is two
      // different files whose names sanitize to the same target.
      const owner = targetPathOwners.get(imgPath);
      if (owner !== undefined && owner !== sourceFile.path) {
        console.warn(
          `Image target path collision at ${imgPath}: ${owner}, ${sourceFile.path}`,
        );
        warnings.push({
          kind: "image-target-collision",
          targetPath: imgPath,
          sourceNames: [owner, sourceFile.path].sort(),
        });
        continue;
      }

      try {
        let imageContent = readCache.get(sourceFile.path);
        if (!imageContent) {
          imageContent = await this.vault.readBinary(sourceFile);
          readCache.set(sourceFile.path, imageContent);
        }
        targetPathOwners.set(imgPath, sourceFile.path);
        entries.push({ path: imgPath, content: imageContent });
      } catch (error) {
        // Deliberately not errorMessage(): this is a debug log, and
        // String(error) keeps a non-Error throw's value instead of
        // flattening it to "Unknown error".
        console.error(
          `Failed to read image ${imageName}: ${error instanceof Error ? error.message : String(error)}`,
        );
        warnings.push({ kind: "image-failed", name: imageName });
      }
    }

    return { entries, warnings };
  }

  /**
   * Publish a single note to GitHub: creates a feature branch, commits the
   * file to it, and opens a pull request against baseBranch.
   */
  async publishNote(file: TFile): Promise<PublishResult> {
    let content: string;
    try {
      content = await this.vault.read(file);
    } catch {
      return failedResult(file.path, "Failed to read file");
    }

    const { frontmatter, body, error: parseError } = splitFrontmatter(content);
    if (parseError) {
      return failedResult(file.path, parseError);
    }
    if (!hasPublishFlag(frontmatter)) {
      return failedResult(
        file.path,
        "File does not have 'status: publish' in frontmatter",
      );
    }
    // Frontmatter validation is prepareBatch's sole responsibility; the
    // parse and publish-flag checks above gate entry into the workflow.

    const result = await this.runPublishWorkflow({
      branchPrefix: "publish",
      readFailures: [],
      files: [{ file, frontmatter, body }],
      commitMessage: () => `Publish: ${file.basename}`,
      prTitle: () => `Publish: ${file.basename}`,
      prBody: () => `Published from Obsidian\n\n**File:** ${file.path}`,
    });

    const single =
      result.results[0] ??
      failedResult(file.path, result.error ?? "Unknown error");
    if (!single.success) {
      return single;
    }
    return {
      ...single,
      prUrl: result.prUrl,
      warnings: [...single.warnings, ...result.warnings],
    };
  }

  /**
   * Publish all notes with status: publish to a single branch and PR.
   */
  async publishAll(): Promise<BatchPublishResult> {
    const { files, readFailures } = await this.getPublishableFiles();
    if (files.length === 0) {
      return buildBatchResult(readFailures, {
        error: summarizeReadFailures(readFailures),
      });
    }

    const collisions = this.detectFilenameCollisions(files);
    if (collisions.length > 0) {
      const collisionError = this.filenameCollisionError(collisions);
      return buildBatchResult(
        [...readFailures, ...failedResults(files, collisionError)],
        { error: collisionError },
      );
    }

    return this.runPublishWorkflow({
      branchPrefix: "publish-batch",
      readFailures,
      files,
      commitMessage: (n) =>
        `Publish ${n} note${n !== 1 ? "s" : ""} from Obsidian`,
      prTitle: (succeeded) => `Batch Publish: ${succeeded.length} notes`,
      prBody: (succeeded) =>
        `Published ${succeeded.length} notes from Obsidian\n\n${succeeded
          .map((r) => `- ${r.filePath}`)
          .join("\n")}`,
    });
  }

  /**
   * Commit prepared files to the target branch. On failure, returns the
   * results with every successful entry marked failed plus the error
   * message; on success (or nothing to commit) returns them unchanged.
   */
  /** Commit, reporting only whether it landed. Turning that into publish
   * outcomes is `toResults`' job, not this one's. */
  private async commitPreparedBatch(
    branchName: string,
    fileEntries: FileEntry[],
    message: string,
  ): Promise<{ error?: unknown }> {
    if (fileEntries.length === 0) return {};
    try {
      await this.githubApiGateway.commitFiles(fileEntries, message, branchName);
      return {};
    } catch (error) {
      return { error };
    }
  }

  /**
   * Shared branch + commit + PR orchestration. Creates a branch first,
   * then prepares `opts.files` into the entries to commit. If branch
   * creation fails, per-file failures are synthesized from that same
   * list (so the user sees N failures, not just a bare error). On any
   * other failure the prepared notes are converted with the workflow
   * error, so a prepared success never reports as published. Callers
   * supply the branch prefix plus the commit-message and PR title/body
   * builders so single-note and batch paths share this workflow while
   * keeping their distinct PR shapes.
   */
  private async runPublishWorkflow(
    opts: WorkflowOpts,
  ): Promise<BatchPublishResult> {
    let branchName: string;
    try {
      branchName = await this.githubApiGateway.createBranchWithRetry(
        opts.branchPrefix,
        this.settings.baseBranch,
      );
    } catch (error) {
      return this.workflowFailure(opts, undefined, error);
    }

    // Left undefined until preparation completes, so `workflowFailure`
    // can tell "nothing was prepared" from "these notes prepared and then
    // the workflow failed" rather than inferring it from an empty array.
    let prepared: Prepared[] | undefined;
    try {
      prepared = await this.prepareBatch(opts.files);
      return await this.commitAndOpenPr(branchName, prepared, opts);
    } catch (error) {
      await this.cleanupBranch(branchName);
      return this.workflowFailure(opts, prepared, error);
    }
  }

  /**
   * Commit the prepared entries and open the PR. When nothing succeeded,
   * deletes the branch and returns without a PR.
   */
  private async commitAndOpenPr(
    branchName: string,
    prepared: Prepared[],
    opts: WorkflowOpts,
  ): Promise<BatchPublishResult> {
    const successCount = prepared.filter((p) => p.ok).length;
    const committed = await this.commitPreparedBatch(
      branchName,
      flattenEntries(prepared),
      opts.commitMessage(successCount),
    );

    const committedResults = toResults(
      prepared,
      committed.error === undefined
        ? undefined
        : { error: committed.error, prefix: "Commit failed" },
    );
    const succeeded = committedResults.filter((r) => r.success);
    const results = [...opts.readFailures, ...committedResults];

    if (succeeded.length === 0) {
      await this.cleanupBranch(branchName);
      return buildBatchResult(results, {
        error:
          committed.error === undefined
            ? undefined
            : errorMessage(committed.error),
      });
    }

    const pr = await this.githubApiGateway.createPullRequest(
      branchName,
      this.settings.baseBranch,
      opts.prTitle(succeeded),
      opts.prBody(succeeded),
      this.settings.prLabels,
    );
    return buildBatchResult(results, {
      prUrl: pr.url,
      warnings: pr.warnings,
    });
  }

  /**
   * Build the batch result for a workflow-level failure: synthesized
   * per-file failures when nothing was prepared yet, otherwise the
   * prepared results marked failed.
   */
  private workflowFailure(
    opts: WorkflowOpts,
    prepared: Prepared[] | undefined,
    error: unknown,
  ): BatchPublishResult {
    const message = errorMessage(error);
    // `undefined` means preparation never completed — branch creation
    // failed, or `prepareBatch` itself threw — so every file failed with
    // the workflow error. Otherwise the notes carry their own outcomes and
    // the workflow error overrides the successes among them.
    const failed =
      prepared === undefined
        ? failedResults(opts.files, message)
        : toResults(prepared, { error });
    return buildBatchResult([...opts.readFailures, ...failed], {
      error: message,
    });
  }

  /**
   * Validate settings before publishing
   */
  /**
   * Delegates to `validatePublish`, which owns the question.
   *
   * Kept as a method because `main.ts` already holds a `Publisher` at both
   * call sites and `main.test.ts` spies on it, but it states nothing of its
   * own: configuration validity belongs beside the settings type, its
   * defaults and its normalizers, not in the orchestrator (#318).
   */
  validateSettings(): string | null {
    return validatePublish(this.settings);
  }

  // === Private helpers ===

  /**
   * Scan the vault for files with status: publish, returning each with
   * its already-parsed frontmatter and body so callers don't re-parse.
   * Gate failures (status != publish) are silently skipped; validation
   * happens per-file in prepareBatch so invalid-but-intended publishes
   * surface as failed results. Read failures cannot be filtered by
   * publish intent (we never read the file), so they surface as failed
   * results — silent loss is the worse trade-off.
   */
  private async getPublishableFiles(): Promise<{
    files: PublishableFile[];
    readFailures: PublishResult[];
  }> {
    const markdownFiles = this.vault.getMarkdownFiles();
    const files: Array<{
      file: TFile;
      frontmatter: Frontmatter;
      body: string;
    }> = [];
    const readFailures: PublishResult[] = [];

    for (const file of markdownFiles) {
      // Cheap rejection first: a vault of thousands of notes should not be
      // read end to end to find the handful marked for publish.
      if (this.isDefinitelyNotPublishable(file)) continue;

      try {
        const content = await this.vault.read(file);
        const {
          frontmatter,
          body,
          error: parseError,
        } = splitFrontmatter(content);
        // A malformed frontmatter block hides publish intent — surface it
        // rather than silently skipping. We can't tell whether the user
        // meant status: publish when the YAML doesn't parse.
        if (parseError) {
          readFailures.push(failedResult(file.path, parseError));
          continue;
        }
        if (hasPublishFlag(frontmatter)) {
          files.push({ file, frontmatter, body });
        }
      } catch (error) {
        readFailures.push(
          failedResult(file.path, `Failed to read: ${errorMessage(error)}`),
        );
      }
    }

    return { files, readFailures };
  }

  /**
   * Prepare all files for a batch commit.
   *
   * Validates each file's frontmatter, transforms the body and resolves
   * its images. Returns one `Prepared` per note, each owning its own
   * entries — nothing here decides a publish outcome, because nothing
   * here has committed anything.
   *
   * The batch-scoped `imageReadCache` and `targetPathOwners` stay
   * batch-scoped on purpose: cross-note deduplication and collision
   * warnings are batch concerns, not per-note ones.
   */
  private async prepareBatch(files: PublishableFile[]): Promise<Prepared[]> {
    const prepared: Prepared[] = [];
    const filesByPathSuffix = this.buildFilesByPathSuffix();
    const publishSet = this.buildPublishSet(files);
    // Read each image source once per batch; multiple notes referencing
    // the same image share the buffer.
    const imageReadCache = new Map<string, ArrayBuffer>();
    // Target imgPath -> first imageName that claimed it. Surfaces silent
    // overwrites when different sources sanitize to the same target.
    const targetPathOwners = new Map<string, string>();

    for (const { file, frontmatter, body } of files) {
      try {
        const validationError = validateFrontmatter(frontmatter);
        if (validationError) {
          prepared.push({
            filePath: file.path,
            ok: false,
            error: validationError,
            warnings: [],
          });
        } else {
          const processed = this.noteTransformer.processFromSplit(
            frontmatter,
            body,
            file.name,
            publishSet,
          );

          const { entries: imageEntries, warnings } = await this.resolveImages(
            processed.images,
            filesByPathSuffix,
            imageReadCache,
            targetPathOwners,
          );

          // Built and attached together, after every await this note
          // needs. There is no window in which the note's content belongs
          // to the batch before the note does.
          prepared.push({
            filePath: file.path,
            ok: true,
            entries: [
              {
                path: `${this.settings.contentDir}/${processed.filename}`,
                content: processed.content,
              },
              ...imageEntries,
            ],
            warnings,
          });
        }
      } catch (error) {
        prepared.push({
          filePath: file.path,
          ok: false,
          error: errorMessage(error),
          warnings: [],
        });
      }

      this.onProgress?.(prepared.length, files.length);
    }

    return prepared;
  }
}
