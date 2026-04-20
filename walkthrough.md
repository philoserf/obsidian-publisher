# Obsidian Publisher Walkthrough

*2026-04-20T15:43:18Z by Showboat 0.6.1*
<!-- showboat-id: 332d17de-2bbd-4eaf-9f1a-8f253b839e88 -->

## Overview

Obsidian Publisher is an Obsidian plugin that publishes notes marked `status: publish` from an Obsidian vault to a GitHub repository for Hugo static-site processing. Every publish creates a timestamped feature branch, commits the transformed files, and opens a pull request — the "direct commit" workflow was retired in 1.6.0.

**Key constraint:** all GitHub operations use Octokit's REST API. Never local Git commands or shell-bound tools — the plugin must work on iOS.

**Stack:** TypeScript, Bun runtime + bundler + test runner, Biome for format/lint, Octokit for GitHub API.

## Architecture

The source lives in `src/`, with one file per responsibility:

```bash
ls src/*.ts | sort
```

```output
src/content-processor.test.ts
src/content-processor.ts
src/github-service.test.ts
src/github-service.ts
src/main.test.ts
src/main.ts
src/publisher.test.ts
src/publisher.ts
src/schema.test.ts
src/schema.ts
src/settings.test.ts
src/settings.ts
src/test-preload.ts
src/types.test.ts
src/types.ts
```

Module boundaries:

- **`main.ts`** — Plugin entry. Registers commands, loads/saves settings, routes commands to `Publisher`, renders user Notices.
- **`publisher.ts`** — Publishing orchestration. `publishNote` (single) and `publishAll` (batch) share a `runPublishWorkflow` helper.
- **`github-service.ts`** — Octokit wrapper. Branch/commit/PR/delete primitives; a `rethrowWithPrefix` helper normalizes error narrowing.
- **`content-processor.ts`** — Obsidian-to-Hugo transforms: wikilinks, image embeds, callouts, mermaid, frontmatter shaping.
- **`schema.ts`** — Frontmatter parsing, the `status: publish` gate, `title`/`date` validation.
- **`settings.ts`** — Plugin settings UI and input sanitizers.
- **`types.ts`** — Shared types (`PublisherSettings`, `PublishResult`, `BatchPublishResult`, `PublishWarning`, `ProcessedContent`) and `parseSettings` — the single load-time data validator.

Tests live next to source as `*.test.ts`. Bun's runner is configured via `bunfig.toml` to preload a mock for the `obsidian` module and Octokit:

```bash
cat bunfig.toml
```

```output
[test]
preload = ["./src/test-preload.ts"]
```

## Entry Point: main.ts

The plugin registers two commands on load:

```bash
sed -n '67,96p' src/main.ts
```

```output
    );
  }
  const labelFailures = warnings.filter((w) => w.kind === "pr-label-failed");
  if (labelFailures.length > 0) {
    const all = [...new Set(labelFailures.flatMap((w) => w.labels))];
    new Notice(`Warning: failed to apply PR labels: ${all.join(", ")}`);
  }
}

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

  async onload() {
    await this.loadSettings();

    // Register settings tab
    this.settingTab = new PublisherSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    // Register commands
    this.addCommand({
```

Both command callbacks delegate to private methods on the plugin class. Those methods:
1. Build a `Publisher` via a cached getter
2. Run `publisher.validateSettings()` — refuses publish with a Notice if GitHub creds or content/image dirs are missing
3. Call `publisher.publishNote(file)` or `publisher.publishAll()`
4. Classify the result and fire a Notice

Batch classification is factored into a pure helper for test coverage — the helper takes a `BatchPublishResult` and returns exactly one Notice string:

```bash
sed -n '27,34p' src/main.ts
```

```output
export function batchNoticeText(result: BatchPublishResult): string {
  if (result.error) return `✗ Failed to publish: ${result.error}`;
  if (result.total === 0) return "No publishable notes found";
  if (result.successful === 0) {
    return "All files failed to process. No PR created.";
  }
  return `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed`;
}
```

