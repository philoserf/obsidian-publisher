# Obsidian Publisher Walkthrough

*2026-09-14T00:52:57Z by Showboat 0.6.1*
<!-- showboat-id: d47d15ff-f5a3-4c90-ad07-5632e5d3bffd -->

## What this is

Obsidian Publisher is an Obsidian plugin that publishes vault notes to a
GitHub repository for Hugo to build. It creates a branch, commits the
transformed notes and their images, and opens a pull request.

One constraint shapes the whole design: **it must work on iOS.** There is
no shell, no git binary, and no filesystem access outside the vault — so
every GitHub operation goes through the REST API via Octokit, and the
plugin never shells out. Where you would reach for `git commit`, this code
builds a tree object and posts it.

The walkthrough follows one publish from the command palette to the pull
request, then goes back through the transform chain in detail, since that
is where most of the complexity lives.

```bash
wc -l $(ls src/*.ts | grep -v -e '\.test\.' -e 'test-preload') | sort -n
```

```output
      63 src/schema.ts
      78 src/notices.ts
      83 src/slug.ts
      85 src/settings-parse.ts
     137 src/types.ts
     210 src/main.ts
     359 src/settings.ts
     420 src/github-api-gateway.ts
     611 src/note-transformer.ts
     644 src/publisher.ts
    2690 total
```

Ten modules, 2,690 lines. Two of them — `publisher.ts` and
`note-transformer.ts` — are nearly half the codebase, and they are the two
this walkthrough spends most of its time in.

## Architecture

Each module owns one question:

| module | question it answers |
| --- | --- |
| `main.ts` | what commands exist, and what does the user see |
| `publisher.ts` | which notes publish, in what order, and what happens when one fails |
| `note-transformer.ts` | what does Obsidian markdown become |
| `slug.ts` | what is a name, as a URL / filename / anchor |
| `github-api-gateway.ts` | how does anything reach GitHub |
| `schema.ts` | is this note publishable |
| `settings.ts` / `settings-parse.ts` | what is configured, and is it usable |
| `notices.ts` | what does a result read like |
| `types.ts` | the shared vocabulary |

The dependency direction is strictly downward: `main` knows `Publisher`,
`Publisher` knows the gateway and the transformer, and neither of those
knows anything above it. `notices.ts` and `slug.ts` are leaves — pure
functions with no Obsidian imports, which is what makes them the easiest
things in the repo to test.

## Entry point

Obsidian loads the plugin and calls `onload()`. Two commands get
registered, and both route into the same `Publisher`.

```bash
sed -n '/  async onload/,/^  }$/p' src/main.ts
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

Note what is *not* here: any guard against a second invocation while the
first is still in flight. Both callbacks are `async` with no in-flight
flag, so two taps produce two branches and two pull requests. That is a
known gap, filed as issue #307 and not yet fixed — worth knowing before
you read the workflow below as if it were single-threaded.

`createPublisher` is called again from `saveSettings`, not just at load,
because the Publisher captures settings — and its GitHub client's token —
at construction. Rebuilding is how a settings change takes effect without
a reload.

## The Publisher's constructor

`Publisher` builds its own collaborators, with one seam.

```bash
sed -n '/^  constructor(/,/^  }$/p' src/publisher.ts
```

```output
  constructor(
    vault: Vault,
    settings: PublisherSettings,
    onProgress?: ProgressCallback,
    metadataCache?: MetadataCache,
    githubApiGateway: PublishGateway = new GitHubApiGateway(settings),
  ) {
    this.vault = vault;
    this.settings = settings;
    this.noteTransformer = new NoteTransformer(settings);
    this.githubApiGateway = githubApiGateway;
    this.onProgress = onProgress;
    this.metadataCache = metadataCache;
  }
```

The fifth parameter is the network seam. Production never passes it —
`main.ts` calls the four-argument form — but a test supplies a fake, and
because the parameter is typed `PublishGateway` rather than
`GitHubApiGateway`, the compiler checks that fake.

That distinction is load-bearing. `GitHubApiGateway` has private fields,
which TypeScript treats nominally, so no object literal can ever satisfy
it; typing the parameter as the class would have moved the cast rather
than removed it. `PublishGateway` is a `Pick` of exactly the four methods
`Publisher` calls:

```bash
sed -n '/^export type PublishGateway/,/^>;$/p' src/publisher.ts
```

```output
export type PublishGateway = Pick<
  GitHubApiGateway,
  "commitFiles" | "createBranchWithRetry" | "createPullRequest" | "deleteBranch"
