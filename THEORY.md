# Theory

A working account of this codebase, addressed to the next maintainer. Read it once; refer back to the invariants when you touch anything.

## What this system is for

This is a one-person publishing pipeline. It takes notes written in an Obsidian vault and puts them into the author's Hugo blog repository — via GitHub's REST API — through a pull request that a human will review before it ships.

The domain has three worlds, and the plugin lives at their junction:

- The **vault**: Obsidian-flavored markdown with wikilinks, note embeds, callouts, comments, highlights, and frontmatter. The vault's addressing scheme is filenames and basenames. Links are by human-readable page name, not URL.
- The **repo**: a Hugo site whose content lives under a directory (`content/posts`) and whose static assets (`static/images`) are served from the site root. Addressing is by path-and-slug URLs. The site's build tools expect specific shortcode calls (`{{< callout ... >}}`, `{{< mermaid >}}`).
- The **review gate**: GitHub pull requests. Nothing reaches the site without appearing on a feature branch with a PR the author will merge by hand.

The plugin is the translator and the gatekeeper. It reshapes a vault note into Hugo-shaped markdown, decides which notes are eligible, and pushes the result through the review gate — never directly, never skipping review. The shape of the destination and the insistence on PR review are not implementation details; they are the whole point. Everything else in the code is scaffolding around those two commitments.

The iOS constraint (the author wants to publish from a phone) is the reason nothing ever shells out to `git`; all write operations go through Octokit's Git Data API. That is why `GitHubService.commitFiles` constructs blobs, trees, and commits by hand — it is the only way to make an atomic multi-file commit without a working copy.

## Vocabulary and core entities

- **Note**: a vault markdown file with frontmatter and body. It becomes a candidate for publication by carrying `status: publish`. This is the "publish sentinel"; before 1.4.0 it was `status: published`, and the rename was a breaking change made precisely because the right word is _intent_, not _state_.
- **Publish set**: the set of slugs being published in one operation. This is the load-bearing abstraction introduced in 1.5.0. Wikilinks and note embeds resolve to URLs only when the target slug is in the set; otherwise they degrade to plain text. A batch publish seeds the set from every file being published; a single-note publish seeds it with the note's own slug (so `[[Self]]` self-references resolve). This moves cross-reference correctness out of Hugo's build and into the publish step, eliminating the old `{{< ref >}}` dance.
- **Slug / sanitized filename**: the canonical form a vault name takes when it lands in the repo — lowercase, hyphenated, with non-`[a-z0-9\-_]` stripped. `sanitizeName` is the shared core; `sanitizeSlug`, `sanitizeFilename`, and `sanitizeImageName` are thin wrappers that differ only in whether they preserve an extension.
- **PublishResult / BatchPublishResult**: the contract between `Publisher` and `main.ts`. Every attempted publish produces a `PublishResult`; the batch wraps a list of them with `total`, `successful`, `failed`, an optional top-level `error`, an optional `prUrl`, and optional batch-level `warnings`. This shape drives the user-visible notices. It is not a debugging artifact — it is the summary that replaces the author's ability to watch a terminal.
- **PublishWarning**: a tagged union of non-fatal conditions (`image-failed`, `image-collision`, `pr-label-failed`). Warnings exist because some things go wrong _after_ the PR has been created, and throwing away a PR over a failed label would cost the user more than the information they were trying to attach. The tags are part of the contract: `main.ts` groups and phrases notices by kind, and tests assert on the shape.
- **Frontmatter schema**: `schema.ts` owns the YAML split (`splitFrontmatter`), the publish gate (`hasPublishFlag`), and validation (`validateFrontmatter`). `title` and `date` are required; nothing else is. The regex handles CRLF endings (that was a bug in 1.4.1).

## Organizing ideas

### The PR is the commit point

Every publish creates a branch, commits files to it, and opens a PR — always, no escape hatch since 1.6.0. The code reflects this with two symmetric invariants:

1. If something fails before the PR is created, the branch is cleaned up (`cleanupBranch`) so the repo is not littered with orphaned refs.
2. If the PR has been created, nothing after that point may throw. Label-apply failure is explicitly caught and converted to a `pr-label-failed` warning. This is a direct fix for a 1.4.1 bug in which label failure triggered branch cleanup and auto-closed the freshly-made PR.

Together these shape `runPublishWorkflow`, the orchestrator extracted in 1.6.0 that both single-note and batch paths now share. The parameterization (branch prefix, commit message, PR title/body builders, and a `synthesizeFailures` closure) is not a generalization for unknown future callers; it exists because the single and batch paths genuinely have the same shape with different message text, and the previous duplication had drifted.

### Results are always populated

