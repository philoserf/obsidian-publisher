# Obsidian Publisher Walkthrough

*2026-09-10T00:06:08Z by Showboat 0.6.1*
<!-- showboat-id: ff3f4d83-71f8-43ac-b613-84c34c148520 -->

## Overview

Obsidian Publisher is an [Obsidian](https://obsidian.md/) plugin that publishes notes from a
vault into a [Hugo](https://gohugo.io/) site's GitHub repository. It does not push files: it
creates a timestamped branch, commits a tree, and opens a pull request. Every publish ends as
a PR against the configured base branch — there is no direct-commit path.

The whole plugin is TypeScript, bundled by Bun into a single committed `main.js`, and tested
with `bun test`. It talks to GitHub through Octokit's REST client rather than a git binary,
because the platform it was written for — Obsidian on iOS — has no shell.

Two commands are the entire user-facing surface:

- **Publish current note to GitHub** — one note, one branch, one PR.
- **Publish all notes to GitHub** — every note in the vault carrying `status: publish`,
  batched into one branch and one PR.

This walkthrough follows the second command from keypress to pull request, because it is the
path that exercises every module. Where the single-note path diverges, it is called out.

## Architecture

Nine source modules live flat in `src/`, each with a `*.test.ts` beside it. There are no
subdirectories — the module boundaries are the file boundaries.

```bash
cat <<'TREE'
src/
  main.ts                  Plugin entry: commands, settings lifecycle, notices
  publisher.ts             Orchestration: scan, prepare, branch, commit, PR
  note-transformer.ts      The transform chain: Obsidian syntax -> Hugo markdown
  github-api-gateway.ts    The only Octokit-aware module; retry lives here
  schema.ts                Frontmatter split, the publish gate, required fields
  settings-parse.ts        Repairs persisted plugin data into PublisherSettings
  settings.ts              Settings UI + the connection test
  notices.ts               Pure formatting of user-visible notice text
  types.ts                 Settings, results, warnings, DEFAULT_SETTINGS
TREE
```

```output
src/
  main.ts                  Plugin entry: commands, settings lifecycle, notices
  publisher.ts             Orchestration: scan, prepare, branch, commit, PR
  note-transformer.ts      The transform chain: Obsidian syntax -> Hugo markdown
  github-api-gateway.ts    The only Octokit-aware module; retry lives here
  schema.ts                Frontmatter split, the publish gate, required fields
  settings-parse.ts        Repairs persisted plugin data into PublisherSettings
  settings.ts              Settings UI + the connection test
  notices.ts               Pure formatting of user-visible notice text
  types.ts                 Settings, results, warnings, DEFAULT_SETTINGS
```

The dependency direction is strictly downward: `main.ts` knows about `publisher.ts` and
`notices.ts`; `publisher.ts` knows about `note-transformer.ts`, `github-api-gateway.ts` and
`schema.ts`; nothing below `publisher.ts` imports anything above it. `notices.ts` and
`types.ts` are leaves that touch no Obsidian or GitHub API at all, which is what lets them be
tested as pure functions.

Data flows one way through four shapes. A vault `TFile` becomes a `PublishableFile` (file
plus parsed frontmatter plus body), which becomes a `ProcessedContent` (rewritten markdown
plus a sanitized filename plus a list of referenced images), which becomes a `FileEntry`
(target path plus content) handed to the GitHub tree API. Alongside that, every note
accumulates a `PublishResult` — success or error, never both — and the batch collects them
into a `BatchPublishResult` that `notices.ts` turns into text.

## 1. Loading the plugin

Obsidian calls `onload()` once when the plugin starts. It does three things: restore
settings, build the `Publisher`, and register the two commands.

```bash
sed -n '56,86p' src/main.ts
```

```output
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

Note the shape of the two callbacks. `editorCallback` receives the active view, so the
single-note command can fail fast with "No active file" when there is nothing to publish;
the batch command takes a plain `callback` because it scans the vault itself.

`this.publisher` is built once and reused, not constructed per command. That matters because
`Publisher` captures the settings object — and its GitHub client captures the token — at
construction time, so a settings change has to rebuild it:

```bash
sed -n '93,103p' src/main.ts
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

`loadData()` returns whatever JSON was on disk, which may be corrupt, partial, or from an
older version. `parseSettings` never trusts it — every field is type-checked independently
and falls back to its default alone, so one bad key cannot wipe a working configuration:

```bash
sed -n '40,60p' src/settings-parse.ts
```

```output

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
```

Two fields get more than a type check. `strippedFrontmatterFields` is filtered so `title` and
`date` can never be stripped — they are required for publishing, so stripping them would make
every note fail — and the shortcode names are regex-validated because they are interpolated
directly into Hugo shortcode tags.

## 2. Publishing all notes

`publishAllNotes` is the batch command's handler. It gates on settings, then hands off:

```bash
sed -n '147,169p' src/main.ts
```

```output
  private async publishAllNotes() {
    const publisher = this.publisher;
    const validationError = publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    new Notice("Scanning vault for publishable notes...");

    let result: BatchPublishResult;
    try {
      result = await publisher.publishAll();
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Error: ${message}`);
      console.error("Batch publish error:", error);
      return;
    } finally {
      // Runs whether publishAll resolved or threw, so a failure part-way
      // through preparation cannot strand the duration-0 progress notice.
      this.endProgress();
    }
