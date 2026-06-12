# Obsidian Publisher Walkthrough

*2026-06-12T16:25:59Z by Showboat 0.6.1*
<!-- showboat-id: 16f0fdac-17f3-49e6-92fe-7cd87e142648 -->

## Overview

Obsidian Publisher is an Obsidian plugin that publishes notes to a GitHub repository for Hugo processing. A note opts in with `status: publish` in its frontmatter; publishing creates a timestamped branch, commits the transformed markdown plus any referenced images, and opens a pull request against the configured base branch.

The key constraint shaping every design decision: **all GitHub operations go through the REST API via Octokit**. No local git, no shell access — the plugin must work on iOS.

This walkthrough tours the code in the order a publish flows through it: plugin entry, the frontmatter gate, orchestration, content transformation, the GitHub gateway, user-facing notices, settings parsing, and testing.

## Architecture

One module per responsibility, with tests alongside each source file:

- `src/main.ts` — plugin entry: commands, settings lifecycle, one `Publisher` instance
- `src/schema.ts` — frontmatter parsing, the `status: publish` gate, required-field validation
- `src/publisher.ts` — orchestration: `publishNote()` / `publishAll()`, branch + commit + PR workflow
- `src/note-transformer.ts` — Obsidian-to-Hugo content pipeline (wikilinks, images, callouts, sanitization)
- `src/github-api-gateway.ts` — all GitHub REST calls via Octokit
- `src/notices.ts` — pure formatting of batch results and warnings into Notice strings
- `src/settings-parse.ts` — validating persisted plugin data into `PublisherSettings`
- `src/settings.ts` — settings UI tab
- `src/types.ts` — `PublisherSettings`, `PublishResult`, `BatchPublishResult`, `PublishWarning`

```bash
ls src/*.ts | grep -v test
```

```output
src/github-api-gateway.ts
src/main.ts
src/note-transformer.ts
src/notices.ts
src/publisher.ts
src/schema.ts
src/settings-parse.ts
src/settings.ts
src/types.ts
```

## Plugin entry: main.ts

`main.ts` wires Obsidian to the Publisher. It builds a single `Publisher` in `onload` and registers two commands: publish the current note, and publish everything flagged for publishing.

```bash
sed -n '24,60p' src/main.ts
```

```output
  private createPublisher(): Publisher {
    return new Publisher(this.app.vault, this.settings, (done, total) => {
      new Notice(`Prepared: ${done}/${total}`);
    });
  }

  async onload() {
    await this.loadSettings();
    this.publisher = this.createPublisher();

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

The Publisher (and the Octokit client inside its gateway) captures settings at construction time, so `saveSettings` rebuilds it — a token change takes effect without reloading the plugin.

```bash
sed -n '67,77p' src/main.ts
```

```output
  async loadSettings() {
    const data = await this.loadData();
    this.settings = parseSettings(data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Publisher captures settings (and its GitHub client's token) at
    // construction; rebuild so changes take effect without a reload.
    this.publisher = this.createPublisher();
  }
```

## The gate: schema.ts

Every publish decision starts here. `splitFrontmatter` separates the YAML block from the body and — crucially — distinguishes *malformed* YAML from a *missing* block. Malformed frontmatter could hide publish intent, so it surfaces as an error instead of a silent skip.

```bash
sed -n '9,38p' src/schema.ts
```

```output
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function splitFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
  /** Set when the frontmatter block existed but YAML parsing failed; distinguishes malformed YAML from a missing block or validation failure. */
  error?: string;
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      frontmatter: {},
      body: match[2],
      error: `Malformed frontmatter YAML: ${message}`,
    };
  }
}

