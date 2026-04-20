# Changelog

## [Unreleased]

### Breaking Changes

- **Direct-commit publish mode retired.** The `usePullRequests` setting is gone; every publish now creates a branch and opens a PR against `baseBranch`. Any user configured with `usePullRequests = false` (the pre-1.4.1 default for existing users) will see PR workflow at upgrade. The GitHub token now unconditionally requires `pull_requests:write` in addition to `contents:write`. The `"Use Pull Requests"` toggle has been removed from the settings UI (#198).

### Fixed

- Dead-code cleanup: removed an unreachable `new Date()` fallback in `ContentProcessor.processFrontmatter`. No user-visible behavior change — `validateFrontmatter` has been rejecting notes with missing `date` upstream in every publish path since 1.4.0. The 1.4.0 entry below announced this removal; the actual deletion was missed at the time. This reconciles the CHANGELOG with the code (#167).
- `strippedFrontmatterFields` can no longer include required frontmatter fields (`title`, `date`). Required fields are filtered at both persistence boundaries (`parseSettings` on load, `parseStrippedFieldsInput` on UI save), and the settings UI surfaces a Notice when a required field is typed into the list. This prevents a misconfiguration where stripping `date` or `title` would produce invalid Hugo frontmatter — previously masked by the `new Date()` fallback, and now surfaced since that fallback is gone (#190).
- `imageUrlPath` edge-slash normalization. Applied the same boundary-regex pattern that hardened `postsUrlPath` in 1.5.0. `imageDir` values with leading/trailing slashes (`/static/images/`), or directories that merely start with `static` (`static-assets`, `staticfiles/img`), now produce correct image URLs instead of `/-assets/...` or `/files/img/...`. Common defaults (`static/images`, `assets/img`) are unchanged (#192).
- Batch publish errors no longer silently masked by the "No publishable notes found" notice. When a batch aborts at the batch level (setting `BatchPublishResult.error` without populating `results[]`), the error text now surfaces to the user instead of being hidden by the empty-results short-circuit in `main.ts`. Factored the notice classification into a pure `batchNoticeText` helper for direct unit test coverage (#193).
- Heading anchor slugs now preserve non-ASCII letters (`é`, `ñ`, `日本語`, Cyrillic, etc.) to match Hugo's default `autoIDType: "github"`. The previous `[^\w\s-]` punctuation strip treated every non-ASCII character as punctuation and dropped it, producing broken anchors. The new regex uses Unicode property escapes (`\p{L}`, `\p{N}`) with the `u` flag, and NFC-normalizes first so decomposed diacritics (e.g. `é` as `e + U+0301`) survive. Sites configured with `autoIDType: "github-ascii"` will see mismatched anchors — opt-in setting, not the default (#195).

### Changed

- Publisher: single-note and batch publishes now share one `runPublishWorkflow` orchestrator for branch creation, commit, PR creation, and cleanup. Internal refactor; no user-visible behavior change (branch prefix, commit message, PR title/body preserved per mode). Deletes the `publishFileToTarget`, `createBatchPR`, and `recoverFailedBatch` helpers; net −100 lines in `publisher.ts` (#153).

## 1.5.0

### Breaking Changes

- **Callout shortcode default renamed** from `notice` to `callout`. Site repos need `hugo-shortcodes/callout.html` (shipped in this release) or override `calloutShortcodeName` setting to `notice` to preserve old behavior (#164, #168).
- **Callout types pass through verbatim.** The 12→7 collapse map is gone; per-type styling now lives in the shipped `callout.css`, not in code. Themes relying on the old 7 buckets (`note`, `info`, `tip`, `question`, `warning`, `error`, `example`) should adopt the shipped CSS or continue to receive unstyled callouts (#168).
- **Wikilinks emit plain `/posts/slug/` URLs** instead of `{{< ref >}}` shortcodes. Links to notes not in the current publish set degrade to plain text (using display/alias if given). Sites no longer need build-time ref resolution (#169).
- **`removePublishFlag` setting retired.** Replaced by `strippedFrontmatterFields: string[]` with a broader default list. Migration: old `true` → default list (includes `status`); old `false` → default list minus `status` (#165).

### Added

- `strippedFrontmatterFields` setting (#165). Default: `status`, `lastmod`, `cssclass`, `cssclasses`, `aliases`, `position`, `created`, `modified`. Configurable via the settings UI.
- `calloutShortcodeName` setting, default `callout` (#164). Validated against `[a-zA-Z0-9_-]` at persistence and input.
- `mermaidShortcodeName` setting, default `mermaid` (#164). Same validation.
- Image embed alt text preserved: `![[img.png|alt text]]` now emits `![alt text](/path/img.png)`. Bare sizes (`|300`, `|300x200`) still discarded cleanly; alt-then-size form (`|alt|300`) keeps alt. Whitespace in size suffixes trimmed; empty alt falls back to filename (#170).
- Filename collision precheck. Before transforming, if multiple notes sanitize to the same filename, publish aborts with a multi-line error listing every offending group and path. Both direct-commit and PR batch paths guarded; zero GitHub API activity when collision detected. Synthesized per-file failed results ensure the error surfaces to the user instead of being swallowed by main.ts's "No publishable notes found" guard (#166).
- `hugo-shortcodes/` directory shipped with reference templates: `callout.html`, `callout.css`, `mermaid.html`, `mermaid.js`, and install README (#171). Mermaid CDN pinned to 10.9.1 for reproducibility; mermaid inner content HTML-escaped; callout title supports title-less callouts.
- Callout title escaping. Titles containing `"` or `\` no longer produce broken Hugo output — pre-existing latent bug fix.
- Fresh `THEORY.md` documenting the architecture post-composite alignment.

### Changed

- Wikilink resolution requires the target to be in the current publish set. Out-of-set links degrade instead of producing broken refs.
- `ContentProcessor.process` / `processFromSplit` accept an optional `publishSet: Set<string>`; defaults to empty. Single-file publish seeds the set with the file's own slug so self-links resolve.
- `ContentProcessor.sanitizeSlug` is now public (needed by `Publisher` to build the publish set).
- `postsUrlPath` derives the URL prefix from `contentDir`, normalizing edge slashes and using a boundary regex to preserve directories starting with `content` but not equal to or prefixed by `content/`.
- Heading anchor slugification strips punctuation, collapses hyphens, and trims edges to match Hugo goldmark's default anchor generation.

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
