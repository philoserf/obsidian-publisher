# Theory

What you need to hold in mind to change this plugin without damaging it. Not an API reference — the code and its comments cover that. This is the reasoning the code cannot state about itself.

## What the system is for

One person writes notes in one Obsidian vault. Some of those notes are also public essays on one Hugo site. The plugin is the bridge, and its whole job is to answer a question the vault cannot answer for itself: _given this pile of notes, which ones are the site, and what does the site's copy of each one look like?_

That framing matters more than it sounds. This is not a general Obsidian-to-static-site exporter, and reading it as one will lead you to "fix" things that are deliberate. The vault is the source of truth and it is messy — thousands of notes, most of them private, some half-finished, a few with broken YAML. The site is a git repository with a fixed shape. Between them sits a translation with no undo: once a publish opens a pull request, the only way back is another commit.

The domain vocabulary is small and worth learning precisely:

A **publishable file** is a note whose frontmatter carries `status: publish`. That sentinel is the entire access-control model. There is no allow-list, no folder convention, no export flag — one string in one field, checked by `hasPublishFlag`, and a note either has it or does not exist as far as the site is concerned.

A **slug** is what a note's title becomes in a URL and in a filename. The **publish set** is the collection of slugs going out in _this particular publish operation_. A **result** is per-note and carries either success or an error, never both, plus **warnings** — conditions the user should know about that did not prevent the publish.

## The organizing ideas

### The iOS constraint is upstream of the architecture

The author writes on a phone. Obsidian on iOS has no shell, no git binary, and no console. Every structural oddity here descends from that.

It is why the GitHub seam is Octokit REST rather than a git wrapper: not a preference, a hard platform limit. It is why `main.js` is a committed bundle rather than a build artifact — the plugin is installed by copying files, and there is no build step on a phone. And it is why `Notice` is treated as a real output channel rather than a nicety. Look at `PR_NOTICE_DURATION_MS`: the pull request URL gets ten seconds instead of the default five because on the one platform that motivated this whole design, a `console.log` of that URL is unreachable. Per-file failure detail _does_ go to the console, which is an accepted degradation — the summary reaches everyone, the detail reaches desktop only.

If you find yourself reaching for a child process, a filesystem path outside the vault, or a native module, stop. That is the constraint talking.

### Link resolution is scoped to the operation, not the site

This is the least obvious idea in the codebase and the one most likely to be broken by a well-meaning change.

`[[Some Note]]` becomes a link only if `some-note` is in the publish set — the set built from the files in _this run_. Otherwise it degrades to bare display text. `buildPublishSet` computes it, `processFromSplit` takes it as a parameter, and `convertWikilinks` and `convertNoteEmbeds` consult it.

The consequence is sharper than "publishing is not monotonic." `publishNote` passes a single-element list into the same workflow, so its publish set contains exactly one slug: the note's own. **A single-note publish therefore flattens every link to every other note**, and only same-page anchors and self-links survive. `publisher.test.ts` pins this directly ("single-file publish links to self work; links to others degrade"). It is not a degenerate edge case — it means the single-note command is only useful for notes with no outbound links, and the batch path is the one that produces a coherent site. That is why the batch path is the one that gets used.

A sibling project would almost certainly resolve links against the whole site — query what is already published, or emit the link optimistically and let the build fail. This one does neither, because it has no model of the site's current state and deliberately refuses to acquire one. Every operation is self-contained.

The single exception is a same-page anchor, `[[#Heading]]`. Its target is the document itself, so it needs no lookup and always resolves. If you add another link form, the first question to answer is which side of that line it falls on.

### One slug rule, three consumers, and no delete path

`slugify` is the single rule: NFC-normalize, lowercase, keep Unicode letters, digits, underscore, whitespace and hyphen, whitespace to hyphens, collapse and trim. Three things consume it — the page slug in a URL, the committed filename, and the heading anchor. `sanitizeName` wraps it with the `untitled` fallback that a filename needs and an anchor does not.

They were not always unified, and the bug that resulted is instructive: page slugs ran an ASCII-only variant while anchors preserved Unicode, so `[[Café#Café]]` emitted `/posts/caf/#café` — the two halves of one link disagreed with each other. Keeping them unified is now an invariant with a test, and it is load-bearing beyond aesthetics: `buildPublishSet` slugifies while `detectFilenameCollisions` sanitizes filenames, so if the two ever diverge a link resolves against a name that was never committed.

The rule also has to agree with something outside this repository. It matches Hugo's default goldmark anchor generation (`autoIDType: "github"`) and Hugo's default URL handling (`removePathAccents: false`). A site that opts into `github-ascii` or turns accents off will see links that load pages but do not jump, or do not load at all. Nothing checks this. It is a contract held in a comment.