```

The `finally` is load-bearing. The progress notice is created with duration `0`, which in
Obsidian means "stay up until dismissed." It is dismissed here rather than from the progress
callback itself, because if preparation throws part-way the callback never reaches
`done === total` and a duration-0 notice would hang on screen forever.

## 3. Finding the publishable notes

`publishAll` runs three phases: scan, precheck, workflow.

```bash
sed -n '332,347p' src/publisher.ts
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
      return buildBatchResult(
        [...readFailures, ...failedResults(files, collisionError)],
        { error: collisionError },
      );
    }
```

The scan is `getPublishableFiles`. A vault can hold thousands of notes and only a handful are
published, so it tries to reject candidates without reading them:

```bash
sed -n '520,547p' src/publisher.ts
```

```output
    for (const file of markdownFiles) {
      // Cheap rejection first: a vault of thousands of notes should not be
      // read end to end to find the handful marked for publish.
      if (this.isDefinitelyNotPublishable(file)) continue;

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
```

Three outcomes per file, and the differences between them are deliberate:

- **Not publishable** — no `status: publish`. Silently skipped. A vault scan makes no claim
  about any particular note, so this is not a failure.
- **Unreadable, or malformed frontmatter** — recorded as a `readFailure`, not skipped. A
  broken YAML block *hides* publish intent; we cannot tell whether the author wrote
  `status: publish` inside it, and silently dropping a note the author meant to publish is
  the worse of the two errors.
- **Publishable** — pushed with its already-parsed frontmatter and body, so no module
  downstream re-parses the file.

The cheap rejection on line 523 is one-sided on purpose:

```bash
sed -n '125,140p' src/publisher.ts
```

```output
  /**
   * Can this file be ruled out without reading it?
   *
   * Only one answer is safe to trust: the cache parsed the frontmatter and
   * it carries no publish flag. Everything else — a cold cache, or parsed
   * frontmatter that came back absent — has to be read, because
   * metadataCache reports MALFORMED frontmatter as simply missing, and a
   * malformed block hides publish intent. Skipping those would silently
   * reintroduce #129.
   */
  private isDefinitelyNotPublishable(file: TFile): boolean {
    if (!this.metadataCache) return false;
    const cache = this.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return false;
    return !hasPublishFlag(cache.frontmatter as Frontmatter);
  }
```

Both early returns say "I don't know" and fall through to a real read. The predicate is
allowed to answer only one question — *the cache parsed frontmatter and there is no publish
flag* — because Obsidian's `metadataCache` reports malformed frontmatter as simply absent,
and that is exactly the case that must not be skipped. Widening this predicate is the easiest
way to silently stop publishing notes.

The parse itself lives in `schema.ts`, and the regex is more careful than it looks:

```bash
sed -n '8,36p' src/schema.ts
```

```output
// The trailing newline after the closing --- is optional so that a note
// which is nothing but frontmatter still parses; without this its block
// is invisible and the note is silently skipped by publishAll.
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

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
    return { frontmatter, body: match[2] ?? "" };
  } catch (error) {
    const message = errorMessage(error);
    return {
      frontmatter: {},
      body: match[2] ?? "",
      error: `Malformed frontmatter YAML: ${message}`,
    };
  }
}
```

`\r?\n` in both positions handles CRLF notes. The trailing-newline group is optional so a
note consisting of nothing but a frontmatter block still parses — without it the block is
invisible and the note is silently skipped. And the `catch` returns a distinct `error` field
rather than an empty frontmatter object, which is what lets the caller above tell "malformed"
apart from "absent". `hasPublishFlag` is then a one-liner: `frontmatter.status === "publish"`.

## 4. The filename-collision precheck

Before anything is transformed, `publishAll` checks that no two notes will publish to the
same file:

```bash
sed -n '182,199p' src/publisher.ts
```

```output
  private detectFilenameCollisions(
    files: Array<{ file: TFile }>,
  ): Array<{ filename: string; paths: string[] }> {
    const byFilename = new Map<string, string[]>();
    for (const { file } of files) {
      const sanitizedFilename = this.noteTransformer.sanitizeFilename(
        file.name,
      );
      const paths = byFilename.get(sanitizedFilename) ?? [];
      paths.push(file.path);
      byFilename.set(sanitizedFilename, paths);
    }
    const collisions: Array<{ filename: string; paths: string[] }> = [];
    for (const [filename, paths] of byFilename) {
      if (paths.length > 1) collisions.push({ filename, paths: paths.sort() });
    }
    return collisions.sort((a, b) => a.filename.localeCompare(b.filename));
  }