Error-first ordering matters: `result.error` wins over `total === 0`, so a batch-level abort (e.g., filename collision) surfaces the real cause instead of the misleading "No publishable notes found."

## Types & Settings: types.ts

All shared types and `parseSettings` (the single load-time validator) live here. `PublisherSettings` defines the persisted config shape:

```bash
sed -n '6,29p' src/types.ts
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
  /** Frontmatter field names to strip when publishing */
  strippedFrontmatterFields: string[];
  /** Base branch to create PRs against (default: "main") */
  baseBranch: string;
  /** Labels to apply to pull requests */
  prLabels: string[];
  /** Hugo shortcode name for Obsidian callouts (default: "callout") */
  calloutShortcodeName: string;
  /** Hugo shortcode name for mermaid diagrams (default: "mermaid") */
  mermaidShortcodeName: string;
}
```

`parseSettings` is the only entry path for persisted data. It type-checks each field, falling back to `DEFAULT_SETTINGS` on type mismatch; a single corrupted field does not wipe the user's config:

```bash
sed -n '159,200p' src/types.ts
```

```output
/**
 * Trim-and-filter persisted prLabels. Whitespace-only labels are dropped
 * (matching the settings UI input sanitizer); an empty result falls back
 * to DEFAULT_SETTINGS.prLabels, symmetric with baseBranch handling.
 */
function resolvePrLabels(value: unknown): string[] {
  if (!isStringArray(value)) return DEFAULT_SETTINGS.prLabels;
  const trimmed = value.map((l) => l.trim()).filter((l) => l.length > 0);
  return trimmed.length > 0 ? trimmed : DEFAULT_SETTINGS.prLabels;
}

/**
 * Validate persisted plugin data against the PublisherSettings shape.
 * Per-field fallback to DEFAULT_SETTINGS on type mismatch — a single
 * corrupted field shouldn't wipe the user's configuration.
 */
export function parseSettings(data: unknown): PublisherSettings {
  const d = isPlainObject(data) ? data : {};
  return {
    githubToken:
      typeof d.githubToken === "string"
        ? d.githubToken
        : DEFAULT_SETTINGS.githubToken,
    repoOwner:
      typeof d.repoOwner === "string"
        ? d.repoOwner
        : DEFAULT_SETTINGS.repoOwner,
    repoName:
      typeof d.repoName === "string" ? d.repoName : DEFAULT_SETTINGS.repoName,
    contentDir:
      typeof d.contentDir === "string"
        ? d.contentDir
        : DEFAULT_SETTINGS.contentDir,
    imageDir:
      typeof d.imageDir === "string" ? d.imageDir : DEFAULT_SETTINGS.imageDir,
    frontmatterTemplate: isPlainObject(d.frontmatterTemplate)
      ? d.frontmatterTemplate
      : DEFAULT_SETTINGS.frontmatterTemplate,
    strippedFrontmatterFields: resolveStrippedFields(d),
    baseBranch:
      typeof d.baseBranch === "string" && d.baseBranch.trim() !== ""
        ? d.baseBranch
```

Two behaviors worth noting:

- `baseBranch` accepts non-empty strings only — trims then falls back if empty. Guarantees the invariant that downstream code assumes.
- `strippedFrontmatterFields` is resolved via `resolveStrippedFields`, which filters required fields (`title`, `date`) so a misconfigured list can't strip them:

```bash
sed -n '138,152p' src/types.ts
```

```output
/**
 * Resolve strippedFrontmatterFields from persisted data. Accepts the
 * current field; falls back to the legacy removePublishFlag boolean for
 * migration; otherwise returns the default list.
 */
function resolveStrippedFields(d: Record<string, unknown>): string[] {
  if (isStringArray(d.strippedFrontmatterFields)) {
    return filterRequiredFields(d.strippedFrontmatterFields);
  }
  const defaults = [...DEFAULT_SETTINGS.strippedFrontmatterFields];
  if (d.removePublishFlag === false) {
    return filterRequiredFields(defaults.filter((f) => f !== "status"));
  }
  return filterRequiredFields(defaults);
}
```

