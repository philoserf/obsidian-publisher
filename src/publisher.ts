import { Notice, type TFile, type Vault } from "obsidian";
import { ContentProcessor } from "./content-processor";
import { GitHubService } from "./github-service";
import type { BatchPublishResult, PublishResult, PublisherSettings } from "./types";

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

  /**
   * Publish a single note to GitHub
   */
  async publishNote(file: TFile): Promise<PublishResult> {
    try {
      // Read file content
      const content = await this.vault.read(file);

      // Check if file has publish: true in frontmatter
      if (!this.hasPublishFlag(content)) {
        return {
          filePath: file.path,
          success: false,
          error: "File does not have 'publish: true' in frontmatter",
        };
      }

      // Process content
      const processed = this.contentProcessor.process(content, file.name);

      // Upload images
      await this.uploadImages(processed.images);

      // Upload markdown file
      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const commitMessage = `Publish: ${file.basename}`;
      const url = await this.githubService.createOrUpdateFile(
        targetPath,
        processed.content,
        commitMessage,
      );

      return {
        filePath: file.path,
        success: true,
        url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        filePath: file.path,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Publish all notes with publish: true
   */
  async publishAll(): Promise<BatchPublishResult> {
    const markdownFiles = this.vault.getMarkdownFiles();
    const results: PublishResult[] = [];

    new Notice("Scanning vault for publishable notes...");

    // Filter files with publish: true
    const publishableFiles: TFile[] = [];
    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        if (this.hasPublishFlag(content)) {
          publishableFiles.push(file);
        }
      } catch (error) {
        console.error(`Failed to read file ${file.path}:`, error);
      }
    }

    if (publishableFiles.length === 0) {
      new Notice("No files with 'publish: true' found");
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }

    new Notice(`Publishing ${publishableFiles.length} notes...`);

    // Publish each file
    for (const file of publishableFiles) {
      const result = await this.publishNote(file);
      results.push(result);

      // Show progress
      const successCount = results.filter((r) => r.success).length;
      new Notice(
        `Progress: ${results.length}/${publishableFiles.length} (${successCount} successful)`,
      );
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Publish a single note to GitHub with branch and PR creation
   */
  async publishNoteWithPR(file: TFile): Promise<PublishResult & { prUrl?: string }> {
    let branchName: string | null = null;

    try {
      // Read file content
      const content = await this.vault.read(file);

      // Check if file has publish: true in frontmatter
      if (!this.hasPublishFlag(content)) {
        return {
          filePath: file.path,
          success: false,
          error: "File does not have 'publish: true' in frontmatter",
        };
      }

      // Generate and create branch
      branchName = await this.githubService.createBranchWithRetry(
        "publish",
        this.settings.baseBranch || "main",
      );

      // Process content
      const processed = this.contentProcessor.process(content, file.name);

      // Upload images to branch
      await this.uploadImages(processed.images, branchName);

      // Upload markdown file to branch
      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const commitMessage = `Publish: ${file.basename}`;
      await this.githubService.createOrUpdateFile(
        targetPath,
        processed.content,
        commitMessage,
        branchName,
      );

      // Create pull request
      const prTitle = `Publish: ${file.basename}`;
      const prBody = `Published from Obsidian\n\n**File:** ${file.path}\n**Images:** ${processed.images.length}`;
      const pr = await this.githubService.createPullRequest(
        branchName,
        this.settings.baseBranch || "main",
        prTitle,
        prBody,
        this.settings.prLabels || ["published-from-obsidian"],
      );

      return {
        filePath: file.path,
        success: true,
        prUrl: pr.url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        filePath: file.path,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Publish all notes with publish: true to a single branch and PR
   */
  async publishAllWithPR(): Promise<BatchPublishResult & { prUrl?: string }> {
    const markdownFiles = this.vault.getMarkdownFiles();
    const results: PublishResult[] = [];
    let branchName: string | null = null;

    new Notice("Scanning vault for publishable notes...");

    // Filter files with publish: true
    const publishableFiles: TFile[] = [];
    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        if (this.hasPublishFlag(content)) {
          publishableFiles.push(file);
        }
      } catch (error) {
        console.error(`Failed to read file ${file.path}:`, error);
      }
    }

    if (publishableFiles.length === 0) {
      new Notice("No files with 'publish: true' found");
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }

    new Notice(`Publishing ${publishableFiles.length} notes to branch...`);

    try {
      // Generate and create branch
      branchName = await this.githubService.createBranchWithRetry(
        "publish-batch",
        this.settings.baseBranch || "main",
      );

      // Publish each file to the branch
      for (const file of publishableFiles) {
        try {
          const content = await this.vault.read(file);
          const processed = this.contentProcessor.process(content, file.name);

          // Upload images to branch
          await this.uploadImages(processed.images, branchName);

          // Upload markdown file to branch
          const targetPath = `${this.settings.contentDir}/${processed.filename}`;
          const commitMessage = `Publish: ${file.basename}`;
          await this.githubService.createOrUpdateFile(
            targetPath,
            processed.content,
            commitMessage,
            branchName,
          );

          results.push({
            filePath: file.path,
            success: true,
          });

          // Show progress
          new Notice(`Progress: ${results.length}/${publishableFiles.length}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          results.push({
            filePath: file.path,
            success: false,
            error: message,
          });
        }
      }

      // Create pull request
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const prTitle = `Batch Publish: ${successful} notes`;
      const fileList = results
        .filter((r) => r.success)
        .map((r) => `- ${r.filePath}`)
        .join("\n");
      const prBody = `Published ${successful} notes from Obsidian\n\n${fileList}`;

      const pr = await this.githubService.createPullRequest(
        branchName,
        this.settings.baseBranch || "main",
        prTitle,
        prBody,
        this.settings.prLabels || ["published-from-obsidian"],
      );

      return {
        total: results.length,
        successful,
        failed,
        results,
        prUrl: pr.url,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to publish: ${message}`);

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        total: results.length,
        successful,
        failed,
        results,
      };
    }
  }

  /**
   * Upload images referenced in a note
   */
  private async uploadImages(imageNames: string[], branch?: string): Promise<void> {
    for (const imageName of imageNames) {
      try {
        // Find the image file in the vault
        const imageFile = this.vault.getFiles().find((f) => f.name === imageName);

        if (!imageFile) {
          console.warn(`Image not found in vault: ${imageName}`);
          continue;
        }

        // Read image content
        const imageContent = await this.vault.readBinary(imageFile);

        // Sanitize filename
        const sanitizedName = this.contentProcessor.sanitizeImageName(imageName);

        // Upload to GitHub
        await this.githubService.uploadImage(sanitizedName, imageContent, branch);
      } catch (error) {
        console.error(`Failed to upload image ${imageName}:`, error);
        // Don't throw - continue with other images
      }
    }
  }

  /**
   * Check if content has publish: true in frontmatter
   */
  private hasPublishFlag(content: string): boolean {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return false;
    }

    const frontmatter = match[1];
    // Simple check for publish: true (could be more robust)
    return /^publish:\s*true\s*$/m.test(frontmatter);
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
}
