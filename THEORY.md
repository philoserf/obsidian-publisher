# Theory

What you need to hold in mind to change this plugin without damaging it. The code and its
comments already document what each function does; this is the reasoning they cannot state
about themselves — why the pieces are shaped the way they are, and which of those shapes are
load-bearing.

## What the system is for

One person keeps one Obsidian vault. A minority of those notes are also public essays on one
Hugo site. This plugin is the bridge, and its entire job is to answer a question the vault
cannot answer for itself: **given this pile of notes, which ones are the site, and what does
the site's copy of each one look like?**

Read it as a general Obsidian-to-static-site exporter and you will "fix" things that are
deliberate. The vault is the source of truth and it is messy — thousands of notes, most
private, some half-drafted, occasionally one with broken YAML. The destination is a git
repository with a fixed shape. Between them is a translation with no undo: once a publish
opens a pull request, the only way back is another commit.

Five domain words carry most of the meaning, and they are worth learning exactly:

A **publishable file** is a note whose frontmatter carries `status: publish`. That sentinel
is the whole access-control model — no allow-list, no folder convention, no export flag. One
string in one field, checked by `hasPublishFlag`.

A **slug** is what a note's title becomes in a URL and in a committed filename. The
**publish set** is the collection of slugs going out in _this particular operation_. A
**result** is per-note and carries success or an error, never both. **Warnings** are
conditions the user should know about that did not prevent the publish.

## The organizing ideas

### The iOS constraint sits upstream of the architecture

The author writes on a phone. Obsidian on iOS has no shell, no git binary, and no console.
Most of what looks odd here descends from that single fact.

It is why the GitHub seam is Octokit REST rather than a git wrapper — not a preference, a
platform limit. It is why `main.js` is a committed bundle rather than a build artifact: the
plugin is installed by copying files, and there is no build step on a phone. And it is why
`Notice` is treated as a real output channel rather than a nicety. `PR_NOTICE_DURATION_MS`
gives the pull request URL ten seconds instead of the default five, because on the one
platform that motivated the design, a `console.log` of that URL is unreachable. Per-file
failure detail _does_ go to the console, and that is an accepted degradation: the summary
reaches everyone, the detail reaches desktop only.

If you reach for a child process, a filesystem path outside the vault, or a native module,
stop. That is the constraint talking.

### Link resolution is scoped to the operation, not to the site

This is the least obvious idea here and the one most likely to be broken by a well-meaning
change.

`[[Some Note]]` becomes a link only if `some-note` is in the publish set — the set built
from the files in _this run_. Otherwise it degrades to bare display text. `buildPublishSet`
computes it, `processFromSplit` takes it as a parameter, `convertWikilinks` and
`convertNoteEmbeds` consult it.

The consequence is sharper than "publishing is not monotonic." `publishNote` passes a
single-element list into the same workflow, so its publish set contains exactly one slug:
the note's own. **A single-note publish therefore flattens every outbound link**, and only
same-page anchors survive. `publisher.test.ts` pins this directly. It is not a degenerate
edge case — it means the single-note command is useful only for notes with no outbound
links, and the batch path is the one that produces a coherent site. That is why the batch
path is the one that gets used.

A sibling project would almost certainly resolve links against the whole site: query what is
already published, or emit optimistically and let the build fail. This one does neither,
because it has no model of the site's current state and deliberately refuses to acquire one.
Every operation is self-contained. That refusal is the single premise most of the rest of
this document depends on.

The one exception is a same-page anchor, `[[#Heading]]`. Its target is the document itself,
so it needs no lookup and always resolves. If you add another link form, the first question
to settle is which side of that line it falls on.

### One slug rule, three consumers, and no delete path

`slugify` is the single rule: NFC-normalize, lowercase, keep Unicode letters, digits,
underscore, whitespace and hyphen; whitespace to hyphens, collapse runs, trim edges. Three
things consume it — the page slug in a URL, the committed filename, and the heading anchor.
`sanitizeName` wraps it with the `untitled` fallback that a filename needs and an anchor does
not, because an empty anchor is simply no anchor while an empty filename is not a file.

