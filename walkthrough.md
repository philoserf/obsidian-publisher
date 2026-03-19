# Obsidian Publisher Walkthrough

*2026-03-19T18:35:16Z by Showboat 0.6.1*
<!-- showboat-id: 7ae473d2-195c-465e-95c9-ce88323bbf92 -->

## Overview

Obsidian Publisher is an [Obsidian](https://obsidian.md) plugin that publishes notes to a GitHub repository for [Hugo](https://gohugo.io) static-site processing. It converts Obsidian-flavored markdown (wikilinks, image embeds, note embeds) into Hugo-compatible formats, uploads images, and commits everything via the GitHub REST API using [Octokit](https://github.com/octokit/rest.js).

**Key constraint:** All GitHub operations use the REST API — no local Git CLI — so the plugin works on iOS.

**Publishing trigger:** Notes must have `status: published` in their YAML frontmatter to be eligible.

### Two workflows

1. **Direct commit** (`usePullRequests = false`) — files committed straight to the base branch via the Contents API.
2. **Branch + PR** (`usePullRequests = true`, default) — creates a timestamped branch, commits via the Git Trees API, and opens a pull request.

## Architecture

### Directory layout

```bash
cat <<'HEREDOC'
src/
  main.ts                  # Plugin entry point, command registration
  publisher.ts             # Orchestration: single & batch publishing
  content-processor.ts     # Obsidian → Hugo markdown conversion
  github-service.ts        # GitHub REST API wrapper (Octokit)
  settings.ts              # Settings UI tab
  types.ts                 # Shared interfaces and defaults
  content-processor.test.ts
  sanitizer.test.ts
  test-preload.ts          # Mock setup for bun:test
HEREDOC
```

```output
src/
  main.ts                  # Plugin entry point, command registration
  publisher.ts             # Orchestration: single & batch publishing
  content-processor.ts     # Obsidian → Hugo markdown conversion
  github-service.ts        # GitHub REST API wrapper (Octokit)
  settings.ts              # Settings UI tab
  types.ts                 # Shared interfaces and defaults
  content-processor.test.ts
  sanitizer.test.ts
  test-preload.ts          # Mock setup for bun:test
```

### Data flow

    User triggers command
      → main.ts (validates settings, routes to Publisher)
        → publisher.ts (orchestrates workflow)
          → content-processor.ts (converts markdown, extracts images)
          → github-service.ts (creates branch, uploads files, opens PR)

### Dependencies

- **obsidian** — Plugin API, vault access, YAML parsing, UI components
- **@octokit/rest** — GitHub REST API client
- **@octokit/request-error** — Typed error handling for API responses

## Entry Point: `main.ts`

The plugin class extends Obsidian's `Plugin` base class. On load, it initializes the `Publisher`, registers the settings tab, and adds two commands.

```bash
sed -n '11,22p' src/main.ts
```

```output
export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;
  private publisher!: Publisher;

  async onload() {
    await this.loadSettings();

    // Initialize publisher
    this.publisher = new Publisher(this.app.vault, this.settings);

    // Register settings tab
    this.addSettingTab(new PublisherSettingTab(this.app, this));
```

### Settings migration

Existing users who upgrade get `usePullRequests = false` (preserving the old direct-commit behavior). New installs default to `true`. The migration checks for `undefined` — not `false` — so it only fires once.

```bash
sed -n '54,63p' src/main.ts
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
```

### Command routing

Both commands validate settings, then branch on `usePullRequests` to choose the workflow. Single-note publish uses the active editor file; batch publish scans the vault for `status: published`.

```bash
sed -n '84,109p' src/main.ts
```

```output
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
```

## Types: `types.ts`

Shared interfaces define the contract between modules. `DEFAULT_SETTINGS` provides zero-config defaults with sensible Hugo paths.

```bash
sed -n '4,41p' src/types.ts
```

```output
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
  prLabels: ["chore"],
  usePullRequests: true,
};
```

## Orchestration: `publisher.ts`

`Publisher` coordinates content processing and GitHub operations. It exposes four public methods matching the two workflows × two modes (single/batch).

### Publish gate: `hasPublishFlag`

Only notes with `status: published` in YAML frontmatter are eligible. The check uses a regex over the raw frontmatter block.

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

### Single-file publish: `publishFileToTarget`

The core publish helper reads the file, checks the flag, processes content, uploads images, then commits the markdown. An optional `branch` parameter directs the commit to a feature branch instead of the default.

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

### Batch publish: `prepareBatch`

Batch mode collects all publishable files into a single atomic commit using the Git Trees API. It deduplicates images across notes using a `Map` keyed by target path.

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

### PR workflow: `publishNoteWithPR`

The PR workflow wraps `publishFileToTarget` with branch creation and PR opening. If publishing fails, the orphaned branch is cleaned up (best-effort).

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
        this.settings.prLabels || ["chore"],
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

## Content Processing: `content-processor.ts`

The processor converts Obsidian-flavored markdown to Hugo-compatible markdown. Processing order matters: images first, then note embeds, then wikilinks — because all three use the `![[...]]` or `[[...]]` syntax.

### Processing pipeline

```bash
sed -n '16,46p' src/content-processor.ts
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
    processedBody = this.convertNoteEmbeds(processedBody);
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

### Wikilink conversion

Converts `[[Page]]`, `[[Page|Display]]`, `[[Page#Heading]]`, and `[[Page#Heading|Display]]` into Hugo `ref` shortcodes with slugified paths and lowercased heading anchors.

```bash
sed -n '156,168p' src/content-processor.ts
```

```output
  private convertWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|#]+)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (_match, page, _hashGroup, heading, _pipeGroup, displayText) => {
        const display = displayText || (heading ? `${page}#${heading}` : page);
        const slug = this.sanitizeSlug(page);
        const fragment = heading
          ? `#${heading.toLowerCase().replace(/\s+/g, "-")}`
          : "";
        return `[${display}]({{< ref "${slug}${fragment}" >}})`;
      },
    );
  }