```

This runs before the workflow because the gateway has no way to detect it later: two notes
whose titles sanitize to the same slug would simply become two tree entries at one path, and
the second would win silently. A collision fails the whole batch with a message naming every
source path, and groups are sorted so the message is stable across runs.

Note what happens to the counts on that path: `failedResults` synthesizes one failed result
per attempted file. That is not padding — the notice tree branches on `total === 0` to print
"No publishable notes found", so a batch that failed before preparing anything would
otherwise be announced to the user as *nothing to do*.

## 5. The shared workflow

Both commands converge here. `runPublishWorkflow` takes a `WorkflowOpts` bundle — a branch
prefix, the files, and three builder callbacks for the commit message and PR title/body — so
the single-note and batch paths share one orchestration while keeping their distinct PR
shapes.

```bash
sed -n '396,418p' src/publisher.ts
```

```output
  private async runPublishWorkflow(
    opts: WorkflowOpts,
  ): Promise<BatchPublishResult> {
    let branchName: string;
    try {
      branchName = await this.githubApiGateway.createBranchWithRetry(
        opts.branchPrefix,
        this.settings.baseBranch,
      );
    } catch (error) {
      return this.workflowFailure(opts, [], error);
    }

    let prepared: PublishResult[] = [];
    try {
      const batch = await this.prepareBatch(opts.files);
      prepared = batch.results;
      return await this.commitAndOpenPr(branchName, batch, opts);
    } catch (error) {
      await this.cleanupBranch(branchName);
      return this.workflowFailure(opts, prepared, error);
    }
  }
```

The branch is created *before* the notes are prepared, and that ordering explains the two
separate `try` blocks. If branch creation fails there is nothing to clean up, so
`workflowFailure` is called with an empty prepared list and synthesizes one failure per
attempted file. If anything after it fails, the branch already exists and must be deleted —
`cleanupBranch` swallows its own errors so a failed cleanup never masks the original error.

Branch names are timestamps, and collisions are resolved by picking a new name rather than
by retrying the same request:

```bash
sed -n '366,406p' src/github-api-gateway.ts
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
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
      const suffix = i > 0 ? `-${i}` : "";
      const branchName = this.generateBranchName(basePrefix) + suffix;

      try {
        await this.createBranch(branchName, baseBranch);
        return branchName;
      } catch (error) {
        // 422 means the name is taken, so the next attempt uses a
        // different one; isTransient covers the failures worth repeating
        // the same request for.
        const collision = error instanceof RequestError && error.status === 422;
        if (!collision && !isTransient(error)) throw error;

        lastError = error;
        // Exponential backoff with jitter so retries are never instant
        // and a rate-limited batch doesn't hammer in lockstep.
        await this.sleep(2 ** i * 500 + Math.random() * 250);
      }
    }

    throw lastError;
  }
