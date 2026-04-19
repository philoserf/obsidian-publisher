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

export type ProgressCallback = (done: number, total: number) => void;

function failedResult(filePath: string, error: string): PublishResult {
  return { filePath, success: false, error, warnings: [] };
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
    return this.settings.baseBranch || "main";
  }

  private get prLabels(): string[] {
    return this.settings.prLabels || ["chore"];
  }

  private markResultsFailed(
    results: PublishResult[],
    error: unknown,
    prefix?: string,
  ): void {
    const message = errorMessage(error);
    const formatted = prefix ? `${prefix}: ${message}` : message;
    for (const r of results) {
      if (r.success) {
        r.success = false;
        r.error = formatted;
      }
    }
  }

  private async cleanupBranch(branchName: string): Promise<void> {
    try {
      await this.githubService.deleteBranch(branchName);
    } catch {
      // Best-effort cleanup
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
   * Detect all slug collisions before transforming. Returns an array of
   * collision groups, each with the sanitized filename and the source
   * paths that produce it. Empty array means all sanitized filenames are
   * unique. Groups are sorted by slug for stable output across runs.
   */
  private detectSlugCollisions(
    files: Array<{ file: TFile }>,
  ): Array<{ slug: string; paths: string[] }> {
    const byFilename = new Map<string, string[]>();
    for (const { file } of files) {
      const sanitized = this.contentProcessor.sanitizeFilename(file.name);
      const paths = byFilename.get(sanitized) ?? [];
      paths.push(file.path);
      byFilename.set(sanitized, paths);
    }
    const collisions: Array<{ slug: string; paths: string[] }> = [];
    for (const [slug, paths] of byFilename) {
      if (paths.length > 1) collisions.push({ slug, paths: paths.sort() });
    }
    return collisions.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  private slugCollisionError(
    collisions: Array<{ slug: string; paths: string[] }>,
  ): string {
    const lines = collisions.map(
      (c) => `  ${c.paths.join(", ")} all publish as "${c.slug}"`,
    );
    return `Slug collision${collisions.length > 1 ? "s" : ""}:\n${lines.join("\n")}`;
  }

  private async resolveImages(
    imageNames: string[],
    filesByBasename: Map<string, TFile[]>,
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

      try {
        const imageContent = await this.vault.readBinary(matches[0]);
        const sanitizedName =
          this.contentProcessor.sanitizeImageName(imageName);
        const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
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
   * Publish a single note to GitHub (direct commit)
   */
  async publishNote(file: TFile): Promise<PublishResult> {
    return this.publishFileToTarget(file);
  }

  /**
   * Publish all notes with status: publish (direct commit)
   */
  async publishAll(): Promise<BatchPublishResult> {
    const { files, readFailures } = await this.getPublishableFiles();
    const collisions = this.detectSlugCollisions(files);
    if (collisions.length > 0) {
      return buildBatchResult(readFailures, {
        error: this.slugCollisionError(collisions),
      });
    }
    const { results: prepared, fileEntries } = await this.prepareBatch(files);
    let commitError: string | undefined;

    if (fileEntries.length > 0) {
      try {
        const successCount = prepared.filter((r) => r.success).length;
        await this.githubService.commitFiles(
          fileEntries,
          `Publish ${successCount} note${successCount !== 1 ? "s" : ""} from Obsidian`,
          this.baseBranch,
        );
      } catch (error) {
        this.markResultsFailed(prepared, error);
        commitError = errorMessage(error);
      }
    }

    const error =
      commitError ??
      (prepared.length === 0 ? summarizeReadFailures(readFailures) : undefined);
    return buildBatchResult([...readFailures, ...prepared], { error });
  }

  /**
   * Publish a single note to GitHub with branch and PR creation
   */
  async publishNoteWithPR(file: TFile): Promise<PublishResult> {
    let content: string;
    try {
      content = await this.vault.read(file);
    } catch {
      return failedResult(file.path, "Failed to read file");
    }

    const { frontmatter, body } = splitFrontmatter(content);
    if (!hasPublishFlag(frontmatter)) {
      return failedResult(
        file.path,
        "File does not have 'status: publish' in frontmatter",
      );
    }
    const validationError = validateFrontmatter(frontmatter);
    if (validationError) {
      return failedResult(file.path, validationError);
    }

    let branchName: string | null = null;

    try {
      branchName = await this.githubService.createBranchWithRetry(
        "publish",
        this.baseBranch,
      );

      const result = await this.publishFileToTarget(file, branchName, {
        frontmatter,
        body,
      });

      if (!result.success) {
        await this.cleanupBranch(branchName);
        return result;
      }

      const prTitle = `Publish: ${file.basename}`;
      const prBody = `Published from Obsidian\n\n**File:** ${file.path}`;
      const pr = await this.githubService.createPullRequest(
        branchName,
        this.baseBranch,
        prTitle,
        prBody,
        this.prLabels,
      );

      return {
        ...result,
        prUrl: pr.url,
        warnings: [...result.warnings, ...pr.warnings],
      };
    } catch (error) {
      if (branchName) {
        await this.cleanupBranch(branchName);
      }
      return failedResult(file.path, errorMessage(error));
    }
  }

  /**
   * Publish all notes with status: publish to a single branch and PR
   */
  async publishAllWithPR(): Promise<BatchPublishResult> {
    const { files, readFailures } = await this.getPublishableFiles();
    if (files.length === 0) {
      return buildBatchResult(readFailures, {
        error: summarizeReadFailures(readFailures),
      });
    }

    const collisions = this.detectSlugCollisions(files);
    if (collisions.length > 0) {
      return buildBatchResult(readFailures, {
        error: this.slugCollisionError(collisions),
      });
    }

    let branchName: string | null = null;
    let prepared: PublishResult[] = [];

    try {
      branchName = await this.githubService.createBranchWithRetry(
        "publish-batch",
        this.baseBranch,
      );

      const batch = await this.prepareBatch(files);
      prepared = batch.results;

      const commitError = await this.commitPreparedBatch(
        branchName,
        prepared,
        batch.fileEntries,
      );

      const succeeded = prepared.filter((r) => r.success);
      const results = [...readFailures, ...prepared];

      if (succeeded.length === 0) {
        await this.cleanupBranch(branchName);
        return buildBatchResult(results, { error: commitError });
      }

      const pr = await this.createBatchPR(branchName, succeeded);
      return buildBatchResult(results, {
        prUrl: pr.url,
        warnings: pr.warnings,
      });
    } catch (error) {
      return this.recoverFailedBatch(
        files,
        prepared,
        readFailures,
        branchName,
        error,
      );
    }
  }

  /**
   * Commit prepared files to the target branch. On failure, marks any
   * successful per-file results as failed and returns the error message;
   * returns undefined on success or when there is nothing to commit.
   */
  private async commitPreparedBatch(
    branchName: string,
    results: PublishResult[],
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>,
  ): Promise<string | undefined> {
    if (fileEntries.length === 0) return undefined;
    try {
      const successCount = results.filter((r) => r.success).length;
      await this.githubService.commitFiles(
        fileEntries,
        `Publish ${successCount} note${successCount !== 1 ? "s" : ""} from Obsidian`,
        branchName,
      );
      return undefined;
    } catch (error) {
      this.markResultsFailed(results, error, "Commit failed");
      return errorMessage(error);
    }
  }

  /**
   * Build and create the batch PR listing the succeeded file paths.
   */
  private async createBatchPR(
    branchName: string,
    succeeded: PublishResult[],
  ): Promise<{ url: string; number: number; warnings: PublishWarning[] }> {
    const successful = succeeded.length;
    const prTitle = `Batch Publish: ${successful} notes`;
    const fileList = succeeded.map((r) => `- ${r.filePath}`).join("\n");
    const prBody = `Published ${successful} notes from Obsidian\n\n${fileList}`;
    return this.githubService.createPullRequest(
      branchName,
      this.baseBranch,
      prTitle,
      prBody,
      this.prLabels,
    );
  }

  /**
   * Recover from the outer catch: clean up the branch, then either
   * synthesize failed results (when none were produced yet) or mark
   * existing results failed. Returns a fully-populated batch result.
   */
  private async recoverFailedBatch(
    files: Array<{
      file: TFile;
      frontmatter: Frontmatter;
      body: string;
    }>,
    prepared: PublishResult[],
    readFailures: PublishResult[],
    branchName: string | null,
    error: unknown,
  ): Promise<BatchPublishResult> {
    if (branchName) {
      await this.cleanupBranch(branchName);
    }
    const message = errorMessage(error);
    if (prepared.length === 0) {
      for (const { file } of files) {
        prepared.push(failedResult(file.path, message));
      }
    } else {
      this.markResultsFailed(prepared, error);
    }
    return buildBatchResult([...readFailures, ...prepared], { error: message });
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
   * Publish a single file to a target branch (or default branch).
   * If `preparsed` is supplied, the caller has already parsed and
   * validated the frontmatter — we skip the re-parse and gate/validate.
   */
  private async publishFileToTarget(
    file: TFile,
    branch?: string,
    preparsed?: { frontmatter: Frontmatter; body: string },
  ): Promise<PublishResult> {
    try {
      let frontmatter: Frontmatter;
      let body: string;

      if (preparsed) {
        ({ frontmatter, body } = preparsed);
      } else {
        const content = await this.vault.read(file);
        const split = splitFrontmatter(content);
        frontmatter = split.frontmatter;
        body = split.body;

        if (!hasPublishFlag(frontmatter)) {
          return failedResult(
            file.path,
            "File does not have 'status: publish' in frontmatter",
          );
        }
        const validationError = validateFrontmatter(frontmatter);
        if (validationError) {
          return failedResult(file.path, validationError);
        }
      }

      const publishSet = new Set([
        this.contentProcessor.sanitizeSlug(file.basename),
      ]);
      const processed = this.contentProcessor.processFromSplit(
        frontmatter,
        body,
        file.name,
        publishSet,
      );
      const targetBranch = branch ?? this.baseBranch;

      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const { entries: imageEntries, warnings } = await this.resolveImages(
        processed.images,
        this.buildFilesByBasename(),
      );

      const fileEntries: Array<{
        path: string;
        content: string | ArrayBuffer;
      }> = [{ path: targetPath, content: processed.content }, ...imageEntries];

      await this.githubService.commitFiles(
        fileEntries,
        `Publish: ${file.basename}`,
        targetBranch,
      );

      return { filePath: file.path, success: true, warnings };
    } catch (error) {
      return failedResult(file.path, errorMessage(error));
    }
  }

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
        const { frontmatter, body } = splitFrontmatter(content);
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