`main.ts`'s user-facing notice classifier (`batchNoticeText`) has a `total === 0` branch that says "No publishable notes found." That is benign when a vault actually has no publishable notes, but it will silently swallow a batch-level failure if the batch returns with `error` set and an empty `results[]`. Every code path that aborts the batch — filename collision detected, branch creation throws, read failures make up the whole set — must synthesize per-file `PublishResult` entries so `total` reflects attempted work. `synthesizeCollisionFailures`, `synthesizeFailures` in the workflow orchestrator, and the read-failure fallback exist for exactly this reason. Any new abort path you add must do the same, or it will vanish from the UI.

### The publish set is the resolver

Link resolution is not a property of the vault or a property of the site — it is a property of a publish operation. The publish set determines which `[[Page]]` wikilinks become `[Page](/posts/page/)` and which decay to plain text. `ContentProcessor.process` takes the set as an argument; the `Publisher` builds it from the files it is about to commit. This has one surprising consequence worth internalizing: you cannot publish a single note containing a link to an unpublished note and expect the link to resolve, even if the target has been published in a previous run. The link will degrade. That is a feature, not a bug — it guarantees every link the site emits points to a slug you intended to commit in the same operation.

### Schema is central, content-processor is a pipeline

`schema.ts` is the one place that knows what YAML is, what `status: publish` means, and what a valid frontmatter looks like. `content-processor.ts` is a straight pipeline of string transforms that runs in a specific order (`processFromSplit`). The order is load-bearing:

- Comments stripped first, so a commented-out wikilink does not produce a phantom publish-set membership check.
- Callouts and mermaid before wikilinks and images, so the syntax inside a callout body is processed once.
- Image references before note embeds, with both sharing the `![[...]]` syntax disambiguated by file extension. `convertImageReferences` handles anything matching `IMAGE_EXTENSIONS`; `convertNoteEmbeds` handles the rest.

Do not rearrange this pipeline casually. The separation of "this transform owns image embeds, that transform owns note embeds" is maintained by the extension regex, and if you add a new transform that walks `![[...]]`, you must pick one side of that line.

### Settings are defended at both boundaries

`parseSettings` (persistence load) and the settings UI (user input) both filter out illegal values. This is not paranoia; it is the consequence of two real attack surfaces: a user hand-editing `data.json`, and a user typing into a settings field. `strippedFrontmatterFields` cannot include required fields at either boundary, because stripping `date` would produce notes that pass vault validation but fail at publish. Shortcode names validate against a character class. `parseSettings` accepts the legacy `removePublishFlag` boolean and migrates it; don't delete this migration until you are certain no installed vault still has the old key — and since the author's vault is the only known install, _certain_ is cheap to verify.

### Error narrowing at the GitHub boundary

`rethrowWithPrefix` exists because `Octokit.RequestError` carries a status code, and that status code is load-bearing. `createBranchWithRetry` specifically checks for `422` (branch already exists) and adds a suffix to retry. If `createBranch` or `commitFiles` wrapped every error as a plain `Error`, the 422 detection would break. So the rule at the GitHub seam is: `RequestError` passes through untouched, generic `Error` gets a descriptive prefix, anything else rethrows as-is. Maintain this discipline in any new Octokit wrapper.

## Seams

### Obsidian ↔ plugin

Obsidian provides the vault (file I/O), YAML parsing (`parseYaml` / `stringifyYaml`), UI primitives (`Notice`, `Setting`, `Plugin`), and a `debounce`. The plugin consumes these and mocks them for tests in `src/test-preload.ts` with a small hand-rolled YAML parser good enough to round-trip the test fixtures. The mock is thin on purpose; do not grow it into a real YAML library. If a test exposes a gap in the mock, fix the test fixture first.

One concrete quirk: `main.ts` defines `publisher` as a getter that constructs a fresh `Publisher` on every access. The comment is explicit about this — reading `this.publisher` twice yields two distinct instances. The callers each capture it into a local variable for the duration of one command. This pattern exists so settings changes propagate without needing an explicit invalidation step; don't "fix" it by caching.

### Plugin ↔ GitHub

`GitHubService` is the single Octokit-aware class. It constructs the client from `settings.githubToken`, exposes `commitFiles` (blobs + tree + commit + ref update, done by hand for iOS), `createBranchWithRetry`, `createPullRequest`, `deleteBranch`, and `validateConnection`. The seam is deliberately narrow: no other file imports `@octokit/*`. If you need a new GitHub operation, add a method here and preserve the `rethrowWithPrefix` error-narrowing pattern.

### Plugin ↔ Hugo

This boundary is the thinnest in the system, and the most interesting conceptually. The plugin does not know Hugo exists at runtime — it only knows the _shape_ the Hugo site expects: `content/`-rooted content paths, `static/`-rooted images, and shortcode calls whose names are configurable. `hugo-shortcodes/` ships reference templates the user copies into their theme. Those files are not built or distributed by the plugin; they are a compact contract between the plugin's emitted markdown and the theme's rendering. If you change what the plugin emits (e.g., callout syntax), you must update the reference shortcodes to match, and vice versa.