```

This is the first of two retry mechanisms in this file, and they are not the same thing.
Here, a 422 ("ref already exists") is retryable because the *next attempt uses a different
name* — the suffix on line 385. `isTransient` covers the orthogonal case: failures worth
repeating the identical request for. Conflating the two is an easy mistake; the second
mechanism is in section 8.

## 6. Preparing the batch

`prepareBatch` is the loop where every note becomes bytes. It sets up four pieces of
per-batch state first, then walks the files:

```bash
sed -n '562,612p' src/publisher.ts
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

    const fileEntries = Array.from(entryMap.entries()).map(
      ([path, content]) => ({ path, content }),
    );
    return { results, fileEntries };
  }
```

The four collections are all scoped to one call, which is a recurring idea in this codebase —
every publish operation is self-contained and holds no model of the site's current state.

- `entryMap` is keyed by *target path*, so a note and its images deduplicate naturally and
  the map's entries become the tree.
- `publishSet` is the set of slugs going out in this run. Link resolution consults it, and
  nothing else. A `[[Wikilink]]` to a note that is not in this batch degrades to plain text.
- `imageReadCache` makes a shared image read once no matter how many notes embed it.
- `targetPathOwners` records which source name claimed each target path, so two different
  images that sanitize to the same name are reported rather than silently overwriting.

Because `publishSet` is built from `opts.files`, the single-note path — which passes a
one-element list — produces a publish set containing exactly one slug: the note's own. A
single-note publish therefore flattens every outbound link to plain text. That is pinned by a
test, not an accident.

One ordering here is worth flagging while reading: line 587 puts the note's content into
`entryMap` *before* `resolveImages` is awaited on line 589. If that await ever threw, the
`catch` would record the note as failed while its entry stayed in the map and shipped with
the commit. It is unreachable today — `resolveImages` catches per-image and its only await is
inside that inner `try` — and it is tracked as GitHub issue #295.

## 7. The transform chain

`processFromSplit` is where Obsidian syntax becomes Hugo markdown:

```bash
sed -n '148,190p' src/note-transformer.ts
```

```output
    publishSet: Set<string> = new Set(),
  ): ProcessedContent {
    const processedFrontmatter = this.processFrontmatter(frontmatter);

    // Code is opaque to the transform chain. Mermaid is the exception: it
    // owns ```mermaid fences, so it runs over code segments while every
    // other transform sees prose only.
    const segments = splitCodeSegments(body);
    const prose = segments
      .filter((seg) => seg.kind === "prose")
      .map((seg) => this.stripComments(seg.text));

    // Images are collected from comment-stripped prose, so a reference
    // that only exists inside %% %% or inside a fence is never queued for
    // upload. Must run before convertImageReferences, which rewrites the
    // ![[...]] syntax out of existence.
    const images = this.extractImages(prose.join("\n"));

    let proseIndex = 0;
    const processedBody = segments
      .map((seg) => {
        if (seg.kind === "code") return this.convertMermaid(seg.text);
        let text = prose[proseIndex++];
        text = this.convertHighlights(text);
        text = this.convertCallouts(text);
        text = this.convertImageReferences(text);
        text = this.convertNoteEmbeds(text, publishSet);
        text = this.convertWikilinks(text, publishSet);
        return text;
      })
      .join("");

    const processedContent = this.assembleDocument(
      processedFrontmatter,
      processedBody,
    );
    const sanitizedFilename = this.sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
    };
```

Read that in three passes.

**Pass one splits.** `splitCodeSegments` divides the body into prose and code spans before
anything is rewritten. This is not tidiness: `==` is the equality operator in most languages
and would become a `<mark>` tag, and several transform regexes use character classes that
admit newlines, so a match could begin inside a fence and end in prose, carrying the closing
fence away with it.

**Pass two collects.** `extractImages` runs over the comment-stripped prose, so an image
referenced only inside a `%%` comment is not queued for upload — and it must run before
`convertImageReferences`, which rewrites the `![[...]]` syntax out of existence.

**Pass three rewrites.** Every segment is mapped: code segments get `convertMermaid` and
nothing else, prose segments get the five-transform chain, and the results are joined back
with no separator. The pairing is by a `proseIndex++` counter walking in lockstep with the
filtered array — correct because `filter` and `map` both preserve order, but the coupling is
implicit.

The comment on lines 160-163 states the invariant slightly more strongly than the code
delivers it: a `%%` comment that *contains* an inline code span or a fence is split across
two prose segments, so neither half holds a complete `%%` pair and the comment is not
stripped at all.

Here is the splitter's core loop:

```bash
sed -n '55,82p' src/note-transformer.ts
```

```output
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE_OPEN);
    if (!open) continue;

    pushProse(starts[i]);

    const marker = open[2];
    // CommonMark: the closing fence uses the same character, is at least as
    // long, and carries nothing but whitespace.
    const closer = new RegExp(
      `^[ \\t]*\\${marker[0]}{${marker.length},}[ \\t]*$`,
    );
    let close = i + 1;
    while (close < lines.length && !closer.test(lines[close])) close++;

    // An unterminated fence runs to the end of the note rather than
    // swallowing some later delimiter.
    const lastLine = close < lines.length ? close : lines.length - 1;
    const end =
      lastLine < lines.length - 1 ? starts[lastLine + 1] : body.length;

    segments.push({ kind: "code", text: body.slice(starts[i], end) });
    proseStart = end;
    i = lastLine;
  }

  pushProse(body.length);
  return segments;
