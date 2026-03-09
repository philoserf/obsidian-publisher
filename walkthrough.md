# Obsidian Publisher — Code Walkthrough

*2026-03-09T04:15:34Z by Showboat 0.6.1*
<!-- showboat-id: e82cad1f-9213-4480-88dd-de73566bbab8 -->

## Overview

Obsidian Publisher is an Obsidian plugin that publishes notes to a GitHub repository for Hugo static site processing. It converts Obsidian-flavored markdown (wikilinks, embedded images) into Hugo-compatible formats, uploads images, and commits everything via the GitHub REST API.

**Key design constraint:** All GitHub operations use the REST API through Octokit — no local Git commands. This allows the plugin to work on iOS where Obsidian has no shell access.

### Architecture

    User triggers command
      → main.ts (plugin entry, command routing, settings migration)
        → publisher.ts (orchestration: single/batch, direct/PR workflows)
          → content-processor.ts (wikilinks, images, frontmatter, filename sanitization)
          → github-service.ts (Octokit wrapper: Contents API, Git Trees API, PRs, branches)

### Source Files

| File | Lines | Role |
|------|-------|------|
| `src/types.ts` | 88 | Type definitions and defaults |
| `src/main.ts` | 185 | Plugin entry point |
| `src/settings.ts` | 258 | Settings UI tab |
| `src/content-processor.ts` | 213 | Markdown transformation |
| `src/publisher.ts` | 403 | Publishing orchestration |
| `src/github-service.ts` | 407 | GitHub API operations |
| `build.ts` | 19 | Bun bundler config |
| `version-bump.ts` | 48 | Version management script |

Let's walk through the code in the order it executes.

---

## 1. Types and Defaults (`src/types.ts`)

Everything starts with the type system. This file defines the shapes that flow through every other module.

```bash
sed -n '1,41p' src/types.ts
```

```output
/**
 * Plugin settings interface
 */
export interface PublisherSettings {
  /** GitHub personal access token */
  githubToken: string;
  /** Repository owner (username or organization) */
  repoOwner: string;
  /** Repository name */
  repoName: string;
  /** Content directory path in the Hugo repository (e.g., "content/posts") */
  contentDir: string;
  /** Image directory path in the Hugo repository (e.g., "static/images") */
  imageDir: string;
  /** Additional frontmatter fields to inject during publishing */
  frontmatterTemplate: Record<string, unknown>;
  /** Whether to remove the status: published field from frontmatter */
  removePublishFlag: boolean;
  /** Base branch to create PRs against (default: "main") */
  baseBranch: string;
  /** Labels to apply to pull requests */
  prLabels: string[];
  /** Whether to use branch/PR workflow (vs direct commit) */
  usePullRequests: boolean;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: PublisherSettings = {
  githubToken: "",
  repoOwner: "",
  repoName: "",
  contentDir: "content/posts",
  imageDir: "static/images",
  frontmatterTemplate: {},
  removePublishFlag: false,
  baseBranch: "main",
  prLabels: ["published-from-obsidian"],
  usePullRequests: true,
};
```

`PublisherSettings` is the single configuration object — GitHub credentials, repo coordinates, Hugo directory paths, and workflow preferences. The defaults assume Hugo conventions (`content/posts`, `static/images`) and the PR workflow.

Note: `usePullRequests` defaults to `true` for new installs but gets migrated to `false` for existing users (handled in `main.ts`).

The result types track what happened during publishing:

```bash
sed -n '43,88p' src/types.ts
```

```output
/**
 * Processed content result
 */
export interface ProcessedContent {
  /** Processed markdown content */
  content: string;
  /** Sanitized filename */
  filename: string;
  /** List of image references found in the content */
  images: string[];
  /** Processed frontmatter */
  frontmatter: Record<string, unknown>;
}

/**
 * Publishing result for a single note
 */
export interface PublishResult {
  /** Original file path */
  filePath: string;
  /** Whether the publish was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** URL to the published file on GitHub */
  url?: string;
  /** URL to the pull request if created */
  prUrl?: string;
}

/**
 * Batch publishing summary
 */
export interface BatchPublishResult {
  /** Total number of notes attempted */
  total: number;
  /** Number of successful publishes */
  successful: number;
  /** Number of failed publishes */
  failed: number;
  /** Individual results */
  results: PublishResult[];
  /** URL to the pull request if created */
  prUrl?: string;
}
```

`ProcessedContent` is the intermediate representation after content transformation — the processed markdown, sanitized filename, extracted image list, and processed frontmatter. `PublishResult` and `BatchPublishResult` are the return types from the publishing workflows, carrying success/failure status and GitHub URLs.

---

## 2. Plugin Entry Point (`src/main.ts`)

This is where Obsidian loads the plugin. The `ObsidianPublisher` class extends Obsidian's `Plugin` base class and wires everything together.

```bash
sed -n '1,48p' src/main.ts
```