`removePublishFlag` is the legacy boolean setting that `strippedFrontmatterFields` replaced in 1.4.0; the `false` branch preserves the migration for users who persisted it.

`PublishResult` and `BatchPublishResult` are the return shapes callers consume:

```bash
sed -n '75,114p' src/types.ts
```

```output
export type PublishWarning =
  | { kind: "image-failed"; name: string }
  | { kind: "image-collision"; name: string; paths: string[] }
  | {
      kind: "image-target-collision";
      targetPath: string;
      sourceNames: string[];
    }
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
```

## Frontmatter Gate: schema.ts

Two functions guard publishing: `hasPublishFlag` (intent check) and `validateFrontmatter` (correctness check). Constants define the publish sentinel and required fields:

```bash
sed -n '1,10p' src/schema.ts
```

```output
import { parseYaml } from "obsidian";

export const PUBLISH_STATUS_FIELD = "status" as const;
export const PUBLISH_STATUS_VALUE = "publish" as const;
export const REQUIRED_FRONTMATTER_FIELDS = ["title", "date"] as const;

export type Frontmatter = Record<string, unknown>;

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

```

```bash
sed -n '30,55p' src/schema.ts
```

```output
      body: match[2],
      error: `Malformed frontmatter YAML: ${message}`,
    };
  }
}

export function hasPublishFlag(frontmatter: Frontmatter): boolean {
  return frontmatter[PUBLISH_STATUS_FIELD] === PUBLISH_STATUS_VALUE;
}

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
```

`date` accepts both strings (e.g. `"2026-04-20"`) and JavaScript `Date` instances (because `parseYaml` coerces ISO-like dates). All other required fields must be non-empty strings. Errors from multiple missing/invalid fields are joined into one message so the user sees every problem at once.

