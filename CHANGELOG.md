# Changelog

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
