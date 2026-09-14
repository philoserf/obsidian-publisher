# Obsidian Publisher Walkthrough

*2026-09-14T01:37:08Z by Showboat 0.6.1*
<!-- showboat-id: 66daa7d5-e222-461b-830c-07fe0bcd9548 -->

## What this is

Obsidian Publisher is an Obsidian plugin that publishes notes from a vault
to a GitHub repository, where Hugo turns them into a site. It does not
build the site and it does not push to it directly: every publish opens a
**pull request**, and merging it is a separate, human step.

One constraint shapes the whole design. The plugin must work on iOS, where
there is no shell and no git binary, so every GitHub operation goes through
the REST API via Octokit — branch, tree, commit, ref, pull request. That is
also why the plugin talks to the user exclusively through Obsidian's
`Notice` toasts: on a phone there is no console to read.

The flow, end to end:

1. A command fires — one note, or every note marked for publish.
2. Candidate notes are found and their frontmatter checked for
   `status: publish`.
3. A timestamped branch is created on GitHub, before anything is
   transformed — so a branch failure costs no work.
4. Each note's body runs a transform chain that rewrites Obsidian syntax
   into Hugo markdown — wikilinks, embeds, callouts, highlights, mermaid —
   and the images it references are resolved against the vault and read.
5. Everything lands in **one** tree and **one** commit, and a pull request
   is opened against `baseBranch`.

Two commands, one workflow: publishing a single note and publishing the
whole vault converge on the same branch-commit-PR path, differing only in
their commit message and PR title.

## Architecture

Nine source modules in `src/`, each owning one thing. The dependency
direction is worth reading before the code, because it explains where a
decision is allowed to live.

```bash
for f in main publisher note-transformer github-api-gateway settings schema slug notices types; do printf "%-20s -> %s\n" "$f" "$(grep -oE "from \"\./[a-z-]+\"" src/$f.ts | sed "s/from \".\///;s/\"//" | sort -u | paste -sd" " -)"; done
```

```output
main                 -> notices publisher settings types
publisher            -> github-api-gateway note-transformer schema settings slug types
note-transformer     -> schema slug types
github-api-gateway   -> types
settings             -> github-api-gateway main schema types
schema               -> types
slug                 -> 
notices              -> types
types                -> 
```

`types.ts` and `slug.ts` are leaves — nothing they depend on can change
under them. `publisher.ts` is the hub: it is the only module that knows
about the gateway, the transformer and the schema at once, which is what
makes it the orchestrator rather than a participant.

Two edges repay a second look.

`settings.ts -> main.ts` is a **type-only** import (`import type
ObsidianPublisher from "./main"`), and `main.ts` imports `settings.ts` back.
TypeScript erases it at build time, so the bundle is fine and the cycle is
not real. A future *value* import from `main.ts` into `settings.ts` would
make it real.

`publisher.ts -> settings.ts` exists for exactly one function,
`validatePublish`. That looks backwards — an orchestrator importing from a
settings UI module — and it is deliberate: the question "is this
configuration usable?" belongs beside the settings type, its defaults and
its normalizers, not in the orchestrator. `Publisher.validateSettings()` is
a one-line delegation kept only because callers already hold a `Publisher`.

## Entry point

`main.ts` is the Obsidian `Plugin` subclass. `onload` does four things:
load and normalize settings, build the `Publisher`, register the settings
tab, and register the two commands.

```bash
sed -n '/^  async onload/,/^  }$/p' src/main.ts
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

        await this.runExclusive(() => this.publishCurrentNote(file));
      },
    });

    this.addCommand({
      id: "publish-all-notes",
      name: "Publish all notes to GitHub",
      callback: async () => {
        await this.runExclusive(() => this.publishAllNotes());
      },
    });
  }
```

`publish-current-note` uses `editorCallback`, so Obsidian only offers it
when an editor is focused; `view.file` can still be null, and that case
gets a notice rather than a thrown error. `publish-all-notes` uses a plain
`callback` — it needs no editor, because it scans the vault.

Both route through `runExclusive`.

### A publish is single-flight

```bash
sed -n '/private async runExclusive/,/^  }$/p' src/main.ts
```

```output
  private async runExclusive(work: () => Promise<void>): Promise<void> {
    if (this.inFlight) {
      new Notice("A publish is already running");
      return;
    }
    // Cleared in a finally so a thrown publish cannot wedge the plugin
    // until reload.
    const task = work().finally(() => {
      this.inFlight = undefined;
    });
    this.inFlight = task;
    await task;
  }
```

One flag covers both commands, not one per command. Publishing the current
note while a batch is committing has the same outcome as two batches: two
branches, two pull requests, and no delete path in the gateway to clean
either up by anything but hand.