>;
```

## Following a batch publish

`publishAll()` is the wider of the two paths; `publishNote()` is the same
workflow with a one-element list. Two prechecks run before any network
call.

```bash
sed -n '/^  async publishAll/,/^  }$/p' src/publisher.ts
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

    return this.runPublishWorkflow({
      branchPrefix: "publish-batch",
      readFailures,
      files,
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

### Selecting candidates without reading the vault

`getPublishableFiles` walks every markdown file, but reading each one off
disk on a phone is expensive. `metadataCache` already holds parsed
frontmatter, so it is used as a prefilter — carefully.

```bash
sed -n '/Can this file be ruled out/,/^  }$/p' src/publisher.ts
```

```output
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

Read the condition closely: the cache can only ever *rule out*, never rule
in. A cold cache, or frontmatter the cache reports as absent, still causes
a full read. That asymmetry is the whole point — Obsidian reports
**malformed** frontmatter as simply missing, so trusting a negative would
silently skip notes whose YAML is broken, which is the bug the comment
names (#129).

### Refusing to publish two notes onto one path

Before any branch exists, the batch checks for notes whose names sanitize
to the same filename.

```bash
sed -n '/private detectFilenameCollisions/,/^  }$/p' src/publisher.ts
```

```output
  private detectFilenameCollisions(
    files: Array<{ file: TFile }>,
  ): Array<{ filename: string; paths: string[] }> {
    const byFilename = new Map<string, string[]>();
    for (const { file } of files) {
      const sanitizedFilename = sanitizeFilename(file.name);
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

The batch aborts rather than committing an overwrite. Two tree entries at
one path would silently keep the last one, and since the gateway has no
delete path, the loser would simply never appear — a note reported as
published that is not on the site.

### The workflow

Everything after the prechecks runs through one function, for both the
single-note and batch paths.

```bash
sed -n '/private async runPublishWorkflow/,/^  }$/p' src/publisher.ts
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

Two `try` blocks, two different recoveries. A branch that never got created
needs no cleanup; anything that throws *after* creation deletes the branch
before reporting, so a failed publish leaves no debris behind.

Note the ordering: the branch is created **before** the notes are prepared.
Preparation is the slow part on a phone, and failing fast on a bad token
beats transforming 167 notes first.

```bash
sed -n '/async createBranchWithRetry/,/^  }$/p' src/github-api-gateway.ts
```

```output
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
        if (i < maxRetries - 1) await this.sleep(backoffDelay(i));
      }
    }

    throw lastError;
  }
```

This is the first of **two** retry mechanisms in the gateway, and they
exist for different reasons. Here a 422 means "that branch name is taken",
and the recovery is to generate a *different* name — so 422 is handled
explicitly and is deliberately absent from `isTransient`, which governs
the other loop. Retrying the identical request on a 422 would just fail
again.

Both loops back off through one helper, and both call it **between**
attempts only — the `i < max - 1` guard is why a failure surfaces
promptly, since sleeping after the final attempt is time spent waiting for
a throw the backoff cannot prevent.

```bash
sed -n '/^function backoffDelay/,/^}$/p' src/github-api-gateway.ts; echo; sed -n '/private async withRetry/,/^  }$/p' src/github-api-gateway.ts
```

```output
function backoffDelay(attempt: number): number {
  return 2 ** attempt * 500 + Math.random() * 250;
}

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < COMMIT_MAX_ATTEMPTS; i++) {
      try {
        return await operation();
      } catch (error) {
        if (!isTransient(error)) throw error;
        lastError = error;
        if (i < COMMIT_MAX_ATTEMPTS - 1) await this.sleep(backoffDelay(i));
      }
    }
    throw lastError;
  }