export function hasPublishFlag(frontmatter: Frontmatter): boolean {
  return frontmatter[PUBLISH_STATUS_FIELD] === PUBLISH_STATUS_VALUE;
}
```

Beyond the gate, `validateFrontmatter` enforces that `title` and `date` exist before a file ships to Hugo. The gate checks happen early (in `publishNote` and the vault scan); validation is deferred to batch preparation so an *intended* publish with bad frontmatter shows up as a failed result rather than vanishing.

## Result types: a discriminated union

Per-file outcomes use `PublishResult`, a `PublishSuccess | PublishFailure` union. The compiler enforces that failures always carry an error and successes never do; the `error?: undefined` / `prUrl?: undefined` members keep those properties readable on the union without narrowing first.

```bash
sed -n '89,111p' src/types.ts
```

```output
export type PublishResult = PublishSuccess | PublishFailure;

export interface PublishSuccess {
  /** Original file path */
  filePath: string;
  success: true;
  error?: undefined;
  /** Non-fatal conditions noticed during publish; always present, [] when none */
  warnings: PublishWarning[];
  /** URL to the pull request if created (single-file PR workflow only) */
  prUrl?: string;
}

export interface PublishFailure {
  /** Original file path */
  filePath: string;
  success: false;
  /** Error message */
  error: string;
  /** Non-fatal conditions noticed during publish; always present, [] when none */
  warnings: PublishWarning[];
  prUrl?: undefined;
}
```

Non-fatal conditions (a missing image, a label that failed to apply) travel as tagged `PublishWarning` values rather than getting flattened into strings, so notices can group them per kind later.

## Orchestration: publisher.ts

The Publisher owns the publish workflows. `publishNote` reads one file, runs the gate checks, then delegates to the shared workflow with single-note commit/PR text builders.

```bash
sed -n '278,323p' src/publisher.ts
```

```output
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
    // Frontmatter validation is prepareBatch's sole responsibility; the
    // parse and publish-flag checks above gate entry into the workflow.

    const result = await this.runPublishWorkflow({
      branchPrefix: "publish",
      readFailures: [],
      prepare: async () => {
        const batch = await this.prepareBatch([{ file, frontmatter, body }]);
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
```

`publishAll` scans the vault for flagged notes, fails fast on filename collisions (two notes that would sanitize to the same target path), then runs the same workflow with batch-shaped text builders — one branch and one PR for all files.

```bash
sed -n '328,365p' src/publisher.ts
```

```output
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
      );
      return buildBatchResult([...readFailures, ...collisionFailures], {
        error: collisionError,
      });
    }

    return this.runPublishWorkflow({
      branchPrefix: "publish-batch",
      readFailures,
      prepare: async () => {
        const batch = await this.prepareBatch(files);
        return { prepared: batch.results, fileEntries: batch.fileEntries };
      },
      synthesizeFailures: (message) =>
        files.map(({ file }) => failedResult(file.path, message)),
      commitMessage: (n) =>
        `Publish ${n} note${n !== 1 ? "s" : ""} from Obsidian`,
      prTitle: (succeeded) => `Batch Publish: ${succeeded.length} notes`,
      prBody: (succeeded) =>
        `Published ${succeeded.length} notes from Obsidian\n\n${succeeded
          .map((r) => `- ${r.filePath}`)
          .join("\n")}`,
    });
  }
```

### The shared workflow, split into phases

Both paths converge on `runPublishWorkflow`, which is deliberately small: create the branch, prepare the content, then hand off to `commitAndOpenPr`. Each failure mode has a dedicated phase — `workflowFailure` builds per-file failed results (synthesized when nothing was prepared yet, so the user sees N failures rather than a bare error), and any failure after branch creation cleans the branch up best-effort.

```bash
sed -n '400,422p' src/publisher.ts
```

```output
  private async runPublishWorkflow(
    opts: WorkflowOpts,
  ): Promise<BatchPublishResult> {
    let branchName: string;
    try {
      branchName = await this.githubApiGateway.createBranchWithRetry(
        opts.branchPrefix,
        this.baseBranch,
      );
    } catch (error) {
      return this.workflowFailure(opts, [], error);
    }

    let prepared: PublishResult[] = [];
    try {
      const batch = await opts.prepare();
      prepared = batch.prepared;
      return await this.commitAndOpenPr(branchName, batch, opts);
    } catch (error) {
      await this.cleanupBranch(branchName);
      return this.workflowFailure(opts, prepared, error);
    }
  }