`hasPublishFlag` is an *intent* check — missing or non-`publish` status is silent (file just doesn't enter the publish set). `validateFrontmatter` is a *correctness* check — an intended-to-publish file with missing `title` or `date` becomes a per-file failure.

## Publisher: the orchestration

`Publisher` owns the publish workflow. Its public surface is three methods: `publishNote`, `publishAll`, `validateSettings`. Internally, both publish methods share a private `runPublishWorkflow` for the branch-commit-PR dance.

`publishNote` reads, gates, validates, then delegates:

```bash
sed -n '234,278p' src/publisher.ts
```

```output
        if (!imageContent) {
          imageContent = await this.vault.readBinary(sourceFile);
          readCache.set(sourceFile.path, imageContent);
        }
        targetPathOwners.set(imgPath, imageName);
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
   * Publish a single note to GitHub: creates a feature branch, commits the
   * file to it, and opens a pull request against baseBranch.
   */
  async publishNote(file: TFile): Promise<PublishResult> {
    let content: string;
    try {
      content = await this.vault.read(file);
    } catch {
      return failedResult(file.path, "Failed to read file");
    }

    const { frontmatter, body, error: parseError } = splitFrontmatter(content);
    if (parseError) {
      return failedResult(file.path, parseError);
    }
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

    const result = await this.runPublishWorkflow({
```

Single-note publishes route through `prepareBatch` with a one-element list — the same pipeline batches use. The trailing adapter reconciles the batch-shaped return to a single `PublishResult`.

`publishAll` adds the vault scan and collision precheck, then delegates to the same workflow:

```bash
sed -n '283,320p' src/publisher.ts
```

```output
        return { prepared: batch.results, fileEntries: batch.fileEntries };
      },
      synthesizeFailures: (message) => [failedResult(file.path, message)],
      commitMessage: () => `Publish: ${file.basename}`,
      prTitle: () => `Publish: ${file.basename}`,
      prBody: () => `Published from Obsidian\n\n**File:** ${file.path}`,
    });

    const single =
      result.results[0] ??
      failedResult(file.path, result.error ?? "Unknown error");
    if (!single.success) {
      return single;
    }
    return {
      ...single,
      prUrl: result.prUrl,
      warnings: [...single.warnings, ...result.warnings],
    };
  }

  /**
   * Publish all notes with status: publish to a single branch and PR.
   */
  async publishAll(): Promise<BatchPublishResult> {
    const { files, readFailures } = await this.getPublishableFiles();
    if (files.length === 0) {
      return buildBatchResult(readFailures, {
        error: summarizeReadFailures(readFailures),
      });
    }

    const collisions = this.detectFilenameCollisions(files);
    if (collisions.length > 0) {
      const collisionError = this.filenameCollisionError(collisions);
      const collisionFailures = this.synthesizeCollisionFailures(
        files,
        collisionError,
```

The collision precheck — added in 1.5.0 — blocks the batch before any GitHub API calls when two notes would sanitize to the same filename (e.g., `Hello World.md` and `hello world.md` both → `hello-world.md`). This surfaces synthetic per-file failures so the error reaches the user instead of being swallowed by the "no publishable notes" guard in `main.ts`.

`runPublishWorkflow` is where the branch-commit-PR sequence lives. It accepts closures for the caller's mode (single vs batch) so the workflow stays generic:

```bash
sed -n '353,425p' src/publisher.ts
```

```output
    results: PublishResult[],
    fileEntries: Array<{ path: string; content: string | ArrayBuffer }>,
    message: string,
  ): Promise<string | undefined> {
    if (fileEntries.length === 0) return undefined;
    try {
      await this.githubService.commitFiles(fileEntries, message, branchName);
      return undefined;
    } catch (error) {
      this.markResultsFailed(results, error, "Commit failed");
      return errorMessage(error);
    }
  }

  /**
   * Shared branch + commit + PR orchestration. Creates a branch first,
   * then calls the caller's `prepare` closure to produce the entries to
   * commit. If branch creation fails, `synthesizeFailures` is used to
   * build per-file failed results (so the user sees N failures, not just
   * a bare error). On any other failure, the prepared results are marked
   * failed. Callers supply the branch prefix plus the commit-message and
   * PR title/body builders so single-note and batch paths share this
   * workflow while keeping their distinct PR shapes.
   */
  private async runPublishWorkflow(opts: {
    branchPrefix: string;
    readFailures: PublishResult[];
    prepare: () => Promise<{
      prepared: PublishResult[];
      fileEntries: Array<{ path: string; content: string | ArrayBuffer }>;
    }>;
    synthesizeFailures: (message: string) => PublishResult[];
    commitMessage: (successCount: number) => string;
    prTitle: (succeeded: PublishResult[]) => string;
    prBody: (succeeded: PublishResult[]) => string;
  }): Promise<BatchPublishResult> {
    let branchName: string;
    try {
      branchName = await this.githubService.createBranchWithRetry(
        opts.branchPrefix,
        this.baseBranch,
      );
    } catch (error) {
      const message = errorMessage(error);
      return buildBatchResult(
        [...opts.readFailures, ...opts.synthesizeFailures(message)],
        { error: message },
      );
    }

    let prepared: PublishResult[] = [];
    try {
      const batch = await opts.prepare();
      prepared = batch.prepared;

      const successCount = prepared.filter((r) => r.success).length;
      const commitError = await this.commitPreparedBatch(
        branchName,
        prepared,
        batch.fileEntries,
        opts.commitMessage(successCount),
      );

      const succeeded = prepared.filter((r) => r.success);
      const results = [...opts.readFailures, ...prepared];

      if (succeeded.length === 0) {
        await this.cleanupBranch(branchName);
        return buildBatchResult(results, { error: commitError });
      }

      const pr = await this.githubService.createPullRequest(
        branchName,
```

Two distinct failure paths:

1. **Branch creation fails** — nothing to clean up; return per-file failures synthesized by the caller's `synthesizeFailures` closure with the branch-error message.
2. **Anything after branch creation fails** — clean up the branch (best-effort), mark the already-prepared results as failed, or synthesize if `prepare` itself threw.

The call order is deliberate: branch first, then prepare. Preparing before branch creation would waste vault reads and image resolution when auth fails, and would mix validation results with a batch-level branch error in the user's per-file output.

`prepareBatch` does the per-file content transformation — validate, process, resolve images — accumulating results and a deduplicated entry map:

```bash
sed -n '492,540p' src/publisher.ts
```

```output

    for (const file of markdownFiles) {
      try {
        const content = await this.vault.read(file);
        const {
          frontmatter,
          body,
          error: parseError,
        } = splitFrontmatter(content);
        // A malformed frontmatter block hides publish intent — surface it
        // rather than silently skipping. We can't tell whether the user
        // meant status: publish when the YAML doesn't parse.
        if (parseError) {
          readFailures.push(failedResult(file.path, parseError));
          continue;
        }
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
    // Read each image source once per batch; multiple notes referencing
    // the same image share the buffer.
    const imageReadCache = new Map<string, ArrayBuffer>();
    // Target imgPath -> first imageName that claimed it. Surfaces silent
```

Key design choices here:

- **`entryMap` keyed on path** dedupes entries naturally — the same image referenced from multiple notes writes once.
- **`publishSet`** is the set of slugs being published in this operation; `ContentProcessor` uses it to gate wikilinks (in-set → markdown link; out-of-set → plain text).
- **Per-file validation failures** don't abort the batch — they land as failed results alongside successes. The batch as a whole still commits the valid files and opens a PR for them.

## Content Processing: content-processor.ts

The pipeline lives in `processFromSplit`, which runs transforms in a specific order:

```bash
sed -n '37,67p' src/content-processor.ts
```

```output
  processFromSplit(
    frontmatter: Frontmatter,
    body: string,
    originalFilename: string,
    publishSet: Set<string> = new Set(),
  ): ProcessedContent {
    const processedFrontmatter = this.processFrontmatter(frontmatter);
    const images = this.extractImages(body);

    let processedBody = body;
    processedBody = this.stripComments(processedBody);
    processedBody = this.convertHighlights(processedBody);
    processedBody = this.convertCallouts(processedBody);
    processedBody = this.convertMermaid(processedBody);
    processedBody = this.convertImageReferences(processedBody);
    processedBody = this.convertNoteEmbeds(processedBody, publishSet);
    processedBody = this.convertWikilinks(processedBody, publishSet);

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

Order matters: image references must be converted before note embeds (both match `![[...]]` but image references check for image extensions first). Wikilinks run last so they don't swallow heading anchors that callouts or other transforms might have touched.

A few transforms worth highlighting.

**Callouts** convert Obsidian callout syntax to Hugo shortcodes, passing the type through verbatim:

```bash
sed -n '165,178p' src/content-processor.ts
```

```output
  private convertCallouts(content: string): string {
    const name = this.settings.calloutShortcodeName;
    return content.replace(
      /^> \[!([\w-]+)\][-+]?(?: (.+))?\n((?:^> .*(?:\n|$))*)/gm,
      (_match, type: string, title: string | undefined, body: string) => {
        const calloutType = type.toLowerCase();
        const cleanBody = body.replace(/^> ?/gm, "").trim();
        const titleAttr = title
          ? ` "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
          : "";
        return `{{< ${name} ${calloutType}${titleAttr} >}}\n${cleanBody}\n{{< /${name} >}}`;
      },
    );
  }
```

Foldable callouts (`> [!note]-` / `> [!note]+`) have their `-`/`+` stripped but the type preserved. Titles are escaped for the Hugo shortcode attribute syntax.

**Wikilinks** gate on the publish set so out-of-set references degrade to plain text instead of producing broken `{{< ref >}}` shortcodes:

```bash
sed -n '242,260p' src/content-processor.ts
```

```output
  private convertWikilinks(content: string, publishSet: Set<string>): string {
    const urlPath = this.postsUrlPath();
    return content.replace(
      /\[\[([^\]|#]+)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (_match, page, _hashGroup, heading, _pipeGroup, displayText) => {
        const display = displayText || (heading ? `${page}#${heading}` : page);
        const slug = this.sanitizeSlug(page);
        if (!publishSet.has(slug)) return display;
        const fragment = heading ? `#${this.slugifyHeading(heading)}` : "";
        return `[${display}](${urlPath}${slug}/${fragment})`;
      },
    );
  }

  /**
   * Convert note embeds (![[Note Name]]) to markdown links when the
   * target slug is in the publish set; otherwise degrade to plain
   * display text. Image embeds are left alone for convertImageReferences.
   */
```

Two URL-path helpers compute the prefix for posts and images from user settings; both normalize edge slashes and use boundary regexes to avoid prefix bleed (e.g., `static-assets` must survive as `/static-assets/`, not `/-assets/`):

```bash
sed -n '119,144p' src/content-processor.ts
```

```output
   * "/assets/img/". Normalizes edge slashes first so "static/images/",
   * "/static/images", and bare "images" all produce "/images/". The
   * boundary regex preserves directories that merely start with
   * "static" but are not "static" or "static/*" (e.g. "static-assets",
   * "staticfiles/img").
   */
  private imageUrlPath(): string {
    const dir = this.settings.imageDir
      .replace(/^\/+|\/+$/g, "")
      .replace(/^static(?:\/|$)/, "");
    return dir ? `/${dir}/` : "/";
  }

  /**
   * Derive the URL prefix for wikilinks from the contentDir setting.
   * Strips leading "content/" so "content/posts" -> "/posts/",
   * "content" -> "/", "content/blog" -> "/blog/". Normalizes edge
   * slashes first so "content/posts/", "/content/posts", and bare
   * "posts" all produce "/posts/".
   */
  private postsUrlPath(): string {
    const dir = this.settings.contentDir
      .replace(/^\/+|\/+$/g, "")
      .replace(/^content(?:\/|$)/, "");
    return dir ? `/${dir}/` : "/";
  }
```

**Heading anchor slugs** match Hugo goldmark's default `autoIDType: "github"`: NFC-normalize first so decomposed diacritics (`e + U+0301`) survive, then preserve any Unicode letter/number via property escapes:

```bash
sed -n '326,335p' src/content-processor.ts
```

```output
  private slugifyHeading(heading: string): string {
    return heading
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
```

## GitHub API Layer: github-service.ts

`GitHubService` is a thin Octokit wrapper. Every Octokit call site uses a shared narrowing helper so errors surface consistently:

```bash
sed -n '9,19p' src/github-service.ts
```

```output
/**
 * Rethrow from an Octokit call site with a consistent narrowing:
 * RequestError passes through (caller gets the status code); generic
 * Error gets wrapped with a descriptive prefix; anything else rethrows
 * as-is.
 */
function rethrowWithPrefix(error: unknown, prefix: string): never {
  if (error instanceof RequestError) throw error;
  if (error instanceof Error) throw new Error(`${prefix}: ${error.message}`);
  throw error;
}
```

`RequestError` carries an HTTP status code. Callers that care about status — notably `createBranchWithRetry`, which retries on 422 — need the instance unchanged; generic errors get a descriptive prefix.

**Atomic commits** use the Git Data API: one blob per file, one tree, one commit, one ref update — all unrelated-file updates land in a single commit:

```bash
sed -n '175,232p' src/github-service.ts
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
      rethrowWithPrefix(error, "Failed to commit files");
    }
  }
