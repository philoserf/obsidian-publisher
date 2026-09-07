# Testing

Policy doc for what this repo tests, what it doesn't, and why. Written for a future maintainer (or present-you in six months) deciding where a new test belongs.

## Current state

- 330 tests across 8 files, one runner (`bun test`), one assertion shape (`describe`/`test`/`expect` from `bun:test`).
- Tests live beside source in `src/` as `*.test.ts`. Fixtures are inline strings in the test files.
- Shared mocks live in `src/test-preload.ts` (loaded via `bunfig.toml`). `parseYaml`/`stringifyYaml` delegate to the real `yaml` package, so nested mappings and multi-line strings round-trip. The Obsidian surface is mocked only as far as the code touches it, but that is further than "pretend to exist": `Notice` records what it showed and implements `setMessage`/`hide`, `debounce` invokes immediately, and `Plugin` carries `app`/`addCommand`/`addSettingTab`/`loadData`/`saveData` so `main.test.ts` can drive `onload()`.
- Octokit is mocked at three different levels, deliberately. `@octokit/rest` and `@octokit/request-error` are `mock.module`'d globally in the preload. `github-api-gateway.test.ts` then builds a **real** `GitHubApiGateway` and overwrites its private `octokit` field with a fake, injecting a no-op `sleep` so retry counts are asserted without waiting. Only `publisher.test.ts` mocks the gateway wholesale.
- No end-to-end tests. Every real publish to the author's Hugo repo is, in practice, the integration test. Breakage gets caught because the author is also the only user.

The manual loop, when a change needs end-to-end verification:

1. `bun run build` — produces `main.js`.
2. `bun run deploy` — copies `main.js` and `manifest.json` into the vault's plugin directory.
3. Reload Obsidian (Cmd-R on desktop, or disable/enable the plugin in Settings).
4. Publish a note. Inspect the opened PR on GitHub for correct branch name, commit payload, labels, and body.

This is not a replacement for tests — it's the path for catching integration-layer issues that the unit suite can't see (Obsidian dispatch, real Octokit behavior, real Hugo rendering).

## What we test

- **Pure transforms.** `NoteTransformer` methods: wikilink conversion, image conversion, callout/mermaid shortcode emission, comment/highlight handling, filename and slug sanitization, code-fence and inline-code protection, and alias urlization. This is the largest file in the suite by a wide margin (120 tests). Inputs are strings, outputs are strings — the test shape matches the code shape.
- **Schema and validation.** `splitFrontmatter`, `hasPublishFlag`, `validateFrontmatter`. Every required-field and CRLF-line-ending fixture from past bugs is pinned.
- **Settings persistence.** `parseSettings` against every corruption shape we've seen or can imagine: wrong type, missing key, empty/whitespace, and that fallbacks copy rather than alias `DEFAULT_SETTINGS`.
- **Publisher orchestration.** `publisher.test.ts` constructs a real `Publisher` with a mocked `GitHubApiGateway` and a fake vault; it asserts on the shape of `PublishResult` / `BatchPublishResult`, on branch-cleanup behavior, on the `total === 0` guard, on progress-callback invocation, on the `metadataCache` prefilter (including the cache-not-yet-populated race), and on every warning variant. This is the highest-value layer in the suite — it pins the orchestration invariants documented in `THEORY.md`.
- **GitHub seam error narrowing.** `github-api-gateway.test.ts` pins that `RequestError` passes through untouched, carrying its status, and that generic `Error` gets a descriptive prefix. The retry predicate depends on that discipline — when `getBranchSha` re-wrapped `RequestError` into a plain `Error` it destroyed the status and disabled retry entirely (#242). The suite also pins `isTransient` directly (429, 5xx, and the header-gated 403) and the attempt counts `withRetry` produces inside `commitFiles`, using the injected `Sleep` seam.
- **User-visible notice classification.** `notices.test.ts` tests `formatBatchNotice` and `formatWarnings` as pure functions — which branch of the notice tree a given `BatchPublishResult` falls into. `main.test.ts` drives the plugin through `onload()` and the registered command callbacks, asserting which notices a publish actually shows.

## What we don't test, and why

- **Real GitHub API.** No PAT in CI, no iOS CI at all, and the API would make the suite flaky and slow. The seam is narrow (`GitHubApiGateway`, eight public methods) and Octokit is a well-tested library. Note this is a claim about the *network*, not the class: `github-api-gateway.test.ts` exercises the real gateway against a fake octokit in 34 tests. It is `publisher.test.ts` that mocks the gateway wholesale.
- **Obsidian runtime behavior.** The plugin imports Obsidian types but the test preload mocks them. We cannot test that Obsidian correctly dispatches a command, fires a file-change event, or renders a `Notice` — only that our code calls the right APIs with the right arguments. Obsidian is the integration layer; the author's daily use is its test.
- **Hugo build output.** The plugin emits markdown and shortcodes; whether Hugo renders them correctly is the site's problem. `hugo-shortcodes/` ships reference templates for the callout and mermaid shortcodes, but no test asserts against a real Hugo build.
- **Snapshot tests.** Deliberately avoided. Snapshots lock in implementation details and rot on refactor. Where an output shape matters, the test asserts on it directly.
- **Integration tests with a fake Octokit recorder.** Considered in #143 (this document is that issue's output) and deferred. The value would be catching cross-module regressions (e.g. the #136 shortcode gap, #190 stripped-field validation, the #193 silent-failure bug). In every case, the fix came with a targeted unit test that would have caught the regression going forward. The integration-test value is real but low-frequency for a single-user plugin; if users appear, or if two regressions in a row point at a gap the current layers don't cover, revisit.

## When a bug arrives

When fixing a bug, add a test at the layer that would have caught it, not the layer it surfaced at. Most production bugs in this repo so far have been pure-transform edge cases (CRLF frontmatter, Unicode heading anchors, image-path boundary regex) that belong in unit tests against the transform itself. Batch-level silent-failure bugs (#193) belong in `main.test.ts` or `publisher.test.ts` — that's where the invariant is expressed.

The rule of thumb: one failing test first, then the fix. The test is the permanent record of what broke; the code change is the fix.

## When to revisit

Signals that the unit-level strategy has stopped paying for itself:

- A regression ships that no existing test layer could have caught — the only realistic catch would have been a cross-module fixture test.
- Users beyond the author appear and their breakage patterns differ from the author's.

Until then, the unit suite plus the author-as-integration-test is the policy. This is deliberate — not a gap to fill.