```

Two details make this robust. Fences are matched line-wise against a `closer` regex built
from the *opening* marker, so a three-backtick fence is not closed by a tilde run and a
four-backtick fence is not closed by three. And an unterminated fence runs to the end of the
note rather than swallowing some later delimiter.

The splitter is also lossless by construction: it slices the original string by precomputed
line offsets (`starts[]`) rather than rejoining split lines, so concatenating every segment
reproduces the input byte for byte. That property has its own test, because an earlier
version dropped newlines at segment boundaries and the whole existing suite still passed.

### One slug rule

Page slugs, committed filenames and heading anchors all run the same function:

```bash
sed -n '106,131p' src/note-transformer.ts
```

```output
/**
 * The one slug rule, shared by page slugs, filenames and heading anchors:
 * NFC-normalize, lowercase, strip everything that is not a Unicode letter,
 * digit, underscore, space or hyphen, then spaces to hyphens with runs
 * collapsed and edges trimmed.
 *
 * It matches Hugo's default goldmark anchor ID generation
 * (autoIDType: "github"). Page slugs used to run an ASCII-only variant
 * instead, so the two halves of a single link disagreed — `[[Café#Café]]`
 * pointed at /posts/caf/#café — and a title like "Rōnin…" published at a
 * visibly broken /posts/rnin-…/.
 *
 * NFC first so decomposed diacritics (`é` as `e + U+0301`) survive the
 * punctuation strip rather than losing the combining mark and silently
 * flattening to `e`.
 */
function slugify(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Keeping the three unified is load-bearing rather than cosmetic. `buildPublishSet` slugifies
note names while `detectFilenameCollisions` sanitizes filenames — if the two rules ever
diverge, a link resolves against a name that was never committed. The comment records what
happened the last time they did.

The rule also has to agree with something outside this repository: Hugo's default goldmark
anchor generation. Nothing here checks that. It is a contract held in a comment.

### Links resolve against the operation, not the site

`convertWikilinks` is where the publish set does its work:

```bash
sed -n '400,419p' src/note-transformer.ts
```

```output
    const urlPath = this.postsUrlPath();
    return content.replace(
      /\[\[([^\]|#]*)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (match, page, _hashGroup, heading, _pipeGroup, displayText) => {
        // The page part is optional so [[#Heading]] matches, but an empty
        // page with no heading is not a link at all ([[]], [[|x]]) — leave
        // it verbatim rather than emitting a link to nowhere.
        if (!page) {
          if (!heading) return match;
          // A same-page anchor is always valid: it needs no publish-set
          // lookup, because the target is this very document.
          return `[${displayText || heading}](#${this.slugifyHeading(heading)})`;
        }
        const display = displayText || (heading ? `${page}#${heading}` : page);
        const slug = this.sanitizeSlug(page);
        if (!publishSet.has(slug)) return display;
        const fragment = heading ? `#${this.slugifyHeading(heading)}` : "";
        return `[${display}](${urlPath}${slug}/${fragment})`;
      },
    );
