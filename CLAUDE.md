# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Publisher is a plugin that publishes Obsidian notes to GitHub for Hugo processing, using the GitHub REST API (via Octokit) for cross-platform compatibility including iOS.

The current next step for this repo is tracked in the workspace backlog at `../NEXT.md` (the `obsidian-publisher` row). Read it when starting work; update it when that step ships.

`THEORY.md` carries the design rationale behind the invariants this file summarizes — read it before changing the publish set, the slug rule, or the error-narrowing seam. `README.md` holds the full Obsidian-to-Hugo transformation table.

## Development Commands

```bash
bun install          # Install dependencies
bun run dev          # Watch mode build with source maps
bun run build        # Production build (runs check first)
bun test             # Run all tests
bun test src/note-transformer.test.ts   # Run a single test file
bun test -t "wikilink"                  # Run tests whose name matches a substring
bun run typecheck    # Type checking only (tsc --noEmit)
bun run lint         # Biome check (lint + format verify)
bun run lint:fix     # Biome check --write
bun run format       # Biome format --write
bun run check        # typecheck + biome check (run before committing)
bun run audit        # bun audit (critical vulnerabilities)
bun run deploy       # Copy main.js + manifest.json into local vault plugin folder
```

`deploy` needs `OBSIDIAN_DEPLOY_DEST` set to the vault's plugin directory; it lives in the gitignored `.env.local` and the script exits 1 without it.

## Architecture

### Key Constraint

All GitHub operations must use the REST API through Octokit. Never use local Git commands or tools that require shell access — the plugin must work on iOS.

### Publishing Flow

1. **User triggers publish** — `main.ts` command handler
2. **Settings validation** — `publisher.ts` checks GitHub credentials
3. **Branch creation** — `github-api-gateway.ts` creates a feature branch
4. **Content processing** — `note-transformer.ts` converts Obsidian syntax to Hugo markdown
5. **File commit** — `github-api-gateway.ts` writes one tree and one commit. Markdown goes inline as tree-entry `content`, so a 167-note batch is one request; only binary images need a separate `createBlob`
6. **PR creation** — `github-api-gateway.ts` creates pull request

### Component Responsibilities

- **`main.ts`** — Plugin entry point: registers commands, loads settings, routes to Publisher
- **`publisher.ts`** — Orchestration: `publishNote()` (single) and `publishAll()` (batch), both branch+PR, frontmatter validation, the `metadataCache` candidate prefilter, and the filename-collision precheck
- **`github-api-gateway.ts`** — GitHub API wrapper using Octokit. All REST API calls must be iOS-compatible
- **`note-transformer.ts`** — The transform chain: code-fence protection, wikilinks, images, note embeds, callouts, mermaid, highlights, comments, slug/filename sanitization, alias urlization
- **`schema.ts`** — Frontmatter split, the `status: publish` gate, and required-field validation
- **`notices.ts`** — Pure formatting of user-visible notice text; no Obsidian calls
- **`settings-parse.ts`** — Validates and repairs persisted plugin data
- **`settings.ts`** — Plugin settings UI with GitHub connection test
- **`types.ts`** — `PublisherSettings`, `PublishResult` (a `PublishSuccess`/`PublishFailure` union), `BatchPublishResult`, `ProcessedContent`, `PublishWarning`, `DEFAULT_SETTINGS`, `errorMessage()`

### Publishing Workflow

Every publish (single note or batch) creates a timestamped branch (`publish/2026-01-08T14-30-22` — an ISO-8601 string with `:` and `.` replaced by `-`), commits changes, and opens a PR with configured labels against `baseBranch`. Batch publishing uses one branch and one PR for all files. Branch collision handled via `createBranchWithRetry()` with suffix.

### Content Transformations

