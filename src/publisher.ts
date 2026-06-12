import type { TFile, Vault } from "obsidian";
import { ContentProcessor } from "./content-processor";
import { GitHubService } from "./github-service";
import {
  type Frontmatter,
  hasPublishFlag,
  splitFrontmatter,
  validateFrontmatter,
} from "./schema";
import {
  type BatchPublishResult,
  errorMessage,
  type PublisherSettings,
  type PublishResult,
  type PublishWarning,
} from "./types";

type ProgressCallback = (done: number, total: number) => void;

function failedResult(filePath: string, error: string): PublishResult {
  return { filePath, success: false, error, warnings: [] };
}

/**
 * Return a copy of results with every successful entry converted to a
 * failed one carrying the given error. Failures keep their original error.
 */
function markResultsFailed(
  results: PublishResult[],
  error: unknown,
  prefix?: string,
): PublishResult[] {
  const message = errorMessage(error);
  const formatted = prefix ? `${prefix}: ${message}` : message;
  return results.map((r) =>
    r.success
      ? {
          filePath: r.filePath,
          success: false,
          error: formatted,
          warnings: r.warnings,
        }
      : r,
  );
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
  private contentProcessor: ContentProcessor;
  private githubService: GitHubService;
  private onProgress?: ProgressCallback;

  constructor(
    vault: Vault,
    settings: PublisherSettings,
    onProgress?: ProgressCallback,
  ) {
    this.vault = vault;
    this.settings = settings;
    this.contentProcessor = new ContentProcessor(settings);
    this.githubService = new GitHubService(settings);
    this.onProgress = onProgress;
  }

  private get baseBranch(): string {
    return this.settings.baseBranch;
  }

  private get prLabels(): string[] {
    return this.settings.prLabels;
  }

  private async cleanupBranch(branchName: string): Promise<void> {
    try {
      await this.githubService.deleteBranch(branchName);
    } catch (error) {
      // Best-effort; don't mask the original publish error.
      console.warn(
        `Failed to clean up branch ${branchName}:`,
        errorMessage(error),
      );
    }
  }

  private buildFilesByBasename(): Map<string, TFile[]> {
    const map = new Map<string, TFile[]>();
    for (const f of this.vault.getFiles()) {
      const existing = map.get(f.name);
      if (existing) existing.push(f);
      else map.set(f.name, [f]);
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
      set.add(this.contentProcessor.sanitizeSlug(file.basename));
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
      const sanitizedFilename = this.contentProcessor.sanitizeFilename(
        file.name,
      );
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

  /**
   * Synthesize a failed PublishResult for each file so the batch's
   * total count reflects attempted publishes. Without this, a
   * collision-only failure (no read failures) produces total=0,
   * which main.ts's "No publishable notes found" guard swallows.
   */
  private synthesizeCollisionFailures(
    files: Array<{ file: TFile }>,
    error: string,
  ): PublishResult[] {
    return files.map(({ file }) => ({
      filePath: file.path,
      success: false,
      error,
      warnings: [],
    }));
  }

  private async resolveImages(
    imageNames: string[],
    filesByBasename: Map<string, TFile[]>,
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

      const matches = filesByBasename.get(imageName) ?? [];

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

      const sanitizedName = this.contentProcessor.sanitizeFilename(imageName);
      const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
      const owner = targetPathOwners.get(imgPath);
      if (owner !== undefined && owner !== imageName) {
        console.warn(
          `Image target path collision at ${imgPath}: ${owner}, ${imageName}`,
        );
        warnings.push({
          kind: "image-target-collision",
          targetPath: imgPath,
          sourceNames: [owner, imageName].sort(),
        });
        continue;
      }

      try {
        const sourceFile = matches[0];
        let imageContent = readCache.get(sourceFile.path);
        if (!imageContent) {
          imageContent = await this.vault.readBinary(sourceFile);
          readCache.set(sourceFile.path, imageContent);
        }
        targetPathOwners.set(imgPath, imageName);
        entries.push({ path: imgPath, content: imageContent });
      } catch (error) {
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
      prepare: async () => {
        const batch = await this.prepareBatch([{ file, frontmatter, body }]);
        return { prepared: batch.results, fileEntries: batch.fileEntries };
      },
      synthesizeFailures: (message) => [failedResult(file.path, message)],
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
      const collisionFailures = this.synthesizeCollisionFailures(
        files,
        collisionError,
      );
      return buildBatchResult([...readFailures, ...collisionFailures], {
        error: collisionError,
      });
    }

    return this.runPublishWorkflow({
      branchPrefix: "publish-batch",
      readFailures,
      prepare: async () => {
        const batch = await this.prepareBatch(files);
        return { prepared: batch.results, fileEntries: batch.fileEntries };
      },
      synthesizeFailures: (message) =>
        files.map(({ file }) => failedResult(file.path, message)),
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
  private async commitPreparedBatch(
    branchName: string,
    results: PublishResult[],
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>,
    message: string,
  ): Promise<{ results: PublishResult[]; error?: string }> {
    if (fileEntries.length === 0) return { results };
    try {
      await this.githubService.commitFiles(fileEntries, message, branchName);
      return { results };
    } catch (error) {
      return {
        results: markResultsFailed(results, error, "Commit failed"),
        error: errorMessage(error),
      };
    }
  }

  /**
   * Shared branch + commit + PR orchestration. Creates a branch first,
   * then calls the caller's `prepare` closure to produce the entries to
   * commit. If branch creation fails, `synthesizeFailures` is used to
   * build per-file failed results (so the user sees N failures, not just
   * a bare error). On any other failure, the prepared results are marked
   * failed. Callers supply the branch prefix plus the commit-message and
   * PR title/body builders so single-note and batch paths share this
   * workflow while keeping their distinct PR shapes.
   */
  private async runPublishWorkflow(opts: {
    branchPrefix: string;
    readFailures: PublishResult[];
    prepare: () => Promise<{
      prepared: PublishResult[];
      fileEntries: Array<{ path: string; content: string | ArrayBuffer }>;
    }>;
    synthesizeFailures: (message: string) => PublishResult[];
    commitMessage: (successCount: number) => string;
    prTitle: (succeeded: PublishResult[]) => string;
    prBody: (succeeded: PublishResult[]) => string;
  }): Promise<BatchPublishResult> {
    let branchName: string;
    try {
      branchName = await this.githubService.createBranchWithRetry(
        opts.branchPrefix,
        this.baseBranch,
      );
    } catch (error) {
      const message = errorMessage(error);
      return buildBatchResult(
        [...opts.readFailures, ...opts.synthesizeFailures(message)],
        { error: message },
      );
    }

    let prepared: PublishResult[] = [];
    try {
      const batch = await opts.prepare();
      prepared = batch.prepared;

      const successCount = prepared.filter((r) => r.success).length;
      const committed = await this.commitPreparedBatch(
        branchName,
        prepared,
        batch.fileEntries,
        opts.commitMessage(successCount),
      );

      const succeeded = committed.results.filter((r) => r.success);
      const results = [...opts.readFailures, ...committed.results];

      if (succeeded.length === 0) {
        await this.cleanupBranch(branchName);
        return buildBatchResult(results, { error: committed.error });
      }

      const pr = await this.githubService.createPullRequest(
        branchName,
        this.baseBranch,
        opts.prTitle(succeeded),
        opts.prBody(succeeded),
        this.prLabels,
      );
      return buildBatchResult(results, {
        prUrl: pr.url,
        warnings: pr.warnings,
      });
    } catch (error) {
      await this.cleanupBranch(branchName);
      const message = errorMessage(error);
      const failed =
        prepared.length === 0
          ? opts.synthesizeFailures(message)
          : markResultsFailed(prepared, error);
      return buildBatchResult([...opts.readFailures, ...failed], {
        error: message,
      });
    }
  }

  /**
   * Validate settings before publishing
   */
  validateSettings(): string | null {
    if (!this.settings.githubToken) {
      return "GitHub token is not configured";
    }
    if (!this.settings.repoOwner || !this.settings.repoName) {
      return "Repository owner and name must be configured";
    }
    if (!this.settings.contentDir) {
      return "Content directory must be configured";
    }
    if (!this.settings.imageDir) {
      return "Image directory must be configured";
    }
    return null;
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
    files: Array<{ file: TFile; frontmatter: Frontmatter; body: string }>;
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
   * Validates each file's frontmatter; invalid files become failed
   * results. Returns per-file results and collected file entries for
   * commitFiles().
   */
  private async prepareBatch(
    files: Array<{ file: TFile; frontmatter: Frontmatter; body: string }>,
  ): Promise<{
    results: PublishResult[];
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>;
  }> {
    const results: PublishResult[] = [];
    const entryMap = new Map<string, string | ArrayBuffer>();
    const filesByBasename = this.buildFilesByBasename();
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
          results.push(failedResult(file.path, validationError));
        } else {
          const processed = this.contentProcessor.processFromSplit(
            frontmatter,
            body,
            file.name,
            publishSet,
          );

          const targetPath = `${this.settings.contentDir}/${processed.filename}`;
          entryMap.set(targetPath, processed.content);

          const { entries: imageEntries, warnings } = await this.resolveImages(
            processed.images,
            filesByBasename,
            imageReadCache,
            targetPathOwners,
          );
          for (const entry of imageEntries) {
            entryMap.set(entry.path, entry.content);
          }

          results.push({ filePath: file.path, success: true, warnings });
        }
      } catch (error) {
        results.push(failedResult(file.path, errorMessage(error)));
      }

      this.onProgress?.(results.length, files.length);
    }

    const fileEntries = Array.from(entryMap.entries()).map(
      ([path, content]) => ({ path, content }),
    );
    return { results, fileEntries };
  }
}
