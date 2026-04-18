# Obsidian Publisher Walkthrough

*2026-04-18T14:20:50Z by Showboat 0.6.1*
<!-- showboat-id: 0831c464-e5bf-40e6-9a68-8f30a9f62256 -->

## Overview

Obsidian Publisher is an Obsidian plugin that publishes vault notes to a Hugo
site's GitHub repository. It scans for notes marked `status: publish`,
transforms Obsidian-flavored markdown into Hugo-ready output, and commits the
files via the GitHub REST API. No local Git binary is involved — the plugin
runs on desktop **and iOS** from a single codebase.

**Tech stack**

- TypeScript, bundled to a single `main.js` via Bun
- Obsidian Plugin API (`obsidian` peer dep)
- Octokit (`@octokit/rest`) for all GitHub operations
- `bun:test` for unit tests

**Key constraint:** every GitHub operation must go through Octokit's REST
endpoints. Anything requiring shell access would break iOS.

## Architecture

The source lives in a flat `src/` directory. Each module has a narrow
responsibility; test files sit next to their source.

```bash
ls src/*.ts | grep -v '\.test\.ts$'
```

```output
src/content-processor.ts
src/github-service.ts
src/main.ts
src/publisher.ts
src/schema.ts
src/settings.ts
src/test-preload.ts
src/types.ts
```

**Module responsibilities**

| Module | Role |
|---|---|
| `main.ts` | Plugin entry point — command registration, settings load with shape validation, publish dispatch, warning aggregation |
| `publisher.ts` | Orchestration — four publish workflows (single/batch × direct/PR), image resolution, read-failure surfacing, error recovery |
| `content-processor.ts` | Transform pipeline — frontmatter, callouts, mermaid, images, wikilinks, slug sanitization |
| `github-service.ts` | Octokit wrapper — branch/PR/blob/tree/commit via REST; iOS-safe base64; non-fatal label failures |
| `schema.ts` | Frontmatter split (LF + CRLF) + publish-flag gate + required-field validation |
| `settings.ts` | Plugin settings UI with debounced save and GitHub connection test |
| `types.ts` | Shared types: `PublisherSettings`, `PublishResult`, `BatchPublishResult`, `PublishWarning`, plus `parseSettings` and `isPlainObject` helpers |
| `test-preload.ts` | Consolidated mocks for `obsidian` imports in tests |

**Data flow for a single publish:** `main` → `Publisher.publishNote*` →
(read file, `schema.splitFrontmatter`, gate, validate) →
`ContentProcessor.processFromSplit` → `Publisher.resolveImages` →
`GitHubService.commitFiles` → optional `createPullRequest`.

## Entry point: `main.ts`

The plugin class extends Obsidian's `Plugin`. On load it hydrates settings,
installs the settings tab, and registers two commands: "Publish current note"
(editor-bound) and "Publish all notes" (vault-wide).

```bash
sed -n '60,89p' src/main.ts
```

```output
  async onload() {
    await this.loadSettings();

    // Register settings tab
    this.settingTab = new PublisherSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

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
```

**Publisher access is deliberately per-call.** The `publisher` getter
returns a *fresh* `Publisher` each time. Commands assign it to a local once
so progress notices and the call chain share a single instance. The
`onProgress` callback fires a transient `Prepared: done/total` notice
during batch preparation.

```bash
sed -n '48,58p' src/main.ts
```

```output
export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;
  private settingTab?: PublisherSettingTab;

  // Constructs a fresh Publisher on each access; assign to a local once per command.
  // Reading `this.publisher` twice yields two distinct instances.
  private get publisher(): Publisher {
    return new Publisher(this.app.vault, this.settings, (done, total) => {
      new Notice(`Prepared: ${done}/${total}`);
    });
  }
```

**Settings load is shape-validated.** `loadSettings` runs persisted data
through `parseSettings` (in `types.ts`), which falls back per-field to
`DEFAULT_SETTINGS` on type mismatch. This guards against corrupted or
hand-edited `data.json` — `prLabels` as a string, `frontmatterTemplate`
as `null`, `usePullRequests` as a string — that previously crashed
downstream code. The migration check (existing users → `usePullRequests:
false`) reads raw `data` so the "no key present" signal isn't erased by
`parseSettings`'s default fill-in.

```bash
sed -n '96,109p' src/main.ts
```

