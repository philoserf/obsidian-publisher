# Testing

Policy doc for what this repo tests, what it doesn't, and why. Written for a future maintainer (or present-you in six months) deciding where a new test belongs.

## Current state

- ~240 tests, one runner (`bun test`), one assertion shape (`describe`/`test`/`expect` from `bun:test`).
- Tests live beside source in `src/` as `*.test.ts`. Fixtures are inline strings in the test files.
- Shared mocks live in `src/test-preload.ts` (loaded via `bunfig.toml`): `obsidian`, a thin hand-rolled `parseYaml`, and the Obsidian UI primitives that import-time requires pretend to exist. `@octokit/rest` is mocked per-test by constructing fake `GitHubService` instances.
- No end-to-end tests. Every real publish to the author's Hugo repo is, in practice, the integration test. Breakage gets caught because the author is also the only user.

The manual loop, when a change needs end-to-end verification:

1. `bun run build` — produces `main.js`.
2. `bun run deploy` — copies `main.js` and `manifest.json` into the vault's plugin directory.
3. Reload Obsidian (Cmd-R on desktop, or disable/enable the plugin in Settings).
4. Publish a note. Inspect the opened PR on GitHub for correct branch name, commit payload, labels, and body.

This is not a replacement for tests — it's the path for catching integration-layer issues that the unit suite can't see (Obsidian dispatch, real Octokit behavior, real Hugo rendering).

## What we test

- **Pure transforms.** `ContentProcessor` methods: wikilink conversion, image conversion, callout/mermaid shortcode emission, comment/highlight handling, filename and slug sanitization. Inputs are strings, outputs are strings — the test shape matches the code shape.
- **Schema and validation.** `splitFrontmatter`, `hasPublishFlag`, `validateFrontmatter`. Every required-field and CRLF-line-ending fixture from past bugs is pinned.
- **Settings persistence.** `parseSettings` against every corruption shape we've seen or can imagine: wrong type, missing key, empty/whitespace, legacy-key migration.
- **Publisher orchestration.** `publisher.test.ts` constructs a real `Publisher` with a mocked `GitHubService` and a fake vault; it asserts on the shape of `PublishResult` / `BatchPublishResult`, on branch-cleanup behavior, on the `total === 0` guard, on progress-callback invocation, and on every warning variant. This is the highest-value layer in the suite — it pins the orchestration invariants documented in `THEORY.md`.
- **GitHub seam error narrowing.** `github-service.test.ts` pins that `RequestError` passes through untouched and generic `Error` gets a descriptive prefix. The 422/404 status-code checks in `createBranchWithRetry` depend on this discipline.
- **User-visible notice classification.** `main.test.ts` tests `batchNoticeText` as a pure function — which branch of the notice tree a given `BatchPublishResult` falls into.

## What we don't test, and why

- **Real GitHub API.** No PAT in CI, no iOS CI at all, and the API would make the suite flaky and slow. The seam is narrow (`GitHubService`), the surface is six methods, and Octokit is a well-tested library. Mocking `GitHubService` and trusting Octokit is the right trade.
- **Obsidian runtime behavior.** The plugin imports Obsidian types but the test preload mocks them. We cannot test that Obsidian correctly dispatches a command, fires a file-change event, or renders a `Notice` — only that our code calls the right APIs with the right arguments. Obsidian is the integration layer; the author's daily use is its test.
- **Hugo build output.** The plugin emits markdown and shortcodes; whether Hugo renders them correctly is the site's problem. `hugo-shortcodes/` ships reference templates for the callout and mermaid shortcodes, but no test asserts against a real Hugo build.
- **Snapshot tests.** Deliberately avoided. Snapshots lock in implementation details and rot on refactor. Where an output shape matters, the test asserts on it directly.
- **Integration tests with a fake Octokit recorder.** Considered in #143; deferred. The value would be catching cross-module regressions (e.g. the #136 shortcode gap, #190 stripped-field validation, the #193 silent-failure bug). In every case, the fix came with a targeted unit test that would have caught the regression going forward. The integration-test value is real but low-frequency for a single-user plugin; if users appear, or if two regressions in a row point at a gap the current layers don't cover, revisit.

## When a bug arrives

When fixing a bug, add a test at the layer that would have caught it, not the layer it surfaced at. Most production bugs in this repo so far have been pure-transform edge cases (CRLF frontmatter, Unicode heading anchors, image-path boundary regex) that belong in unit tests against the transform itself. Batch-level silent-failure bugs (#193) belong in `main.test.ts` or `publisher.test.ts` — that's where the invariant is expressed.

The rule of thumb: one failing test first, then the fix. The test is the permanent record of what broke; the code change is the fix.

## When to revisit

Signals that the unit-level strategy has stopped paying for itself:

- A regression ships that no existing test layer could have caught — the only realistic catch would have been a cross-module fixture test.
- The `parseYaml` mock's limitations block a test you actually want to write (#129 — then it becomes the next move).
- Users beyond the author appear and their breakage patterns differ from the author's.

Until then, the unit suite plus the author-as-integration-test is the policy. This is deliberate — not a gap to fill.