```

`isTransient` decides what is worth repeating at all:

```bash
sed -n '/^export function isTransient/,/^}$/p' src/github-api-gateway.ts
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
```

A bare 403 is usually a missing token scope, not rate limiting, so it only
counts as transient when the response looks rate-limit shaped. Retrying a
permission error would burn every attempt before surfacing a problem the
user has to fix by hand.

## Preparing the batch

`prepareBatch` is where each note becomes a file entry. It is also where
every per-note concern has accumulated — validation, transform, image
resolution, progress ticks — which makes it the natural place for the next
`await` someone adds.

```bash
sed -n '/private async prepareBatch/,/^  }$/p' src/publisher.ts
```

```output
  private async prepareBatch(files: PublishableFile[]): Promise<{
    results: PublishResult[];
    fileEntries: FileEntry[];
  }> {
    const results: PublishResult[] = [];
    const entryMap = new Map<string, string | ArrayBuffer>();
    const filesByPathSuffix = this.buildFilesByPathSuffix();
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
            filesByPathSuffix,
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

Three things to notice.

`entryMap` is keyed by target path, so an entry has no owning note once it
is in the map. That is why the ordering inside the loop matters and why
`resolveImages` catching per-image is load-bearing rather than incidental:
if it threw, the note would be recorded as failed while its content stayed
in the map and went out with the commit. Issue #309 replaces this shape
with a per-note `Prepared` type.

`imageReadCache` is batch-scoped, so a header image referenced by every
note is read from the vault once.

And the result pushed here says `success: true` when **nothing has been
committed**. Preparation success is not publish success, and the type
system does not know the difference — two helpers maintain it by hand,
which we come to below.

## The transform chain

`processFromSplit` is the transformer's entry point.

```bash
sed -n '/  processFromSplit(/,/^  }$/p' src/note-transformer.ts
```

```output
  processFromSplit(
    frontmatter: Frontmatter,
    body: string,
    originalFilename: string,
    publishSet: Set<string> = new Set(),
  ): ProcessedContent {
    const processedFrontmatter = this.processFrontmatter(frontmatter);

    // One pass over the segments. Each carries its own text, so there is
    // no second array to re-pair by index (#310) and no synthetic joined
    // string to collect images from.
    //
    // Code is opaque to the transform chain. Mermaid is the exception: it
    // owns mermaid fences, so it runs over code segments while every other
    // transform sees prose. A comment contributes nothing — not to the
    // output and not to the image set — which is what makes a reference
    // hidden inside `%% %%` never queued for upload.
    const images: string[] = [];
    const processedBody = this.transformBody(body, publishSet, images);

    const processedContent = this.assembleDocument(
      processedFrontmatter,
      processedBody,
    );
    const sanitizedFilename = sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
    };
  }
```

The body work is one line, because the interesting part is recursive.

### One scanner, four competitors

The document has two levels: block containers that nest — fences,
blockquotes, `%%` comments — and inline constructs that live inside one
block. A flat prose/code split cannot express that, and every defect this
chain used to have was a container the model could not see.

`splitCodeSegments` resolves every opaque-region delimiter in a single
left-to-right pass, by earliest start position.

```bash
sed -n '/^type Segment = {/,/^};$/p' src/note-transformer.ts
```

```output
type Segment = {
  kind: "prose" | "code" | "comment" | "quote";
  text: string;
  info?: string;
};
```

Four kinds, and two of them carry more than text. A fence keeps the `info`
string the scanner already parsed, which is how `convertMermaid` avoids
re-matching the fence with a second, stricter pattern — and how an inline
span, which has no `info`, is never mistaken for one.

The scan itself is a `while` over positions. At a line start it tries a
fence, then a blockquote run; anywhere it tries a backtick run, then `%%`.
Whichever opens first wins:

```bash
sed -n '/^    if (body\[pos\] === "`") {/,/^    pos++;$/p' src/note-transformer.ts
```

```output
    if (body[pos] === "`") {
      const span = matchSpan(body, pos);
      if (span !== null) {
        flushProse(pos);
        segments.push({ kind: "code", text: body.slice(pos, span) });
        proseStart = span;
        pos = span;
        continue;
      }
    }

    if (body.startsWith("%%", pos)) {
      const close = body.indexOf("%%", pos + 2);
      if (close !== -1) {
        const end = close + 2;
        flushProse(pos);
        segments.push({ kind: "comment", text: body.slice(pos, end) });
        proseStart = end;
        pos = end;
        continue;
      }
    }

    pos++;
```

That ordering is the whole design, and it is easy to get wrong in either
direction:

- `%%` must compete with **fences**, or a comment wrapping a fenced block
  never gets paired and publishes verbatim — with its hidden text, its
  wikilinks rewritten, and its images uploaded to a public repo.
- `%%` must equally compete with **spans**, or an inline `` `%%` `` stops
  being literal. The span opens first, so it wins, which is what Obsidian
  does.
- A `%%` **inside** a fence is not a delimiter at all, because the fence
  was consumed when the scan reached its opening line. Mermaid's own `%%`
  comment syntax depends on this.

Splitting is lossless: concatenating every segment reproduces the input
byte for byte. That is what lets a comment be a segment *kind* rather than
a deletion — the scanner keeps every byte, and assembly drops the comment
segments. The suite asserts the property across all four kinds.

### Spans stop at a blank line

CommonMark matches a code span within a paragraph. Admitting a blank line
let two unmatched backticks in different paragraphs pair up and exempt
everything between them from the entire chain.

```bash
sed -n '/^function matchSpan/,/^}$/p' src/note-transformer.ts
```

```output
function matchSpan(text: string, start: number): number | null {
  let runEnd = start;
  while (text[runEnd] === "`") runEnd++;
  const runLength = runEnd - start;

  const blank = /\n[ \t]*\n/g;
  blank.lastIndex = start;
  const blankAt = blank.exec(text);
  const limit = blankAt ? blankAt.index : text.length;

  let cursor = runEnd;
  while (cursor < limit) {
    if (text[cursor] !== "`") {
      cursor++;
      continue;
    }
    let closeEnd = cursor;
    while (text[closeEnd] === "`") closeEnd++;
    if (closeEnd - cursor === runLength && closeEnd <= limit) return closeEnd;
    cursor = closeEnd;
  }
  return null;
}
```

### A blockquote is a container

This is the part that makes the model two-level rather than one. A quote
segment's interior is left **unscanned** by the scanner. The callout pass
strips the markers and re-enters the whole pipeline on the stripped body.

```bash
sed -n '/private transformBody(/,/^  }$/p' src/note-transformer.ts
```

```output
  private transformBody(
    body: string,
    publishSet: Set<string>,
    images: string[],
  ): string {
    const segments = splitCodeSegments(body);

    for (const seg of segments) {
      if (seg.kind === "prose") images.push(...this.extractImages(seg.text));
    }

    return segments
      .map((seg) => {
        if (seg.kind === "comment") return "";
        if (seg.kind === "code") return this.convertMermaid(seg);
        if (seg.kind === "quote")
          return this.transformQuote(seg.text, publishSet, images);
        return this.transformProse(seg.text, publishSet);
      })
      .join("");
  }
```

`transformBody` calls `transformQuote`, which calls `transformBody` again.
That recursion is not a convenience — without it the scanner emits
quote/fence/quote for a callout containing a code sample, and the callout
pass sees only the lines above the fence. Teaching the fence regex about a
`> ` prefix does not help: the fragmentation happens one level up.

```bash
sed -n '/private transformQuote(/,/^  }$/p' src/note-transformer.ts
```

```output
  private transformQuote(
    text: string,
    publishSet: Set<string>,
    images: string[],
  ): string {
    const trailingNewline = text.endsWith("\n") ? "\n" : "";
    const lines = text.replace(/\n$/, "").split("\n");
    const stripped = lines.map((line) => line.replace(/^[ \t]*> ?/, ""));

    // `\r?$` so a CRLF note's title does not carry its carriage return
    // into the shortcode attribute.
    const header = stripped[0].match(/^\[!([\w-]+)\][-+]?(?: (.+))?\r?$/);

    if (!header) {
      const inner = this.transformBody(stripped.join("\n"), publishSet, images);
      return (
        inner
          .split("\n")
          .map((line) => (line === "" ? ">" : `> ${line}`))
          .join("\n") + trailingNewline
      );
    }

    const name = this.settings.calloutShortcodeName;
    const calloutType = header[1].toLowerCase();
    const title = header[2];
    const titleAttr = title
      ? ` "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : "";
    const inner = this.transformBody(
      stripped.slice(1).join("\n"),
      publishSet,
      images,
    );
    return `{{< ${name} ${calloutType}${titleAttr} >}}\n${inner.trim()}\n{{< /${name} >}}${trailingNewline}`;
  }
```

Three details worth pausing on.

The strip pattern is `^[ \t]*> ?` — the space **optional**. Obsidian writes
a paragraph break inside a callout as a line containing nothing but `>`,
and a pattern requiring `> ` ends the callout there.

The header is matched on the first line only, which is where Obsidian
requires it. The previous implementation used a `gm` regex that could
match one mid-block.

And a quote with no callout header is re-prefixed after recursion, so a
plain `> quote` still publishes as a blockquote — but its contents have
now been through the transform chain like any other prose.

### Images are collected before they are rewritten

Note the ordering inside `transformBody`: images are gathered from prose
segments in a first loop, then the map runs. That is required, because
`convertEmbeds` rewrites the `![[...]]` syntax out of existence. A quote's
images are collected by its own recursion, and a comment's are never
collected at all — which is what makes a reference hidden inside `%% %%`
safe from upload.

### Mermaid reads what the scanner parsed

Mermaid inverts the opacity rule: it is the one transform that runs over
*code* segments, because a mermaid diagram **is** a fenced block.

```bash
sed -n '/private convertMermaid(/,/^  }$/p' src/note-transformer.ts
```

```output
  private convertMermaid(segment: Segment): string {
    if (segment.info === undefined) return segment.text;
    if (segment.info.trim().split(/\s+/)[0] !== "mermaid") return segment.text;

    const name = this.settings.mermaidShortcodeName;
    const lines = segment.text.split("\n");
    // Drop the opening fence line, and the closing one when it is present
    // — an unterminated fence runs to the end of the note.
    const body = lines.slice(1, lines[lines.length - 1] === "" ? -2 : -1);
    return `{{< ${name} >}}\n${body.join("\n").trimEnd()}\n{{< /${name} >}}`;
  }
```

Because it reads `segment.info`, it cannot recognize a narrower fence
syntax than the scanner accepts — tildes, four-or-more markers, and an
info string beyond the bare language all convert. The
`info === undefined` guard is what keeps an inline `` `mermaid` `` span
from becoming a shortcode.

### One embed syntax, one pass

Obsidian's `![[...]]` has exactly one form, so one function handles both
arms.

```bash
sed -n '/private convertEmbeds(/,/^  }$/p' src/note-transformer.ts
```

```output
  private convertEmbeds(content: string, publishSet: Set<string>): string {
    const imageUrl = this.imageUrlPath();
    const postsUrl = this.postsUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw: string) => {
      // One front end for both arms: `name` is the text before the first
      // pipe, which is the image filename and equally the note target.
      const { name, alt } = this.parseImageSuffix(raw);

      if (IMAGE_EXTENSIONS.test(name)) {
        const fileName = vaultBasename(name);
        const normalizedAlt = alt?.trim();
        // Alt falls back to the file's name, not the path the author
        // happened to write it with — `![[pic.png]]` and
        // `![[folder/pic.png]]` name one image and should render alike.
        const altText = normalizedAlt ? normalizedAlt : fileName;
        return `![${altText}](${imageUrl}${sanitizeFilename(fileName)})`;
      }

      // For note embeds the pipe is display text: ![[Note|Display]]. That
      // is not `alt` — parseImageSuffix joins everything after the first
      // pipe, which is right for an image caption and wrong here.
      //
      // The target may still carry an anchor (![[Note#Heading]]), which has
      // to come off before the slug lookup — sanitizeSlug drops the `#` and
      // runs the heading into the name, so "Note#Heading" slugified to
      // "noteheading", never matched the publish set, and every anchored
      // embed degraded to plain text.
      const displayText = raw.split("|")[1];
      const hash = name.indexOf("#");
      const page = hash === -1 ? name : name.slice(0, hash);
      const heading = hash === -1 ? "" : name.slice(hash + 1);
      const display = displayText ?? name;
      const slug = sanitizeSlug(vaultBasename(page));
      if (!publishSet.has(slug)) return display;
      const fragment = heading ? `#${slugify(heading)}` : "";
      return `[${display}](${postsUrl}${slug}/${fragment})`;
    });
  }
