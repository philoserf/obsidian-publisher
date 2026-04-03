import { Notice, type TFile, type Vault } from "obsidian";
import { ContentProcessor } from "./content-processor";
import { GitHubService } from "./github-service";
import type {
  BatchPublishResult,
  PublisherSettings,
  PublishResult,
} from "./types";

export class Publisher {
  private vault: Vault;
  private settings: PublisherSettings;
  private contentProcessor: ContentProcessor;
  private githubService: GitHubService;

  constructor(vault: Vault, settings: PublisherSettings) {
    this.vault = vault;
    this.settings = settings;
    this.contentProcessor = new ContentProcessor(settings);
    this.githubService = new GitHubService(settings);
  }

  private get baseBranch(): string {
    return this.settings.baseBranch || "main";
  }

  private get prLabels(): string[] {
    return this.settings.prLabels || ["chore"];
  }

  private markResultsFailed(results: PublishResult[], error: unknown): void {
    const message = error instanceof Error ? error.message : "Unknown error";
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

  private async resolveImages(
    imageNames: string[],
    filesByName: Map<string, TFile>,
  ): Promise<{
    entries: Array<{ path: string; content: ArrayBuffer }>;
    failedImages: string[];
  }> {
    const entries: Array<{ path: string; content: ArrayBuffer }> = [];
    const failedImages: string[] = [];

    for (const imageName of imageNames) {
      const imageFile = filesByName.get(imageName);
      if (!imageFile) {
        console.warn(`Image not found in vault: ${imageName}`);
        failedImages.push(imageName);
        continue;
      }
      try {
        const imageContent = await this.vault.readBinary(imageFile);
        const sanitizedName =
          this.contentProcessor.sanitizeImageName(imageName);
        const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
        entries.push({ path: imgPath, content: imageContent });
      } catch (error) {
        console.error(`Failed to read image ${imageName}:`, error);
        failedImages.push(imageName);
      }
    }

    return { entries, failedImages };
  }

  /**
   * Publish a single note to GitHub (direct commit)
   */
  async publishNote(file: TFile): Promise<PublishResult> {
    return this.publishFileToTarget(file);
  }

  /**
   * Publish all notes with status: published (direct commit)
   */
  async publishAll(): Promise<BatchPublishResult> {
    const publishableFiles = await this.getPublishableFiles();
    if (publishableFiles.length === 0) {
      new Notice("No files with 'status: published' found");
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    new Notice(`Publishing ${publishableFiles.length} notes...`);
    const { results, fileEntries } = await this.prepareBatch(publishableFiles);

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
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    return { total: results.length, successful, failed, results };
  }

  /**
   * Publish a single note to GitHub with branch and PR creation
   */
  async publishNoteWithPR(
    file: TFile,
  ): Promise<PublishResult & { prUrl?: string }> {
    let content: string;
    try {
      content = await this.vault.read(file);
    } catch {
      return {
        filePath: file.path,
        success: false,
        error: "Failed to read file",
      };
    }

    if (!this.hasPublishFlag(content)) {
      return {
        filePath: file.path,
        success: false,
        error: "File does not have 'status: published' in frontmatter",
      };
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
      const message = error instanceof Error ? error.message : "Unknown error";
      return { filePath: file.path, success: false, error: message };
    }
  }

  /**
   * Publish all notes with status: published to a single branch and PR
   */
  async publishAllWithPR(): Promise<BatchPublishResult & { prUrl?: string }> {
    const publishableFiles = await this.getPublishableFiles();
    if (publishableFiles.length === 0) {
      new Notice("No files with 'status: published' found");
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    new Notice(`Publishing ${publishableFiles.length} notes to branch...`);
    let branchName: string | null = null;

    try {
      branchName = await this.githubService.createBranchWithRetry(
        "publish-batch",
        this.baseBranch,
      );

      const { results, fileEntries } =
        await this.prepareBatch(publishableFiles);

      if (fileEntries.length > 0) {
        try {
          const successCount = results.filter((r) => r.success).length;
          await this.githubService.commitFiles(
            fileEntries,
            `Publish ${successCount} note${successCount !== 1 ? "s" : ""} from Obsidian`,
            branchName,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          for (const r of results) {
            if (r.success) {
              r.success = false;
              r.error = `Commit failed: ${message}`;
            }
          }
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (successful === 0) {
        await this.cleanupBranch(branchName);
        new Notice("All files failed to process. No PR created.");
        return { total: results.length, successful: 0, failed, results };
      }

      const prTitle = `Batch Publish: ${successful} notes`;
      const fileList = results
        .filter((r) => r.success)
        .map((r) => `- ${r.filePath}`)
        .join("\n");
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
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to publish: ${message}`);
      return { total: 0, successful: 0, failed: 0, results: [] };
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

      if (!this.hasPublishFlag(content)) {
        return {
          filePath: file.path,
          success: false,
          error: "File does not have 'status: published' in frontmatter",
        };
      }

      const processed = this.contentProcessor.process(content, file.name);
      const targetBranch = branch ?? this.baseBranch;

      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const filesByName = new Map(
        this.vault.getFiles().map((f) => [f.name, f]),
      );
      const { entries: imageEntries, failedImages } = await this.resolveImages(
        processed.images,
        filesByName,
      );

      if (failedImages.length > 0) {
        new Notice(
          `Warning: ${failedImages.length} image(s) failed: ${failedImages.join(", ")}`,
        );
      }

      const fileEntries: Array<{
        path: string;
        content: string | ArrayBuffer;
      }> = [{ path: targetPath, content: processed.content }, ...imageEntries];

      await this.githubService.commitFiles(
        fileEntries,
        `Publish: ${file.basename}`,
        targetBranch,
      );

      return { filePath: file.path, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { filePath: file.path, success: false, error: message };
    }
  }

  /**
   * Scan the vault for files with status: published
   */
  private async getPublishableFiles(): Promise<
    Array<{ file: TFile; content: string }>
  > {
    const markdownFiles = this.vault.getMarkdownFiles();
    const publishableFiles: Array<{ file: TFile; content: string }> = [];

    new Notice("Scanning vault for publishable notes...");

    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        if (this.hasPublishFlag(content)) {
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
    const allFailedImages: string[] = [];
    const filesByName = new Map(this.vault.getFiles().map((f) => [f.name, f]));

    for (const { file, content } of files) {
      try {
        const processed = this.contentProcessor.process(content, file.name);

        const targetPath = `${this.settings.contentDir}/${processed.filename}`;
        entryMap.set(targetPath, processed.content);

        const { entries: imageEntries, failedImages } =
          await this.resolveImages(processed.images, filesByName);
        for (const entry of imageEntries) {
          entryMap.set(entry.path, entry.content);
        }
        allFailedImages.push(...failedImages);

        results.push({ filePath: file.path, success: true });
        new Notice(`Prepared: ${results.length}/${files.length}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          filePath: file.path,
          success: false,
          error: message,
        });
      }
    }

    if (allFailedImages.length > 0) {
      const unique = [...new Set(allFailedImages)];
      new Notice(
        `Warning: ${unique.length} image(s) failed: ${unique.join(", ")}`,
      );
    }

    const fileEntries = Array.from(entryMap.entries()).map(
      ([path, content]) => ({ path, content }),
    );
    return { results, fileEntries };
  }

  /**
   * Check if content has status: published in frontmatter
   */
  private hasPublishFlag(content: string): boolean {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return false;
    }

    const frontmatter = match[1];
    return /^status:\s*published\s*$/m.test(frontmatter);
  }
}