```

### Image and note embed conversion

Image embeds (`![[photo.png]]`) are converted to standard markdown with a URL path derived from `imageDir` (stripping Hugo's `static/` prefix). Non-image embeds (`![[Some Note]]`) become Hugo ref links.

```bash
sed -n '126,197p' src/content-processor.ts
```

```output
  /**
   * Derive the URL path for images from the imageDir setting.
   * Strips "static/" prefix since Hugo serves static/ at the root.
   */
  private imageUrlPath(): string {
    return `/${this.settings.imageDir.replace(/^static\/?/, "")}`;
  }

  /**
   * Extract image references from content (only actual images, not note embeds)
   */
  private extractImages(content: string): string[] {
    const embedRegex = /!\[\[([^\]]+)\]\]/g;
    const images: string[] = [];

    let match = embedRegex.exec(content);
    while (match !== null) {
      if (IMAGE_EXTENSIONS.test(match[1])) {
        images.push(match[1]);
      }
      match = embedRegex.exec(content);
    }

    return images;
  }

  /**
   * Convert Obsidian wikilinks to Hugo ref shortcodes
   * Handles: [[Page]], [[Page|Display]], [[Page#Heading]], [[Page#Heading|Display]]
   */
  private convertWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|#]+)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (_match, page, _hashGroup, heading, _pipeGroup, displayText) => {
        const display = displayText || (heading ? `${page}#${heading}` : page);
        const slug = this.sanitizeSlug(page);
        const fragment = heading
          ? `#${heading.toLowerCase().replace(/\s+/g, "-")}`
          : "";
        return `[${display}]({{< ref "${slug}${fragment}" >}})`;
      },
    );
  }

  /**
   * Convert note embeds (![[Note Name]]) to Hugo ref links.
   * Only matches embeds that are NOT image files.
   */
  private convertNoteEmbeds(content: string): string {
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, name) => {
      if (IMAGE_EXTENSIONS.test(name)) {
        return _match; // leave for convertImageReferences (already processed)
      }
      const slug = this.sanitizeSlug(name);
      return `[${name}]({{< ref "${slug}" >}})`;
    });
  }

  /**
   * Convert Obsidian image references to Hugo-compatible markdown.
   * Derives the URL path from the imageDir setting.
   */
  private convertImageReferences(content: string): string {
    const urlPath = this.imageUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, imageName) => {
      if (!IMAGE_EXTENSIONS.test(imageName)) {
        return _match; // not an image — leave for convertNoteEmbeds
      }
      const sanitizedName = this.sanitizeFilename(imageName);
      return `![${imageName}](${urlPath}/${sanitizedName})`;
    });
  }
```

### Frontmatter processing

Frontmatter is parsed with Obsidian's `parseYaml`, processed (optional status removal, template merge, date injection), then serialized back with `stringifyYaml`.

```bash
sed -n '78,104p' src/content-processor.ts
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