```

The pipe means different things on each side, and this is the subtlety the
merge had to preserve: an image caption is every segment after the first
pipe rejoined, while a note embed's display text is only the second
segment. `![[img.png|A|B]]` is `![A|B](…)`, but `![[Note|A|B]]` is
`[A](…)`.

`vaultBasename` drops the directory before the slug lookup. Obsidian writes
a reference path-qualified when the filename would be ambiguous, and
unconditionally when the vault's "New link format" is set to an absolute
or relative path — so on those settings every link carries a directory.
The publish set is keyed on basenames, so the reference has to be reduced
to one before it is looked up. The *display* text keeps the full path,
which is what an unresolved link degrades to in Obsidian too.

## The slug rule

Three things consume one rule: a page slug in a URL, a committed filename,
and a heading anchor.

```bash
sed -n '/^export function slugify/,/^}$/p' src/slug.ts; echo; sed -n '/^export function sanitizeSlug/,/^}$/p' src/slug.ts
```

```output
export function slugify(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeSlug(value: string): string {
  return slugify(value) || "untitled";
}
```

The difference between the two exported names is the entire reason both
exist: an empty anchor is simply no anchor, but an empty filename is not a
file. So a heading anchor calls `slugify` directly and takes no fallback.

Keeping the three unified is load-bearing beyond tidiness.
`buildPublishSet` slugifies while `detectFilenameCollisions` sanitizes
filenames — if the two ever diverge, a link resolves against a name that
was never committed. The rule lives in its own module for that reason: its
blast radius is renamed live files, and the gateway has no delete path to
clean them up.

## Resolving images

An embed names a file; the vault index has to find it.

```bash
sed -n '/private buildFilesByPathSuffix/,/^  }$/p' src/publisher.ts
```

```output
  private buildFilesByPathSuffix(): Map<string, TFile[]> {
    const map = new Map<string, TFile[]>();
    for (const f of this.vault.getFiles()) {
      const segments = f.path.split("/");
      for (let i = 0; i < segments.length; i++) {
        const key = segments.slice(i).join("/");
        const existing = map.get(key);
        if (existing) existing.push(f);
        else map.set(key, [f]);
      }
    }
    return map;
  }
```

Indexing every *suffix* of every path is how Obsidian's own
shortest-unique-path resolution works, and it makes bare and qualified
references one lookup rather than two code paths. A bare name still maps to
every file carrying it, so an ambiguous reference is still reported as a
collision — and a qualified one now disambiguates it, which is exactly why
Obsidian wrote the path in the first place.

```bash
sed -n '/private async resolveImages/,/^  }$/p' src/publisher.ts
```

```output
  private async resolveImages(
    imageNames: string[],
    filesByPathSuffix: Map<string, TFile[]>,
    readCache: Map<string, ArrayBuffer>,
    targetPathOwners: Map<string, string>,
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

      const matches = filesByPathSuffix.get(imageName) ?? [];

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

      const sourceFile = matches[0];
      // The committed name comes from the file, not from the spelling the
      // author used: `![[pic.png]]` and `![[folder/pic.png]]` name one
      // image and must land on one target path, matching the URL the
      // transformer emits.
      const sanitizedName = sanitizeFilename(vaultBasename(imageName));
      const imgPath = `${this.settings.imageDir}/${sanitizedName}`;
      // Owned by the resolved vault path, so two spellings of one file are
      // one image rather than a collision. A genuine collision is two
      // different files whose names sanitize to the same target.
      const owner = targetPathOwners.get(imgPath);
      if (owner !== undefined && owner !== sourceFile.path) {
        console.warn(
          `Image target path collision at ${imgPath}: ${owner}, ${sourceFile.path}`,
        );
        warnings.push({
          kind: "image-target-collision",
          targetPath: imgPath,
          sourceNames: [owner, sourceFile.path].sort(),
        });
        continue;
      }

      try {
        let imageContent = readCache.get(sourceFile.path);
        if (!imageContent) {
          imageContent = await this.vault.readBinary(sourceFile);
          readCache.set(sourceFile.path, imageContent);
        }
        targetPathOwners.set(imgPath, sourceFile.path);
        entries.push({ path: imgPath, content: imageContent });
      } catch (error) {
        // Deliberately not errorMessage(): this is a debug log, and
        // String(error) keeps a non-Error throw's value instead of
        // flattening it to "Unknown error".
        console.error(
          `Failed to read image ${imageName}: ${error instanceof Error ? error.message : String(error)}`,
        );
        warnings.push({ kind: "image-failed", name: imageName });
      }
    }

    return { entries, warnings };
  }
