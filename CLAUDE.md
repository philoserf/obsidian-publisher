# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Publisher is a plugin that publishes Obsidian notes to GitHub for Hugo processing, using the GitHub REST API (via Octokit) for cross-platform compatibility including iOS.

The current next step for this repo is tracked in the workspace backlog at `../NEXT.md` (the `obsidian-publisher` row). Read it when starting work; update it when that step ships.

`THEORY.md` carries the design rationale behind the invariants this file summarizes — read it before changing the publish set, the slug rule, or the error-narrowing seam. `README.md` holds the full Obsidian-to-Hugo transformation table.

`WALKTHROUGH.md` is **generated, and regenerated once per release — not per PR.** Run the `code-walkthrough` skill after all the work for a release has landed; do not hand-edit it, and do not regenerate it because one PR moved a function it quotes. `bun run verify:docs` belongs to the release gate for the same reason: wiring it into CI would fail on every PR that touches a quoted function and would pressure exactly the per-PR regeneration this rule rules out. Note also what a green verify does and does not mean — it re-executes the code blocks and never reads the prose around them, so a deleted function leaves the narrative describing something that is gone while verify still passes (#328).

## Development Commands

```bash
bun test src/note-transformer.test.ts   # Run a single test file
bun test -t "wikilink"                  # Run tests whose name matches a substring
bun run check        # typecheck + biome check (run before committing)
bun run verify:docs  # re-run WALKTHROUGH.md's code blocks (release gate only)
bun run deploy       # Copy main.js + manifest.json into local vault plugin folder
```

`deploy` needs `OBSIDIAN_DEPLOY_DEST` set to the vault's plugin directory; it lives in the gitignored `.env.local` and the script exits 1 without it.

## Architecture

### Key Constraint

All GitHub operations must use the REST API through Octokit. Never use local Git commands or tools that require shell access — the plugin must work on iOS.

### Publishing Flow

1. **User triggers publish** — `main.ts` command handler
2. **Settings validation** — `validatePublish()` in `settings.ts` (`Publisher.validateSettings()` delegates to it)
3. **Branch creation** — `github-api-gateway.ts` creates a feature branch
4. **Content processing** — `note-transformer.ts` converts Obsidian syntax to Hugo markdown
5. **File commit** — `github-api-gateway.ts` writes one tree and one commit. Markdown goes inline as tree-entry `content`, so a 167-note batch is one request; only binary images need a separate `createBlob`
6. **PR creation** — `github-api-gateway.ts` creates pull request

### Component Responsibilities

- **`main.ts`** — Plugin entry point: registers commands, loads settings, routes to Publisher. Holds the single-flight `inFlight` promise: one flag across both commands, so a second invocation while a publish is pending is refused with a notice rather than opening a duplicate branch and PR. The guard is here and not on `Publisher`, which stays concurrently drivable for tests
- **`publisher.ts`** — Orchestration: `publishNote()` (single) and `publishAll()` (batch), both branch+PR, frontmatter validation, the `metadataCache` candidate prefilter, and the filename-collision precheck. `prepareBatch` returns `Prepared[]`, **not** `PublishResult[]` — a prepared note has not been committed, and its successful arm owns that note's file entries so a failed note cannot contribute any. `toResults()` is the only place a `PublishResult` is made from a `Prepared`
- **`github-api-gateway.ts`** — GitHub API wrapper using Octokit. All REST API calls must be iOS-compatible
- **`note-transformer.ts`** — The transform chain: code-fence protection, wikilinks, images, note embeds, callouts, mermaid, highlights, comments, slug/filename sanitization, alias urlization
- **`schema.ts`** — Frontmatter split, the `status: publish` gate, and required-field validation
- **`notices.ts`** — Pure formatting of user-visible notice text; no Obsidian calls
- **`settings.ts`** — Plugin settings UI with GitHub connection test. The YAML seam has no recovery path: input that does not parse to an object yields `{}`, which the additional-frontmatter control notices and reports. Do not add a salvage parser — the one that existed was the only way a value the user never wrote could reach a commit (#319). Every field has **one** normalizer, called by both the settings control and `parseSettings` — the load path used to validate types while the control repaired values, so all nine fields could disagree about what a bad value is (#314). Add a field in one place. Whether a configuration is _usable_ lives beside them too: `validateConnection` (token, owner, name) and `validatePublish` (those plus the two directories, derived from the first rather than restating it). The field sets differ on purpose — a connection test must not demand a content directory — but the vocabulary is one, "… is required" (#318). `sanitizePath` validates rather than subtracts, for the same reason: removing characters can synthesize the value being removed, and `.~./posts` used to become `../posts` (#313). It rejects whole (returning `""`, which `validateSettings` turns into a failed publish) rather than repairing, and deliberately does not restrict which characters a path may contain
- **`slug.ts`** — The one slug rule and its three shapes: `slugify` (heading anchors), `sanitizeSlug` (page slugs, with the `untitled` fallback), `sanitizeFilename` (committed filenames)

### Publishing Workflow

Every publish (single note or batch) creates a timestamped branch (`publish/2026-01-08T14-30-22` — an ISO-8601 string with `:` and `.` replaced by `-`), commits changes, and opens a PR with configured labels against `baseBranch`. Batch publishing uses one branch and one PR for all files. Branch collision handled via `createBranchWithRetry()` with suffix.

### Content Transformations

- **Code is opaque, and the document has two levels.** `splitCodeSegments` resolves four competing delimiters in one left-to-right pass by earliest start — a fence at line start, a blockquote run at line start, an inline backtick run, and `%%` — yielding `prose`, `code`, `comment` and `quote` segments. Only prose runs the transform chain, so nothing inside a fence or an inline code span is rewritten; a `comment` segment is dropped at assembly and contributes no images. A `quote` is a **container**: its interior is unscanned, and the callout pass strips the markers and re-enters the pipeline recursively, which is what lets a fence nest inside a callout. Splitting is lossless across every kind and has a test. Mermaid is the one transform that runs over _code_ segments, reading the `info` string the scanner already parsed rather than re-matching the fence
- **Wikilinks:** `[[Page Name]]` to `[Page Name](/posts/page-name/)`, `[[Page|Custom]]` to `[Custom](/posts/page-name/)` — but **only when the target slug is in the publish set**; otherwise the link degrades to bare display text. The `/posts/` prefix derives from `contentDir`. A same-page `[[#Heading]]` needs no publish-set lookup and always emits `[Heading](#heading)`. A path-qualified target (`[[folder/Page]]`) has its directory dropped before the slug lookup, because `buildPublishSet` keys on `file.basename` — but the **display text keeps the path the author wrote**, so a degraded link reads as it did in the vault
- **Images:** `![[image.png]]` to `![image.png](/images/image.png)`. A path-qualified embed resolves through `buildFilesByPathSuffix`, which indexes every suffix of every vault path the way Obsidian's shortest-unique-path resolution does; the committed name and URL come from the basename, so `![[pic.png]]` and `![[folder/pic.png]]` are one image. `targetPathOwners` is keyed on the resolved `TFile.path` for that reason — keying it on the reference text makes two spellings of one file look like a target collision. One function, `convertEmbeds`, handles both arms of `![[...]]` — an image extension makes it an image, anything else is a note embed. The pipe is read differently on each side: an image caption is every segment after the first pipe (minus a trailing bare size), a note embed's display text is only the second
- **One slug rule everywhere.** Page slugs, committed filenames and heading anchors all run the same `slugify()`: NFC-normalize, lowercase, keep Unicode letters, digits, underscore, whitespace and hyphen, whitespace to hyphens, collapse runs, trim edges. So `Rōnin…` keeps its macron while `Report Q3.2026` still becomes `report-q32026` (a dot is punctuation, not a letter). `sanitizeSlug` adds the `untitled` fallback that a filename needs and an anchor does not, so a heading anchor calls `slugify` directly; `sanitizeFilename` also lowercases the extension. All three live in `slug.ts`, which is the rule's owner — change it there, not in a caller. Keeping the three unified is load-bearing — `buildPublishSet` slugifies while `detectFilenameCollisions` sanitizes filenames, so if they diverge a link resolves against a name that was never committed
- **Renames leave the old file behind.** There is no delete path in the gateway, so changing a note's title (or changing the slug rule) commits a new file and leaves the previous one live. Removing it is a manual step in the site repo
- **Frontmatter:** Removes configured `strippedFrontmatterFields`, merges template fields without overriding existing ones, and urlizes `aliases` into post URLs so Hugo emits real redirects. `title` and `date` are **required** — a note missing either fails to publish; neither is synthesized

### GitHub API Patterns

Add new methods to `github-api-gateway.ts` using Octokit, and use `this.settings.repoOwner` / `this.settings.repoName`.

Error handling goes through `rethrowWithPrefix`: a `RequestError` passes through **untouched** so its status survives for the caller, and only a generic `Error` gets a descriptive prefix. Wrapping a `RequestError` was bug #242 — it destroyed the status and silently disabled retry.

Wrap any new idempotent call in `this.withRetry(...)`. Its predicate `isTransient` covers 429, 5xx, and 403 only when the response looks rate-limit shaped (a `retry-after` header, or `x-ratelimit-remaining: 0`) — a bare 403 is usually a missing scope, and retrying it just burns attempts. `422` is deliberately excluded: on branch creation it means the name is taken, which `createBranchWithRetry` resolves by generating a **different** name, not by repeating the same request. Both loops back off through `backoffDelay(attempt)` and call it **between** attempts only — never after the last, which is dead wait before a throw the backoff cannot prevent.

### Testing

Mocks are consolidated in `src/test-preload.ts`, loaded via `bunfig.toml`.

Octokit is mocked at three different levels on purpose. The preload `mock.module`s `@octokit/rest` and `@octokit/request-error` globally; `github-api-gateway.test.ts` then builds a **real** `GitHubApiGateway` and overwrites its private `octokit` field with a fake, injecting a recording `sleep` mock so retry counts — and the number of backoffs between them — are asserted without waiting; only `publisher.test.ts` mocks the gateway wholesale, passing the fake as `Publisher`'s fifth constructor argument — typed `PublishGateway`, so the compiler checks it. Reach for the level that matches what you are pinning.

`TESTING.md` is the test-policy doc — consult it when deciding where a new test belongs. Its rule: add the test at the layer that would have caught the bug, not the layer it surfaced at. Unlike `WALKTHROUGH.md` and `THEORY.md` it is not regenerated per release and nothing checks it; re-read it when a test **file** is added or removed, which is the event that drifts it.

### Build

`main.js` is committed, and CI fails if a rebuild moves it — rebuild before committing any source change.

### Version and Release

Use the `release-gate` then `release-ship` skills — do not tag by hand. `release-ship` sets `disable-model-invocation`, so it cannot be called via `Skill`; ask the user to run `/release-ship`. `release-ship` follows a prep-PR pattern: the version bump, CHANGELOG, and walkthrough ship as one PR, and the tag is applied after merge. Never use `bun version` / `npm version`, which auto-tag immediately and skip that step.

## Code Style

Code style is enforced by Biome. Run `bun run check` before committing. Type imports come before value imports.