The case is not hypothetical. Obsidian will invoke a command again while
the previous invocation's promise is still pending — a second hotkey press,
or a tap on a mobile toolbar button that did not appear to respond because
the network is slow. Re-tapping is the natural response to a slow cellular
publish, which is exactly what this plugin exists for (#307).

The guard lives here and not on `Publisher`, which stays a pure
orchestrator the tests can drive concurrently. It also protects
`this.progress` — a single `Notice` field that two live batches would
interleave counts into.

`this.inFlight` is cleared in a `finally`, so a publish that throws cannot
wedge the plugin until reload.

### The progress notice is one toast, updated in place

```bash
sed -n '/private createPublisher/,/^  }$/p' src/main.ts
```

```output
  private createPublisher(): Publisher {
    const onProgress = (done: number, total: number) => {
      const message = `Prepared: ${done}/${total}`;
      // Duration 0 keeps it up until we dismiss it; a per-file toast would
      // otherwise bury the summary, the PR URL and every warning.
      if (this.progress) this.progress.setMessage(message);
      else this.progress = new Notice(message, 0);
    };

    return new Publisher(
      this.app.vault,
      this.settings,
      onProgress,
      this.app.metadataCache,
    );
  }
```

Duration `0` means the notice stays up until something hides it. A
per-file toast would otherwise bury the summary, the PR URL and every
warning under a stack of "Prepared: 43/167".

That makes dismissal a correctness concern rather than a tidiness one.
`endProgress()` is called from a `finally` around `publishAll`, not from
the progress tick: if preparation throws part-way through, the tick never
reaches `done === total`, and a duration-0 notice would stay on screen
forever.

`saveSettings` rebuilds the `Publisher` rather than mutating it. Both
`Publisher` and its `GitHubApiGateway` capture settings at construction —
the gateway hands the token to Octokit in its constructor — so a changed
token would otherwise not take effect until the vault reloaded.

## Settings

`settings.ts` holds the settings UI, but the part that matters is not the
UI. It is that **every field has exactly one normalizer, called from both
sides** — the settings control's `onChange` and the load path.

```bash
sed -n '/^export function parseSettings/,/^}$/p' src/settings.ts
```

```output
export function parseSettings(data: unknown): PublisherSettings {
  const d = isPlainObject(data) ? data : {};
  const str = (value: unknown, fallback: string) =>
    typeof value === "string" ? value : fallback;

  return {
    githubToken: str(d.githubToken, DEFAULT_SETTINGS.githubToken),
    repoOwner:
      typeof d.repoOwner === "string"
        ? sanitizeGitHubOwner(d.repoOwner)
        : DEFAULT_SETTINGS.repoOwner,
    repoName:
      typeof d.repoName === "string"
        ? sanitizeRepoName(d.repoName)
        : DEFAULT_SETTINGS.repoName,
    contentDir:
      typeof d.contentDir === "string"
        ? sanitizePath(d.contentDir)
        : DEFAULT_SETTINGS.contentDir,
    imageDir:
      typeof d.imageDir === "string"
        ? sanitizePath(d.imageDir)
        : DEFAULT_SETTINGS.imageDir,
    frontmatterTemplate: isPlainObject(d.frontmatterTemplate)
      ? d.frontmatterTemplate
      : { ...DEFAULT_SETTINGS.frontmatterTemplate },
    strippedFrontmatterFields: filterRequiredFields(
      Array.isArray(d.strippedFrontmatterFields) &&
        d.strippedFrontmatterFields.every((v) => typeof v === "string")
        ? (d.strippedFrontmatterFields as string[])
        : DEFAULT_SETTINGS.strippedFrontmatterFields,
    ),
    baseBranch: normalizeBaseBranch(
      str(d.baseBranch, DEFAULT_SETTINGS.baseBranch),
    ),
    prLabels: normalizePrLabels(d.prLabels),
    calloutShortcodeName: normalizeShortcodeName(
      str(d.calloutShortcodeName, ""),
      DEFAULT_SETTINGS.calloutShortcodeName,
    ),
    mermaidShortcodeName: normalizeShortcodeName(
      str(d.mermaidShortcodeName, ""),
      DEFAULT_SETTINGS.mermaidShortcodeName,
    ),
  };
}
```

Each field answers two questions here. **Absent or the wrong type** falls
back to the default, so one corrupted field cannot wipe a configuration.
**Present but unnormalized** runs the same function the settings control
runs, so the value a reload produces is the value the control would have
stored.

Previously the load path answered only the first question and the control
only the second, so all nine fields could disagree about what a bad value
is. A persisted `../escape` survived untouched; `  main  ` kept its
spaces; `[]` labels came back as the default (#314). Adding a field here is
what keeps the two sides from drifting again — there is no second place to
forget.

`normalizePrLabels` shows the shape of the fix:

```bash
sed -n '/^export function normalizePrLabels/,/^}$/p' src/settings.ts
```

```output
export function normalizePrLabels(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    return [...DEFAULT_SETTINGS.prLabels];
  }
  return value.map((l) => l.trim()).filter((l) => l.length > 0);
}
```

An empty array is **kept**, not replaced. Publishing with no labels is a
thing a user may want, and replacing `[]` with the default meant clearing
the field never stuck across a reload. Only a value that is not a string
array at all falls back.

### A path is validated, not sanitized

```bash
sed -n '/^export function sanitizePath/,/^}$/p' src/settings.ts
```

```output
export function sanitizePath(value: string): string {
  const segments = value
    .trim()
    .split("/")
    .filter((segment) => segment.length > 0);
  const hazardous = segments.some(
    (segment) => segment === "." || segment === ".." || segment.includes("~"),
  );
  return hazardous ? "" : segments.join("/");
}
```

Nothing is removed. The previous version removed `..`, then `~`, then edge
slashes — and a sanitizer that removes characters can *synthesize* the
value it was written to remove. `.~./posts` became `../posts`: stripping
`..` left `.~./`, and stripping `~` closed the gap. `..././` became `./.`,
and `a/....//b` left an empty segment no later step removed (#313).

No ordering of removals fixes that, so a path is either acceptable as
written or rejected whole. Rejection returns `""`, which routes into
`validatePublish` and fails the publish loudly rather than publishing
somewhere odd.

It is deliberately *not* an allowlist of permitted characters: a space and
a non-ASCII letter are both legitimate in a Hugo content directory, and
narrowing what a path may contain is a separate decision from fixing the
reconstruction bug.

### One statement of what a usable configuration is

```bash
sed -n '/^export function validateConnection(/,/^}$/p' src/settings.ts; echo; sed -n '/^export function validatePublish(/,/^}$/p' src/settings.ts
```

```output
export function validateConnection(settings: PublisherSettings): string | null {
  if (!settings.githubToken) return "GitHub token is required";
  if (!settings.repoOwner || !settings.repoName) {
    return "Repository owner and name are required";
  }
  return null;
}

export function validatePublish(settings: PublisherSettings): string | null {
  const connection = validateConnection(settings);
  if (connection) return connection;
  if (!settings.contentDir) return "Content directory is required";
  if (!settings.imageDir) return "Image directory is required";
  return null;
}
```

`validatePublish` derives from `validateConnection` rather than restating
its two checks. The field sets differ on purpose — a connection test must
not demand a content directory, or the button whose whole job is telling
the user their token works would be blocked by an unrelated field — but "a
usable configuration needs a token and an owner/name pair" is one piece of
knowledge. It used to be stated twice, in two modules, in two vocabularies
that the user met in the same settings session (#318). One vocabulary now:
"… is required".

The YAML seam in the additional-frontmatter control has no recovery path
by design. Input that does not parse to an object yields `{}`, which the
control notices and reports. The salvage parser that used to exist —
splitting on the first colon per line — was the one path that could put a
value the user never wrote into a commit: `author: [unclosed` became
`{ author: "[unclosed" }`, non-empty, so no notice fired (#319).

## Following a publish

`publisher.ts` is the largest module and the one worth reading in order.
Start with the batch path, because the single-note path is a special case
of it.

### Finding the candidates without reading the vault twice

```bash
sed -n '/private async getPublishableFiles/,/^  }$/p' src/publisher.ts
```

```output
  private async getPublishableFiles(): Promise<{
    files: PublishableFile[];
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

    return { files, readFailures };
  }
```

Note what this returns: not just the files, but each file's **already
parsed** frontmatter and body. Everything downstream takes them as given
rather than re-splitting the content.

Three outcomes, deliberately distinguished. A note without `status:
publish` is silently skipped — it was never a candidate. A note whose
frontmatter **fails to parse** becomes a read failure rather than a skip,
because malformed YAML hides publish intent and we cannot tell whether the
user meant to publish it. A note that cannot be read at all also surfaces
as a failure: read failures cannot be filtered by publish intent, since we
never saw the file, and silent loss is the worse trade.

Before any of that, a cheap rejection:

```bash
sed -n '/private isDefinitelyNotPublishable/,/^  }$/p' src/publisher.ts
```

```output
  private isDefinitelyNotPublishable(file: TFile): boolean {
    if (!this.metadataCache) return false;
    const cache = this.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return false;
    return !hasPublishFlag(cache.frontmatter as Frontmatter);
  }
```

A vault of thousands of notes should not be read end to end to find the
handful marked for publish, and Obsidian already keeps a parsed
`metadataCache`. But only **one** answer from that cache is safe to trust:
the cache parsed the frontmatter and it carries no publish flag.

Everything else has to be read. A cold cache returns nothing, and —
critically — `metadataCache` reports *malformed* frontmatter as simply
absent. Trusting "no frontmatter" as "not publishable" would silently skip
every note whose YAML is broken, which is the one case the read path exists
to surface.

### Refusing to publish two notes onto one path

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

This runs **before** anything is transformed or committed. Two notes whose
names sanitize to the same filename would otherwise both be written into
one tree entry, and the second would silently win — a published post
replaced by an unrelated one, with no error anywhere.

The whole batch fails rather than dropping the loser, and every file gets a
failure result so the batch total reflects attempted publishes. Without
that, a collision-only failure produces `total = 0`, which the "No
publishable notes found" notice would swallow.

Groups are sorted by filename and paths sorted within a group, so the error
message is stable across runs.

### The workflow both commands share

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
      return this.workflowFailure(opts, undefined, error);
    }

    // Left undefined until preparation completes, so `workflowFailure`
    // can tell "nothing was prepared" from "these notes prepared and then
    // the workflow failed" rather than inferring it from an empty array.
    let prepared: Prepared[] | undefined;
    try {
      prepared = await this.prepareBatch(opts.files);
      return await this.commitAndOpenPr(branchName, prepared, opts);
    } catch (error) {
      await this.cleanupBranch(branchName);
      return this.workflowFailure(opts, prepared, error);
    }
  }
```

The branch is created **first**, before anything is prepared. That ordering
is what makes a branch-creation failure cheap: nothing has been transformed
yet, and the failure is reported against the file list without any work
being thrown away.

`prepared` is left `undefined` until preparation completes. That is not
tidiness — it is the signal `workflowFailure` reads to tell "nothing was
prepared" from "these notes prepared and then the workflow failed", rather
than inferring it from an empty array, which is ambiguous.

### A prepared note is not a published note

```bash
sed -n '/^type Prepared =/,/warnings: PublishWarning\[\] };$/p' src/publisher.ts
```

```output
type Prepared =
  | {
      filePath: string;
      ok: true;
      entries: FileEntry[];
      warnings: PublishWarning[];
    }
  | { filePath: string; ok: false; error: string; warnings: PublishWarning[] };
```

This type exists to be **not** a `PublishResult`. A `PublishResult` with
`success: true` means "this note was published" everywhere else in the
system — it is what the batch counts, what the notice announces, and what
`main.ts` prints under "Successful publishes". At preparation time no
branch has been written to, so minting one here made every path from
preparation to a returned batch responsible for remembering to rewrite it,
and the compiler could not help because the two were the same type (#309).

The second property is subtler: **a note's file entries hang off its own
`Prepared`**, built and attached together. A note that failed cannot own
entries, because there is no shared map for it to have written into. An
earlier version wrote a note's content into a batch-wide `entryMap` before
resolving its images, so a note that failed mid-preparation had already
contributed content to the commit (#295). Making entries a field of the
note dissolves that rather than reordering two statements.

Converting the one into the other happens in exactly one place:

```bash
sed -n '/^function toResults/,/^}$/p' src/publisher.ts
```

```output
function toResults(
  prepared: Prepared[],
  commitError?: { error: unknown; prefix?: string },
): PublishResult[] {
  const formatted = commitError
    ? commitError.prefix
      ? `${commitError.prefix}: ${errorMessage(commitError.error)}`
      : errorMessage(commitError.error)
    : undefined;

  return prepared.map((p) => {
    if (!p.ok) {
      return {
        filePath: p.filePath,
        success: false,
        error: p.error,
        warnings: p.warnings,
      };
    }
    return formatted === undefined
      ? { filePath: p.filePath, success: true, warnings: p.warnings }
      : {
          filePath: p.filePath,
          success: false,
          error: formatted,
          warnings: p.warnings,
        };
  });
}
```

`commitError` is the commit that never landed. A prepared success becomes a
failure carrying that error; a note that failed during preparation keeps
the reason it failed for. This replaced three separate exits that each had
to remember to rewrite a value that was already wrong.

The entries that actually reach the commit come from the successes only:

```bash
sed -n '/^function flattenEntries/,/^}$/p' src/publisher.ts
```

```output
function flattenEntries(prepared: Prepared[]): FileEntry[] {
  const byPath = new Map<string, string | ArrayBuffer>();
  for (const p of prepared) {
    if (!p.ok) continue;
    for (const entry of p.entries) byPath.set(entry.path, entry.content);
  }
  return Array.from(byPath.entries()).map(([path, content]) => ({
    path,
    content,
  }));
}
```

Deduplicating by target path in note order reproduces what the shared map
did, without the shared map. Two notes referencing one image share a buffer
through the batch's read cache, so a later write of the same path is the
same bytes.

### Commit, then open the PR

```bash
sed -n '/private async commitAndOpenPr/,/^  }$/p' src/publisher.ts
```

```output
  private async commitAndOpenPr(
    branchName: string,
    prepared: Prepared[],
    opts: WorkflowOpts,
  ): Promise<BatchPublishResult> {
    const successCount = prepared.filter((p) => p.ok).length;
    const committed = await this.commitPreparedBatch(
      branchName,
      flattenEntries(prepared),
      opts.commitMessage(successCount),
    );

    const committedResults = toResults(
      prepared,
      committed.error === undefined
        ? undefined
        : { error: committed.error, prefix: "Commit failed" },
    );
    const succeeded = committedResults.filter((r) => r.success);
    const results = [...opts.readFailures, ...committedResults];

    if (succeeded.length === 0) {
      await this.cleanupBranch(branchName);
      return buildBatchResult(results, {
        error:
          committed.error === undefined
            ? undefined
            : errorMessage(committed.error),
      });
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

When nothing succeeded, the branch is deleted and no PR is opened — an
empty pull request is worse than none, and the branch would otherwise
linger with no way to remove it from inside the plugin.

`cleanupBranch` swallows its own errors and logs a warning. It is
best-effort by design: a failed cleanup must not mask the original publish
error, which is the one the user needs.

### Preparing the batch

```bash
sed -n '/private async prepareBatch/,/^  }$/p' src/publisher.ts
```

```output
  private async prepareBatch(files: PublishableFile[]): Promise<Prepared[]> {
    const prepared: Prepared[] = [];
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
          prepared.push({
            filePath: file.path,
            ok: false,
            error: validationError,
            warnings: [],
          });
        } else {
          const processed = this.noteTransformer.processFromSplit(
            frontmatter,
            body,
            file.name,
            publishSet,
          );

          const { entries: imageEntries, warnings } = await this.resolveImages(
            processed.images,
            filesByPathSuffix,
            imageReadCache,
            targetPathOwners,
          );

          // Built and attached together, after every await this note
          // needs. There is no window in which the note's content belongs
          // to the batch before the note does.
          prepared.push({
            filePath: file.path,
            ok: true,
            entries: [
              {
                path: `${this.settings.contentDir}/${processed.filename}`,
                content: processed.content,
              },
              ...imageEntries,
            ],
            warnings,
          });
        }
      } catch (error) {
        prepared.push({
          filePath: file.path,
          ok: false,
          error: errorMessage(error),
          warnings: [],
        });
      }

      this.onProgress?.(prepared.length, files.length);
    }

    return prepared;
  }
```

Three structures are built once per batch and threaded through every note,
and their scope is the point:

- **`filesByPathSuffix`** indexes the vault for image resolution.
- **`publishSet`** is the set of slugs being published in this run. A link
  to a note outside it degrades to plain text — the transformer cannot know
  what is being published without being told.
- **`imageReadCache`** and **`targetPathOwners`** make cross-note
  deduplication and collision detection batch concerns rather than per-note
  ones. Two notes referencing the same image read it once; two *different*
  images that sanitize to one target path produce a warning rather than a
  silent overwrite.

The `try` wraps each note individually, so one note throwing — a
frontmatter value YAML cannot serialize, say — fails that note and leaves
the batch intact.

Note the comment at the push: entries are built and attached **after every
`await` this note needs**. There is no window in which a note's content
belongs to the batch before the note itself does.

`onProgress` fires once per note regardless of outcome, which is why the
counter is `prepared.length` rather than a success count — the user is
watching progress, not results.

### The single-note path

`publishNote` reads the file, splits its frontmatter, checks the publish
flag, and then hands a one-element list to the same workflow:

```bash
sed -n '/^  async publishNote/,/^  }$/p' src/publisher.ts
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
      files: [{ file, frontmatter, body }],
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

Frontmatter *validation* is deliberately absent here — that is
`prepareBatch`'s sole responsibility. The parse and publish-flag checks
above only gate entry into the workflow, so there is exactly one place that
decides whether a note's `title` and `date` are acceptable.

The tail unwraps the batch shape back into a single result, lifting the
batch-level `prUrl` and warnings onto it.

## The transform chain

`note-transformer.ts` is where Obsidian markdown becomes Hugo markdown.
Everything below is easier to follow after seeing it run, so here it is
running — the real module, on a real note, with default settings:

```bash
bun --preload ./src/test-preload.ts -e '
import { NoteTransformer } from "./src/note-transformer.ts";
import { DEFAULT_SETTINGS } from "./src/types.ts";

const body = [
  "See [[Other Note]] and [[Missing Note]].",
  "",
  "> [!warning] Careful",
  "> Uses ==marks== and ![[pic.png]].",
  "",
  "Hidden: %% a note to self %%",
].join("\n");

const t = new NoteTransformer(DEFAULT_SETTINGS);
const out = t.processFromSplit(
  { title: "Demo", date: "2026-09-13", status: "publish" },
  body,
  "Demo Note.md",
  new Set(["other-note"]),
);

console.log("filename:", out.filename);
console.log("images:  ", JSON.stringify(out.images));
console.log("---");
console.log(out.content);
'
```

```output
filename: demo-note.md
images:   ["pic.png"]
---
---
title: Demo
date: 2026-09-13
---
See [Other Note](/posts/other-note/) and Missing Note.

{{< callout warning "Careful" >}}
Uses <mark>marks</mark> and ![pic.png](/images/pic.png).
{{< /callout >}}

Hidden: 
```

Seven separate behaviors in that one output, and each is a section below:

- `Demo Note.md` became `demo-note.md` — the slug rule, applied to a
  filename.
- `status` is gone from the frontmatter; `title` and `date` stayed.
- `[[Other Note]]` resolved to a link, because `other-note` was in the
  publish set. `[[Missing Note]]` was not, so it degraded to its display
  text rather than linking somewhere that will 404.
- The callout became a shortcode, carrying its type and title.
- `==marks==` became `<mark>`, **inside** the callout — the callout is a
  container whose interior is transformed, not an opaque block.
- `![[pic.png]]` became a markdown image with a site URL, and the file name
  was queued for upload in `images`.
- The `%%` comment vanished from the output, and contributed nothing.

### One scanner, four competitors

Everything starts with splitting the body into segments.

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

`splitCodeSegments` resolves four opaque-region delimiters in a single
left-to-right pass, by earliest start position: a fence at line start, a
blockquote run at line start, an inline backtick run, and `%%`.

Running it on a body that contains all four at once:

```bash
bun --preload ./src/test-preload.ts -e '
import { splitCodeSegments } from "./src/note-transformer.ts";

const body = [
  "Text with `code` and %% a comment %%.",
  "",
  "```js",
  "let x = %% not a comment %%;",
  "```",
  "",
  "> [!note] Title",
  "> Body line.",
].join("\n");

for (const s of splitCodeSegments(body)) {
  console.log(s.kind.padEnd(8), JSON.stringify(s.text));
}

const rejoined = splitCodeSegments(body).map((s) => s.text).join("");
console.log("lossless:", rejoined === body);
'
```

```output
prose    "Text with "
code     "`code`"
prose    " and "
comment  "%% a comment %%"
prose    ".\n\n"
code     "```js\nlet x = %% not a comment %%;\n```\n"
prose    "\n"
quote    "> [!note] Title\n> Body line."
lossless: true
```

Two things in that output are load-bearing.

The `%%` inside the fenced block is **not** a comment — it is part of the
code segment. Not because of a special case, but because the fence was
consumed when the scan reached its opening line, so the scanner never
arrives at that `%%` as a candidate. Mermaid's own `%%` comment syntax is
what pins this in the test suite.

And the split is **lossless**: concatenating every segment's text
reproduces the input exactly. That is what lets `comment` be a *kind*
rather than a deletion — the scanner stays a pure partition, and dropping
comments becomes an assembly decision made later.

The fence branch requires a CommonMark-conformant closer — same character,
at least as long:

```bash
sed -n '/const open = line.match(FENCE_OPEN);/,/^      }$/p' src/note-transformer.ts
```

```output
      const open = line.match(FENCE_OPEN);
      if (open) {
        const marker = open[2];
        // CommonMark: the closing fence uses the same character, is at
        // least as long, and carries nothing but whitespace.
        const closer = new RegExp(
          `^[ \\t]*\\${marker[0]}{${marker.length},}[ \\t]*$`,
        );
        let cursor = lineEnd;
        while (cursor < body.length) {
          const nextEnd = lineEndAt(cursor);
          if (closer.test(body.slice(cursor, nextEnd).replace(/\r?\n$/, ""))) {
            cursor = nextEnd;
            break;
          }
          cursor = nextEnd;
        }
        flushProse(pos);
        segments.push({
          kind: "code",
          text: body.slice(pos, cursor),
          info: open[3],
        });
        proseStart = cursor;
        pos = cursor;
        continue;
      }
```

The `info` string is captured onto the segment. That matters later:
`convertMermaid` reads it instead of re-matching the fence with a second,
narrower pattern (#306).

The `%%` competition is the subtle one. It must compete with fences, or a
comment wrapping a fenced block is never paired and publishes verbatim
(#300). It must equally compete with backtick spans, or ``before `%%`
after`` regresses — the span opens first, so the `%%` stays literal, which
is what Obsidian itself does.

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

Note that both branches only consume when they find a *pair*. An unmatched
backtick or an unclosed `%%` falls through to `pos++` and stays prose.

### Spans stop at a blank line

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

The closing run must be the same length as the opening one, so ``a ` b``
works.

The blank-line limit is the interesting part. CommonMark matches a code
span within a paragraph, and admitting `\n\s*\n` let two unmatched
backticks in *different paragraphs* pair up — exempting everything between
them from the entire transform chain, comments included (#305). A stray
backtick in a note is common; silently disabling every transform for the
next three paragraphs is not a failure anyone would connect to it.

### A blockquote is a container, not a leaf

This is the structural idea the rest of the chain depends on. A `quote`
segment's interior is deliberately left unscanned by the scanner. The
callout pass strips the markers and **re-enters the pipeline
recursively**:

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

Images are collected per level, from prose only, *before* any transform
rewrites the `![[...]]` syntax out of existence. A quote's images are
collected by its own recursion; a comment's are never collected at all,
which is what makes a reference hidden inside `%% %%` never queued for
upload.

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

The recursion is what lets a fenced block nest inside a callout. Without
it the scanner emits quote/fence/quote and the callout fragments across
three segments, so only the text above the fence converts — a defect a
local fix could not reach (#303). Watch it work:

```bash
bun --preload ./src/test-preload.ts -e '
import { NoteTransformer } from "./src/note-transformer.ts";
import { DEFAULT_SETTINGS } from "./src/types.ts";

const body = [
  "> [!tip] Nested",
  "> Before the fence.",
  ">",
  "> ```js",
  "> const x = 1;",
  "> ```",
  ">",
  "> After the fence, with a [[Target]] link.",
].join("\n");

const t = new NoteTransformer(DEFAULT_SETTINGS);
console.log(t.processFromSplit({}, body, "n.md", new Set(["target"])).content);
'
```

````output
{{< callout tip "Nested" >}}
Before the fence.

```js
const x = 1;
```

After the fence, with a [Target](/posts/target/) link.
{{< /callout >}}
````

The fence survived intact, the bare `>` lines became paragraph breaks, and
the wikilink *after* the fence still resolved — all three of which the flat
model got wrong.

Two details in the marker strip are worth naming. The pattern is
`^[ \t]*> ?` with the space **optional**, which is what admits Obsidian's
bare `>` paragraph separator; requiring `> ` ended the callout at that line
and published the remainder as a raw blockquote welded to the closing
shortcode (#299). And the callout header is matched on the **first line
only**, where Obsidian requires it — an earlier `gm` regex could match one
mid-block.

A blockquote with no `[!type]` header is still a container: it recurses,
then re-adds its `>` markers. Only the header decides shortcode versus
blockquote.

### Mermaid reads what the scanner already parsed

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

Mermaid is the one transform that runs over **code** segments rather than
prose — it owns mermaid fences, and a fence is code by construction.

It takes the whole segment, not its text, so it can read the `info` string
the scanner captured. Re-matching the fence with a second, stricter pattern
is what made tilde fences, four-backtick fences and any info string beyond
the bare language publish raw (#306). An inline span has no `info` at all,
which is how it is excluded in one line rather than by a separate guard.

### One embed syntax, one pass

Obsidian writes `![[...]]` for both images and note embeds, so there is one
pass with one classification:

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

An image extension makes it an image; anything else is a note embed,
converted to a link when its slug is in the publish set and degraded to
plain text when it is not.

This used to be two methods, each a full pass that matched every embed and
returned half of them verbatim. That forced them to agree about
classification forever, with the dependency recorded only in two comments
pointing at each other — and made the second one's image guard
*unreachable*, since the first had already consumed every image embed
(#301).

The pipe is read differently on each side, which is the one asymmetry
worth remembering. An **image caption** is every segment after the first
pipe minus a trailing bare size, so `![[pic.png|a|b]]` captions "a|b". A
**note embed's** display text is only the second segment. `parseImageSuffix`
gives the right answer for the first and the wrong one for the second,
which is why the note-embed arm splits the raw text itself.

Anchors have to come off before the slug lookup. `sanitizeSlug` drops `#`
as punctuation and runs the heading into the name, so `Note#Heading`
slugified to `noteheading`, matched nothing, and every anchored embed
degraded to plain text.

### Links resolve only into the publish set

```bash
sed -n '/private convertWikilinks(/,/^  }$/p' src/note-transformer.ts
```

```output
  private convertWikilinks(content: string, publishSet: Set<string>): string {
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
          return `[${displayText || heading}](#${slugify(heading)})`;
        }
        const display = displayText || (heading ? `${page}#${heading}` : page);
        // The lookup drops the directory; the display text above keeps it,
        // because an unresolved link should degrade to what the author
        // wrote — which is what Obsidian shows too.
        const slug = sanitizeSlug(vaultBasename(page));
        if (!publishSet.has(slug)) return display;
        const fragment = heading ? `#${slugify(heading)}` : "";
        return `[${display}](${urlPath}${slug}/${fragment})`;
      },
    );
  }
```

A link to a note that is not being published degrades to bare display text
rather than pointing at a URL that will 404. That is the whole reason
`publishSet` is threaded from `Publisher` down through every transform.

Three cases worth calling out:

- `[[#Heading]]` — a same-page anchor, always valid. It needs no
  publish-set lookup, because the target is this very document.
- `[[]]` and `[[|x]]` — an empty page with no heading is not a link at
  all; left verbatim rather than emitting a link to nowhere.
- `[[folder/Page]]` — the lookup drops the directory, but the **display
  text keeps the path the author wrote**, so a degraded link reads as it
  did in the vault.

Here is the degradation and the path-qualified case together:

```bash
bun --preload ./src/test-preload.ts -e '
import { NoteTransformer } from "./src/note-transformer.ts";
import { DEFAULT_SETTINGS } from "./src/types.ts";

const t = new NoteTransformer(DEFAULT_SETTINGS);
const publishSet = new Set(["target"]);

const cases = [
  "[[Target]]",
  "[[Target|Custom text]]",
  "[[Target#Some Heading]]",
  "[[notes/Target]]",
  "[[Nonexistent]]",
  "[[notes/Nonexistent]]",
  "[[#Local Heading]]",
  "[[]]",
];

for (const c of cases) {
  const out = t.processFromSplit({}, c, "n.md", publishSet).content.trim();
  console.log(c.padEnd(24), "->", out);
}
'
```

```output
[[Target]]               -> [Target](/posts/target/)
[[Target|Custom text]]   -> [Custom text](/posts/target/)
[[Target#Some Heading]]  -> [Target#Some Heading](/posts/target/#some-heading)
[[notes/Target]]         -> [notes/Target](/posts/target/)
[[Nonexistent]]          -> Nonexistent
[[notes/Nonexistent]]    -> notes/Nonexistent
[[#Local Heading]]       -> [Local Heading](#local-heading)
[[]]                     -> [[]]
```

### Frontmatter, and why aliases get rewritten

Frontmatter processing does three things: strip the configured fields,
merge template fields **without overriding** what the note already has, and
urlize `aliases`.

```bash
bun --preload ./src/test-preload.ts -e '
import { NoteTransformer } from "./src/note-transformer.ts";
import { DEFAULT_SETTINGS } from "./src/types.ts";

const settings = {
  ...DEFAULT_SETTINGS,
  frontmatterTemplate: { author: "Mark", draft: false },
};

const fm = {
  title: "DNA as Remix Culture",
  date: "2026-09-13",
  status: "publish",
  cssclasses: ["wide"],
  author: "Someone Else",
  aliases: ["DNA as Remix Culture", "Genetic Remix", "/legacy-path/"],
};

const t = new NoteTransformer(settings);
console.log(t.processFromSplit(fm, "Body.", "n.md", new Set()).content);
'
```

```output
---
title: DNA as Remix Culture
date: 2026-09-13
author: Someone Else
aliases:
  - /posts/dna-as-remix-culture/
  - /posts/genetic-remix/
  - /legacy-path/
draft: false
---
Body.
```

`status` and `cssclasses` were stripped. `author` stayed "Someone Else" —
the template does not override a field the note already carries — while
`draft` was added because the note had none.

The aliases are the interesting part:

```bash
sed -n '/private urlizeAliases(/,/^  }$/p' src/note-transformer.ts
```

```output
  private urlizeAliases(value: unknown): unknown {
    const urlize = (entry: unknown): unknown => {
      if (typeof entry !== "string") return entry;
      const trimmed = entry.trim();
      // Already a path (e.g. "/antifa/") — the author means it literally.
      // Checked before slugifying, since sanitizeSlug strips "/".
      if (trimmed.startsWith("/")) return entry;
      const slug = sanitizeSlug(trimmed);
      if (!slug || slug === "untitled") return entry;
      return `${this.postsUrlPath()}${slug}/`;
    };

    return Array.isArray(value) ? value.map(urlize) : urlize(value);
  }
```

Hugo emits a redirect stub at whatever path an alias names, **verbatim**.
Aliases here are previous note titles, so an alias of "DNA as Remix
Culture" produced a stub at `/posts/DNA as Remix Culture/` while the URL
the post really used — `/posts/dna-as-remix-culture/` — was left dead.

`sanitizeSlug` and `postsUrlPath` are reused deliberately: they are what
generated those URLs in the first place, so reusing them is what makes the
redirect land. A value that already names a path is left alone, checked
*before* slugifying since `sanitizeSlug` strips `/`.

This is also why `aliases` is deliberately absent from the default
`strippedFrontmatterFields`. Hugo reads it as the redirect list, so
stripping it would discard every redirect the publisher emits.

Assembly is the last step, and it fails loudly:

```bash
sed -n '/private assembleDocument(/,/^  }$/p' src/note-transformer.ts
```

```output
  private assembleDocument(
    frontmatter: Record<string, unknown>,
    body: string,
  ): string {
    if (Object.keys(frontmatter).length === 0) {
      return body;
    }

    try {
      const yaml = stringifyYaml(frontmatter);
      return `---\n${yaml}---\n${body}`;
    } catch (error) {
      // Publishing a body without its frontmatter block would corrupt
      // the Hugo page while reporting success; fail the file instead.
      throw new Error(
        `Failed to serialize frontmatter: ${errorMessage(error)}`,
      );
    }
  }
```

Publishing a body without its frontmatter block would corrupt the Hugo page
while reporting success, so a serialization failure throws — and
`prepareBatch`'s per-note `try` turns that into one failed note rather than
a failed batch.

## The slug rule

`slug.ts` is the smallest module and the one with the widest blast radius.
One rule, three shapes.

```bash
sed -n '/^export function slugify/,/^}$/p' src/slug.ts; echo; sed -n '/^export function sanitizeSlug/,/^}$/p' src/slug.ts; echo; sed -n '/^export function sanitizeFilename/,/^}$/p' src/slug.ts
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

export function sanitizeFilename(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

  if (!hasExtension) {
    return sanitizeSlug(filename);
  }

  const name = sanitizeSlug(filename.slice(0, lastDotIndex));
  // Lowercased with the name: leaving it alone made photo.PNG and
  // photo.png distinct target paths, so Publisher.resolveImages saw no
  // collision and committed both — which then collide on checkout on any
  // case-insensitive filesystem.
  const extension = filename.slice(lastDotIndex).toLowerCase();
  return name + extension;
}
```

NFC-normalize, lowercase, keep Unicode letters, digits, underscore,
whitespace and hyphen, whitespace to hyphens, collapse runs, trim edges:

```bash
bun -e '
import { slugify, sanitizeSlug, sanitizeFilename } from "./src/slug.ts";

for (const s of ["Rōnin at Dusk", "Report Q3.2026", "Café", "!!!", "  a   b  "]) {
  console.log("slugify        ", JSON.stringify(s).padEnd(18), "->", JSON.stringify(slugify(s)));
}
console.log("sanitizeSlug    ", JSON.stringify("!!!").padEnd(18), "->", JSON.stringify(sanitizeSlug("!!!")));
for (const f of ["My Photo.PNG", "Report Q3.2026.md", "README"]) {
  console.log("sanitizeFilename", JSON.stringify(f).padEnd(18), "->", JSON.stringify(sanitizeFilename(f)));
}
'
```

```output
slugify         "Rōnin at Dusk"    -> "rōnin-at-dusk"
slugify         "Report Q3.2026"   -> "report-q32026"
slugify         "Café"             -> "café"
slugify         "!!!"              -> ""
slugify         "  a   b  "        -> "a-b"
sanitizeSlug     "!!!"              -> "untitled"
sanitizeFilename "My Photo.PNG"     -> "my-photo.png"
sanitizeFilename "Report Q3.2026.md" -> "report-q32026.md"
sanitizeFilename "README"           -> "readme"
```

`Rōnin` keeps its macron while `Report Q3.2026` still becomes
`report-q32026` — a dot is punctuation, not a letter. It matches Hugo's
default goldmark anchor generation (`autoIDType: "github"`), which is the
point: page slugs used to run an ASCII-only variant, so the two halves of a
single link disagreed. `[[Café#Café]]` pointed at `/posts/caf/#café`, and a
title like "Rōnin…" published at a visibly broken `/posts/rnin-…/`.

NFC comes first so decomposed diacritics (`é` as `e + U+0301`) survive the
punctuation strip rather than losing the combining mark and flattening to
`e`.

The three shapes differ only in what they add. `sanitizeSlug` adds the
`untitled` fallback a *name* needs and an anchor does not — an empty anchor
is simply no anchor, but an empty filename is not a file — so a heading
anchor calls `slugify` directly. `sanitizeFilename` preserves the
extension and **lowercases it**: leaving it alone made `photo.PNG` and
`photo.png` distinct target paths, so no collision was detected and both
were committed, which then collide on checkout on any case-insensitive
filesystem.

Keeping the three unified is load-bearing. `buildPublishSet` slugifies
while `detectFilenameCollisions` sanitizes filenames, so if the two ever
diverge a link resolves against a name that was never committed. And the
blast radius of changing the rule is renamed live files — which the gateway
has no delete path to clean up.

One operation deliberately stays *outside* the rule:

```bash
sed -n '/^export function vaultBasename/,/^}$/p' src/slug.ts
```

```output
export function vaultBasename(reference: string): string {
  const slash = reference.lastIndexOf("/");
  return slash === -1 ? reference : reference.slice(slash + 1);
}
```

Obsidian writes a reference path-qualified when the bare basename would be
ambiguous, and unconditionally when the vault's "New link format" is set to
an absolute or relative path. The directory is *addressing* — how to find
the file — while the publish set, the committed filename and the URL are
all keyed on the name.

Folding it into `slugify` would be wrong: the slug rule strips `/` as
punctuation, so `folder/Note` slugified to `foldernote` and matched nothing
(#308). Stripping the directory *before* the rule is a different operation
from the rule itself, and an alias like `some/path` still runs the plain
rule.

## Resolving images

A note names its images the way the author typed them. Turning that into
bytes to upload is `resolveImages`, and the index it reads is built once
per batch:

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

Every **suffix** of every path is a key, which is how Obsidian's own
shortest-unique-path resolution works: `a/b/pic.png` is reachable as
`pic.png`, `b/pic.png` and `a/b/pic.png`.

Keying on the basename alone was #308 — a path-qualified reference never
matched, so the note published with a broken image URL and nothing
uploaded. Bare-basename lookups are unchanged by the fix: the shortest
suffix *is* the basename, and it still maps to every file with that name,
so an ambiguous reference still reports a collision.

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

Four ways an image does not get uploaded, and all four are **warnings, not
failures** — the note still publishes:

- **Not found** — no vault file matches the reference.
- **Ambiguous** — more than one file matches, so uploading either would be
  a guess.
- **Target collision** — two *different* files whose names sanitize to the
  same target path. Uploading both means one silently overwrites the other.
- **Unreadable** — `readBinary` threw. This one reports the same
  `image-failed` kind as "not found", because from the note's side the
  outcome is identical: the reference stays in the markdown and the bytes
  never arrive.

The third check is keyed on the resolved `TFile.path`, not on the reference
text, and the distinction matters: `![[pic.png]]` and `![[folder/pic.png]]`
are two spellings of **one** file. Keying on the reference would make them
look like a collision and skip an image that was never in conflict. A
genuine collision is two different files, and the owner check
(`owner !== sourceFile.path`) is exactly that test.

The committed name comes from the file, not the spelling: `sanitizeFilename
(vaultBasename(imageName))`. That has to match the URL `convertEmbeds`
emits, which does the same thing — otherwise a note links to an image that
was uploaded under a different name.

`readCache` is threaded in from the batch, so two notes referencing one
image read it from the vault once.

## Committing

`github-api-gateway.ts` is the only module that talks to GitHub, and the
iOS constraint lives here: every operation is a REST call through Octokit,
never a git command.

### One tree, one commit

```bash
sed -n '/Text goes inline/,/^      }$/p' src/github-api-gateway.ts
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

Markdown goes **inline** as a tree entry's `content`, so GitHub writes the
blob as part of `createTree`. A 167-note batch is one request rather than
167. Binary has no encoding parameter on a tree entry, so images still need
a base64 blob of their own — which is the one place the file count drives
the request count.

The type enforces the either/or:

```bash
sed -n '/^type TreeEntry = {/,/^} & (/p' src/github-api-gateway.ts
```

```output
type TreeEntry = {
  path: string;
  mode: "100644";
  type: "blob";
} & ({ content: string; sha?: never } | { sha: string; content?: never });
```

`content` and `sha` are mutually exclusive with `?: never`, so a tree entry
naming its content both ways does not compile.

The full sequence is: read the branch SHA, read its commit, build the tree
on top of that commit's tree, create a commit, move the ref. Five calls
regardless of how many notes are in the batch.

### Errors narrow in exactly one place

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

A `RequestError` passes through **untouched**, so its status survives for
the caller. Only a generic `Error` gets a descriptive prefix. Wrapping a
`RequestError` was bug #242: it destroyed the status and silently disabled
every retry downstream, because the retry predicate reads `error.status`.

`validateConnection` is the deliberate exception — it does *not* use this
helper, because its message is user-facing guidance in the settings
connection test, and a bare "Not Found" helps nobody.

### What is worth retrying

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

429 and 5xx are transient by definition. **403 is ambiguous** — GitHub uses
it both for secondary rate limiting and for "token lacks scope" — so it
only counts when the response looks rate-limit shaped: a `retry-after`
header, or `x-ratelimit-remaining: 0`. Otherwise a genuine permission error
would burn every attempt before surfacing, which is slow *and* misleading.

**422 is deliberately absent.** On branch creation it means "ref already
exists", which is resolved by trying a **different** name rather than
repeating the same request; elsewhere it is a hard validation error, and
`updateRef` is non-forced so a 422 there is a non-fast-forward that
retrying cannot fix.

```bash
sed -n '/private async withRetry/,/^  }$/p' src/github-api-gateway.ts; echo; sed -n '/^function backoffDelay/,/^}$/p' src/github-api-gateway.ts
```

```output
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

function backoffDelay(attempt: number): number {
  return 2 ** attempt * 500 + Math.random() * 250;
}
```

The `i < COMMIT_MAX_ATTEMPTS - 1` guard is the whole point of #312. Both
retry loops used to sleep at the tail of every iteration **including the
last**, so each exhausted retry spent a further ~2s waiting before a throw
the backoff could not have prevented. Two loops, so a commit that failed
both ways paid it twice. A three-attempt loop now waits twice — roughly
500ms then 1s, plus jitter so a rate-limited batch does not hammer in
lockstep.

`sleep` is injectable, which is how the suite asserts attempt counts *and*
the number of backoffs between them without waiting.

### Branch names collide by design

```bash
sed -n '/generateBranchName(prefix/,/^  }$/p' src/github-api-gateway.ts; echo; sed -n '/async createBranchWithRetry/,/^  }$/p' src/github-api-gateway.ts
```

```output
  generateBranchName(prefix = "publish"): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    return `${prefix}/${timestamp}`;
  }

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

The branch name is an ISO-8601 timestamp with `:` and `.` replaced by `-`,
so two publishes in the same second collide. That is a 422, and this loop
is the one place 422 is treated as retryable — because the retry uses a
*different* name (`-1`, `-2`), not the same request again.

The two conditions are read separately for that reason: a collision gets a
new name, and `isTransient` covers the failures worth repeating the same
request for.

### A stalled request must not hang a publish

```bash
sed -n '/^export async function fetchWithTimeout/,/^}$/p' src/github-api-gateway.ts
```

```output
export async function fetchWithTimeout(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    const aborted =
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    if (aborted && timeout.aborted) {
      throw new Error(
        `GitHub API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }
    throw error;
  }
}
```

The timeout signal is **composed** with whatever signal the caller passed,
not substituted for it. Octokit forwards a per-request `request.signal`,
and overwriting it would silently make a caller's cancellation impossible.

The rewrap is conditional on `timeout.aborted` for the mirror-image reason:
a caller-initiated abort must not be reported as a timeout.

### A failed label is not a failed publish

`createPullRequest` applies labels **after** the PR exists, and treats a
label failure as a warning rather than throwing. Throwing would leave an
orphaned PR that the plugin has no way to close — the PR is the user's
primary artifact, and a missing `chore` label is not worth discarding it.

## What the user sees

`notices.ts` is pure formatting — no Obsidian calls, which is what makes it
directly testable.

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

Four distinct outcomes, in priority order: a batch-level error, nothing
found, everything failed, and a mixed summary. The ordering matters —
`total === 0` has to be checked before `successful === 0`, or an empty
vault reports "All files failed to process".

Warnings are grouped by kind, one notice per kind, deduplicated by name.
The target-collision case unions its sources per target path, because one
warning per (file, collision) pair means multiple warnings for the same
target when three or more sources collide — and every contributor needs to
reach the user.

`main.ts` is what turns these into toasts. The PR URL gets a 10-second
notice rather than the default ~5s, for a concrete reason: on iOS there is
no console, so the notice is the only place the URL appears, and a GitHub
URL takes a moment to read on a phone.

## Verifying the whole thing

```bash
grep -c 'test(' src/*.test.ts | sort -t: -k2 -rn
```

```output
src/note-transformer.test.ts:140
src/settings.test.ts:56
src/publisher.test.ts:54
src/github-api-gateway.test.ts:34
src/settings-load.test.ts:33
src/schema.test.ts:28
src/main.test.ts:23
src/slug.test.ts:11
src/notices.test.ts:11
```

Octokit is mocked at three levels, deliberately. The preload
`mock.module`s `@octokit/rest` and `@octokit/request-error` globally;
`github-api-gateway.test.ts` builds a **real** `GitHubApiGateway` and
overwrites its private `octokit` field with a fake, injecting a recording
`sleep` so attempt counts and the backoffs between them are asserted
without waiting; only `publisher.test.ts` mocks the gateway wholesale,
through the typed fifth constructor argument. Reach for the level that
matches what you are pinning — `TESTING.md` is the policy doc, and its rule
is to add a test at the layer that would have caught the bug, not the layer
it surfaced at.

That typed argument is the reason `PublishGateway` exists:

```bash
sed -n '/^export type PublishGateway/,/^>;$/p' src/publisher.ts
```

```output
export type PublishGateway = Pick<
  GitHubApiGateway,
  "commitFiles" | "createBranchWithRetry" | "createPullRequest" | "deleteBranch"
>;
```

A port rather than the class itself, because `GitHubApiGateway`'s private
fields make it nominal — no fake can satisfy the class type. The
constructor's default argument is where the real class is checked against
these four methods.

Test files are typechecked, which was not always true: they were excluded
from `tsc`, so every cast, fake and stub in the suite was decorative
(#320).

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
that. Measured on this revision: 5,000 levels of `> > > …` is fine, 20,000
throws `RangeError: Maximum call stack size exceeded`. Not a practical
concern — that is not a note anyone writes, and the vault is the user's own
— but it is a property the flat model did not have, and worth remembering
if this code ever runs over input the user did not author.

**The `settings.ts` ↔ `main.ts` cycle is type-only.** `settings.ts` needs
`ObsidianPublisher` only as a type, TypeScript erases the import, and the
bundle works. A future *value* import from `main.ts` into `settings.ts`
would make the cycle real.

## Regenerating this document

`WALKTHROUGH.md` is generated by the `code-walkthrough` skill and
regenerated **once per release, after all the work has landed** — not per
pull request. Do not hand-edit it.

`bun run verify:docs` re-executes every code block and diffs the captured
output. It belongs to the release gate rather than CI: run in CI it would
fail on every pull request that touches a quoted function, which is
pressure toward exactly the per-PR regeneration this rule rejects.

Know what a green verify does and does not mean. It re-runs the code blocks
and never reads the prose around them, so a *deleted* function leaves the
narrative describing something that is gone while verify still passes — a
`sed` range matching nothing yields empty output rather than wrong output.
Issue #328 has the measurements.

The same blind spot covers the source's own doc comments, and this
regeneration turned up six of them: four sites carrying two consecutive
block comments where the newer one had been added below the stale one, and
two orphaned blocks whose functions no longer existed at all. The sharpest
stated `commitPreparedBatch`'s pre-#309 contract directly above a signature
that contradicted it. Corrected in `12e6612`; nothing in the toolchain
could have reported them.

## Companion documents

This one deliberately does not duplicate them:

- `THEORY.md` — why the system is shaped this way, and what breaks if you
  change it. Read it before touching the publish set, the slug rule, or the
  error-narrowing seam.
- `README.md` — the full Obsidian-to-Hugo transformation table.
- `TESTING.md` — where a new test belongs, and why Octokit is mocked at
  three levels.
- `CLAUDE.md` — the working conventions and the invariants in brief.