```

Three guards, in order: not found, ambiguous basename, and target-path
collision. The third is the subtle one — two differently-named source
images whose names sanitize to the same committed path would silently
overwrite each other in the tree.

`targetPathOwners` is keyed on the resolved `TFile.path`, not on the
reference text. That matters now that both `![[pic.png]]` and
`![[folder/pic.png]]` can name one file: keyed on the reference, two
spellings of the same image would look like a collision and the second
would be dropped.

## Committing

The commit is where the iOS constraint shows most clearly. There is no
`git`, so the code builds a tree object by hand.

```bash
sed -n '/  async commitFiles(/,/^  }$/p' src/github-api-gateway.ts
```

```output
  async commitFiles(
    files: Array<{ path: string; content: string | ArrayBuffer }>,
    message: string,
    branch: string,
  ): Promise<void> {
    try {
      const branchSha = await this.withRetry(() => this.getBranchSha(branch));

      const commitData = await this.withRetry(() =>
        this.octokit.rest.git.getCommit({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          commit_sha: branchSha,
        }),
      );

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

      const newTree = await this.withRetry(() =>
        this.octokit.rest.git.createTree({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          base_tree: commitData.data.tree.sha,
          tree: treeEntries,
        }),
      );

      const newCommit = await this.withRetry(() =>
        this.octokit.rest.git.createCommit({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          message,
          tree: newTree.data.sha,
          parents: [branchSha],
        }),
      );

      await this.withRetry(() =>
        this.octokit.rest.git.updateRef({
          owner: this.settings.repoOwner,
          repo: this.settings.repoName,
          ref: `heads/${branch}`,
          sha: newCommit.data.sha,
        }),
      );
    } catch (error) {
      rethrowWithPrefix(error, "Failed to commit files");
    }
  }