They were not always unified, and the bug that resulted teaches the rule: page slugs ran an
ASCII-only variant while anchors preserved Unicode, so `[[Café#Café]]` emitted
`/posts/caf/#café` and the two halves of one link disagreed with each other. Unification is
now an invariant with a test, and it is load-bearing beyond aesthetics — `buildPublishSet`
slugifies while `detectFilenameCollisions` sanitizes filenames, so if the two ever diverge a
link resolves against a name that was never committed.

The rule also has to agree with something outside this repository: Hugo's default goldmark
anchor generation (`autoIDType: "github"`) and its default `removePathAccents: false`. A site
that opts into `github-ascii`, or turns accents off, gets links that load pages but do not
jump, or do not load at all. Nothing in this repo checks it. It is a contract held in a
comment, and it is the thinnest strand in the whole design.

**The invariant that costs the most if forgotten: there is no delete path.** The gateway can
create branches, blobs, trees, commits and pull requests, and it can delete a _branch_ — it
cannot delete a _file_. So any change to the destination filename is a rename that leaves the
old file live on the site. Renaming a note does it. Changing `slugify` does it to every
affected note at once. Neither the plugin nor the site notices, and you get two copies of the
same post. If you touch the slug rule, the blast radius is not "some URLs change," it is
"some posts now exist twice," and cleanup is manual. The `aliases` escape hatch below is what
makes such a change survivable at all.

### Code is opaque, and mermaid is the exception that proves it

`splitCodeSegments` divides the body into prose and code before any transform runs; only
prose goes through the chain. This is not tidiness. Every transform is actively unsafe inside
code: `==` is the equality operator in most languages and would become `<mark>`, and several
of the regexes use character classes that admit newlines, so a match could begin inside a
fence and end in prose, carrying the closing fence away with it.

The splitter is lossless by construction — it slices the original string by precomputed line
offsets rather than rejoining split lines, so concatenating every segment reproduces the
input byte for byte. That property has its own test, because an earlier version dropped
newlines at segment boundaries and the entire existing suite still passed.

Mermaid inverts the rule: it is the one transform that runs over _code_ segments, because a
mermaid diagram **is** a fenced block. When you add a transform, decide explicitly which side
it belongs on. There is no default.

Two things about this idea are less settled than the prose above implies, and both are filed:
`convertMermaid` recognizes a strictly narrower fence syntax than the splitter does, so a
tilde-fenced or info-string mermaid block is protected from every transform and then never
converted; and inserting the splitter ahead of `stripComments` quietly reopened two closed
bugs about comment leakage. Both are consequences of the same thing — the splitter became the
first stage of the pipeline without every later stage being re-derived against it.

### Failure has two kinds, and the difference is expressed intent

A note without `status: publish` is not a failure in `publishAll` — it is silently skipped,
because a vault scan makes no claim about any particular note. The same note _is_ a failure in
`publishNote`, because the user pointed at it and pressed publish. Same condition, opposite
handling, and the discriminator is whether intent was expressed.

Read and parse failures break that symmetry on purpose. When a file cannot be read, or its
frontmatter is malformed YAML, the batch reports it rather than skipping it — because a
malformed block _hides_ publish intent. We cannot tell whether the author wrote
`status: publish` when the YAML does not parse, and silently dropping a note the author meant
to publish is the worse of the two errors. `splitFrontmatter` returns a distinct `error`
field precisely so callers can tell "malformed" from "absent," and the same asymmetry drives
`isDefinitelyNotPublishable`.

Warnings are a third category and never fail anything. The clearest case is a pull request
whose labels could not be applied: the PR exists, it is the artifact the user wanted, and
throwing would orphan it. So label failure becomes a warning on a successful result.

### Counts are a user-facing contract, not statistics

`buildBatchResult` derives `total` from the number of results, and `failedResults` exists
solely to produce one failed result per attempted file. That looks like padding until you
read the notice tree: `formatBatchNotice` branches on `total === 0` and prints "No publishable
notes found." A batch that failed wholesale before preparing anything — a filename collision,
say — would otherwise report zero total and be announced to the user as _nothing to do_.

`markResultsFailed` is the same idea from the other end. If the commit throws after
preparation succeeded, every prepared success is rewritten as a failure, so the user is never
told "twelve notes prepared successfully" about a commit that never landed. Preparation
success is not publish success, and the type system does not know that; these two helpers are
where the distinction lives.

### Retry is licensed by idempotency, and 422 is not a retry