```output
  async loadSettings() {
    const data = await this.loadData();
    this.settings = parseSettings(data);

    // Migration: existing users (data exists, no usePullRequests field) default
    // to false to preserve pre-PR-workflow behavior. Check raw data so the
    // signal isn't erased by parseSettings's default fill-in.
    if (isPlainObject(data) && !("usePullRequests" in data)) {
      this.settings.usePullRequests = false;
      await this.saveSettings();
    }
  }

  async saveSettings() {
```

**Warnings are kind-tagged.** Non-fatal conditions travel through
`PublishResult.warnings` (per file) and `BatchPublishResult.warnings`
(batch-level, e.g. PR label apply failure) as a discriminated union.
Image warnings share a `name` field; `pr-label-failed` carries
`labels` and `error`. Image-kind dispatch goes through
`notifyImageWarnings`, which uses `Extract<PublishWarning, { name:
string }>` to narrow the shape; the `pr-label-failed` branch is
inline because its shape diverges.

```bash
sed -n '14,46p' src/main.ts
```

```output
type NamedImageWarning = Extract<PublishWarning, { name: string }>;

function notifyImageWarnings(
  warnings: PublishWarning[],
  kind: NamedImageWarning["kind"],
  format: (names: string[]) => string,
): void {
  const filtered = warnings.filter(
    (w): w is NamedImageWarning => w.kind === kind,
  );
  if (filtered.length === 0) return;
  const names = [...new Set(filtered.map((w) => w.name))];
  new Notice(format(names));
}

function notifyWarnings(warnings: PublishWarning[]): void {
  notifyImageWarnings(
    warnings,
    "image-failed",
    (names) => `Warning: ${names.length} image(s) failed: ${names.join(", ")}`,
  );
  notifyImageWarnings(
    warnings,
    "image-collision",
    (names) =>
      `Warning: ${names.length} image basename(s) collide, skipped: ${names.join(", ")}`,
  );
  const labelFailures = warnings.filter((w) => w.kind === "pr-label-failed");
  if (labelFailures.length > 0) {
    const all = [...new Set(labelFailures.flatMap((w) => w.labels))];
    new Notice(`Warning: failed to apply PR labels: ${all.join(", ")}`);
  }
}
```

**Batch warnings flow into the notifier too.** The batch publish path
sources warnings from both per-file results and `BatchPublishResult.warnings`
so PR-level conditions surface in the same place as image-level ones.

```bash
sed -n '199,202p' src/main.ts
```

```output
      notifyWarnings([
        ...result.results.flatMap((r) => r.warnings),
        ...(result.warnings ?? []),
      ]);
```

## The schema module

`schema.ts` is the single source of truth for frontmatter handling. It
exports three constants (the publish field, the sentinel value, and the
required-field list), a `splitFrontmatter` parser, a `hasPublishFlag`
gate, and a `validateFrontmatter` check.

**Sentinel: `status: publish`** — this is *intent*, not state. The
`FRONTMATTER_REGEX` accepts both LF and CRLF line endings (the optional
`\r?` makes Windows / Windows-host iCloud / Dropbox files parse instead
of silently failing the gate).

```bash
sed -n '1,9p' src/schema.ts
```

```output
import { parseYaml } from "obsidian";

export const PUBLISH_STATUS_FIELD = "status" as const;
export const PUBLISH_STATUS_VALUE = "publish" as const;
export const REQUIRED_FRONTMATTER_FIELDS = ["title", "date"] as const;

export type Frontmatter = Record<string, unknown>;

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
```

**`splitFrontmatter` is forgiving.** A missing delimiter yields `{}` +
full body; a YAML parse error logs and returns `{}` + the body portion.
Non-object YAML (arrays, scalars) is coerced to `{}`. This means the
*presence* of the `status: publish` flag becomes the gate — callers rely
on `hasPublishFlag` rather than on structural YAML validity.

```bash
sed -n '11,32p' src/schema.ts
```

```output
export function splitFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const parsed = parseYaml(match[1]);
    const frontmatter =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Frontmatter)
        : {};
    return { frontmatter, body: match[2] };
  } catch (error) {
    console.error("Failed to parse frontmatter:", error);
    return { frontmatter: {}, body: match[2] };
  }
}

export function hasPublishFlag(frontmatter: Frontmatter): boolean {
  return frontmatter[PUBLISH_STATUS_FIELD] === PUBLISH_STATUS_VALUE;
}
```

**Required-field validation aggregates all issues.** Each missing/invalid
field contributes to the joined error message so a single publish attempt
reports every problem at once, not just the first.

```bash
sed -n '34,55p' src/schema.ts
```

