# Obsidian Publisher Walkthrough

*2026-04-03T18:39:16Z by Showboat 0.6.1*
<!-- showboat-id: 320db748-cf50-4203-9a2a-1a152124df11 -->

## Overview

Obsidian Publisher is an Obsidian plugin that publishes notes to a GitHub repository
for Hugo static site generation. It converts Obsidian-flavored markdown (wikilinks,
callouts, image embeds, mermaid blocks) into Hugo-compatible output and uploads files
via the GitHub REST API through Octokit.

**Key design constraint:** All GitHub operations use the REST API — no local git
commands or shell access — so the plugin works on iOS/iPadOS.

**Technologies:** TypeScript, Bun (runtime + test runner + bundler), Biome (format +
lint), Octokit (GitHub REST client).

**Entry point:** `src/main.ts` — an Obsidian `Plugin` subclass that registers two
commands: publish the current note, or publish all notes with `status: published`
frontmatter.

**Two publishing workflows:**

1. **Direct commit** (`usePullRequests = false`) — files committed straight to the
   base branch. Legacy mode for backward compatibility.
2. **Branch + PR** (`usePullRequests = true`) — creates a timestamped branch, commits
   files, then opens a pull request. Default for new installs.

## Architecture

Six source files in `src/`, each with a clear responsibility:

```bash
cat <<'HEREDOC'
src/
├── main.ts                 Plugin entry: commands, settings load, routing
├── publisher.ts            Orchestration: workflows, batch processing, vault scanning
├── github-service.ts       GitHub API wrapper (Octokit): branches, commits, PRs
├── content-processor.ts    Markdown transformation: wikilinks, images, frontmatter
├── settings.ts             Settings UI tab with sanitization and connection test
├── types.ts                Type definitions and shared utilities
├── test-preload.ts         Test mocks for obsidian + octokit modules
├── *.test.ts               Co-located test files
build.ts                    Bun bundler script (CJS output, externals: obsidian, electron)
HEREDOC
```

```output
src/
├── main.ts                 Plugin entry: commands, settings load, routing
├── publisher.ts            Orchestration: workflows, batch processing, vault scanning
├── github-service.ts       GitHub API wrapper (Octokit): branches, commits, PRs
├── content-processor.ts    Markdown transformation: wikilinks, images, frontmatter
├── settings.ts             Settings UI tab with sanitization and connection test
├── types.ts                Type definitions and shared utilities
├── test-preload.ts         Test mocks for obsidian + octokit modules
├── *.test.ts               Co-located test files
build.ts                    Bun bundler script (CJS output, externals: obsidian, electron)
```

## Types and Defaults (`src/types.ts`)

The foundation. Defines all shared interfaces and the `DEFAULT_SETTINGS` constant.
A shared `errorMessage()` utility extracts human-readable messages from unknown
catch values.

```bash
head -41 src/types.ts | tail -38
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

```bash
tail -4 src/types.ts
```

```output
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
```

## Plugin Entry Point (`src/main.ts`)

`ObsidianPublisher` extends Obsidian's `Plugin` class. On load it:

1. Loads and migrates settings (existing users keep direct-commit; new users get PR mode)
2. Creates a `Publisher` instance
3. Registers two commands: publish current note, publish all notes

Each command validates settings, then delegates to the appropriate `Publisher` method
based on the `usePullRequests` toggle. Results are displayed via Obsidian `Notice`.

```bash
head -58 src/main.ts | tail -42
```

```output
    await this.loadSettings();
    this._publisher = new Publisher(this.app.vault, this.settings);

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
  }

  onunload() {}

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

The `publishCurrentNote` method shows the routing logic — it checks `usePullRequests`
to decide between `publishNoteWithPR()` and `publishNote()`:

```bash
head -109 src/main.ts | tail -42
```

```output
  private async publishCurrentNote(file: TFile) {
    // Validate settings
    const validationError = this._publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    new Notice(`Publishing ${file.basename}...`);

    try {
      let result: PublishResult;

      if (this.settings.usePullRequests) {
        // Use PR workflow
        result = await this._publisher.publishNoteWithPR(file);

        if (result.success && result.prUrl) {
          new Notice(`✓ Pull request created for ${file.basename}`);
          console.log(`Pull Request: ${result.prUrl}`);
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
      } else {
        // Fallback to direct commit workflow
        result = await this._publisher.publishNote(file);

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
      const message = errorMessage(error);
      new Notice(`✗ Error: ${message}`);
      console.error("Publish error:", error);
    }
  }
```

## Content Processing (`src/content-processor.ts`)

The `ContentProcessor` transforms Obsidian markdown into Hugo-compatible output. The
`process()` method is the single entry point, applying transformations in order:

1. Extract frontmatter from body
2. Process frontmatter (remove status, merge template, ensure date)
3. Extract image references from body
4. Transform body: strip comments → highlights → callouts → mermaid → images → note embeds → wikilinks
5. Reassemble frontmatter + body
6. Sanitize filename

The transformation order matters — image references must be converted before note
embeds to avoid ambiguity (both use `![[...]]` syntax).

```bash
head -50 src/content-processor.ts | tail -35
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
      images,
      frontmatter: processedFrontmatter,
    };
  }
```

### Frontmatter Processing

Frontmatter is extracted via regex (`/^---\n([\s\S]*?)\n---\n/`), parsed with
Obsidian's `parseYaml`, then processed: optionally removing the `status` field,
merging template fields (without overriding existing keys), and ensuring a `date`
field exists for Hugo.

```bash
head -108 src/content-processor.ts | tail -27
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

### Content Transformations

Each transformation is a focused regex replacement:

- **Strip comments** — removes `%%...%%` (Obsidian comments, including multiline)
- **Highlights** — `==text==` → `<mark>text</mark>`
- **Callouts** — Obsidian `> [!type]` blocks → Hugo `{{< notice >}}` shortcodes,
  with a type mapping table (e.g., `tip`/`hint`/`important` all map to `"tip"`)
- **Mermaid** — fenced mermaid blocks → `{{< mermaid >}}` shortcodes
- **Images** — `![[image.png]]` → `![image.png](/images/image.png)`, stripping
  Obsidian sizing suffixes (`|300`), deriving the URL from `imageDir` minus `static/`
- **Note embeds** — `![[Note Name]]` → `[Note Name]({{< ref "note-name" >}})` (non-image embeds)
- **Wikilinks** — `[[Page|Display]]` → `[Display]({{< ref "page" >}})`, with heading fragment support

```bash
head -196 src/content-processor.ts | tail -16
```

```output

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
```

### Filename Sanitization

The `sanitizeName` core strips the input to a URL-safe slug: lowercase, spaces to
hyphens, remove special characters, collapse consecutive hyphens, trim edges. Falls
back to `"untitled"` if the result is empty. `sanitizeFilename` preserves the file
extension; `sanitizeSlug` drops it.

```bash
tail -43 src/content-processor.ts | head -33
```

```output
   */
  private sanitizeName(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "") || "untitled"
    );
  }

  /**
   * Sanitize a page name into a slug (no extension)
   */
  private sanitizeSlug(page: string): string {
    return this.sanitizeName(page);
  }

  /**
   * Sanitize filename for Hugo URLs (preserves extension)
   */
  sanitizeFilename(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

    if (!hasExtension) {
      return this.sanitizeName(filename);
    }

    const name = this.sanitizeName(filename.slice(0, lastDotIndex));
    const extension = filename.slice(lastDotIndex);
```

## GitHub Service (`src/github-service.ts`)

The `GitHubService` wraps Octokit for all GitHub REST API calls. Key methods:

- **`validateConnection()`** — checks repo access (used by settings test button)
- **`commitFiles()`** — atomic multi-file commit via the Git Trees API (create blobs → create tree → create commit → update ref)
- **`createBranchWithRetry()`** — generates a timestamped branch name and retries with a suffix on 422 (name collision)
- **`createPullRequest()`** — creates a PR and adds labels
- **`deleteBranch()`** — cleanup on failure

The `toBase64()` helper converts strings and ArrayBuffers in 8KB chunks using
`TextEncoder` + `btoa` — cross-platform compatible (no Node.js `Buffer`).

```bash
head -215 src/github-service.ts | tail -61
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

The branch creation retry logic handles name collisions (422 status):

```bash
tail -27 src/github-service.ts | head -25
```

```output
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
```

## Publisher Orchestration (`src/publisher.ts`)

The `Publisher` class ties everything together. It holds references to `ContentProcessor`
and `GitHubService`, reads files from the Obsidian `Vault`, and orchestrates the
publishing workflows.

### Vault Scanning

`getPublishableFiles()` reads every markdown file in the vault and checks for
`status: published` in frontmatter via the `hasPublishFlag()` regex. This is the
gate for batch publishing.

```bash
tail -12 src/publisher.ts
```

```output
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
```

### Single-Note PR Workflow

`publishNoteWithPR()` creates a branch, publishes the file to it, then opens a PR.
On any failure, it cleans up the branch:

```bash
head -176 src/publisher.ts | tail -54
```

```output
  async publishNoteWithPR(file: TFile): Promise<PublishResult> {
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
      const message = errorMessage(error);
      return { filePath: file.path, success: false, error: message };
    }
  }
```

### Batch Publishing

`prepareBatch()` processes all files, deduplicating images via a `Map`, then
`publishAllWithPR()` commits everything in a single atomic commit and opens one PR.
The deduplication ensures that if multiple notes reference the same image, it's only
uploaded once.

```bash
head -408 src/publisher.ts | tail -50
```

```output
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
```

## Settings UI (`src/settings.ts`)

The `PublisherSettingTab` renders the settings form using Obsidian's `Setting` API.
Each field saves immediately on change (no debounce — see issue #114). Input
sanitization methods guard against path traversal (`..`), tilde expansion, and
invalid GitHub usernames/repo names.

The "Test Connection" button creates a temporary `GitHubService` and calls
`validateConnection()` to verify credentials and repo access.

Frontmatter template editing uses `parseYaml`/`stringifyYaml` for round-tripping,
with a fallback `parseSimpleFrontmatter` for invalid YAML.

```bash
head -250 src/settings.ts | tail -22
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
```

## Build System

The build script (`build.ts`) uses Bun's bundler to produce a single `main.js` file
in CJS format. `obsidian` and `electron` are externals (provided by the host app).
Octokit is bundled in. Watch mode debounces rebuilds on `src/` changes.

```bash
head -24 build.ts
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
    minify: !isWatch,
  });

  if (!result.success) {
    console.error("Build failed");
    for (const message of result.logs) console.error(message);
    if (!isWatch) process.exit(1);
    return;
  }

  console.log(
    `Built main.js (${(result.outputs[0].size / 1024).toFixed(1)} KB)`,
  );
}
```

## Testing (`src/test-preload.ts`)

Tests use Bun's test runner with module mocks loaded via `bunfig.toml` preload.
The preload file mocks three external modules:

- **`obsidian`** — `parseYaml` (simple line-by-line parser), `stringifyYaml`,
  `Notice`, `Plugin`, `PluginSettingTab`, `Setting` (all stubs)
- **`@octokit/rest`** — empty `Octokit` class
- **`@octokit/request-error`** — `RequestError` with status code support

The `parseYaml` mock handles flat key-value pairs, inline arrays (`[a, b]`),
booleans, and integers — enough for test scenarios but not full YAML (see issue #129).

```bash
head -32 src/test-preload.ts
```

```output
import { mock } from "bun:test";

mock.module("obsidian", () => ({
  parseYaml(text: string): unknown {
    const result: Record<string, unknown> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      let value: unknown = trimmed.slice(colonIdx + 1).trim();

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
      } else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (typeof value === "string" && /^\d+$/.test(value))
        value = Number(value);

      if (key) result[key] = value;
    }
    return result;
  },
```

## Concerns

### Code Quality

1. **`publisher.ts` couples to UI** — `Publisher` directly calls `new Notice()`
   in `publishAll()`, `publishAllWithPR()`, `getPublishableFiles()`, and
   `prepareBatch()`. This mixes orchestration with presentation, making the class
   harder to test in isolation. (Issue #126)

2. **`publishAllWithPR()` is 72 lines with deep nesting** — the try/catch wrapping
   branch creation, batch preparation, conditional cleanup, and PR creation makes
   the control flow hard to follow. (Issue #124)

3. **`settings.ts` `display()` is 170 lines** — a single method building the entire
   settings form. Extracting per-section builders would improve readability. (Issue #125)

4. **No debounce on settings save** — every keystroke triggers `saveSettings()` which
   re-creates the `Publisher` instance. This is wasteful and could cause issues on
   slower devices. (Issue #114)

5. **`prepareBatch()` uses `errorMessage` inline instead of the shared utility** —
   line 387–388 duplicates the `error instanceof Error ? error.message : "Unknown error"`
   pattern instead of calling `errorMessage()` from `types.ts`.

### Robustness

6. **Blob creation is sequential** — `commitFiles()` creates blobs one at a time in
   a loop. For batch publishes with many images, this could be slow. Parallel blob
   creation with `Promise.all` (or batched) would be faster, though rate limits should
   be considered.

7. **`sanitizeName` strips dots from filenames** — the regex `[^a-z0-9\-_]` removes
   dots, which means `sanitizeSlug("my.page")` becomes `"mypage"`. This is fine for
   slugs but could be surprising for filenames with multiple dots.

### Community Standards

8. **No `.editorconfig`** — Biome handles formatting, but an `.editorconfig` is
   standard for multi-editor consistency (Obsidian plugin community convention).

9. **`isDesktopOnly: false` in manifest** — correctly signals iOS compatibility,
   which aligns with the REST-API-only design constraint.

10. **Token stored unencrypted** — the settings description notes this, which is good
    transparency. This is standard for Obsidian plugins (the platform doesn't provide
    a keychain API), but worth noting for security-conscious users.