```

Line 415 is the whole idea: a wikilink whose slug is not in this run's publish set becomes
bare display text, not a broken link. The plugin has no model of what the site already
contains and deliberately refuses to acquire one, so "is this link valid?" can only be
answered about the current operation.

The exception is the same-page anchor on line 411. `[[#Heading]]` needs no lookup because its
target is this very document, so it always resolves. If you add a new link form, decide first
which side of that line it falls on. `convertNoteEmbeds` applies the same rule to `![[Note]]`
embeds, splitting off any `#anchor` before the slug lookup.

## 8. Resolving images

Back in `prepareBatch`, each note's collected image names go to `resolveImages`. Three things
can go wrong before a read is even attempted, and all three are warnings rather than
failures:

```bash
sed -n '223,257p' src/publisher.ts
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

Images are addressed by *basename*, because that is how Obsidian embeds refer to them. So a
name that matches nothing is a missing image, and a name that matches two files in different
folders is ambiguous — neither is guessed at, both are reported and skipped. The third case
is subtler: two differently-named source images whose sanitized names collide at the same
target path would silently overwrite each other in the tree, so `targetPathOwners` catches
the second one.

A missing or ambiguous image does not fail its note. The note publishes with a link to an
image that will 404, and the user gets a warning naming it. That is the consistent policy —
`PublishWarning` is a tagged union precisely so `notices.ts` can group and present these
without the publish itself being at risk.

## 9. Committing

`prepareBatch` returns an `entryMap` flattened into `FileEntry[]`, and `commitPreparedBatch`
hands it to `commitFiles`. The gateway builds one tree and one commit for the whole batch
using the Git data API — read the branch SHA, read its commit, build a tree, create a commit,
move the ref.

The interesting part is how text and binary differ:

```bash
sed -n '286,318p' src/github-api-gateway.ts
```

```output
      // Text goes inline: GitHub writes the blob as part of createTree,
      // so a 167-note batch is one request instead of 167. Binary has no
      // encoding parameter on a tree entry, so images still need a
      // base64 blob of their own.
      const treeEntries: TreeEntry[] = [];
      for (const file of files) {
        if (typeof file.content === "string") {
          treeEntries.push({
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            content: file.content,
          });
          continue;
        }

        const base64 = this.toBase64(file.content);
        const blob = await this.withRetry(() =>
          this.octokit.rest.git.createBlob({
            owner: this.settings.repoOwner,
            repo: this.settings.repoName,
            content: base64,
            encoding: "base64",
          }),
        );

        treeEntries.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.data.sha,
        });
      }