```output
import { Notice, Plugin, type TFile } from "obsidian";
import { Publisher } from "./publisher";
import { PublisherSettingTab } from "./settings";
import {
  type BatchPublishResult,
  DEFAULT_SETTINGS,
  type PublisherSettings,
  type PublishResult,
} from "./types";

export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;
  private publisher!: Publisher;

  async onload() {
    await this.loadSettings();

    // Initialize publisher
    this.publisher = new Publisher(this.app.vault, this.settings);

    // Register settings tab
    this.addSettingTab(new PublisherSettingTab(this.app, this));

    // Register commands
    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note to GitHub",
      editorCallback: async (_editor, view) => {
        const file = view.file;
        if (!file) {
          new Notice("No active file");
          return;
        }

        await this.publishCurrentNote(file);
      },
    });

    this.addCommand({
      id: "publish-all-notes",
      name: "Publish all notes to GitHub",
      callback: async () => {
        await this.publishAllNotes();
      },
    });

    console.log("Obsidian Publisher plugin loaded");
  }
```

`onload()` does three things:
1. Loads settings from Obsidian's data store (with migration logic)
2. Creates a `Publisher` instance with the vault and settings
3. Registers two commands: "Publish current note" (editor command, needs an active file) and "Publish all notes" (global command, scans the vault)

The `editorCallback` variant only appears in the command palette when an editor is active, while `callback` is always available.

### Settings Migration

The migration logic handles the transition when the PR workflow was added:

```bash
sed -n '54,69p' src/main.ts
```

```output
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // Migration: for existing users, default to false to preserve current behavior
    if (data && data.usePullRequests === undefined) {
      this.settings.usePullRequests = false;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Reinitialize publisher with new settings
    this.publisher = new Publisher(this.app.vault, this.settings);
  }
```

When `usePullRequests` was added, existing users had saved data without that field. The migration detects this (`data.usePullRequests === undefined`) and defaults them to `false` (direct commit), preserving their existing behavior. New users get `true` from `DEFAULT_SETTINGS`.

Note that `saveSettings()` recreates the `Publisher` instance. This ensures the publisher always reflects current settings after a change in the settings tab.

### Command Routing

Both commands follow the same pattern — validate settings, then branch on `usePullRequests`:

```bash
sed -n '74,115p' src/main.ts
```

```output
  private async publishCurrentNote(file: TFile) {
    // Validate settings
    const validationError = this.publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    new Notice(`Publishing ${file.basename}...`);

    try {
      let result: PublishResult & { prUrl?: string };

      if (this.settings.usePullRequests) {
        // Use PR workflow
        result = await this.publisher.publishNoteWithPR(file);

        if (result.success && result.prUrl) {
          new Notice(`✓ Pull request created for ${file.basename}`);
          console.log(`Pull Request: ${result.prUrl}`);
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
      } else {
        // Fallback to direct commit workflow
        result = await this.publisher.publishNote(file);

        if (result.success) {
          new Notice(`✓ Successfully published ${file.basename}`);
          if (result.url) {
            console.log(`Published to: ${result.url}`);
          }
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`✗ Error: ${message}`);
      console.error("Publish error:", error);
    }
  }
```

The `publishAllNotes()` method follows the same pattern but calls `publishAll()` / `publishAllWithPR()` and logs batch results. The UI layer (`main.ts`) handles user-facing notifications via `new Notice()` while errors go to `console.error()`.

---

## 3. Content Processing (`src/content-processor.ts`)

This is the transformation engine. It converts Obsidian-flavored markdown into Hugo-compatible markdown by processing frontmatter, converting wikilinks, converting image embeds, and sanitizing filenames.

### The Process Pipeline

The `process()` method runs transformations in a specific order:

```bash
sed -n '14,43p' src/content-processor.ts
```

```output
  process(content: string, originalFilename: string): ProcessedContent {
    const { frontmatter, body } = this.extractFrontmatter(content);

    // Process frontmatter
    const processedFrontmatter = this.processFrontmatter(frontmatter);

    // Find all images in the content
    const images = this.extractImages(body);

    // Convert content
    let processedBody = body;
    processedBody = this.convertImageReferences(processedBody);
    processedBody = this.convertWikilinks(processedBody);

    // Reassemble content with frontmatter
    const processedContent = this.assembleFrontmatter(
      processedFrontmatter,
      processedBody,
    );

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
      frontmatter: processedFrontmatter,
    };
  }
```

**Order matters:** Image references (`![[image.png]]`) are converted before wikilinks (`[[Page]]`). If wikilinks ran first, it would incorrectly match the image syntax since `![[...]]` contains `[[...]]`. The image regex consumes `![[...]]` patterns first, leaving only true wikilinks for the second pass.

Images are extracted *before* conversion so the original filenames (not sanitized versions) are available for vault lookup later.

### Frontmatter Extraction and Processing

```bash
sed -n '48,70p' src/content-processor.ts
```