```

Markdown goes inline as tree-entry `content`, so a 167-note batch is one
request. Only binary images need `createBlob` first and are referenced by
`sha` — a tree entry names its content one way or the other, never both,
which is what the `TreeEntry` union encodes.

Every idempotent call is wrapped in `withRetry`. Errors pass through
`rethrowWithPrefix`:

```bash
sed -n '/^function rethrowWithPrefix/,/^}$/p' src/github-api-gateway.ts
```

```output
function rethrowWithPrefix(error: unknown, prefix: string): never {
  if (error instanceof RequestError) throw error;
  if (error instanceof Error) throw new Error(`${prefix}: ${error.message}`);
  throw error;
}
```

A `RequestError` passes through **untouched** so its status survives for
the caller; only a generic `Error` gets a descriptive prefix. Wrapping a
`RequestError` destroyed the status and silently disabled retry throughout
the gateway — that was bug #242, and this three-line function is the whole
fix.

## Failure has two shapes

A note without `status: publish` is not a failure — it is skipped. A note
that claims to publish and cannot is a failure with a message. The
distinction is expressed intent, not validity.

The harder case is a batch that gets part-way. Because a prepared result
already says `success: true`, two helpers rewrite results after the fact
when the commit never happened.

```bash
sed -n '/^function markResultsFailed/,/^}$/p' src/publisher.ts; echo; sed -n '/private workflowFailure/,/^  }$/p' src/publisher.ts
```

```output
function markResultsFailed(
  results: PublishResult[],
  error: unknown,
  prefix?: string,
): PublishResult[] {
  const message = errorMessage(error);
  const formatted = prefix ? `${prefix}: ${message}` : message;
  return results.map((r) =>
    r.success
      ? {
          filePath: r.filePath,
          success: false,
          error: formatted,
          warnings: r.warnings,
        }
      : r,
  );
}

  private workflowFailure(
    opts: WorkflowOpts,
    prepared: PublishResult[],
    error: unknown,
  ): BatchPublishResult {
    const message = errorMessage(error);
    const failed =
      prepared.length === 0
        ? failedResults(opts.files, message)
        : markResultsFailed(prepared, error);
    return buildBatchResult([...opts.readFailures, ...failed], {
      error: message,
    });
  }