**The invariant that costs the most if forgotten:** there is no delete path. The gateway can create branches, trees, commits and pull requests, and it can delete a _branch_ — it cannot delete a _file_. So the destination filename changing, for any reason, is a rename that leaves the old file live on the site. Renaming a note does it. Changing `slugify` does it to every affected note at once. Neither the plugin nor the site notices; you get two copies of the same post and discover it later. If you touch the slug rule, the blast radius is not "some URLs change" — it is "some posts now exist twice," and cleanup is manual.

### Code is opaque, and mermaid is the exception that proves it

`splitCodeSegments` divides the body into prose and code before any transform runs, and only prose goes through the chain. This is not tidiness. Every transform is actively unsafe inside code: `==` is an equality operator in most languages and would become `<mark>`, and several of the regexes use character classes that admit newlines, so a match could begin inside a fence and end in prose, carrying the closing fence away with it.

The splitter is lossless by construction — it slices the original string by precomputed line offsets rather than rejoining split lines, so concatenating every segment reproduces the input byte for byte. That property has its own test, because an earlier version silently dropped newlines at segment boundaries and the entire existing suite still passed.

Mermaid inverts the rule: it is the one transform that runs over _code_ segments, because a mermaid diagram **is** a fenced block. When you add a transform, decide explicitly which side it belongs on. There is no default.

### Failure has two kinds, and the difference is intent

A note without `status: publish` is not a failure in `publishAll` — it is silently skipped, because a vault scan makes no claim about any particular note. The same note _is_ a failure in `publishNote`, because the user pointed at it and pressed publish. Same condition, opposite handling, and the difference is whether intent was expressed.

Read and parse failures break that symmetry deliberately. When a file cannot be read, or its frontmatter is malformed YAML, the batch reports it rather than skipping it — because a malformed block _hides_ publish intent. We cannot tell whether the author meant `status: publish` when the YAML does not parse, and silently dropping a note the author meant to publish is the worse of the two errors. `splitFrontmatter` returns a distinct `error` field precisely so callers can tell "malformed" from "absent."

Warnings are a third category and never fail anything. The clearest case is a pull request whose labels could not be applied: the PR exists, it is the artifact the user wanted, and throwing would orphan it. So label failure becomes a warning attached to a successful result.

### Counts are a user-facing contract

`buildBatchResult` derives `total` from the number of results, and `failedResults` exists solely to produce one failed result per attempted file. That looks like padding until you read the notice tree: `formatBatchNotice` branches on `total === 0` and prints "No publishable notes found." A batch that failed wholesale before preparing anything — a filename collision, say — would otherwise report zero total and be announced to the user as _nothing to do_. The counts are not statistics; they are the input to what the user is told.

The same logic drives `markResultsFailed`. If the commit throws after preparation succeeded, every prepared success is rewritten as a failure. The user is not told "twelve notes prepared successfully" about a commit that never landed.

### Retry is licensed by idempotency, and 422 is not a retry

`withRetry` wraps every call inside `commitFiles`, and it is safe only because of a property of the Git data API: blobs and trees are content-addressed, and `updateRef` is non-forced, so repeating any of them is a no-op rather than a duplicate.

`isTransient` decides what is worth repeating: 429 and 5xx unconditionally, and 403 only when the response looks rate-limit shaped — a `retry-after` header, or `x-ratelimit-remaining: 0`. A bare 403 is usually a missing token scope, and retrying it just burns attempts before surfacing a permission error.

422 is deliberately excluded, and this is the distinction to keep straight. On branch creation, 422 means the name is already taken, which `createBranchWithRetry` resolves by generating a _different_ name — a different request, not the same one again. Elsewhere it is a hard validation error. Two retry mechanisms live in the same file for two different reasons; conflating them is easy and wrong.

Holding all of this together is `rethrowWithPrefix`, which passes `RequestError` through untouched so its status survives and wraps only generic errors. This looks like a minor stylistic rule and is not: when `getBranchSha` once re-wrapped `RequestError` into a plain `Error`, it destroyed the status code and silently disabled retry throughout the gateway. Any new call site that wraps a `RequestError` reintroduces that.

## The seams

**Obsidian** is reached through `vault` (read, readBinary, getMarkdownFiles, getFiles), `metadataCache`, and `Notice`. The tests mock this wholesale, so nothing here verifies that Obsidian dispatches a command or renders a notice — only that the right APIs are called with the right arguments.

`metadataCache` is the newest and subtlest part of this seam. It exists to avoid reading thousands of notes to find a hundred, and `isDefinitelyNotPublishable` is deliberately one-sided: the _only_ answer it trusts is "the cache parsed frontmatter and there is no publish flag." A cold cache and parsed-but-absent frontmatter both fall through to a real read, because `metadataCache` reports malformed frontmatter as simply missing — and a malformed block is exactly the case that must not be skipped. Widening this predicate to trust more answers is the single easiest way to silently stop publishing notes. Note also that it arrives as an optional fourth constructor parameter, appended rather than woven in; that shape is honest about it being a late performance addition, and it means every test that predates it still constructs a `Publisher` that reads everything.

**GitHub** is `GitHubApiGateway`, and it is the only Octokit-aware module. Keep it that way; the iOS constraint lives here.