The `imageUrlPath` and `postsUrlPath` helpers encode the Hugo convention (that `static/` serves at root and `content/` is the content root) as URL-shape transformations. Both use boundary regexes so `static-assets` and `staticfiles/img` are not mis-stripped to `-assets` or `files/img`. The comments document this; preserve it if you touch them.

### Settings persistence

Settings live in Obsidian's plugin data (`data.json`), as plaintext, including the GitHub token. This is an Obsidian platform constraint with no encrypted-storage API. The README says so; the onus is on the user. Do not invent encryption — just document carefully.

## What this system accommodates, and what it does not

Changes that fit the theory and are easy:

- **New body transforms** (another Obsidian-specific syntax): add a method to `ContentProcessor`, slot it into the `processFromSplit` pipeline in the right position, cover it with tests. Pipeline order is documented above.
- **New frontmatter behavior**: extend `schema.ts`. Keep parsing, gating, and validation together.
- **New settings**: extend the `PublisherSettings` type, add the field to `DEFAULT_SETTINGS`, defend it in `parseSettings`, and wire a UI setting in `settings.ts`. Remember both boundaries.
- **New non-fatal conditions**: add a new `PublishWarning` variant, plumb it through to `main.ts`'s `notifyWarnings`, update tests.

Changes that resist, and why:

- **Direct-commit publishing**: gone since 1.6.0, and its removal is the expression of an invariant, not the removal of a feature. Reintroducing it would have to re-open the question of what it means for a publish to "ship without review," which is the project's core commitment.
- **Cross-run wikilink resolution**: the publish set is a per-operation abstraction. Making it per-vault or per-site would push cross-reference correctness back out of the plugin and into the site build, undoing the 1.5.0 simplification. Workable, but a rethink.
- **Batch-wide image handling** (open issue #154): the current design resolves images per-file; collisions across files are detected but not unified. Fixing this properly requires deciding whether batch publishing has a single shared image namespace, which the code does not currently model.
- **Progress reporting beyond per-file preparation**: `ProgressCallback` fires in `prepareBatch` only. Reporting "uploading blob 3 of 7" during commit would require a second progress axis in `GitHubService`. Not hard, but a new concept.

A maintainer who does not understand the publish-set idea will likely break wikilink tests; one who does not understand the "PR-is-the-commit-point" invariant will reintroduce the orphaned-PR bug; one who does not understand the `total`-populated invariant will make batch errors silently disappear. Those three are the load-bearing places.

## Uncertainties and tensions

- The plugin has a single known user (the author). Many of the "defensive" behaviors (per-field settings fallback, YAML migration from `removePublishFlag`) are inferred from the CHANGELOG to be battle-scarred, but some may be aspirational hedges against a population of users that does not exist. I cannot tell from code alone which is which.
- The `hugo-shortcodes/` directory is part of the plugin's distribution (it's in the repo and mentioned in the README) but is not bundled into `main.js` or shipped by the Obsidian release workflow. The user copies files by hand. This is a coherent choice — the plugin is for one person and the theme is for one site — but the boundary is informal, and if the author ever wants "one-button setup," this is where friction lives.
- `BatchPublishResult` is used for single-note publishing too (`publishNote` calls `runPublishWorkflow` and unwraps `results[0]`). This is efficient but leaks batch vocabulary into the single-note path; a reader seeing `BatchPublishResult` in the single-note return value is right to be briefly confused.
- `BatchPublishResult.warnings` is optional where `PublishResult.warnings` is required. Open issue #205 proposes making it non-optional; the inconsistency is real but low-cost.
- The test mock for `parseYaml` is a flat line-per-key parser that cannot handle nested YAML (open issue #129). Tests that want nested frontmatter would need richer fixtures; the current suite side-steps this by using flat frontmatter everywhere. This constrains test expressiveness more than runtime behavior.
- The `1.4.1` fix for CRLF frontmatter and the `1.6.0` fix for Unicode heading anchors both suggest places where the regex-heavy approach to text transformation has missed an edge case at the cost of a bug-then-fix cycle. The transforms are still regex-based, and more such bugs likely remain. Consider this when adding transforms: prefer explicit boundary handling and normalize inputs before matching.
- The filename-collision precheck and the `total`-populated invariant together suggest the `BatchPublishResult` shape is _almost but not quite_ self-describing: `error` + empty `results` has been possible and has been a bug. A more principled fix would make the invariant type-level (e.g., require `results.length >= 1` when `error` is set). I can infer the intent but not whether the author considered and rejected this.

When in doubt, re-read the CHANGELOG. It is not a changelog so much as an archaeology of the theory being built.