```

Every path from preparation to a returned batch has to remember to call
one of them. The compiler cannot help, because a prepared success and a
published success are the same type — which is the finding in issue #309,
still open.

## What the user sees

`notices.ts` is pure formatting, with no Obsidian imports, so the wording
is testable without a vault.

```bash
sed -n '/^export function formatBatchNotice/,/^}$/p' src/notices.ts
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

Counts are a user-facing contract: the numbers in that string are what the
user checks against their vault, so `buildBatchResult` derives them from
the results array rather than accepting them from a caller.

## Verifying the whole thing

The suite runs on Bun's built-in runner, with test files alongside their
sources.

```bash
grep -c 'test(' src/*.test.ts | sort -t: -k2 -rn
```

```output
src/note-transformer.test.ts:140
src/publisher.test.ts:54
src/settings.test.ts:44
src/github-api-gateway.test.ts:34
src/schema.test.ts:28
src/settings-parse.test.ts:25
src/main.test.ts:19
src/slug.test.ts:11
src/notices.test.ts:11
```

Octokit is mocked at three levels deliberately. The preload
`mock.module`s it globally; `github-api-gateway.test.ts` builds a **real**
gateway and overwrites its private `octokit` field with a fake, injecting
a recording `sleep` mock so both attempt counts and the backoffs between
them are asserted without waiting; only `publisher.test.ts` mocks the
gateway wholesale, through the typed constructor argument. Reach for the
level that matches what you are pinning — `TESTING.md` is the policy doc.

