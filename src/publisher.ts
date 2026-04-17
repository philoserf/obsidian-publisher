import type { TFile, Vault } from "obsidian";
import { ContentProcessor } from "./content-processor";
import { GitHubService } from "./github-service";
import {
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

  private markResultsFailed(results: PublishResult[], error: unknown): void {
    const message = errorMessage(error);
    for (const r of results) {
      if (r.success) {
        r.success = false;
        r.error = `Commit failed: ${message}`;
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
        console.error(`Failed to read image ${imageName}:`, error);
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
    const publishableFiles = await this.getPublishableFiles();
    if (publishableFiles.length === 0) {
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    const { results, fileEntries } = await this.prepareBatch(publishableFiles);
    let commitError: string | undefined;

    if (fileEntries.length > 0) {
      try {
        const successCount = results.filter((r) => r.success).length;
        await this.githubService.commitFiles(
          fileEntries,
          `Publish ${successCount} note${successCount !== 1 ? "s" : ""} from Obsidian`,
          this.baseBranch,
        );
      } catch (error) {
        this.markResultsFailed(results, error);
        commitError = errorMessage(error);
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return {
      total: results.length,
      successful,
      failed,
      results,
      error: commitError,
    };
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

    const { frontmatter } = splitFrontmatter(content);
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

      const result = await this.publishFileToTarget(file, branchName, content);

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

      return { ...result, prUrl: pr.url };
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
    const publishableFiles = await this.getPublishableFiles();
    if (publishableFiles.length === 0) {
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    let branchName: string | null = null;
    let results: PublishResult[] = [];

    try {
      branchName = await this.githubService.createBranchWithRetry(
        "publish-batch",
        this.baseBranch,
      );

      const prepared = await this.prepareBatch(publishableFiles);
      results = prepared.results;
      const { fileEntries } = prepared;
      let commitError: string | undefined;

      if (fileEntries.length > 0) {
        try {
          const successCount = results.filter((r) => r.success).length;
          await this.githubService.commitFiles(
            fileEntries,
            `Publish ${successCount} note${successCount !== 1 ? "s" : ""} from Obsidian`,
            branchName,
          );
        } catch (error) {
          this.markResultsFailed(results, error);
          commitError = errorMessage(error);
        }
      }

      const succeeded = results.filter((r) => r.success);
      const successful = succeeded.length;
      const failed = results.length - successful;

      if (successful === 0) {
        await this.cleanupBranch(branchName);
        return {
          total: results.length,
          successful: 0,
          failed,
          results,
          error: commitError,
        };
      }

      const prTitle = `Batch Publish: ${successful} notes`;
      const fileList = succeeded.map((r) => `- ${r.filePath}`).join("\n");
      const prBody = `Published ${successful} notes from Obsidian\n\n${fileList}`;

      const pr = await this.githubService.createPullRequest(
        branchName,
        this.baseBranch,
        prTitle,
        prBody,
        this.prLabels,
      );

      return {
        total: results.length,
        successful,
        failed,
        results,
        prUrl: pr.url,
      };
    } catch (error) {
      if (branchName) {
        await this.cleanupBranch(branchName);
      }
      const message = errorMessage(error);
      if (results.length === 0) {
        for (const { file } of publishableFiles) {
          results.push(failedResult(file.path, message));
        }
      } else {
        this.markResultsFailed(results, error);
      }
      return {
        total: results.length,
        successful: 0,
        failed: results.length,
        results,
        error: message,
      };
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
   * Publish a single file to a target branch (or default branch)
   */
  private async publishFileToTarget(
    file: TFile,
    branch?: string,
    prereadContent?: string,
  ): Promise<PublishResult> {
    try {
      const content = prereadContent ?? (await this.vault.read(file));

      const { frontmatter } = splitFrontmatter(content);
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

      const processed = this.contentProcessor.process(content, file.name);
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
   * Scan the vault for files with status: publish
   */
  private async getPublishableFiles(): Promise<
    Array<{ file: TFile; content: string }>
  > {
    const markdownFiles = this.vault.getMarkdownFiles();
    const publishableFiles: Array<{ file: TFile; content: string }> = [];

    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        if (hasPublishFlag(splitFrontmatter(content).frontmatter)) {
          publishableFiles.push({ file, content });
        }
      } catch (error) {
        console.error(`Failed to read file ${file.path}:`, error);
      }
    }

    return publishableFiles;
  }

  /**
   * Prepare all files for a batch commit.
   * Returns per-file results and collected file entries for commitFiles().
   */
  private async prepareBatch(
    files: Array<{ file: TFile; content: string }>,
  ): Promise<{
    results: PublishResult[];
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>;
  }> {
    const results: PublishResult[] = [];
    const entryMap = new Map<string, string | ArrayBuffer>();
    const filesByBasename = this.buildFilesByBasename();

    for (const { file, content } of files) {
      try {
        const processed = this.contentProcessor.process(content, file.name);

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