```output
  private extractFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    try {
      const frontmatter = parseYaml(match[1]) || {};
      const body = match[2];
      return {
        frontmatter: typeof frontmatter === "object" ? frontmatter : {},
        body,
      };
    } catch (error) {
      console.error("Failed to parse frontmatter:", error);
      return { frontmatter: {}, body: content };
    }
  }
```

The regex `^---\n([\s\S]*?)\n---\n([\s\S]*)$` splits content at YAML frontmatter delimiters. It uses a non-greedy match (`*?`) to capture the first `---` block only. Obsidian's `parseYaml()` handles the actual YAML parsing. On parse failure, the content is returned as-is with empty frontmatter — a safe fallback.

```bash
sed -n '75,101p' src/content-processor.ts
```

```output
  private processFrontmatter(
    frontmatter: Record<string, unknown>,
  ): Record<string, unknown> {
    const processed = { ...frontmatter };

    // Remove status field if configured
    if (this.settings.removePublishFlag) {
      delete processed.status;
    }

    // Add template fields
    for (const [key, value] of Object.entries(
      this.settings.frontmatterTemplate,
    )) {
      // Don't override existing fields
      if (!(key in processed)) {
        processed[key] = value;
      }
    }

    // Ensure date field exists (Hugo requirement)
    if (!processed.date) {
      processed.date = new Date().toISOString();
    }

    return processed;
  }
```

Frontmatter processing does three things:
1. **Optionally strips `status`** — removes the publishing flag so Hugo doesn't see it
2. **Merges template fields** — adds configured fields without overriding user-set values
3. **Ensures `date` exists** — Hugo requires a date field; auto-generates one if missing

The non-override behavior (`if (!(key in processed))`) is important: user-authored frontmatter always takes precedence over template defaults.

### Wikilink and Image Conversion

```bash
sed -n '126,165p' src/content-processor.ts
```

```output
  private extractImages(content: string): string[] {
    const imageRegex = /!\[\[([^\]]+)\]\]/g;
    const images: string[] = [];

    let match = imageRegex.exec(content);
    while (match !== null) {
      images.push(match[1]);
      match = imageRegex.exec(content);
    }

    return images;
  }

  /**
   * Convert Obsidian wikilinks to markdown links
   * Handles: [[Page]] and [[Page|Display Text]]
   */
  private convertWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
      (_match, page, _, displayText) => {
        const display = displayText || page;
        const slug = this.sanitizeFilename(page);
        return `[${display}](${slug})`;
      },
    );
  }

  /**
   * Convert Obsidian image references to Hugo-compatible markdown
   * Handles: ![[image.png]]
   */
  private convertImageReferences(content: string): string {
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, imageName) => {
      const sanitizedName = this.sanitizeFilename(imageName);
      // Hugo paths are relative to content directory
      // Images in static/images are referenced as /images/
      return `![${imageName}](/images/${sanitizedName})`;
    });
  }
```

The conversions:

| Obsidian | Hugo |
|----------|------|
| `[[Page Name]]` | `[Page Name](page-name)` |
| `[[Page\|Custom Text]]` | `[Custom Text](page)` |
| `![[photo.png]]` | `![photo.png](/images/photo.png)` |

Wikilink targets are sanitized (lowercased, hyphenated) to produce URL-safe slugs. Image alt text preserves the original filename for readability while the path uses the sanitized version.

Note the image path is hardcoded to `/images/` — this matches Hugo's convention where `static/images/foo.png` becomes `/images/foo.png` in the rendered site. The `imageDir` setting controls where files are uploaded to GitHub, but the *reference* path is always `/images/`.

**Concern:** The hardcoded `/images/` prefix means if a user sets `imageDir` to something like `static/assets/img`, their image references will still point to `/images/`, breaking the link. This coupling between the upload path and the reference path should be configurable or derived from `imageDir`.

### Filename Sanitization

```bash
sed -n '174,205p' src/content-processor.ts
```

```output
  sanitizeFilename(filename: string): string {
    // Extract extension if present
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

    let name = filename;
    let extension = "";

    if (hasExtension) {
      name = filename.slice(0, lastDotIndex);
      extension = filename.slice(lastDotIndex); // includes the dot
    }

    // Convert to lowercase and replace spaces with hyphens
    name = name.toLowerCase().replace(/\s+/g, "-");

    // Remove special characters, keep only alphanumeric, hyphens, and underscores
    name = name.replace(/[^a-z0-9\-_]/g, "");

    // Remove consecutive hyphens
    name = name.replace(/-+/g, "-");

    // Remove leading/trailing hyphens
    name = name.replace(/^-+|-+$/g, "");

    // If name is empty after sanitization, use a default
    if (!name) {
      name = "untitled";
    }

    return name + extension;
  }
```

The sanitizer produces Hugo-friendly URL slugs:

1. Separate name from extension (preserves `.md`, `.png`, etc.)
2. Lowercase everything
3. Spaces → hyphens
4. Strip special characters (keep `a-z`, `0-9`, `-`, `_`)
5. Collapse consecutive hyphens
6. Trim leading/trailing hyphens
7. Empty result → `"untitled"`

This is well-tested — see the test suite below. The extension is *not* sanitized (just preserved as-is), which is fine since extensions are typically already clean.

---

## 4. GitHub Service (`src/github-service.ts`)

This is the API layer — all GitHub communication goes through this class. It wraps Octokit and provides two commit strategies.

```bash
sed -n '1,33p' src/github-service.ts
```

```output
import { RequestError } from "@octokit/request-error";
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
```

The constructor creates an Octokit instance with the user's GitHub token. `validateConnection()` is used by the "Test Connection" button in settings — it attempts a `repos.get()` call to verify both the token and repository access.

### Strategy 1: Contents API (Single-File Commits)

For single-file publishing, the Contents API creates one commit per file:

```bash
sed -n '39,117p' src/github-service.ts
```

```output
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
      if (error instanceof RequestError && error.status === 404) {
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
        sha: existingSha ?? undefined,
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
```

The Contents API pattern:

1. `getFileSha()` checks if the file exists — returns the SHA for updates, `null` for creates
2. `createOrUpdateFile()` sends the file content (base64-encoded) with the SHA if updating

GitHub's Contents API requires the existing file's SHA for updates (optimistic concurrency). The 404 → `null` pattern in `getFileSha()` is standard for GitHub API consumers.

**Concern:** Each file creates a separate commit. For single-note publishing this is fine, but `uploadImages()` in `publisher.ts` calls `uploadImage()` per image via the Contents API. A note with 5 images produces 6 commits (5 images + 1 markdown). This is noisy in the git history.

### Strategy 2: Git Trees API (Atomic Batch Commits)

For batch publishing, the lower-level Git Trees API creates one atomic commit for all files:

```bash
sed -n '291,355p' src/github-service.ts
```

```output
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

      const treeEntries = await Promise.all(
        files.map(async (file) => {
          const base64 =
            typeof file.content === "string"
              ? this.stringToBase64(file.content)
              : this.arrayBufferToBase64(file.content);

          const blob = await this.octokit.rest.git.createBlob({
            owner: this.settings.repoOwner,
            repo: this.settings.repoName,
            content: base64,
            encoding: "base64",
          });

          return {
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blob.data.sha,
          };
        }),
      );

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
        throw new Error(`Failed to commit files: ${error.message}`);
      }
      throw error;
    }
  }
```

The Git Trees API workflow:

1. **Get branch SHA** — find the current tip of the target branch
2. **Get commit** — retrieve the commit to find its tree SHA
3. **Create blobs** — upload each file as a blob object (parallelized with `Promise.all`)
4. **Create tree** — build a new tree with the blobs, based on the existing tree
5. **Create commit** — create a commit pointing to the new tree with the branch tip as parent
6. **Update ref** — fast-forward the branch to the new commit

This produces a single, atomic commit regardless of how many files are included. The `base_tree` parameter ensures existing files in the repo are preserved — only the specified paths are added or updated.

**Concern:** Blob creation is parallelized (`Promise.all`), which is good for performance but could hit GitHub's rate limits with many files. No rate-limit handling exists.

### Branch Management and PR Creation

```bash
sed -n '199,286p' src/github-service.ts
```

```output
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
```

Branch creation gets the base branch SHA and creates a new Git ref pointing to it. PR creation uses the Pulls API, then adds labels via the Issues API (GitHub treats PR labels as issue labels).

Labels are added in a separate API call after PR creation. If label addition fails, the PR still exists but lacks labels — a reasonable tradeoff.

### Branch Collision Handling

```bash
sed -n '368,407p' src/github-service.ts
```

```output
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
```

Branch names follow the pattern `publish/2026-03-08T14-30-22` (ISO timestamp with colons/dots replaced by hyphens). If a collision occurs (HTTP 422), it retries with `-1`, `-2` suffixes up to 3 attempts.

**Concern:** The retry calls `generateBranchName()` again on each iteration, generating a *new* timestamp. If the loop takes more than a second between iterations, the second attempt gets a different timestamp entirely (which would likely succeed anyway, making the suffix logic dead code in practice). The suffix would only matter if two publishes happened within the same second.

### Base64 Encoding

```bash
sed -n '165,187p' src/github-service.ts
```

```output
  /**
   * Convert string to base64 (cross-platform)
   */
  private stringToBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return btoa(chunks.join(""));
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return btoa(chunks.join(""));
  }
```

Both methods chunk the byte array into 8192-byte segments before calling `String.fromCharCode()`. This avoids the "Maximum call stack size exceeded" error that occurs when spreading large arrays (`String.fromCharCode(...hugeArray)`). The `btoa()` call then base64-encodes the joined string.