```

`commitAndOpenPr` is the happy-path phase: commit the prepared entries, and only open a PR if at least one file actually succeeded. A commit failure marks every successful result failed (via `markResultsFailed`); zero successes deletes the branch instead of opening an empty PR.

```bash
sed -n '428,480p' src/publisher.ts
```

```output
  private async commitAndOpenPr(
    branchName: string,
    batch: { prepared: PublishResult[]; fileEntries: FileEntry[] },
    opts: WorkflowOpts,
  ): Promise<BatchPublishResult> {
    const successCount = batch.prepared.filter((r) => r.success).length;
    const committed = await this.commitPreparedBatch(
      branchName,
      batch.prepared,
      batch.fileEntries,
      opts.commitMessage(successCount),
    );

    const succeeded = committed.results.filter((r) => r.success);
    const results = [...opts.readFailures, ...committed.results];

    if (succeeded.length === 0) {
      await this.cleanupBranch(branchName);
      return buildBatchResult(results, { error: committed.error });
    }

    const pr = await this.githubApiGateway.createPullRequest(
      branchName,
      this.baseBranch,
      opts.prTitle(succeeded),
      opts.prBody(succeeded),
      this.prLabels,
    );
    return buildBatchResult(results, {
      prUrl: pr.url,
      warnings: pr.warnings,
    });
  }

  /**
   * Build the batch result for a workflow-level failure: synthesized
   * per-file failures when nothing was prepared yet, otherwise the
   * prepared results marked failed.
   */
  private workflowFailure(
    opts: WorkflowOpts,
    prepared: PublishResult[],
    error: unknown,
  ): BatchPublishResult {
    const message = errorMessage(error);
    const failed =
      prepared.length === 0
        ? opts.synthesizeFailures(message)
        : markResultsFailed(prepared, error);
    return buildBatchResult([...opts.readFailures, ...failed], {
      error: message,
    });
  }
