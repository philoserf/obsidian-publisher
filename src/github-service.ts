import { Octokit } from "@octokit/rest";
import type { PublisherSettings } from "./types";

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
   * Get the SHA of an existing file (needed for updates)
   * Returns null if file doesn't exist
   */
  async getFileSha(path: string, branch?: string): Promise<string | null> {
    try {
      const params: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      } = {
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        path,
      };

      if (branch) {
        params.ref = branch;
      }

      const response = await this.octokit.repos.getContent(params);

      // GitHub API returns an array for directories, object for files
      if (Array.isArray(response.data)) {
        return null;
      }

      return "sha" in response.data ? response.data.sha : null;
    } catch (error) {
      // 404 means file doesn't exist, which is fine
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a file in the repository
   */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch?: string,
  ): Promise<string> {
    const existingSha = await this.getFileSha(path, branch);

    try {
      const params: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        content: string;
        sha?: string;
        branch?: string;
      } = {
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        path,
        message,
        content: this.stringToBase64(content),
        sha: existingSha || undefined,
      };

      if (branch) {
        params.branch = branch;
      }

      const response =
        await this.octokit.repos.createOrUpdateFileContents(params);

      // Return the HTML URL to the file
      return response.data.content?.html_url || "";
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload file ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Upload an image file to the repository
   */
  async uploadImage(
    filename: string,
    content: ArrayBuffer,
    branch?: string,
  ): Promise<string> {
    const path = `${this.settings.imageDir}/${filename}`;
    const base64Content = this.arrayBufferToBase64(content);
    const existingSha = await this.getFileSha(path, branch);

    try {
      const params: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        content: string;
        sha?: string;
        branch?: string;
      } = {
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        path,
        message: `Upload image: ${filename}`,
        content: base64Content,
        sha: existingSha || undefined,
      };

      if (branch) {
        params.branch = branch;
      }

      const response =
        await this.octokit.repos.createOrUpdateFileContents(params);

      return response.data.content?.html_url || "";
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload image ${filename}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Convert string to base64 (cross-platform)
   */
  private stringToBase64(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
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
      if (error instanceof Error) {
        throw new Error(
          `Failed to create branch ${branchName}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Create a pull request
   * Returns the PR URL and PR number
   */
  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string,
    labels?: string[],
  ): Promise<{ url: string; number: number }> {
    try {
      const response = await this.octokit.rest.pulls.create({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        title,
        head,
        base,
        body,
      });

      // Add labels if provided
      if (labels && labels.length > 0) {
        await this.octokit.rest.issues.addLabels({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          issue_number: response.data.number,
          labels,
        });
      }

      return {
        url: response.data.html_url,
        number: response.data.number,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create pull request: ${error.message}`);
      }
      throw error;
    }
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
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 422
        ) {
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