`withRetry` wraps every call inside `commitFiles`, and it is safe only because of a property
of the Git data API: blobs and trees are content-addressed, and `updateRef` is non-forced, so
repeating any of them is a no-op rather than a duplicate. Retry here is not optimism; it is a
claim about the API that happens to be true.

`isTransient` decides what is worth repeating: 429 and 5xx unconditionally, 403 only when the
response looks rate-limit shaped (a `retry-after` header, or `x-ratelimit-remaining: 0`). A
bare 403 is usually a missing token scope, and retrying it burns attempts before surfacing a
permission error.

422 is deliberately excluded, and this is the distinction to keep straight. On branch
creation, 422 means the name is taken, which `createBranchWithRetry` resolves by generating a
_different_ name — a different request, not the same one again. Elsewhere it is a hard
validation error. Two retry mechanisms live in one file for two different reasons; conflating
them is easy and wrong.

Holding it together is `rethrowWithPrefix`, which passes `RequestError` through untouched so
its status survives and wraps only generic errors. This looks like a stylistic rule and is
not: when `getBranchSha` once re-wrapped `RequestError` into a plain `Error` it destroyed the
status code and silently disabled retry throughout the gateway (#242). Any new call site that
wraps a `RequestError` reintroduces that.

## The seams

**Obsidian** is reached through `vault` (`read`, `readBinary`, `getMarkdownFiles`,
`getFiles`), `metadataCache`, and `Notice`. The tests mock this wholesale, so nothing here
verifies that Obsidian dispatches a command or renders a notice — only that the right APIs
are called with the right arguments.

`metadataCache` is the newest and subtlest part of that seam. It exists so a vault of
thousands of notes is not read end to end to find a hundred, and `isDefinitelyNotPublishable`
is deliberately one-sided: the _only_ answer it trusts is "the cache parsed frontmatter and
there is no publish flag." A cold cache and parsed-but-absent frontmatter both fall through
to a real read, because `metadataCache` reports malformed frontmatter as simply missing — and
a malformed block is exactly the case that must not be skipped (#129). Widening this predicate
to trust more answers is the single easiest way to silently stop publishing notes. It arrives
as an optional fourth constructor parameter, appended rather than woven in; that shape is
honest about it being a late performance addition, and it means every test predating it still
constructs a `Publisher` that reads everything.

**GitHub** is `GitHubApiGateway`, the only Octokit-aware module. Keep it that way; the iOS
constraint lives here.

**Hugo** is the seam with no code at all. The plugin emits shortcodes (`callout`, `mermaid`)
the destination theme must define, writes to paths the site must use, assumes an
anchor-generation algorithm, and rewrites `aliases` into redirect URLs. None of it is
verified by anything. `hugo-shortcodes/` ships reference templates, and that is the entire
enforcement mechanism. This is where a silent breakage is most likely to originate, and where
you should look first when output that passes every test still renders wrong.

The alias behavior deserves attention because it hides inside a settings default. `aliases` is
_deliberately absent_ from `DEFAULT_SETTINGS.strippedFrontmatterFields`, with a comment saying
why: Hugo reads that field as its redirect list, so stripping it would discard every redirect
the publisher emits. `urlizeAliases` then converts each alias from a bare title into the URL
that title actually produced, reusing `sanitizeSlug` and `postsUrlPath` — the same functions
that generated the original URLs, which is precisely why the redirect lands. A value already
starting with `/` passes through untouched, checked _before_ slugification because
`sanitizeSlug` would strip the slash. That escape hatch is how you pin an exact historical
URL, and it is the counterweight to having no delete path.

## What the system accommodates, and what it does not

Adding a transform is easy and the shape is obvious: a method on `NoteTransformer`, slotted
into `processFromSplit` on the prose side (or the code side, if it owns a fence), plus tests.
Adding a settings field is easy: `PublisherSettings`, `DEFAULT_SETTINGS`, a validated branch
in `parseSettings`, a control in `settings.ts`. Adding a warning kind means a variant in
`PublishWarning` and a branch in `formatWarnings` — and `notices.ts` is pure and separately
tested precisely so the notice tree can be reasoned about without a plugin instance.

What would require rethinking something fundamental:

**Publishing incrementally, or deleting.** Both need a model of what the site currently
contains, and the system deliberately has none. "Unpublish" is not a new gateway method; it is
a new relationship between the plugin and the site's state, and it collides with the
publish-set idea head-on, because link resolution would have to consult the site rather than
the operation.

**Publishing a subset with working links.** Same root. Today the answer is "publish everything
together," which is why the batch path is the one that gets used.

**Any second user.** Settings validation, error messages, and the whole notice tree assume the
person reading them wrote the code. `README.md` says so outright, at length.

A maintainer who holds the theory looks first at the publish set when links misbehave, at
`slugify` when URLs move, at `isDefinitelyNotPublishable` when notes go missing, at the
Hugo-side config when anchors fail, and at `rethrowWithPrefix` when retries stop working. A
maintainer who does not is most likely to cause damage by widening the metadata-cache
predicate, by "simplifying" the two retry mechanisms into one, or by adjusting the slug rule
without realizing it renames live files.

## Uncertainties

Everything below is inferred from code and history. Treat it as flagged, not settled.

**The pipeline's first stage was inserted without re-deriving the later ones.**
`splitCodeSegments` (#243) is correct in itself, and so were the comment fixes it landed on
top of (#80, #244). Together they are not: a `%%` comment containing an inline code span or a
fence is split across two prose segments, so neither half holds a complete pair and the
comment publishes verbatim, with its wikilinks rewritten and its images uploaded. I verified
this against the real transformer. The mermaid fence mismatch has the same origin. I read the
whole cluster as sequencing accident rather than intent, but I am inferring — it is possible
someone decided a comment containing code is out of scope. Nothing says so.

**`prepareBatch` has a narrow window where a failed note can still be committed** — tracked
as #295, and this pass corroborates it without widening it. The note's content is written into
`entryMap` _before_ `resolveImages` runs; if `resolveImages` threw, the outer catch would
record a failed result while the entry stayed in the map and went out with the commit. Still
unreachable today: `resolveImages` catches per-image and its only `await` sits inside that
`try`. What this pass adds is why the hazard is easy to reintroduce — `prepareBatch` is also
where every _other_ per-note concern accumulated (validation, transform, image resolution,
progress ticks), so it is the natural place to add the next `await`, and the ordering that
makes it safe is not visible from inside the loop body.

**The prose/code reassembly is more fragile than it looks.** `processFromSplit` filters
segments into a `prose` array, then walks all segments again with a `proseIndex++` counter to
pair them back up. It is correct — `filter` and `map` both preserve order by specification —
but the coupling is implicit, and a refactor that reorders, memoizes, or parallelizes either
pass would misalign prose with its slot with no test failing loudly.

**Seam discipline is inconsistent, and I read it as history rather than intent.**
`GitHubApiGateway` takes an injectable `Sleep` so retry timing is testable, but `Publisher`
constructs its own gateway with no injection point, so `publisher.test.ts` reaches in and
overwrites a private field. Two different answers to the same testability question in adjacent
files. I believe the `Sleep` seam arrived with retry and the gateway seam simply never was
added, but that is inference.

**Image target collisions are only visible within one batch.** `targetPathOwners` is created
per `prepareBatch` call, so two images that sanitize to the same target path are caught when
published together and silently overwrite each other when published separately. This is
consistent with "every operation is self-contained," so it may be deliberate — but the
warning's existence implies someone thought the overwrite worth reporting, and the
cross-operation case is not reported.

**One transform branch appears unreachable.** `convertNoteEmbeds` tests
`IMAGE_EXTENSIONS.test(nameForCheck)` and returns the match untouched "for
convertImageReferences" — but `convertImageReferences` runs first over the same regex, so no
image embed survives to reach it. The parenthetical "(already processed)" suggests the author
knew. Left here rather than filed, because whether it is dead weight or deliberate belt-and-
braces is a reduction question, not a theory one.

**Error-message handling has two conventions.** `errorMessage` flattens any non-`Error` throw
to `"Unknown error"`; `resolveImages` deliberately uses `String(error)` instead, so a thrown
non-Error keeps its value in the debug log. The comment says this is on purpose and I believe
it, but only one of the two is the default and nothing marks which call sites should use
which.

**The Hugo contract may already have drifted.** The plugin assumes `autoIDType: "github"` and
`removePathAccents: false`. Both are Hugo defaults, and nothing in this repository would
notice if the site changed them. If anchors or accented URLs start failing, read the site's
`hugo.yaml` before debugging the transformer.