```

**Branch-name collision** (422 "Reference already exists") is the one error treated as recoverable. `createBranchWithRetry` retries with an incrementing suffix:

```bash
sed -n '259,283p' src/github-service.ts
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

**PR label application** is intentionally non-fatal: a failing label-apply returns a warning rather than throwing, because throwing after the PR exists would orphan the PR:

```bash
sed -n '123,170p' src/github-service.ts
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

## Settings UI: settings.ts

`PublisherSettingTab` renders the configuration UI. The nonobvious parts are the sanitizers and the debounced save.

**Input sanitizers** live as free functions so they're independently testable:

```bash
sed -n '16,40p' src/settings.ts
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

export function sanitizeShortcodeName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}
```

**`strippedFrontmatterFields` handling** is layered. The UI parses comma-separated input and filters required fields in one pass; a separate helper detects which required fields were blocked so the UI can fire a Notice:

```bash
sed -n '55,66p' src/settings.ts
```

```output
export function parseStrippedFieldsInput(value: string): string[] {
  const required = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);
  return value
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && !required.has(f));
}

export function requiredFieldsIn(fields: string[]): string[] {
  const required = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);
  return [...new Set(fields.filter((f) => required.has(f)))];
}
```

The settings tab wires a debounced save — typing into the textarea fires a Notice only when a required field *newly* appears in the input (not on every keystroke after).

## Build & Test

The build produces a single `main.js` bundle. `obsidian` and `electron` are external; `@octokit/rest` is bundled:

```bash
sed -n '1,30p' build.ts
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