Two methods exist because the GitHub API needs base64 for both text content (markdown files → `string`) and binary content (images → `ArrayBuffer`). The logic is identical — the only difference is the input type.

---

## 5. Publisher Orchestration (`src/publisher.ts`)

The Publisher ties content processing and GitHub operations together. It implements four publishing methods:

| Method | Scope | Strategy |
|--------|-------|----------|
| `publishNote()` | Single file | Direct commit (Contents API) |
| `publishAll()` | All flagged files | Atomic batch commit (Git Trees API) |
| `publishNoteWithPR()` | Single file | Branch + PR |
| `publishAllWithPR()` | All flagged files | Branch + atomic batch + PR |

```bash
sed -n '210,241p' src/publisher.ts
```

```output
  private async publishFileToTarget(
    file: TFile,
    branch?: string,
  ): Promise<PublishResult> {
    try {
      const content = await this.vault.read(file);

      if (!this.hasPublishFlag(content)) {
        return {
          filePath: file.path,
          success: false,
          error: "File does not have 'status: published' in frontmatter",
        };
      }

      const processed = this.contentProcessor.process(content, file.name);
      await this.uploadImages(processed.images, branch);

      const targetPath = `${this.settings.contentDir}/${processed.filename}`;
      const url = await this.githubService.createOrUpdateFile(
        targetPath,
        processed.content,
        `Publish: ${file.basename}`,
        branch,
      );

      return { filePath: file.path, success: true, url };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { filePath: file.path, success: false, error: message };
    }
  }
```

`publishFileToTarget()` is the core single-file workflow:

1. Read file from vault
2. Check for `status: published` frontmatter flag
3. Process content (wikilinks, images, frontmatter)
4. Upload referenced images
5. Upload the markdown file
6. Return result with GitHub URL

This is used by both `publishNote()` (direct commit) and `publishNoteWithPR()` (branch workflow). The optional `branch` parameter routes uploads to either the base branch or a feature branch.

### Batch Publishing

```bash
sed -n '282,343p' src/publisher.ts
```

```output
  private async prepareBatch(files: TFile[]): Promise<{
    results: PublishResult[];
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>;
  }> {
    const results: PublishResult[] = [];
    const entryMap = new Map<string, string | ArrayBuffer>();
    const allFailedImages: string[] = [];
    const filesByName = new Map(this.vault.getFiles().map((f) => [f.name, f]));

    for (const file of files) {
      try {
        const content = await this.vault.read(file);
        const processed = this.contentProcessor.process(content, file.name);

        // Add markdown entry
        const targetPath = `${this.settings.contentDir}/${processed.filename}`;
        entryMap.set(targetPath, processed.content);

        // Resolve images
        for (const imageName of processed.images) {
          const imageFile = filesByName.get(imageName);
          if (!imageFile) {
            allFailedImages.push(imageName);
            continue;
          }
          try {
            const imageContent = await this.vault.readBinary(imageFile);
            const sanitizedName =
              this.contentProcessor.sanitizeImageName(imageName);
            const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
            entryMap.set(imgPath, imageContent);
          } catch (error) {
            console.error(`Failed to read image ${imageName}:`, error);
            allFailedImages.push(imageName);
          }
        }

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
```

`prepareBatch()` collects all files and images into a single `Map<path, content>` for atomic commit via `commitFiles()`. Key behaviors:

- **Deduplication:** Using a `Map` means if two notes reference the same image, it's only included once
- **Image resolution:** Images are looked up by filename from the vault's file index (`getFiles()`)
- **Progress feedback:** Shows `Prepared: N/M` notices as files are processed
- **Graceful degradation:** Failed images are collected and reported but don't block the batch

The vault file index is built once with `this.vault.getFiles().map(f => [f.name, f])` — a `Map` for O(1) lookups by filename. This is efficient for vaults with many files.

**Concern:** Image lookup is by filename only (`filesByName.get(imageName)`). If two images in different vault folders share the same name (e.g., `attachments/photo.png` and `archive/photo.png`), only the last one in the file list wins. This could silently upload the wrong image.

### Publish Flag Detection

```bash
sed -n '392,402p' src/publisher.ts
```

```output
  private hasPublishFlag(content: string): boolean {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return false;
    }

    const frontmatter = match[1];
    return /^status:\s*published\s*$/m.test(frontmatter);
  }
```

This uses regex rather than YAML parsing — faster for scanning the entire vault. It extracts the frontmatter block, then checks for a `status: published` line.

**Concern:** The match is case-sensitive. `status: Published` or `status: PUBLISHED` won't trigger publishing. This is tracked in issue #50. Also note the duplicate frontmatter extraction: `hasPublishFlag()` extracts frontmatter with regex, then `ContentProcessor.extractFrontmatter()` does it again with YAML parsing. A minor inefficiency — the file content is read and regex-matched twice per publish.

### PR Workflow with Cleanup

```bash
sed -n '62,114p' src/publisher.ts
```