```

### Preparing the batch

`prepareBatch` validates each file's frontmatter, runs it through the NoteTransformer, and accumulates commit entries in a `Map` keyed by target path (so duplicate image targets dedupe naturally). It also builds the *publish set* — the slugs being published this run — which the transformer uses to decide whether a wikilink becomes a real link or degrades to plain text.

```bash
sed -n '564,608p' src/publisher.ts
```

```output
    const results: PublishResult[] = [];
    const entryMap = new Map<string, string | ArrayBuffer>();
    const filesByBasename = this.buildFilesByBasename();
    const publishSet = this.buildPublishSet(files);
    // Read each image source once per batch; multiple notes referencing
    // the same image share the buffer.
    const imageReadCache = new Map<string, ArrayBuffer>();
    // Target imgPath -> first imageName that claimed it. Surfaces silent
    // overwrites when different sources sanitize to the same target.
    const targetPathOwners = new Map<string, string>();

    for (const { file, frontmatter, body } of files) {
      try {
        const validationError = validateFrontmatter(frontmatter);
        if (validationError) {
          results.push(failedResult(file.path, validationError));
        } else {
          const processed = this.noteTransformer.processFromSplit(
            frontmatter,
            body,
            file.name,
            publishSet,
          );

          const targetPath = `${this.settings.contentDir}/${processed.filename}`;
          entryMap.set(targetPath, processed.content);

          const { entries: imageEntries, warnings } = await this.resolveImages(
            processed.images,
            filesByBasename,
            imageReadCache,
            targetPathOwners,
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
```

### Image resolution

`resolveImages` maps each `![[image.png]]` reference to a vault file by basename and reads its bytes. Three failure modes each become a tagged warning, never a publish failure: image not found (`image-failed`), the same basename existing in multiple folders (`image-collision`, skipped because the pick would be arbitrary), and two different source images sanitizing to the same target path (`image-target-collision`, skipped to avoid a silent overwrite).

```bash
sed -n '218,252p' src/publisher.ts
```

```output
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

      const sanitizedName = this.noteTransformer.sanitizeFilename(imageName);
      const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
      const owner = targetPathOwners.get(imgPath);
      if (owner !== undefined && owner !== imageName) {
        console.warn(
          `Image target path collision at ${imgPath}: ${owner}, ${imageName}`,
        );
        warnings.push({
          kind: "image-target-collision",
          targetPath: imgPath,
          sourceNames: [owner, imageName].sort(),
        });
        continue;
      }
```

## Content pipeline: note-transformer.ts

`NoteTransformer.processFromSplit` is a fixed sequence of pure string transformations over the body, plus frontmatter processing (strip configured fields, merge template fields) and filename sanitization. Order matters: comments are stripped before anything else, and image references are converted before note embeds so each handler can defer non-matching embeds to the other.

```bash
sed -n '22,52p' src/note-transformer.ts
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

    const processedContent = this.assembleDocument(
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

Wikilinks only become links when the target is also being published this run; otherwise they degrade to plain display text — no dead links on the site. Heading fragments are slugified to match Hugo's goldmark anchor IDs.

```bash
sed -n '230,242p' src/note-transformer.ts
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
```

Image embeds become Hugo-rooted markdown images. The URL path is derived from `imageDir` by stripping the leading `static/` (Hugo serves `static/` at the site root), and Obsidian's `|alt|size` suffixes are parsed so sizing hints drop out while alt text survives.

```bash
sed -n '269,297p' src/note-transformer.ts
```

```output
  private convertImageReferences(content: string): string {
    const urlPath = this.imageUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const { name, alt } = this.parseImageSuffix(raw);
      if (!IMAGE_EXTENSIONS.test(name)) {
        return _match; // not an image — leave for convertNoteEmbeds
      }
      const sanitizedName = this.sanitizeFilename(name);
      const normalizedAlt = alt?.trim();
      const altText = normalizedAlt ? normalizedAlt : name;
      return `![${altText}](${urlPath}${sanitizedName})`;
    });
  }

  /**
   * Core sanitization: lowercase, spaces→hyphens, strip special chars,
   * collapse hyphens, trim edges, fallback to "untitled".
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
```

Callouts and mermaid blocks convert to Hugo shortcodes (names configurable in settings; matching shortcode templates ship in `hugo-shortcodes/`). The full transformation catalog: comments stripped, `==highlights==` to `<mark>`, callouts and mermaid to shortcodes, image embeds to markdown images, note embeds and wikilinks to site links or plain text.

## GitHub gateway: github-api-gateway.ts

`GitHubApiGateway` is the only module that talks to GitHub, and it does so exclusively through Octokit REST — the iOS constraint in practice. Every request gets a 30s abort timeout so a stalled mobile connection surfaces as an error instead of hanging a publish forever.

```bash
sed -n '21,59p' src/github-api-gateway.ts
```

```output
/** Per-request budget for GitHub API calls; a stalled connection on
 * mobile must surface as an error rather than hang a publish forever. */
const REQUEST_TIMEOUT_MS = 30_000;

/** fetch with an abort timeout; rewraps the opaque DOMException so
 * errorMessage() surfaces "timed out" instead of "signal is aborted". */
async function fetchWithTimeout(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(
        `GitHub API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }
    throw error;
  }
}

export class GitHubApiGateway {
  private octokit: Octokit;
  private settings: PublisherSettings;

  constructor(settings: PublisherSettings) {
    this.settings = settings;
    this.octokit = new Octokit({
      auth: settings.githubToken,
      request: { fetch: fetchWithTimeout },
    });
  }
```

`commitFiles` builds one atomic commit through the Git Trees API: blob per file (base64-encoded with a chunked, cross-platform converter), one tree on top of the branch's current tree, one commit, then a ref update. All files in a batch land in a single commit.

```bash
sed -n '204,261p' src/github-api-gateway.ts
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

Branch names are timestamped (`publish/2026-01-08T14-30-22`), and `createBranchWithRetry` retries on collision (422 — same-second publish) and transient failures (429/5xx) with exponential backoff plus jitter. A `-N` suffix disambiguates retries.

```bash
sed -n '288,316p' src/github-api-gateway.ts
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
        // 422: branch already exists (retry with suffix). 429/5xx:
        // transient rate-limit or server error, worth another attempt.
        const retryable =
          error instanceof RequestError &&
          (error.status === 422 || error.status === 429 || error.status >= 500);
        if (!retryable || i === maxRetries - 1) throw error;

        // Exponential backoff with jitter so retries are never instant
        // and a rate-limited batch doesn't hammer in lockstep.
        const delay = 2 ** i * 500 + Math.random() * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Failed to create branch after ${maxRetries} attempts`);
  }
```

One more deliberate softness: in `createPullRequest`, a label-apply failure is non-fatal. The PR already exists and is the user's primary artifact, so the failure becomes a `pr-label-failed` warning instead of throwing and orphaning the PR.

## Notices: notices.ts

Notice text lives in pure functions, separate from `main.ts`'s Notice plumbing — easy to test without Obsidian. `formatBatchNotice` picks the headline; `formatWarnings` groups the tagged warnings into one message per kind, deduplicating names.

```bash
sed -n '5,12p' src/notices.ts
```

```output
export function formatBatchNotice(result: BatchPublishResult): string {
  if (result.error) return `✗ Failed to publish: ${result.error}`;
  if (result.total === 0) return "No publishable notes found";
  if (result.successful === 0) {
    return "All files failed to process. No PR created.";
  }
  return `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed`;
}
```

```bash
sed -n '31,47p' src/notices.ts
```

```output
export function formatWarnings(warnings: PublishWarning[]): string[] {
  const messages: string[] = [];

  const failed = formatNamedImageWarnings(
    warnings,
    "image-failed",
    (names) => `Warning: ${names.length} image(s) failed: ${names.join(", ")}`,
  );
  if (failed) messages.push(failed);

  const collisions = formatNamedImageWarnings(
    warnings,
    "image-collision",
    (names) =>
      `Warning: ${names.length} image basename(s) collide, skipped: ${names.join(", ")}`,
  );
  if (collisions) messages.push(collisions);
```

## Settings parsing: settings-parse.ts

Persisted plugin data is untrusted: `parseSettings` validates every field individually and falls back to `DEFAULT_SETTINGS` per field, so one corrupted value never wipes the whole configuration. It also carries a migration (the legacy `removePublishFlag` boolean becomes the `strippedFrontmatterFields` list) and guards invariants like never stripping the required `title`/`date` fields.

```bash
sed -n '17,31p' src/settings-parse.ts
```

```output
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

function filterRequiredFields(fields: string[]): string[] {
  const required = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);
  return fields.filter((f) => !required.has(f));
}
```

## Testing

Tests use Bun's built-in runner with `.test.ts` files alongside each source module. Obsidian's module is mocked once in `src/test-preload.ts` (loaded via `bunfig.toml`): `parseYaml`/`stringifyYaml` delegate to the real `yaml` package, `debounce` invokes immediately, and the UI classes are stubs. Note-heavy modules carry the heaviest suites — the transformer's string pipeline and the publisher's failure-mode matrix.

```bash
grep -c 'test(' src/*.test.ts
```

```output
src/github-api-gateway.test.ts:19
src/note-transformer.test.ts:90
src/notices.test.ts:11
src/publisher.test.ts:41
src/schema.test.ts:24
src/settings-parse.test.ts:26
src/settings.test.ts:41
```

## Recap

A publish is: gate on `status: publish` (schema.ts) → create timestamped branch → transform content and resolve images (note-transformer.ts, publisher.ts) → one atomic Trees-API commit → PR with labels (github-api-gateway.ts) → format results and warnings into notices (notices.ts). Failures degrade in layers: fatal errors mark per-file results failed and clean up the branch; non-fatal conditions travel as tagged warnings; and the `PublishSuccess | PublishFailure` union keeps the two outcomes honest at compile time. Everything GitHub-facing rides Octokit REST, keeping the plugin iOS-compatible.

