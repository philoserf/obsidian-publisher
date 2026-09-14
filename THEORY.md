# Theory

What you need to hold in your head to change this system without breaking it in ways the
tests will not catch. Not a tour — `WALKTHROUGH.md` is the tour, and `README.md` has the
full transformation table. This document is about _why_, and about which of the things you
could change are load-bearing.

## What the system is for

A private Obsidian vault and a public Hugo site are two collections of markdown with
different rules. The vault is where writing happens: notes link to each other by title,
embed images by filename, and carry frontmatter that is nobody's business but the author's.
The site is a build artifact with URLs, anchors and redirects. This plugin is the
translation between them, and it runs in one direction only.

The domain has three entities worth naming, because the code names them and the vocabulary
is not obvious from the outside:

A **note** is a vault file carrying `status: publish`. That sentinel is the whole of the
author's expressed intent — there is no separate manifest, no publish queue, no per-note
configuration. Publishing is a property the note asserts about itself.

A **publish set** is the set of notes participating in _one operation_. Not the set of
notes on the site. This distinction is the single most important idea in the system and the
one a well-meaning change is most likely to destroy; it gets its own section below.

An **operation** is one invocation of one of the two commands. It produces exactly one
branch, one commit and one pull request, or it produces nothing. There is no partial
operation and no resumable operation.

What the system does _not_ model is as load-bearing as what it does. It has no
representation of the site's current contents, no cache of what was published before, no
record of previous operations. It cannot tell you whether a note is already live. This is
not an omission waiting to be filled — several behaviors that look like bugs are consequences
of it, and "fixing" them by acquiring site state would be a different system.

## The organizing ideas

### One rule, one owner — and rejection rather than repair

This is the newest layer of the theory and the one most likely to be violated by someone
who has not read this far, because violating it looks like being helpful.