```output
  async publishNoteWithPR(
    file: TFile,
  ): Promise<PublishResult & { prUrl?: string }> {
    if (!(await this.canPublish(file))) {
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
        this.settings.baseBranch || "main",
      );

      const result = await this.publishFileToTarget(file, branchName);

      if (!result.success) {
        try {
          await this.githubService.deleteBranch(branchName);
        } catch {
          // Best-effort cleanup
        }
        return result;
      }

      const prTitle = `Publish: ${file.basename}`;
      const prBody = `Published from Obsidian\n\n**File:** ${file.path}`;
      const pr = await this.githubService.createPullRequest(
        branchName,
        this.settings.baseBranch || "main",
        prTitle,
        prBody,
        this.settings.prLabels || ["published-from-obsidian"],
      );

      return { ...result, prUrl: pr.url };
    } catch (error) {
      if (branchName) {
        try {
          await this.githubService.deleteBranch(branchName);
        } catch {
          // Best-effort cleanup
        }
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      return { filePath: file.path, success: false, error: message };
    }
  }
```

The PR workflow wraps the direct-commit workflow with branch lifecycle management:

1. Check publish flag (early exit if missing)
2. Create a timestamped branch
3. Publish file to that branch
4. If publishing fails → delete the branch (best-effort cleanup)
5. If publishing succeeds → create a PR
6. If anything throws → delete the branch (best-effort cleanup)

The cleanup is best-effort (`catch {}`) because a failed cleanup shouldn't mask the original error. Orphaned branches are a minor annoyance, not a data loss risk.

**Concern:** `canPublish()` reads the file and checks the flag, then `publishFileToTarget()` reads the file again and checks the flag again. Three reads of the same file content in the PR path (plus the frontmatter extraction in ContentProcessor). Not a correctness issue, but wasteful for large files.

---

## 6. Settings UI (`src/settings.ts`)

The settings tab provides the configuration UI within Obsidian's settings panel.

```bash
sed -n '20,41p' src/settings.ts
```

```output
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Publisher Settings" });

    // GitHub Token
    new Setting(containerEl)
      .setName("GitHub Personal Access Token")
      .setDesc(
        "Create a token at github.com/settings/tokens with 'repo' scope. Token is stored securely.",
      )
      .addText((text) =>
        text
          .setPlaceholder("ghp_xxxxxxxxxxxx")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          })
          .inputEl.setAttribute("type", "password"),
      );
```

**Concern:** The description says "Token is stored securely" but the token is saved to Obsidian's `data.json` in plaintext on disk. The `type="password"` attribute only masks the input in the UI. This is tracked in issue #45. Obsidian doesn't provide a secure credential storage API, so this is a platform limitation, but the description shouldn't claim security it doesn't have.

Each setting field calls `this.plugin.saveSettings()` on change, which also reinstantiates the Publisher. This means settings take effect immediately without requiring a plugin reload.

### Frontmatter Template Parsing

```bash
sed -n '197,231p' src/settings.ts
```

```output
  private serializeFrontmatter(template: Record<string, unknown>): string {
    if (Object.keys(template).length === 0) return "";
    try {
      return stringifyYaml(template).trim();
    } catch {
      return Object.entries(template)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    }
  }

  private parseFrontmatter(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    if (!trimmed) return {};
    try {
      const parsed = parseYaml(trimmed);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return this.parseSimpleFrontmatter(trimmed);
    }
  }

  private parseSimpleFrontmatter(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const colonIndex = t.indexOf(":");
      if (colonIndex === -1) continue;
      const key = t.slice(0, colonIndex).trim();
      const value = t.slice(colonIndex + 1).trim();
      if (key && value) result[key] = value;
    }
    return result;
  }
```

The frontmatter template textarea accepts YAML input. Parsing has two tiers:

1. **YAML parser** (`parseYaml()` from Obsidian) — handles full YAML syntax including arrays, nested objects
2. **Fallback parser** (`parseSimpleFrontmatter()`) — handles simple `key: value` lines when YAML parsing fails

The fallback only produces string values. If a user types `count: 5`, YAML parsing returns `{ count: 5 }` (number), but the fallback returns `{ count: "5" }` (string). This inconsistency could cause subtle frontmatter differences depending on whether the input is valid YAML.

### Connection Test

```bash
sed -n '233,258p' src/settings.ts
```

```output
  private async testConnection(): Promise<void> {
    const settings = this.plugin.settings;

    // Validate settings
    if (!settings.githubToken) {
      new Notice("GitHub token is required");
      return;
    }

    if (!settings.repoOwner || !settings.repoName) {
      new Notice("Repository owner and name are required");
      return;
    }

    try {
      new Notice("Testing GitHub connection...");
      const github = new GitHubService(settings);
      await github.validateConnection();
      new Notice("✓ Connection successful! Repository is accessible.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`✗ Connection failed: ${message}`);
      console.error("GitHub connection test failed:", error);
    }
  }
}
```