Test files are typechecked, which was not always true: they were excluded
from `tsc` until 1.10.0, so every cast and fake in them was decorative.

```bash
grep -A2 'include' tsconfig.json
```

```output
  "include": ["src/**/*.ts", "build.ts", "deploy.ts", "version-bump.ts"]
}
```

## Two things worth knowing before you change this

**The quote recursion is driven by input depth.** `transformQuote` and
`transformBody` call each other once per `>` level, and nothing bounds
that. Measured: 5,000 levels of `> > > …` is fine, 20,000 throws
`RangeError: Maximum call stack size exceeded`. This is not a practical
concern — 20,000 nested blockquotes on one line is not a note anyone
writes, and the vault is the user's own — but it is a property the flat
model did not have, and it is the kind of thing to remember if this code
ever runs over input the user did not author.

**Where the narrative had to jump.** Two places. `prepareBatch` required
explaining an ordering constraint (`entryMap.set` before `resolveImages`)
that is invisible from inside the loop and is held by a property of
`resolveImages` rather than by the data — that is issue #309. And the
prepared-vs-published result type forced a forward reference to two
helpers that fix up a value which was already wrong. Both are open
findings, and both read as structure rather than as bugs, which is why
they read awkwardly in a linear pass.

## Findings filed

| finding | where |
| --- | --- |
| `WALKTHROUGH.md` drifted through seven merged PRs with nothing running `showboat verify` | `.issues/walkthrough-drifts-with-nothing-gating-it.md` |

## Durable references

This document is regenerated, not maintained by hand. Re-run the
`code-walkthrough` skill after any change to the transform chain or the
publish workflow, and run `uvx showboat verify WALKTHROUGH.md` to check
that its snippets still execute — bearing in mind that a green verify
covers the code blocks and not the prose around them.

Companion documents, which this one deliberately does not duplicate:

- `THEORY.md` — why the system is shaped this way, and what breaks if you
  change it. Read it before touching the publish set, the slug rule, or
  the error-narrowing seam.
- `README.md` — the full Obsidian-to-Hugo transformation table.
- `TESTING.md` — where a new test belongs, and why Octokit is mocked at
  three levels.
- `CLAUDE.md` — the working conventions and the invariants in brief.