- **Code is opaque.** The body is split into prose and code segments first (`splitCodeSegments`); only prose runs the transform chain, so nothing inside a fence or an inline code span is rewritten. Mermaid is the one transform that runs over *code* segments instead
- **Wikilinks:** `[[Page Name]]` to `[Page Name](/posts/page-name/)`, `[[Page|Custom]]` to `[Custom](/posts/page-name/)` — but **only when the target slug is in the publish set**; otherwise the link degrades to bare display text. The `/posts/` prefix derives from `contentDir`. A same-page `[[#Heading]]` needs no publish-set lookup and always emits `[Heading](#heading)`
- **Images:** `![[image.png]]` to `![image.png](/images/image.png)`
- **One slug rule everywhere.** Page slugs, committed filenames and heading anchors all run the same `slugify()`: NFC-normalize, lowercase, keep Unicode letters, digits, underscore, whitespace and hyphen, whitespace to hyphens, collapse runs, trim edges. So `Rōnin…` keeps its macron while `Report Q3.2026` still becomes `report-q32026` (a dot is punctuation, not a letter). `sanitizeName` adds the `untitled` fallback that a filename needs and an anchor does not; `sanitizeFilename` also lowercases the extension. Keeping the three unified is load-bearing — `buildPublishSet` slugifies while `detectFilenameCollisions` sanitizes filenames, so if they diverge a link resolves against a name that was never committed
- **Renames leave the old file behind.** There is no delete path in the gateway, so changing a note's title (or changing the slug rule) commits a new file and leaves the previous one live. Removing it is a manual step in the site repo
- **Frontmatter:** Removes configured `strippedFrontmatterFields`, merges template fields without overriding existing ones, and urlizes `aliases` into post URLs so Hugo emits real redirects. `title` and `date` are **required** — a note missing either fails to publish; neither is synthesized

### GitHub API Patterns

Add new methods to `github-api-gateway.ts` using Octokit, and use `this.settings.repoOwner` / `this.settings.repoName`.

Error handling goes through `rethrowWithPrefix`: a `RequestError` passes through **untouched** so its status survives for the caller, and only a generic `Error` gets a descriptive prefix. Wrapping a `RequestError` was bug #242 — it destroyed the status and silently disabled retry.

Wrap any new idempotent call in `this.withRetry(...)`. Its predicate `isTransient` covers 429, 5xx, and 403 only when the response looks rate-limit shaped (a `retry-after` header, or `x-ratelimit-remaining: 0`) — a bare 403 is usually a missing scope, and retrying it just burns attempts. `422` is deliberately excluded: on branch creation it means the name is taken, which `createBranchWithRetry` resolves by generating a **different** name, not by repeating the same request.

### Testing

Tests use Bun's built-in runner (`bun:test`) with `describe`/`test`/`expect` API. Test files live alongside source in `src/` with `.test.ts` suffix. Mocks are consolidated in `src/test-preload.ts`, loaded via `bunfig.toml`.

Octokit is mocked at three different levels on purpose. The preload `mock.module`s `@octokit/rest` and `@octokit/request-error` globally; `github-api-gateway.test.ts` then builds a **real** `GitHubApiGateway` and overwrites its private `octokit` field with a fake, injecting a no-op `sleep` so retry counts are asserted without waiting; only `publisher.test.ts` mocks the gateway wholesale. Reach for the level that matches what you are pinning.

`TESTING.md` is the test-policy doc — consult it when deciding where a new test belongs. Its rule: add the test at the layer that would have caught the bug, not the layer it surfaced at.

### Build

Single-file bundle via Bun: entry `src/main.ts` to output `main.js`. Externals: `obsidian`, `electron`. Bundled: `@octokit/rest` and `@octokit/request-error`. `main.js` is committed, and CI fails if a rebuild moves it — rebuild before committing any source change.

### Version and Release

Use the `obsidian-gate` then `obsidian-ship` skills — do not tag by hand. `obsidian-ship` sets `disable-model-invocation`, so it cannot be called via `Skill`; ask the user to run `/obsidian-ship`. `obsidian-ship` follows a prep-PR pattern: the version bump, CHANGELOG, and walkthrough ship as one PR, and the tag is applied after merge. Never use `bun version` / `npm version`, which auto-tag immediately and skip that step.

## Code Style

Code style is enforced by Biome. Run `bun run check` before committing. Type imports come before value imports.