The connection test creates a temporary `GitHubService` instance and calls `validateConnection()`. This verifies the token is valid and the repository is accessible. Note that it creates its own GitHubService rather than using the publisher's instance — this is correct because the settings may have just changed and the publisher hasn't been reinstantiated yet (though `saveSettings()` does reinstantiate, the test button doesn't call save first).

---

## 7. Build System

### Bun Bundler (`build.ts`)

```bash
cat build.ts
```

```output
const watch = process.argv.includes("--watch");

const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir: ".",
  format: "cjs",
  external: ["obsidian", "electron"],
  minify: !watch,
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) console.error(message);
  process.exit(1);
}

if (watch) console.log("Watching for changes...");

export {};
```

The build bundles everything into a single `main.js` file:

- **Format:** CommonJS (`cjs`) — required by Obsidian's plugin loader
- **Externals:** `obsidian` and `electron` are provided by the runtime
- **Bundled:** `@octokit/rest` and its dependencies are inlined
- **Minification:** Enabled for production builds, disabled in watch mode for readable source maps

The `export {}` at the end makes TypeScript treat this as a module (required for top-level `await`).

### Version Management (`version-bump.ts`)

```bash
cat version-bump.ts
```

```output
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const bumpType = process.argv[2];
if (!bumpType || !["patch", "minor", "major"].includes(bumpType)) {
  console.error("Usage: bun run version <patch|minor|major>");
  process.exit(1);
}

// Read current version from manifest.json (authority)
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const [major, minor, patch] = manifest.version.split(".").map(Number);

// Bump
let newVersion: string;
switch (bumpType) {
  case "major":
    newVersion = `${major + 1}.0.0`;
    break;
  case "minor":
    newVersion = `${major}.${minor + 1}.0`;
    break;
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
}

// Update manifest.json
manifest.version = newVersion;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

// Update package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = newVersion;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

// Update versions.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[newVersion] = manifest.minAppVersion;
writeFileSync("versions.json", `${JSON.stringify(versions, null, 2)}\n`);

// Commit and tag
execSync("git add manifest.json package.json versions.json");
execSync(`git commit -m "chore: bump version to ${newVersion}"`);
execSync(`git tag -a ${newVersion} -m "${newVersion}"`);

console.log(
  `Bumped to ${newVersion} — commit and tag created. Push with: git push && git push --tags`,
);
```

The version script:

1. Reads the current version from `manifest.json` (the authority)
2. Bumps according to semver (`patch`, `minor`, or `major`)
3. Updates three files: `manifest.json`, `package.json`, `versions.json`
4. Creates a git commit and annotated tag
5. Tells the user to push manually

`versions.json` maps plugin versions to minimum Obsidian versions (required by the Obsidian plugin ecosystem). The tag push triggers the release workflow.

---

## 8. CI/CD

### CI Pipeline (`.github/workflows/main.yml`)

```bash
cat .github/workflows/main.yml
```

```output
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install
      - run: bun run check
```

CI runs `bun run check` on pushes to main and PRs against main. This executes `typecheck && biome check .` — TypeScript strict-mode type checking plus Biome linting/formatting.

**Concern:** CI doesn't run tests (`bun test` is not called). The `check` script runs typecheck and lint but skips the test suite entirely. Tests only run if a developer remembers to run `bun test` locally.

### Release Pipeline (`.github/workflows/release.yml`)

```bash
cat .github/workflows/release.yml
```

```output
name: Release

on:
  push:
    tags:
      - "*"

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: |
          bun install
          bun run build

      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            main.js
            manifest.json
          fail_on_unmatched_files: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The release workflow triggers on any tag push, builds the plugin, and creates a GitHub release with `main.js` and `manifest.json`. `fail_on_unmatched_files: true` ensures the release fails if the build didn't produce the expected artifacts.

Note that `bun run build` includes `bun run check` (typecheck + lint) as a prerequisite, so the release won't be created if there are type errors or lint violations.

---

## 9. Test Suite

The test suite uses Bun's built-in test runner with an Obsidian module mock.

### Test Infrastructure

```bash
cat bunfig.toml && echo '---' && cat src/__mocks__/preload.ts
```

```output
[test]
preload = ["./src/__mocks__/preload.ts"]
---
import { mock } from "bun:test";

mock.module("obsidian", () => require("./obsidian"));
```

`bunfig.toml` tells Bun's test runner to preload `src/__mocks__/preload.ts` before every test file. The preload uses `mock.module()` to intercept `import ... from "obsidian"` and replace it with the local mock. This is necessary because the real Obsidian module is only available inside the Obsidian app runtime.

### Obsidian Mock

```bash
cat src/__mocks__/obsidian.ts
```

```output
/**
 * Minimal mock of Obsidian APIs for testing.
 * parseYaml/stringifyYaml use JSON as a stand-in since we only need
 * basic object round-tripping in tests.
 */

export function parseYaml(text: string): unknown {
  // Simple YAML parser for test fixtures: handles key: value lines,
  // arrays like [a, b], and quoted strings
  const result: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Parse arrays like [a, b]
    if (
      typeof value === "string" &&
      value.startsWith("[") &&
      value.endsWith("]")
    ) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    // Parse booleans and numbers
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (typeof value === "string" && /^\d+$/.test(value))
      value = Number(value);

    if (key) result[key] = value;
  }
  return result;
}

