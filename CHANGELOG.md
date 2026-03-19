# Changelog

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