```output
type RequiredField = (typeof REQUIRED_FRONTMATTER_FIELDS)[number];

function validateField(value: unknown, field: RequiredField): string | null {
  if (value === undefined || value === null) return `${field} is missing`;
  if (typeof value === "string") {
    return value.trim() === "" ? `${field} is missing` : null;
  }
  if (field === "date" && value instanceof Date) return null;
  const expected = field === "date" ? "string or date" : "string";
  return `${field} must be a ${expected}`;
}

export function validateFrontmatter(frontmatter: Frontmatter): string | null {
  const issues: string[] = [];
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    const issue = validateField(frontmatter[field], field);
    if (issue) issues.push(issue);
  }
  return issues.length === 0
    ? null
    : `Invalid frontmatter: ${issues.join("; ")}`;
}
```

## The Publisher class

`Publisher` owns orchestration. It's constructed fresh per command
(see the getter in `main.ts`) and holds a `ContentProcessor`, a
`GitHubService`, and an optional progress callback. The `baseBranch`
and `prLabels` getters apply literal fallback defaults so empty-string
or missing settings don't leak into API calls.

```bash
sed -n '53,78p' src/publisher.ts
```

```output
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
```

**Four public workflows.** Single-file and batch, each in direct-commit
and branch+PR flavors.

- `publishNote` — thin wrapper over `publishFileToTarget` (no branch).
- `publishNoteWithPR` — creates a timestamped branch, commits, opens a
  PR, rolls back the branch on commit failure (but **not** on label
  failure — labels surface as warnings, see GitHub service section).
- `publishAll` — scans the vault, prepares a batch, commits to
  `baseBranch` atomically. Read failures from the scan thread back as
  per-file failed results.
- `publishAllWithPR` — scans, prepares, commits to a single batch
  branch, opens one PR listing all succeeded files. Read failures and
  PR-level warnings flow into the batch result.

The common shape is: read → split → gate → validate → transform →
resolve images → commit. PR variants add branch lifecycle + PR creation
around that.

```bash
sed -n '200,251p' src/publisher.ts
```

```output
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
```

**Vault scan surfaces read failures.** `getPublishableFiles` reads each
markdown file, splits frontmatter, and keeps notes with the publish
flag. Files that fail to read are no longer silently dropped — they
become per-file failed results that flow into the batch result so a
mobile user sees them in a Notice instead of `console.error`.

```bash
sed -n '483,510p' src/publisher.ts
```

```output
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
```

**Read-failure summarization.** When the only failures are read failures
(no commit was attempted), the batch-level `error` is set to a summary
so `main.ts` can surface it in a Notice rather than the generic "All
files failed to process" message. Single read failure → its message
verbatim; multiple → "Failed to read N files".

```bash
sed -n '40,52p' src/publisher.ts
```

```output
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

```

**Batch preparation deduplicates by target path.** An `entryMap` keyed
by `contentDir/filename` means two notes that sanitize to the same slug
collapse into one entry (last-write-wins). This is a known gap — slug
collision precheck is tracked in issue #166.

```bash
sed -n '518,560p' src/publisher.ts
```

```output
  private async prepareBatch(
    files: Array<{ file: TFile; frontmatter: Frontmatter; body: string }>,
  ): Promise<{
    results: PublishResult[];
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>;
  }> {
    const results: PublishResult[] = [];
    const entryMap = new Map<string, string | ArrayBuffer>();
    const filesByBasename = this.buildFilesByBasename();

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
```

**Image resolution is basename-based with collision detection.** The
vault is indexed by file basename once, then each referenced image
lookup yields zero (missing → warning), one (read + rewrite path), or
many matches (collision → skip + warning with sorted paths). The
sorted paths make collision warnings stable across runs.

```bash
sed -n '113,160p' src/publisher.ts
```

```output
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
```

**Error recovery in the batch-PR flow.** Three responsibilities are
teased apart: commit (`commitPreparedBatch`), PR creation
(`createBatchPR`), and outer recovery (`recoverFailedBatch`). The
recovery path takes both `prepared` and `readFailures` separately so
read failures aren't relabeled with the outer error message —
`markResultsFailed` only touches the prepared results.

```bash
sed -n '364,388p' src/publisher.ts
```

```output
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

```