export function stringifyYaml(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(", ")}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export class Notice {}
```

The mock provides three things from the `obsidian` module:

1. **`parseYaml()`** — a simplified YAML parser that handles `key: value` lines, arrays (`[a, b]`), booleans, and numbers
2. **`stringifyYaml()`** — serializes objects back to YAML-like format
3. **`Notice`** — a no-op class (the real one shows toast notifications)

This is sufficient for testing content processing. The mock's `parseYaml()` doesn't handle nested objects, multi-line strings, or complex YAML features — but the test fixtures don't need them.

### Test Coverage

```bash
grep -c 'test(' src/content-processor.test.ts src/sanitizer.test.ts
```

```output
src/content-processor.test.ts:18
src/sanitizer.test.ts:10
```

```bash
grep -c 'describe(' src/content-processor.test.ts src/sanitizer.test.ts
```

```output
src/content-processor.test.ts:5
src/sanitizer.test.ts:1
```

28 test cases across 6 describe blocks, covering:

- **content-processor.test.ts** (18 tests): Wikilink conversion (4), image reference conversion (4), frontmatter processing (5), filename sanitization (3), full pipeline (1), plus a helper to verify end-to-end transformation
- **sanitizer.test.ts** (10 tests): Dedicated tests for the `sanitizeFilename()` function — spaces, case, special chars, hyphens/underscores, consecutive hyphens, extensionless files, empty names, images, complex filenames, leading/trailing hyphens

Note that `sanitizer.test.ts` duplicates the sanitization logic rather than importing from `content-processor.ts`. The comment says this avoids Obsidian dependencies, but the content-processor tests already handle this via the mock. This duplication means a bug fix to the real sanitizer could pass `content-processor.test.ts` while the duplicated copy in `sanitizer.test.ts` retains the old behavior (or vice versa).

**What's not tested:**
- `github-service.ts` (0 tests) — the entire GitHub API layer
- `publisher.ts` (0 tests) — publishing orchestration, batch logic, error handling
- `main.ts` (0 tests) — plugin lifecycle, command routing
- `settings.ts` (0 tests) — frontmatter template parsing, connection test

These gaps are tracked in issues #46 and #48.

---

## 10. Concerns and Community Standards

### Issues Found

| Concern | Severity | Location |
|---------|----------|----------|
| Hardcoded `/images/` path in image references doesn't match configurable `imageDir` | Medium | `content-processor.ts:163` |
| Token described as "stored securely" but saved in plaintext | Medium | `settings.ts:30` |
| CI doesn't run tests | Medium | `.github/workflows/main.yml` |
| No tests for GitHub API layer or publisher orchestration | High | `github-service.ts`, `publisher.ts` |
| Duplicate sanitization logic in test file | Low | `sanitizer.test.ts:11-33` |
| `hasPublishFlag()` is case-sensitive | Low | `publisher.ts:401` |
| File content read multiple times per publish | Low | `publisher.ts` |
| Image lookup by filename ignores vault folder paths | Low | `publisher.ts:289` |
| Branch retry regenerates timestamp, making suffix logic mostly dead code | Low | `github-service.ts:389` |
| GitHub Actions not pinned to specific versions | Low | `.github/workflows/*.yml` |

### Community Standards Compliance

**Good:**
- TypeScript with strict mode enabled
- Biome for linting and formatting (modern alternative to ESLint + Prettier)
- Clean separation of concerns across modules
- Proper error handling with typed errors (`RequestError`)
- MIT license
- Conventional commit messages (`chore:`, `fix:`, `feat:`)
- GitHub Actions CI/CD pipeline

**Could improve:**
- README is minimal (4 lines) — no installation guide, usage docs, or screenshots
- No CHANGELOG.md
- No CONTRIBUTING.md
- No `.github/ISSUE_TEMPLATE` or PR template
- Tests don't run in CI
- No code coverage reporting
- No JSDoc on public API methods in `publisher.ts` and `github-service.ts`

### Obsidian Plugin Standards

- `manifest.json` includes all required fields (`id`, `name`, `version`, `minAppVersion`, `description`, `author`)
- `isDesktopOnly: false` — correctly signals mobile compatibility
- `versions.json` maintained by version-bump script
- Uses Obsidian's `Plugin` base class correctly
- Registers commands with proper IDs and names
- Settings tab follows Obsidian's `PluginSettingTab` pattern
- No deprecated API usage detected