await build();

if (isWatch) {
  console.log("Watching src/ for changes...");
  let timeout: ReturnType<typeof setTimeout> | null = null;
```

**Test mocks** live in `src/test-preload.ts`, registered as a Bun preload module. The Obsidian API is mocked minimally — just `parseYaml`, `stringifyYaml`, `Notice`, `Plugin`, `PluginSettingTab`, `Setting`, and `debounce`. Octokit is a stub class so tests substitute their own mock. This keeps tests from pulling in the real Obsidian runtime.

Counts:

```bash
grep -cE '^  test\(' src/*.test.ts | grep -v ':0'
```

```output
src/content-processor.test.ts:89
src/github-service.test.ts:17
src/main.test.ts:5
src/publisher.test.ts:41
src/schema.test.ts:24
src/settings.test.ts:41
src/types.test.ts:26
```

## Concerns

Readers evaluating the codebase should know:

1. **Persisted-token exposure.** `data.json` stores the GitHub PAT in plaintext — an Obsidian platform constraint (no encrypted storage API). README's Security section flags this; recommend single-repo-scoped tokens. No in-repo mitigation possible.

2. **No integration tests.** Unit coverage is solid (234 tests; every transform, validator, and orchestration branch pinned). The cross-module publish flow — content transform → GitHub API → PR → label handling — has no integration-shaped test. Tracked in issue #143.

3. **Per-file order-dependence in transforms.** `processFromSplit` runs transforms in a specific order (image references before note embeds; wikilinks last) because some transforms produce output that later transforms must not rewrite. Correct, but fragile — reordering would silently regress.

4. **`autoIDType: "github-ascii"` mismatch.** Heading slugs preserve Unicode to match Hugo's default `autoIDType: "github"`. Sites configured with the opt-in `github-ascii` variant will see mismatched anchors. Documented in CHANGELOG 1.6.0; no runtime warning.

5. **Community standard adherence.**
   - TypeScript: strict mode on, clean typecheck.
   - Biome: formatter + linter; `bun run check` passes on CI.
   - Bun native APIs where applicable (test runner, bundler).
   - Single `main.js` artifact committed per Obsidian plugin convention.
   - `pull_requests:write` token scope is unconditional as of 1.6.0 (PR workflow is the only mode).

6. **Single maintainer, single user.** The codebase makes decisions optimized for that reality — e.g., the `usePullRequests` setting was retired in 1.6.0 as a breaking change rather than carried as migration cruft. Future forks or users would need to re-evaluate.