**`markResultsFailed` is prefix-parameterized.** Commit failures get a
`"Commit failed: ..."` prefix from `commitPreparedBatch` (the only
place where commit was the actual cause). The recovery path calls it
without a prefix because the underlying error message ("Failed to
create pull request: ..." / "Failed to create branch ...") is
self-describing.

```bash
sed -n '80,93p' src/publisher.ts
```

```output
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
```

## Content transformation pipeline

`ContentProcessor.processFromSplit` is the pipeline. Order matters —
comments strip first so commented-out markup never reaches later
regexes; image references run before note embeds because note embeds
fall through to image conversion for the image case.

```bash
sed -n '26,55p' src/content-processor.ts
```

```output
  processFromSplit(
    frontmatter: Frontmatter,
    body: string,
    originalFilename: string,
  ): ProcessedContent {
    const processedFrontmatter = this.processFrontmatter(frontmatter);
    const images = this.extractImages(body);

    let processedBody = body;
    processedBody = this.stripComments(processedBody);
    processedBody = this.convertHighlights(processedBody);
    processedBody = this.convertCallouts(processedBody);
    processedBody = this.convertMermaid(processedBody);
    processedBody = this.convertImageReferences(processedBody);
    processedBody = this.convertNoteEmbeds(processedBody);
    processedBody = this.convertWikilinks(processedBody);

    const processedContent = this.assembleFrontmatter(
      processedFrontmatter,
      processedBody,
    );
    const sanitizedFilename = this.sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
      frontmatter: processedFrontmatter,
    };
  }
```

**Frontmatter processing.** The status field is optionally stripped
(controlled by `removePublishFlag`), template fields are merged without
overriding existing keys, and a `date` fallback is injected if the note
lacks one. The `date` fallback is a carryover that the schema validator
now makes unreachable via `publishNote` paths — the public `process()`
entry is still reachable by callers that bypass validation.

```bash
sed -n '60,86p' src/content-processor.ts
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

**Callout conversion maps Obsidian types to a smaller set.** The static
`CALLOUT_TYPE_MAP` collapses Obsidian's ~20 callout types into 7
notice types (`note`, `info`, `tip`, `question`, `warning`, `error`,
`example`). The composite-spec plan in `TODO.md` calls for passing the
types through verbatim in a future release — see issue #168.

```bash
sed -n '160,174p' src/content-processor.ts
```

```output
  /**
   * Convert Obsidian callouts to notice shortcodes
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

**Image references strip Obsidian sizing suffixes.** The Obsidian
`![[img.png|300]]` syntax has the `|300` dropped cleanly (current
behavior — see issue #170 for the `|alt` enhancement). The URL path is
derived from `imageDir` with the `static/` prefix stripped, since Hugo
serves `static/` at the site root.

```bash
sed -n '253,263p' src/content-processor.ts
```

```output
  private convertImageReferences(content: string): string {
    const urlPath = this.imageUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const imageName = this.stripImageSize(raw);
      if (!IMAGE_EXTENSIONS.test(imageName)) {
        return _match; // not an image — leave for convertNoteEmbeds
      }
      const sanitizedName = this.sanitizeFilename(imageName);
      return `![${imageName}](${urlPath}/${sanitizedName})`;
    });
  }
```

**Wikilinks and note embeds emit Hugo `ref` shortcodes.** The wikilink
regex handles display text, heading anchors, and the combination. The
composite-spec plan proposes replacing `{{< ref >}}` with plain
`/posts/slug/` paths gated by the publish set (issue #169) — the trade
is decoupling from Hugo's build-time ref resolver.

```bash
sed -n '217,247p' src/content-processor.ts
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

**Filename sanitization.** The core `sanitizeName` lowercases, converts
whitespace to hyphens, strips non-alphanumerics (keeping hyphens and
underscores), collapses runs of hyphens, trims edges, and falls back to
`"untitled"`. `sanitizeFilename` preserves the file extension;
`sanitizeSlug` drops it. Both `sanitizeImageName` and wikilink slugging
route through this.

```bash
sed -n '269,302p' src/content-processor.ts
```

```output
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
    return name + extension;
  }
```

## GitHub service

`GitHubService` is a thin Octokit wrapper. Every method that touches
the repo routes through the REST API — no shell-out, no file system,
iOS-safe. The surface is deliberately small so a future client swap
stays cheap.

**iOS-safe base64.** Node's `Buffer` isn't available on iOS, and
`btoa` on a full payload blows the call stack for large binaries. The
`toBase64` helper chunks `fromCharCode` at 8192 bytes to avoid both.

```bash
sed -n '40,52p' src/github-service.ts
```

```output
   * Convert string or ArrayBuffer to base64 (cross-platform, chunked for large payloads)
   */
  private toBase64(input: string | ArrayBuffer): string {
    const bytes =
      typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return btoa(chunks.join(""));
  }
```

**Atomic multi-file commits via the Git Trees API.** Rather than one
commit per file (which would leak half-published state on failure),
`commitFiles` creates blobs sequentially, builds a single tree over the
base commit's tree, creates one commit pointing at it, and fast-forwards
the branch ref. Blobs are serialized — parallelizing them provoked
GitHub rate limits during batch publishes.

```bash
sed -n '171,231p' src/github-service.ts
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

**Branch creation retries on 422.** `createBranchWithRetry` collides on
a timestamp suffix if another publish ran in the same second, and
applies a numeric suffix up to 3 attempts. The inner `createBranch`
deliberately re-throws a `RequestError` without wrapping it — the
retry logic needs the status code preserved.

```bash
sed -n '247,282p' src/github-service.ts
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

**PR creation with non-fatal label warnings.** `pulls.create` and
`addLabels` are now in separate try blocks. Label apply failure
(unknown label, permissions, transient network) logs `console.warn`
and returns a `pr-label-failed` warning alongside the PR url —
**without throwing**. This avoids the orphaned-PR side effect from
1.4.0 where the cleanupBranch reaction to a label-failure would delete
the just-created PR's head ref.

```bash
sed -n '119,167p' src/github-service.ts
```

```output
  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string,
    labels?: string[],
  ): Promise<{ url: string; number: number; warnings: PublishWarning[] }> {
    let response: Awaited<ReturnType<typeof this.octokit.rest.pulls.create>>;
    try {
      response = await this.octokit.rest.pulls.create({
        owner: this.settings.repoOwner,
        repo: this.settings.repoName,
        title,
        head,
        base,
        body,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create pull request: ${error.message}`);
      }
      throw error;
    }

    const warnings: PublishWarning[] = [];
    if (labels && labels.length > 0) {
      try {
        await this.octokit.rest.issues.addLabels({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          issue_number: response.data.number,
          labels,
        });
      } catch (error) {
        const message = errorMessage(error);
        console.warn(
          `PR labels not applied (${labels.join(", ")}): ${message}`,
        );
        warnings.push({ kind: "pr-label-failed", labels, error: message });
      }
    }

    return {
      url: response.data.html_url,
      number: response.data.number,
      warnings,
    };
  }

```

## Settings UI

`PublisherSettingTab` renders the settings panel. Persistence is
**debounced to 500ms** (trailing edge) via Obsidian's `debounce`
helper. The plugin hooks `hide()` on the tab and `onunload()` on the
plugin to flush a pending save and then cancel the timer — without the
flush-before-cancel ordering (added in 1.4.0), in-flight edits could
be lost on tab switch or plugin reload.

```bash
sed -n '89,102p' src/settings.ts
```

```output
export class PublisherSettingTab extends PluginSettingTab {
  plugin: ObsidianPublisher;
  readonly save: Debouncer<[], Promise<void>>;

  constructor(app: App, plugin: ObsidianPublisher) {
    super(app, plugin);
    this.plugin = plugin;
    this.save = debounce(() => this.plugin.saveSettings(), 500, true);
  }

  hide(): void {
    this.save.cancel();
    void this.plugin.saveSettings();
  }
```

**Input sanitization at the boundary.** GitHub owner, repo name, and
path settings are cleaned on every keystroke to prevent path
traversal and to keep fields inside GitHub's own length/character
rules. These helpers are extracted to top-level functions so they can
be unit-tested in isolation.

```bash
sed -n '15,35p' src/settings.ts
```

```output
export function sanitizeGitHubOwner(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 39);
}

export function sanitizeRepoName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_.]/g, "")
    .slice(0, 100);
}

export function sanitizePath(value: string): string {
  return value
    .trim()
    .replace(/\.\./g, "")
    .replace(/~/g, "")
    .replace(/^\/+|\/+$/g, "");
}
```

**Frontmatter template parsing falls back to a line-based parser.**
If the user's textarea input doesn't parse as YAML, a simple
`key: value` parser runs instead so a stray formatting glitch doesn't
silently blank their template.

```bash
sed -n '50,77p' src/settings.ts
```

```output
export function parseFrontmatter(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const parsed = parseYaml(trimmed);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return parseSimpleFrontmatter(trimmed);
  }
}

function parseSimpleFrontmatter(text: string): Record<string, string> {
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

## Types and warnings

The `PublishWarning` discriminated union is the contract between the
publisher (which produces warnings) and `main.ts` (which renders per-kind
notices). The 1.4.1 release added a third kind, `pr-label-failed`, with
a different shape (`labels` + `error` rather than `name`).
`BatchPublishResult.warnings` is optional so PR-level conditions
(currently just label failures) can travel alongside per-file warnings.

```bash
sed -n '57,100p' src/types.ts
```

```output
/**
 * Non-fatal condition noticed during publish. Tagged for test stability
 * and per-kind display in main.ts.
 */
export type PublishWarning =
  | { kind: "image-failed"; name: string }
  | { kind: "image-collision"; name: string; paths: string[] }
  | { kind: "pr-label-failed"; labels: string[]; error: string };

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
  /** Non-fatal conditions noticed during publish; always present, [] when none */
  warnings: PublishWarning[];
  /** URL to the pull request if created (single-file PR workflow only) */
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
  /** Batch-level failure (e.g. commitFiles or PR creation threw) */
  error?: string;
  /** Batch-level non-fatal conditions (e.g. PR label apply failed) */
  warnings?: PublishWarning[];
}
```

**Settings shape validation lives in `types.ts`.** `parseSettings`
checks each field's runtime type and falls back to `DEFAULT_SETTINGS`
on mismatch. `isPlainObject` is exported because `main.ts` reuses it
to detect whether persisted data was a real object (for the migration
gate).

```bash
sed -n '109,118p' src/types.ts
```

```output
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

```

## Tests

Tests live alongside source with `.test.ts` suffixes. `bun:test` is the
runner; `src/test-preload.ts` (loaded via `bunfig.toml`) consolidates
mocks for the `obsidian` module — `parseYaml`, `stringifyYaml`,
`debounce`, and a fake `Notice`. That one-file mock means individual
tests don't each re-mock Obsidian.

```bash
ls src/*.test.ts
```

```output
src/content-processor.test.ts
src/github-service.test.ts
src/publisher.test.ts
src/schema.test.ts
src/settings.test.ts
src/types.test.ts
```

## Concerns and known gaps

The composite-spec alignment plan in `TODO.md` is an umbrella
(issue #172). The 1.4.x bug backlog is closed; remaining gaps are all
forward-looking enhancements:

- **#166 slug collision precheck** — two notes that sanitize to the
  same slug silently collapse in `prepareBatch`'s `entryMap`. Composite
  plan calls for blocking publish with a named-conflict error.
- **#168 callout types pass-through** — the 20→7 collapse in
  `CALLOUT_TYPE_MAP` loses information; the composite plan calls for
  letting theme CSS render the original type.
- **#170 image `|alt` syntax** — `![[img.png|alt]]` alt text is
  currently discarded; only `|300` sizing is cleanly stripped.
- **#169 wikilinks emit `/posts/slug/`** — the current `{{< ref >}}`
  output couples to Hugo's build-time ref resolver. Composite plan
  proposes plain markdown links with publish-set gating.
- **#164 configurable shortcode names** — `notice` and `mermaid`
  shortcode names are hardcoded; composite plan adds settings.
- **#165 `strippedFrontmatterFields` setting** — replaces
  `removePublishFlag` with a configurable list (default-strips `status`
  and `lastmod`).
- **#167 strict `date` requirement** — drop the `new Date()` fallback
  in `processFrontmatter` since the schema validator already requires it.
- **#171 ship `hugo-shortcodes/` reference templates** — the publisher
  emits shortcode syntax with no way to verify the destination site
  defines the templates.

**Code smell: `process()` bypasses the schema gate.** The public
`ContentProcessor.process(content, filename)` path splits frontmatter
and runs the pipeline *without* calling `hasPublishFlag` or
`validateFrontmatter`. Only `processFromSplit` is used by the
publisher; `process` is reachable from tests and would process an
unvalidated file if any future caller used it.

**Cross-platform hygiene.** No top-to-bottom guard prevents a future
change from importing `node:fs`, `node:path`, or `child_process` into
the runtime bundle — only code review catches it. A Biome rule or a
bundle-size check would enforce the iOS constraint mechanically.

**Content-processor frontmatter `date` fallback is dead code on the
primary path.** Since 1.4.0, `publishFileToTarget` and `prepareBatch`
reject any note missing `date` before the content processor runs; the
`processed.date = new Date().toISOString()` branch survives only for
the public `process()` entry point. Issue #167 tracks removal as part
of the composite spec work.