Read the issues closed into 1.10.0 in order and a single argument runs through them. A slug
rule with three consumers and no module became `slug.ts` (#315). Two settings normalizers
that disagreed about what a bad value is became one, called from both sides (#314). Two
functions answering "is this configuration usable?" in two vocabularies became
`validateConnection` and `validatePublish`, the second deriving from the first (#318). Two
passes over one embed syntax became `convertEmbeds` (#301). A path sanitizer that removed
`..`, then `~`, then edge slashes became a validator that removes nothing (#313). Two
fallback parsers that salvaged input the surrounding code had already rejected were deleted
(#319, #332).

Two principles, and they are connected.

**A rule has exactly one owner.** Where knowledge was stated twice it was not kept in sync
by discipline; one statement was deleted and the other made authoritative. The recurring
failure this prevents is not disagreement between two copies — it is that nobody notices the
disagreement, because each copy is locally correct. `slug.ts` exists for precisely this: the
publish set slugifies while the collision precheck sanitizes filenames, and if those two ever
diverge a link resolves against a name that was never committed. `slug.test.ts` pins the
agreement directly, which is what a load-bearing invariant with two consumers should look
like.

**Rejection beats repair.** `sanitizePath` is the sharpest case. Its predecessor removed the
dangerous parts of a path, and a remover can _synthesize_ what it removes: `.~./posts`
became `../posts`, because stripping `..` left `.~./` and stripping `~` closed the gap. No
ordering of removals fixes that. So nothing is removed — a path is acceptable as written or
rejected whole, and rejection returns `""`, which fails the publish loudly. The same
reasoning killed the YAML salvage parser: it was the only path by which a value the author
never wrote could reach a commit.

The practical consequence for you: when you find input that the code refuses to handle, the
question is not "how do I make this work?" but "which owner should decide, and should it
reject?" Adding a second place that repairs a value is how every one of the bugs above was
introduced.

### Every operation is self-contained, and link resolution is scoped to it

`[[Some Note]]` becomes a link only when its slug is in the publish set — the set built from
the files in _this run_. Otherwise it degrades to the display text the author wrote.

The consequence is sharper than it first sounds. `publishNote` passes a one-element list
into the same workflow, so a single-note publish has a publish set containing exactly one
slug: the note's own. **Publishing one note therefore flattens every outbound link it has.**
Only same-page anchors survive, because their target is the document itself and needs no
lookup. This is pinned by tests, which is how you know it is intended rather than an
oversight — the single-note command is useful for notes with no outbound links, and the
batch command is the one that produces a coherent site.

A sibling project solving this problem would almost certainly resolve links against the
site: query what is already published, or emit optimistically and let the build break. This
one does neither, because it has no model of the site and refuses to acquire one. That
refusal is the premise most of the rest of this document rests on. If you ever find yourself
adding a "what is already published?" lookup, you are not fixing a bug; you are proposing a
different system, and most of the reasoning below stops applying.

The reference must be reduced to a basename before the lookup, because the set is keyed on
`file.basename`. That is `vaultBasename`, and it is deliberately _not_ part of the slug
rule: the rule strips `/` as punctuation, so `folder/Note` slugified to `foldernote` and
matched nothing (#308). Addressing and naming are different operations. Note the asymmetry
that falls out — the lookup drops the directory, but the degraded display text keeps the
path the author wrote, because an unresolved link should read the way it read in the vault.

### The document has two levels, and the scanner is the only thing that knows

The transform chain does not see a flat stream of text with code blocks to skip. It sees a
tree, one level deep at a time, and `splitCodeSegments` is the only place that knows how to
find the boundaries.

Four delimiters compete in one left-to-right pass, resolved by earliest start: a fence at
line start, a blockquote run at line start, an inline backtick run, and `%%`. The
competition is load-bearing in both directions. `%%` must compete with fences, or a comment
wrapping a fenced block never pairs and publishes verbatim (#300). It must equally compete
with backtick spans, or a `%%` inside a code span stops being literal — which is what
Obsidian itself does. A `%%` _inside_ a fence is not a delimiter at all, not by special case
but because the fence was consumed when the scan reached its opening line.

Two properties make this tractable. The split is **lossless** — concatenating every
segment's text reproduces the input — which is what lets a comment be a _kind_ rather than a
deletion, so removing comments becomes an assembly decision made later and downstream code
never sees a hole. And a quote segment is a **container**: its interior is deliberately
unscanned, and the callout pass strips the markers and re-enters the pipeline recursively.
That recursion is why a fenced block can nest inside a callout (#303), a case the previous
flat model could not reach with any local fix.

Mermaid is the one transform that runs over code rather than prose, because it owns fences.
It reads the `info` string the scanner already captured rather than re-matching the fence
with a second pattern — re-matching is what made tilde fences and four-backtick fences
publish raw (#306). If you add a transform, the first question is which level it operates on.

### "Prepared" and "published" are different types, on purpose

A `PublishResult` with `success: true` means _this note was published_ everywhere in the
system: it is what the batch counts, what the notice announces, what the console prints
under "Successful publishes". At preparation time nothing has been committed, so preparation
produces `Prepared`, a different type.

They used to be the same type, and every path from preparation to a returned batch was
responsible for remembering to rewrite an optimistic `success: true` before it escaped. The
compiler could not help, because the two were the same type (#309). Now exactly one function,
`toResults`, converts one into the other, and it is therefore the only place a publish
outcome is decided.

The second property is subtler and worth preserving deliberately: **a note's file entries
hang off its own `Prepared`**, built and attached together after every `await` that note
needs. There is no batch-wide map for a note to write into before it is known to have
succeeded. An earlier version wrote a note's content into a shared map before resolving its
images, so a note that failed mid-preparation had already contributed content to the commit
(#295). Making entries a field of the note dissolves that, rather than fixing it by ordering
two statements correctly and hoping nobody reorders them.

### Counts are a user-facing contract

`total`, `successful` and `failed` are not statistics; they select which sentence the user
sees. A batch that fails on a filename collision synthesizes one failure _per file_ rather
than returning a bare error, because otherwise `total` is 0 and the "No publishable notes
found" branch swallows a real failure (#193 is the ancestor of this rule).

So when you add a failure mode, the question is not only "does the error reach the user" but
"which count does this land in, and does the notice tree still say something true?" On iOS
there is no console, so the `Notice` is the entire user interface. Anything that only reaches
`console.log` has, for the platform this plugin exists to serve, not been reported at all.

### The iOS constraint sits upstream of the architecture

Every GitHub operation goes through the REST API via Octokit, never a git binary, because
there is no shell on iOS. That is the stated constraint, and it explains the gateway's
existence. What is easier to miss is how far downstream it reaches: it is why the plugin
reports exclusively through toasts, why the PR URL gets a longer notice duration than the
default, why the per-request timeout exists at all (a stalled cellular connection must
surface as an error rather than hang a publish forever), and why the single-flight guard
exists — re-tapping a button that has not visibly responded is the natural thing to do on a
slow mobile connection, and it used to produce two branches and two pull requests that had
to be cleaned up by hand (#307).

### Retry is licensed by idempotency, and 422 is not a retry

`withRetry` wraps only calls that are safe to repeat: blobs and trees are content-addressed,
and `updateRef` with an unchanged SHA is a no-op. The predicate is narrow on purpose. 403
counts only when the response looks rate-limit shaped, because GitHub uses it both for
secondary rate limiting and for "token lacks scope", and retrying a permission error burns
every attempt before surfacing something the user could have acted on immediately.

422 is deliberately excluded, and the reason is the useful part: on branch creation it means
the name is taken, which is resolved by trying a **different** name rather than repeating the
same request. `createBranchWithRetry` treats it as retryable for exactly that reason —
the retry changes the input. Two loops, two different notions of what a retry is.

Both loops back off _between_ attempts and never after the last, which sounds like a
micro-optimization and was worth a fix (#312): the tail sleep added seconds of dead wait to
every failure the backoff could not have prevented, and a commit that failed both ways paid
it twice.

### The single-user premise is a design input, not a disclaimer

The README's "you probably shouldn't install this" is not modesty. Breaking changes ship
without migration paths, and the changelog is a list of retirements: the publish sentinel
renamed, `removePublishFlag` retired, `{{< ref >}}` wikilinks retired, direct-commit publish
mode removed entirely along with its setting.

This is what makes the "one owner, reject don't repair" discipline affordable. A plugin with
users could not delete a salvage parser that had been quietly fixing their malformed input
for a year. This one can, because the only installation is the author's and the author is
also the integration test. When you are weighing whether to keep a compatibility path, the
answer here is almost always no — and that answer would be wrong in a sibling project.

## The seams

**Obsidian** is the runtime and is entirely mocked in tests. The plugin can be verified to
call the right APIs with the right arguments and nothing more; whether Obsidian dispatches a
command, populates `metadataCache`, or renders a `Notice` is untested by construction. The
mock is deliberately only as wide as the code reaches — `Setting`'s builder methods are
absent, which is a standing claim that `PublisherSettingTab.display()` has no test. Adding
one means restoring them in the same change.

The `metadataCache` prefilter is the one place this seam leaks into logic. Only one answer
from the cache is safe to trust — it parsed the frontmatter and there is no publish flag —
because the cache reports _malformed_ frontmatter as simply absent. Trusting "no
frontmatter" as "not publishable" would silently skip exactly the notes whose YAML is broken,
which is the case the read path exists to surface.

**GitHub** is behind `GitHubApiGateway`, and `Publisher` depends on a four-method `Pick` of
it named `PublishGateway`. That port is typed rather than nominal because the class's private
fields make it unsatisfiable by a fake; the constructor's default argument is where the real
class is checked against the port. Error narrowing has one rule and it is load-bearing: a
`RequestError` passes through untouched so its status survives, and only a generic `Error`
gets a prefix. Wrapping a `RequestError` destroyed the status and silently disabled retry,
because the retry predicate reads it (#242).

The gateway has **no delete path**, and this is felt well outside it. Because a note's
committed filename follows the slug rule, renaming a note publishes a new file and leaves
the old one live. Changing the slug rule does this to every note at once. There is no
mechanism in this system to clean that up, which is why the rule's blast radius is the real
argument for keeping it in one module.

**Hugo** is the seam with no verification at all. The plugin assumes `autoIDType: "github"`
and `removePathAccents: false` — both Hugo defaults — and emits `callout` and `mermaid`
shortcodes the site must define. Reference implementations ship in `hugo-shortcodes/`.
Nothing in this repository would notice if the site changed any of it. If anchors or accented
URLs start failing, read the site's config before debugging the transformer.

**The settings file** is a seam because it is the one place data crosses a process boundary
and comes back changed by nobody. `parseSettings` answers two questions per field — absent or
wrong type falls back, present but unnormalized runs the same normalizer the UI runs — and
that pairing is the invariant. A field added to only one side is the bug class (#314).

**Between the transformer and the publisher** there is a seam worth knowing about because it
is enforced only incidentally. The image URL written into the markdown and the path the image
is committed at are computed in two different modules, from the same input, through the same
two functions — and the directory halves are deliberately _different_, because `imageUrlPath`
strips a leading `static/` that the commit path keeps. Mutating either side does currently
fail a test, so the coupling is pinned; but the publisher-side catch comes from a target
collision test whose subject is something else entirely. Rewrite that test with pre-sanitized
fixtures and the coupling silently stops being checked. It deserves a direct test of its own,
the way `slug.test.ts` directly pins the slug/filename agreement.

**The standing documents are themselves a seam, and only two of the three are
checked.** `WALKTHROUGH.md` is regenerated once per release and `bun run verify:docs`
re-executes its code blocks at the release gate; `THEORY.md` is regenerated once per
release. Nothing re-executes prose, so a claim in any of them can go false silently — which
has happened twice (#254, #328) and, until `af727dd`, a third time in `TESTING.md`, the one
document that had no cadence at all. Its rule now is to be re-read whenever a test file is
added or removed, that being the event that drifts it. Treat all three as code that no
compiler checks.

## What the system accommodates, and what it does not

It absorbs new **transforms** well. Add a prose transform to the chain in `transformProse`,
or a segment kind to the scanner, and the two-level model carries it — provided you settle
first which level it belongs to and whether the split stays lossless.

It absorbs new **settings** well, now that each has one normalizer. Add the field to
`PublisherSettings`, give it a default, write one normalizer, call it from `parseSettings`
and the control. There is no second place to forget.

It absorbs new **warning kinds** well. The union in `types.ts` is discriminated and
`notices.ts` is pure formatting, so the compiler will walk you to every site.

It does **not** accommodate anything requiring knowledge of the site. Incremental publishing,
link resolution against live pages, detecting that a note was renamed, cleaning up orphaned
files — each needs a model of remote state the system deliberately lacks. These are not
features waiting to be added; the first one implemented becomes the system's new premise.

It does **not** accommodate multi-user anything. Both the "reject don't repair" discipline
and the freedom to ship breaking changes depend on the single installation.

It does **not** accommodate partial success at the operation level. One branch, one commit,
one PR, or nothing. A note can fail individually and the batch continues, but there is no
"commit what worked and retry the rest" — and adding it would put the system in the position
of knowing what is already committed, which is the premise again.

**Where a maintainer who did not read this would do damage.** Making `publishNote` resolve
links against all notes with `status: publish` rather than the operation's set — it looks
like an obvious fix for flattened links and it silently changes the system's premise. Adding
a "clean up" or "repair" step to a normalizer. Re-wrapping a `RequestError` to improve an
error message. Adding a second place that decides a publish outcome. Adding an option where
something was deliberately removed.

## Uncertainties

Everything here is inferred from code, tests and history. Treat it as flagged rather than
settled.

**Two prior uncertainties are now resolved**, recorded here so they are not re-investigated:
the inconsistent testability seams (`Sleep` injected, gateway not) closed with #311, and the
unreachable image guard in the old `convertNoteEmbeds` closed with #301 when the two embed
passes merged.

**Image target collisions are only visible within one operation.** `targetPathOwners` is
created per batch, so two images that sanitize to one target path are caught when published
together and silently overwrite each other when published separately. This is consistent
with "every operation is self-contained," so it may be deliberate — but the warning's
existence implies somebody thought the overwrite worth reporting, and the cross-operation
case is not reported. I could not determine from the code which reading is correct.

**Error-message handling has two conventions and nothing marks which applies where.**
`errorMessage` flattens a non-`Error` throw to "Unknown error"; `resolveImages` deliberately
uses `String(error)` so a thrown non-Error keeps its value in a debug log. The comment says
this is intentional and I believe it. But only one is the default, and a new call site has
nothing to consult.

**`Publisher.validateSettings` is a one-line delegation kept for its callers' convenience**,
and #298 deleted exactly that shape elsewhere in the same release — one-line delegations
whose bodies are the functions they call. #335's reasoning is explicit (twelve test call
sites spy on the method, and `main.ts` already holds a `Publisher` at both call sites), so
this is a reasoned exception rather than drift. Recorded because the next person hunting
for code to delete will find it and should know the argument was already had.

**The `~` rejection in `sanitizePath` has no stated justification.** The code comment admits
it: there is no shell, and GitHub's tree API does not expand `~`, so the threat model is
unclear. It was carried forward from the sanitizer it replaced. It is harmless, and it is
the one rule in the settings layer nobody can currently explain.

**The Hugo contract may already have drifted and nothing here would know.** See the seam
above. This is the system's largest untested assumption and it lives entirely outside the
repository.
