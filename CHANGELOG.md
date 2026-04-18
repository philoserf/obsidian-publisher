# Changelog

## 1.4.1

### Fixed

- Batch publish no longer silently drops files that fail to read. Read failures surface as per-file failed `PublishResult` entries with `Failed to read: …` messages, and counted in the failed totals. When all files are unreadable, the batch-level error summarizes the read failures so mobile users see the cause in a Notice (#157).
- Persisted settings are validated on load. A corrupted or hand-edited `data.json` (e.g. `prLabels` as a string, `frontmatterTemplate` as `null`, `usePullRequests` as a string) now falls back per-field to defaults instead of crashing downstream code (#160).
- Frontmatter regex accepts CRLF line endings. Files saved with `\r\n` (Windows, Windows-host iCloud/Dropbox sync) now parse instead of silently failing the publish gate (#159).
- PR label apply failure no longer orphans the just-created PR. Label apply now surfaces as a non-fatal warning and the PR is preserved, instead of triggering branch cleanup that auto-closed the PR. The batch path no longer mislabels successful per-file commits as "Commit failed" when PR creation fails (#156).

## 1.4.0

### Breaking Changes

- **Publish sentinel renamed** from `status: published` to `status: publish`. Legacy notes with `status: published` are no longer publishable — update frontmatter to `status: publish` (intent) to publish.
- **`title` and `date` frontmatter are now required.** Publish is rejected with a per-note error if either is missing, non-string, or malformed. The old `new Date()` fallback for missing `date` is gone — publish intent must be explicit.

### Added

- Schema module (`src/schema.ts`) as the single source of truth for frontmatter parsing, publish-flag gating, and validation. Exposes `PUBLISH_STATUS_FIELD` / `PUBLISH_STATUS_VALUE` constants, `REQUIRED_FRONTMATTER_FIELDS`, and `splitFrontmatter` / `hasPublishFlag` / `validateFrontmatter` helpers.
- Preflight frontmatter validation in both single-file publish paths — fails fast before any GitHub API activity.
- Image basename-collision detection. Distinct images with the same filename now surface as a warning instead of one silently overwriting the other on upload.
- `THEORY.md` documenting architectural intent and trade-offs.
- `TODO.md` capturing the composite spec alignment plan.

### Fixed

- Frontmatter error collection aggregates all per-note errors in a batch instead of short-circuiting on the first; non-string `title` / `date` values are rejected.
- Settings disk save is debounced to avoid writing on every keystroke.
- Pending debounced save is flushed on tab hide and plugin unload before cancellation, so in-flight edits aren't lost.
- Batch publish propagates per-file errors and aligns result counts with the `results[]` array.
- Quoted publish-flag values (`status: "publish"`) parse correctly — the old regex-based gate silently failed on quotes.
- Image collision paths are sorted for stable output.
- Image read failure log now includes the underlying error message instead of a raw `Error` object.

### Changed

- Content processor delegates frontmatter parsing to the schema module (no more regex duplication).
- `publishAllWithPR` decomposed into three helpers for clarity.
- Settings cluster simplified: `display()` decomposed with an `addTextSetting` helper; pure helpers extracted and directly tested.
- `Notice` calls decoupled from `Publisher` — UI surface is no longer a publisher dependency.
- Release workflow bumped to `softprops/action-gh-release@v3`.
- `claude-code-review` workflow removed.

### Docs

- README and code comments updated for the `status: publish` rename.
- Stale hugo-coder references removed from docs.

## 1.3.0

### Fixed

- Add build step to CI workflow
- Align frontmatter regex in publisher with content-processor
- Allow dots and underscores in repo name sanitization
- Preserve RequestError in createBranch for retry logic
- Add types to tsconfig for TypeScript 6 compatibility

### Changed

- Consolidate sanitize functions into shared sanitizeName
- Extract shared errorMessage utility
- Unify base64 encoding into single toBase64 helper
- Remove unused getFileSha and createOrUpdateFile
- Remove redundant prUrl type intersections
- Use markResultsFailed in publishAllWithPR

### Internal

- CI workflows, dependency updates

## 1.2.0

### Features

- Convert Obsidian callouts to hugo-coder notice shortcodes (maps ~20 callout types to 7 notice types)
- Convert mermaid fenced code blocks to hugo-coder mermaid shortcodes
- Convert Obsidian highlight syntax (`==text==`) to `<mark>` tags
- Strip Obsidian comments (`%%...%%`) before publishing
- Implement file watching in `bun run dev` (was a no-op)

### Bug Fixes

- Handle Obsidian image sizing syntax (`![[image.png|300]]`)
- Fix note embed pipe-alias (`![[Note|Display]]`) losing display text
- Skip PR creation when all files fail in batch publish
- Mark results as failed when commitFiles throws (was reporting false success)
- Use atomic commit for single-file publish with images (was one commit per image)
- Stop recreating Publisher on every settings keystroke
- Restrict release workflow to semver tag pushes
- Declare @octokit/request-error as explicit dependency
- Include test files in type checking
- Align validate script with CI checks (add test step)
- Add input validation for settings fields (GitHub name sanitization, path traversal prevention)
- Create blobs sequentially to avoid GitHub rate limits

### Refactoring

- Extract shared helpers: `markResultsFailed()`, `cleanupBranch()`, `resolveImages()`
- Consolidate `baseBranch` and `prLabels` fallbacks into getters
- Eliminate double vault reads during batch publish
- Delete duplicated sanitizer.test.ts
- Remove console.log from plugin load/unload

### Tests

- Add unit tests for publisher.ts (19 tests)
- Add unit tests for github-service.ts (13 tests)

### Docs

- Document content transformations and hugo-coder theme optimization in README

## 1.1.1

### Bug Fixes

- Fix wikilink conversion, image paths, note embeds, and heading anchors

### Chores

- Update @biomejs/biome and @types/node
- Converge CI, build config, and repo structure to canonical pattern

## 1.1.0

### Features

- Add repository settings configuration
- Add branch + PR publishing workflow

### Bug Fixes

- Fix iOS compatibility: replace Node.js Buffer with cross-platform base64 encoding
- Strip leading/trailing slashes from directory settings
- Use parseYaml for frontmatter template to preserve YAML structure
- Clean up orphaned branch when PR creation fails
- Delete status field instead of setting to undefined
- Report failed image uploads to the user

### Refactoring

- Extract common publish logic, batch to single commit
- Change publish flag from publish:true to status:published

### Performance

- Optimize image lookup and base64 encoding

## 1.0.0

Initial release. Publish Obsidian notes to GitHub for Hugo processing.