```

Markdown goes into the tree entry as `content` and GitHub blobs it as part of `createTree`,
so a 167-note batch costs one request rather than 167. Images cannot: a tree entry has no
`encoding` parameter, so each binary needs its own base64 `createBlob` and is referenced by
`sha`. The `TreeEntry` type encodes that as a union — `content` or `sha`, never both.

Every one of those calls is wrapped in `withRetry`, and that is licensed by a specific
property of the API rather than by optimism:

```bash
sed -n '248,265p' src/github-api-gateway.ts
```

```output
  /**
   * Repeat an idempotent request while it keeps failing transiently.
   * Every call this wraps is safe to repeat: blobs and trees are
   * content-addressed, and updateRef with an unchanged SHA is a no-op.
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < COMMIT_MAX_ATTEMPTS; i++) {
      try {
        return await operation();
      } catch (error) {
        if (!isTransient(error)) throw error;
        lastError = error;
        await this.sleep(2 ** i * 500 + Math.random() * 250);
      }
    }
    throw lastError;
  }
```

Blobs and trees are content-addressed and `updateRef` is non-forced, so repeating any of them
is a no-op rather than a duplicate. That is what makes retry safe here and would not make it
safe elsewhere.

This is the second retry mechanism. `isTransient` decides what is worth repeating the *same*
request for:

```bash
sed -n '37,48p' src/github-api-gateway.ts
```

```output
export function isTransient(error: unknown): boolean {
  if (!(error instanceof RequestError)) return false;
  if (error.status === 429 || error.status >= 500) return true;
  if (error.status !== 403) return false;
  const headers = error.response?.headers ?? {};
  return (
    headers["retry-after"] !== undefined ||
    headers["x-ratelimit-remaining"] === "0"
  );
}

/** A git tree entry names its content one of two ways, never both:
```

429 and 5xx are transient by definition. 403 is ambiguous — GitHub uses it both for secondary
rate limiting and for "token lacks scope" — so it counts only when the response looks
rate-limit shaped. A bare 403 is usually a permission problem, and retrying it would burn
every attempt before surfacing the real error. 422 is absent entirely: on branch creation it
means "name taken", which is resolved by a *different* request, and elsewhere it is a hard
validation error.

All of that depends on the status code surviving, which is why the error-narrowing helper is
the load-bearing three lines it is:

```bash
sed -n '9,19p' src/github-api-gateway.ts
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

A `RequestError` passes through untouched so `isTransient` can still read `.status`; only a
generic `Error` gets a descriptive prefix. When `getBranchSha` once re-wrapped a
`RequestError` into a plain `Error` it destroyed the status and silently disabled retry
across the entire gateway — GitHub issue #242. Any new call site that wraps a `RequestError`
reintroduces it.

## 10. Opening the pull request

With the commit landed, `commitAndOpenPr` decides whether there is anything to open a PR
about:

```bash
sed -n '429,456p' src/publisher.ts
```

```output
    const successCount = batch.results.filter((r) => r.success).length;
    const committed = await this.commitPreparedBatch(
      branchName,
      batch.results,
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
      this.settings.baseBranch,
      opts.prTitle(succeeded),
      opts.prBody(succeeded),
      this.settings.prLabels,
    );
    return buildBatchResult(results, {
      prUrl: pr.url,
      warnings: pr.warnings,
    });
  }
```

If nothing succeeded, the branch is deleted and no PR is opened — an empty PR is worse than
none. Otherwise the caller-supplied builders shape the title and body, which is the only
place the single-note and batch paths differ in their output: one says
`Publish: <basename>`, the other `Batch Publish: N notes` with a bulleted file list.

Labels are applied after the PR is created, and their failure is deliberately not fatal:

```bash
sed -n '224,240p' src/github-api-gateway.ts
```

```output
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
```

The PR already exists at this point and is the artifact the user actually wanted; throwing
here would leave it orphaned with the publish reported as a failure. So the failure becomes a
`pr-label-failed` warning riding on a successful result.

## 11. Turning results into text

`buildBatchResult` derives `total`, `successful` and `failed` from the results array, and
`notices.ts` turns that into what the user sees:

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

Four branches in strict order, and the ordering is the contract. A batch-level `error` wins
over everything. `total === 0` is "No publishable notes found" — which is why the collision
path back in section 4 synthesizes one failed result per file rather than returning an empty
list, and why `markResultsFailed` rewrites prepared successes as failures when a commit
throws. If those two helpers did not exist, a wholesale failure would be announced to the
user as *nothing to do*, or a failed commit reported as twelve successful publishes.

`formatWarnings` then groups the tagged `PublishWarning` union by kind and emits one notice
line per kind that occurred, deduplicating names — and for target collisions, unioning the
source names per target so that three colliding sources produce one complete message rather
than two partial ones.

Both functions are pure and separately tested. That is deliberate: the notice tree is the
plugin's entire output channel on iOS, where `console.log` is unreachable, so it is worth
being able to reason about without constructing a plugin instance.

## 12. Where the single-note path differs

`publishNote` reads the file itself, checks the parse and the publish flag, and then enters
the same `runPublishWorkflow`. Three differences are worth holding on to:

- Its publish set has one member, so every outbound link flattens to plain text.
- Frontmatter validation still happens inside `prepareBatch` — `publishNote` deliberately
  does not duplicate it, so an invalid note surfaces as a failed result rather than an early
  return.
- It unwraps the batch result back into a single `PublishResult`, merging the batch-level
  `prUrl` and warnings into the success case.

Everything else — branch, prepare, commit, PR, cleanup — is the path traced above.

## Findings from this pass

Tracing the code end to end surfaced two things a reader of this document should not have to
rediscover.

The first is a branch with no reachable input: `convertNoteEmbeds` guards against image
embeds that `convertImageReferences` has already consumed one line earlier. The second is
structural — `processFromSplit` is the one function in this codebase that could not be
explained linearly, because it derives a second array from its segments and re-pairs them
with a hand-maintained counter.

**Related existing findings.** Section 7 notes that the comment on lines 160-163 of
`note-transformer.ts` claims more than the code delivers, and that `convertMermaid` owns
"```mermaid" fences specifically rather than fenced blocks generally; `THEORY.md` records
both. The `prepareBatch` ordering hazard flagged in section 6 is tracked on GitHub as issue
#295.