### Filename sanitization

Filenames are lowercased, spaces replaced with hyphens, special characters stripped, and consecutive hyphens collapsed. The extension is preserved. Empty results become `untitled`.

```bash
sed -n '217,248p' src/content-processor.ts
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

## GitHub Service: `github-service.ts`

All GitHub API interactions go through `GitHubService`. It wraps Octokit and provides two commit strategies.

### Contents API (single-file)

Used by `publishFileToTarget` for direct commits. Each file is a separate API call and a separate commit.

```bash
sed -n '76,117p' src/github-service.ts
```

```output
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

### Git Trees API (batch commit)

Used by `prepareBatch` for atomic multi-file commits. Creates blobs for each file in parallel, builds a new tree, creates a commit, and updates the branch ref — all in one logical operation.

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

### Branch management and collision handling

Branches are named with ISO timestamps (e.g., `publish/2026-03-19T18-21-46`). `createBranchWithRetry` handles 422 collisions by appending a suffix (`-1`, `-2`), retrying up to 3 times.

```bash
sed -n '371,406p' src/github-service.ts
```

```output
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
```

### Cross-platform base64 encoding

The plugin avoids Node.js `Buffer` for iOS compatibility. Instead, it uses `TextEncoder` + `btoa` with chunked processing (8192-byte chunks to avoid stack overflow from `String.fromCharCode` spread).

```bash
sed -n '168,187p' src/github-service.ts
```

```output
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

## Settings UI: `settings.ts`

`PublisherSettingTab` extends Obsidian's `PluginSettingTab` to render a form for all settings. Notable details:

- **Token field** uses `type="password"` to mask the value
- **Directory fields** strip leading/trailing slashes on save
- **Frontmatter template** uses Obsidian's `parseYaml`/`stringifyYaml` with a simple `key: value` fallback parser
- **Test Connection** button instantiates a temporary `GitHubService` to validate credentials

```bash
sed -n '233,257p' src/settings.ts
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
```

## Testing

Tests use Bun's built-in runner with mocks preloaded via `bunfig.toml`. The mock provides stubs for `parseYaml`, `stringifyYaml`, and `Notice`.

```bash
grep -c 'test(' src/content-processor.test.ts src/sanitizer.test.ts
```

```output
src/content-processor.test.ts:24
src/sanitizer.test.ts:10
```

Test coverage focuses on content processing (24 tests) and filename sanitization (10 tests). There are no tests for `publisher.ts`, `github-service.ts`, or `settings.ts` — these would require mocking the Obsidian Vault API and Octokit.

## Build

The plugin bundles to a single `main.js` via Bun's bundler, externalizing `obsidian` and `electron`, and bundling `@octokit/rest` inline.

```bash
sed -n '1,19p' build.ts
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

## Concerns

### Code quality

1. **`version-bump.ts` doesn't bump** — The script reads `npm_package_version` from the environment (set by `bun run` from `package.json`), so it only syncs `manifest.json`/`versions.json` to match. The actual version bump must be done manually in `package.json` first, making the `bun run version patch` command misleading.

2. **Duplicated `hasPublishFlag` check** — `publishNoteWithPR` calls `canPublish` (which reads the file and checks the flag), then `publishFileToTarget` reads the file again and re-checks. The file is read twice and the flag is checked twice.

3. **Duplicated base64 methods** — `stringToBase64` and `arrayBufferToBase64` share identical chunking logic; only the input-to-bytes step differs. Could be a single method accepting `Uint8Array`.

4. **No test coverage for publisher or GitHub service** — The orchestration and API layers are untested. Integration tests with mocked Octokit would catch regressions in the publish pipeline.

5. **`baseBranch` fallback scattered** — `this.settings.baseBranch || "main"` appears 5 times across `publisher.ts`. The default is already `"main"` in `DEFAULT_SETTINGS`, so the fallback is redundant if settings are loaded correctly — or it should be centralized.

### Community standards

6. **Open issues for Obsidian syntax gaps** — Issues #80–85 track missing transformations: Obsidian comments pass through as visible text, callouts aren't converted to Hugo shortcodes, highlight syntax (`==text==`) isn't handled, and mermaid code blocks need shortcode conversion.

7. **Token stored unencrypted** — The GitHub PAT is stored in Obsidian's plugin data file (plain JSON). The settings UI documents this, but it's worth noting as a security consideration.

8. **No LICENSE file** — `package.json` declares MIT but no `LICENSE` file exists in the repo root.

