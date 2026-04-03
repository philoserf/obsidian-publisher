# Obsidian Publisher Walkthrough

*2026-03-19T23:52:36Z by Showboat 0.6.1*
<!-- showboat-id: 775fcfb0-5f74-45b4-aa11-4c920a304ff4 -->

## Overview

Obsidian Publisher is an Obsidian plugin that publishes notes to GitHub for Hugo processing. It converts Obsidian-specific markdown syntax to Hugo-compatible format and commits files via the GitHub REST API (Octokit). Designed for iOS compatibility — no local git commands.

Tailored for the [hugo-coder](https://github.com/luizdepra/hugo-coder) theme as used by [philoserf.com](https://philoserf.com).

**Key technologies:** TypeScript, Bun (build/test), Octokit REST API, Obsidian Plugin API

**Entry point:** `src/main.ts` → registers commands, loads settings, routes to Publisher

**Publishing flow:**
1. User triggers publish command
2. Settings validated, content read from vault
3. Content processor converts Obsidian syntax to Hugo markdown
4. GitHub service commits files via REST API (Git Trees API for atomic commits)
5. Optionally creates a branch and pull request

## Architecture

Six source modules, each with a single responsibility:

```bash
cat <<'HEREDOC'
src/
├── main.ts               # Plugin entry: commands, settings, routing
├── publisher.ts           # Orchestration: publish workflows, batch logic
├── content-processor.ts   # Syntax conversion: wikilinks, images, callouts, mermaid
├── github-service.ts      # GitHub API: commits, branches, PRs via Octokit
├── settings.ts            # Settings UI tab with input validation
└── types.ts               # Shared interfaces and defaults
HEREDOC
```

```output
src/
├── main.ts               # Plugin entry: commands, settings, routing
├── publisher.ts           # Orchestration: publish workflows, batch logic
├── content-processor.ts   # Syntax conversion: wikilinks, images, callouts, mermaid
├── github-service.ts      # GitHub API: commits, branches, PRs via Octokit
├── settings.ts            # Settings UI tab with input validation
└── types.ts               # Shared interfaces and defaults
```

## Types and Defaults

`types.ts` defines the shared interfaces. `PublisherSettings` holds all plugin configuration. `DEFAULT_SETTINGS` provides sensible defaults — notably `usePullRequests: true` for new users.

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

## Plugin Entry Point

`main.ts` is the Obsidian plugin class. It registers two commands (publish current note, publish all), manages settings with migration logic, and provides a cached `Publisher` instance that rebuilds on settings change.

```bash
sed -n '12,23p' src/main.ts
```

```output
export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;
  private _publisher!: Publisher;

  async onload() {
    await this.loadSettings();
    this._publisher = new Publisher(this.app.vault, this.settings);

    // Register settings tab
    this.addSettingTab(new PublisherSettingTab(this.app, this));

    // Register commands
```

Settings migration: existing users who upgrade from pre-PR versions get `usePullRequests = false` to preserve their workflow. New users get `true` from `DEFAULT_SETTINGS`.

```bash
sed -n '50,64p' src/main.ts
```

```output
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
    this._publisher = new Publisher(this.app.vault, this.settings);
  }

```

## Content Processor

The heart of the Obsidian-to-Hugo conversion. `process()` runs a pipeline: extract frontmatter, strip comments, convert highlights, callouts, mermaid, images, note embeds, and wikilinks — in that order. Order matters: comments must be stripped first, images before wikilinks (since both use `![[...]]`).

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
    processedBody = this.stripComments(processedBody);
    processedBody = this.convertHighlights(processedBody);
    processedBody = this.convertCallouts(processedBody);
    processedBody = this.convertMermaid(processedBody);
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
```

### Obsidian Comment Stripping and Highlights

Comments (`%%...%%`) are stripped first so they don't interfere with later transforms. Highlights (`==text==`) become `<mark>` tags. The negative lookahead `(?!=)` prevents matching `===`.

```bash
sed -n '138,150p' src/content-processor.ts
```

```output
  /**
   * Strip Obsidian comments (%%...%%) including multiline
   */
  private stripComments(content: string): string {
    return content.replace(/%%[\s\S]*?%%/g, "");
  }

  /**
   * Convert Obsidian highlight syntax (==text==) to HTML mark tags
   */
  private convertHighlights(content: string): string {
    return content.replace(/==((?!=).+?)==/g, "<mark>$1</mark>");
  }
```

### Callout-to-Notice Conversion

Obsidian has ~20 callout types. Hugo-coder's `notice` shortcode has 7. The static `CALLOUT_TYPE_MAP` maps between them, defaulting unknown types to `note`. The regex handles optional foldable markers (`+`/`-`) and optional titles.

```bash
sed -n '152,218p' src/content-processor.ts
```

```output
  private static readonly CALLOUT_TYPE_MAP: Record<string, string> = {
    note: "note",
    abstract: "note",
    summary: "note",
    tldr: "note",
    info: "info",
    todo: "info",
    tip: "tip",
    hint: "tip",
    important: "tip",
    success: "tip",
    check: "tip",
    done: "tip",
    question: "question",
    help: "question",
    faq: "question",
    warning: "warning",
    caution: "warning",
    attention: "warning",
    failure: "error",
    fail: "error",
    missing: "error",
    danger: "error",
    error: "error",
    bug: "error",
    example: "example",
    quote: "note",
    cite: "note",
  };

  /**
   * Convert Obsidian callouts to hugo-coder notice shortcodes
   */
  private convertCallouts(content: string): string {
    return content.replace(
      /^> \[!([\w-]+)\][-+]?(?: (.+))?\n((?:^> .*(?:\n|$))*)/gm,
      (_match, type: string, title: string | undefined, body: string) => {
        const noticeType =
          ContentProcessor.CALLOUT_TYPE_MAP[type.toLowerCase()] ?? "note";
        const cleanBody = body.replace(/^> ?/gm, "").trim();
        const titleAttr = title ? ` "${title}"` : "";
        return `{{< notice ${noticeType}${titleAttr} >}}\n${cleanBody}\n{{< /notice >}}`;
      },
    );
  }

  /**
   * Convert mermaid fenced code blocks to hugo-coder mermaid shortcodes
   */
  private convertMermaid(content: string): string {
    return content.replace(
      /```mermaid\n([\s\S]*?)```/g,
      (_match, body: string) =>
        `{{< mermaid >}}\n${body.trimEnd()}\n{{< /mermaid >}}`,
    );
  }

  /**
   * Strip Obsidian sizing suffix (|300 or |300x200) from an embed name
   */
  private stripImageSize(name: string): string {
    return name.split("|")[0];
  }

  /**
   * Extract image references from content (only actual images, not note embeds)
   */
```

### Wikilink Conversion

Wikilinks (`[[Page]]`, `[[Page|Display]]`, `[[Page#Heading]]`) become Hugo ref shortcodes. The page name is sanitized to a slug. Note embeds (`![[Note]]`) become ref links; image embeds (`![[image.png]]`) become standard markdown images with the URL derived from `imageDir`. The `stripImageSize` helper handles Obsidian's `|300` sizing syntax.

```bash
sed -n '237,270p' src/content-processor.ts
```

```output
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
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const nameForCheck = this.stripImageSize(raw);
      if (IMAGE_EXTENSIONS.test(nameForCheck)) {
        return _match; // leave for convertImageReferences (already processed)
      }
      // For note embeds, pipe is display text: ![[Note|Display]]
      const [name, displayText] = raw.split("|");
      const display = displayText ?? name;
      const slug = this.sanitizeSlug(name);
      return `[${display}]({{< ref "${slug}" >}})`;
    });
  }

```

## Publisher Orchestration

`publisher.ts` provides four publish methods: `publishNote()`, `publishAll()`, `publishNoteWithPR()`, and `publishAllWithPR()`. Shared helpers handle branch cleanup, image resolution, and commit failure propagation.

```bash
sed -n '24,80p' src/publisher.ts
```

```output
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
```

### Single File Publish with PR

The PR workflow reads the file once, checks the publish flag, creates a branch, commits markdown + images atomically via `publishFileToTarget`, then opens a PR. On failure, the branch is cleaned up.

```bash
sed -n '126,170p' src/publisher.ts
```

```output
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
```

## GitHub Service

`github-service.ts` wraps Octokit for all GitHub API interactions. The key method is `commitFiles()` which uses the Git Trees API for atomic multi-file commits. Blobs are created sequentially to avoid rate limits.

```bash
sed -n '155,215p' src/github-service.ts
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
        throw new Error(`Failed to commit files: ${error.message}`);
      }
      throw error;
    }
  }
```

### Branch Creation with Retry

`createBranchWithRetry` generates timestamped branch names and retries with a suffix on 422 (branch exists). `createBranch` preserves `RequestError` so the `instanceof` check in the retry loop works correctly.

```bash
sed -n '242,266p' src/github-service.ts
```

```output
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

## Settings UI

`settings.ts` renders the Obsidian settings tab. Input validation sanitizes GitHub names (alphanumeric + hyphens, length-limited) and directory paths (strips `..` and `~`).

```bash
sed -n '230,252p' src/settings.ts
```

```output
  private sanitizeGitHubOwner(value: string): string {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9-]/g, "")
      .slice(0, 39);
  }

  private sanitizeRepoName(value: string): string {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9-_.]/g, "")
      .slice(0, 100);
  }

  private sanitizePath(value: string): string {
    return value
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.\./g, "")
      .replace(/~/g, "");
  }

  private async testConnection(): Promise<void> {
```

## Build and Tooling

Single-file Bun build bundles to `main.js`. Watch mode uses `fs.watch` with 100ms debounce. The validate script runs types, tests, lint, and build in sequence.

```bash
sed -n '1,10p' build.ts
```

```output
import { watch } from "node:fs";

const isWatch = process.argv.includes("--watch");

async function build() {
  const result = await Bun.build({
    entrypoints: ["src/main.ts"],
    outdir: ".",
    format: "cjs",
    external: ["obsidian", "electron"],
```

## Test Coverage

```bash
grep -c 'test(' src/content-processor.test.ts src/publisher.test.ts src/github-service.test.ts
```

```output
src/content-processor.test.ts:47
src/publisher.test.ts:19
src/github-service.test.ts:11
```

## Concerns

1. **Settings save on every keystroke.** The `onChange` handlers in `settings.ts` call `saveSettings()` (disk write + Publisher rebuild) per character. A debounce or save-on-blur would reduce churn.

2. **No test coverage for settings UI.** `settings.ts` sanitization helpers are tested only implicitly through manual use. The sanitization logic could be extracted and unit-tested.