**Hugo** is the seam with no code. The plugin emits shortcodes (`callout`, `mermaid`) that the destination theme must define, writes to paths the site must use (`content/posts`, `static/images`), assumes an anchor-generation algorithm, and rewrites `aliases` into redirect URLs. None of this is verified by anything. `hugo-shortcodes/` ships reference templates and that is the whole enforcement mechanism. This is the thinnest part of the theory and the place where a silent breakage is most likely to originate.

The alias behavior deserves specific attention because it hides in a settings default. `aliases` is _deliberately absent_ from `DEFAULT_SETTINGS.strippedFrontmatterFields`, with a comment saying why: Hugo reads that field as its redirect list, so stripping it would discard every redirect the publisher emits. `urlizeAliases` then converts each alias from a bare title into the URL that title actually produced, reusing `sanitizeSlug` and `postsUrlPath` — the same functions that generated the original URLs, which is the entire reason the redirect lands. A value already starting with `/` passes through untouched, checked _before_ slugification because `sanitizeSlug` would strip the slash. That escape hatch is how you pin an exact historical URL, and it is what makes a slug-rule change survivable.

## What the system accommodates, and what it does not

Adding a transform is easy and the shape is obvious: a method on `NoteTransformer`, slotted into `processFromSplit` on the prose side (or the code side, if it owns a fence), plus tests. Adding a settings field is easy: `PublisherSettings`, `DEFAULT_SETTINGS`, a validated branch in `parseSettings`, a control in `settings.ts`. Adding a warning kind means a variant in `PublishWarning` and a branch in `formatWarnings` — and note that `notices.ts` is pure and separately tested precisely so the notice tree can be reasoned about without a plugin instance.

What would require rethinking something fundamental:

**Publishing incrementally, or deleting.** Both need a model of what the site currently contains, and the system deliberately has none. Every operation reads the vault and writes forward. Adding "unpublish" is not a new gateway method; it is a new relationship between the plugin and the site's state, and it collides with the publish-set idea directly — link resolution would have to consult the site rather than the operation.

**Publishing a subset with working links.** Follows from the same place. Today the answer is "publish everything together," which is why the batch path is the one that gets used.

**Any second user.** Settings validation, error messages, and the whole notice tree assume the person reading them wrote the code. `README.md` says this outright.

A maintainer who understands the theory looks first at the publish set when links misbehave, at `slugify` when URLs move, at `isDefinitelyNotPublishable` when notes go missing, and at `rethrowWithPrefix` when retries stop working. A maintainer who does not is most likely to cause damage by widening the metadata-cache predicate, by "simplifying" the two retry mechanisms into one, or by adjusting the slug rule without realizing it renames live files.

## Uncertainties

Everything below is inferred from code and history. Treat it as flagged, not settled.

**`prepareBatch` has a narrow window where a failed note can still be committed** — tracked in #295. The note's content is written into `entryMap` _before_ `resolveImages` runs. If `resolveImages` threw, the outer catch would record a failed result while the note's entry remained in the map and went out with the commit. It is not reachable today: `resolveImages` catches per-image, and its only `await` sits inside that `try`. But the ordering is a latent hazard rather than a deliberate design, and any future `await` added outside the inner `try` reintroduces it silently.

**The prose/code reassembly is more fragile than it looks.** `processFromSplit` filters segments into a `prose` array, then walks all segments again with a `proseIndex++` counter to pair them back up. It is correct only because `filter` preserves order and the second pass visits segments in the same order. Nothing enforces that coupling, and a future refactor that reorders or memoizes either pass would misalign prose with its slot silently.

**Seam discipline is inconsistent, and I read it as history rather than intent.** `GitHubApiGateway` takes an injectable `Sleep` so retry timing is testable, but `Publisher` constructs its own gateway with no injection point — so `publisher.test.ts` reaches in and overwrites a private field. Two different answers to the same testability question, in adjacent files. I believe the `Sleep` seam was added when retry arrived and the gateway seam simply never was, but I am inferring.

**Image target collisions are only visible within one batch.** `targetPathOwners` is created per `prepareBatch` call, so two images that sanitize to the same target path are caught when published together and silently overwrite each other when published in separate operations. This is consistent with the "each operation is self-contained" idea, so it may be deliberate — but the warning's existence implies someone considered the overwrite worth reporting, and the cross-operation case is not.

**Error-message handling has one documented inconsistency.** `errorMessage` flattens any non-`Error` throw to `"Unknown error"`, and `resolveImages` deliberately uses `String(error)` instead so a thrown non-Error keeps its value in the debug log. The comment says this is on purpose. I believe it, but it means there are two conventions in the codebase and only one of them is the default.

**The Hugo contract may already have drifted.** The plugin assumes `autoIDType: "github"` and `removePathAccents: false`. Both are Hugo defaults and both were verified against the destination site's config at the time of writing, but nothing in this repository would notice if the site changed them. If anchors or accented URLs start failing, check the site's `hugo.yaml` before debugging the transformer.
