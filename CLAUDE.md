# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Publisher is a plugin that publishes Obsidian notes to GitHub for Hugo processing, using the GitHub REST API (via Octokit) for cross-platform compatibility including iOS.

## Development Commands

```bash
bun install          # Install dependencies
bun run dev          # Watch mode build with source maps
bun run build        # Production build (runs check first)
bun test             # Run all tests
bun run typecheck    # Type checking only (tsc --noEmit)
bun run lint         # Biome check (lint + format verify)
bun run lint:fix     # Biome check --write
bun run format       # Biome format --write
bun run check        # typecheck + biome check (run before committing)
bun run audit        # bun audit (critical vulnerabilities)
bun run deploy       # Copy main.js + manifest.json into local vault plugin folder
```

## Architecture

### Key Constraint

All GitHub operations must use the REST API through Octokit. Never use local Git commands or tools that require shell access — the plugin must work on iOS.

### Publishing Flow

1. **User triggers publish** — `main.ts` command handler
2. **Settings validation** — `publisher.ts` checks GitHub credentials
3. **Branch creation** — `github-service.ts` creates a feature branch
4. **Content processing** — `content-processor.ts` converts Obsidian syntax to Hugo markdown
5. **File upload** — `github-service.ts` uploads markdown and images via GitHub API
6. **PR creation** — `github-service.ts` creates pull request

### Component Responsibilities

- **`main.ts`** — Plugin entry point: registers commands, loads settings, routes to Publisher
- **`publisher.ts`** — Orchestration: `publishNote()` (single) and `publishAll()` (batch), both branch+PR, frontmatter validation
- **`github-service.ts`** — GitHub API wrapper using Octokit. All REST API calls must be iOS-compatible
- **`content-processor.ts`** — Wikilink/image conversion, filename sanitization, frontmatter processing
- **`settings.ts`** — Plugin settings UI with GitHub connection test
- **`types.ts`** — Type definitions: `PublisherSettings`, `PublishResult`, `BatchPublishResult`, `ProcessedContent`

### Publishing Workflow

Every publish (single note or batch) creates a timestamped branch (`publish/2026-01-08-143022`), commits changes, and opens a PR with configured labels against `baseBranch`. Batch publishing uses one branch and one PR for all files. Branch collision handled via `createBranchWithRetry()` with suffix.

### Content Transformations

- **Wikilinks:** `[[Page Name]]` to `[Page Name](page-name.md)` | `[[Page|Custom]]` to `[Custom](page-name.md)`
- **Images:** `![[image.png]]` to `![image.png](/images/image.png)`
- **Filename sanitization:** Lowercase, spaces to hyphens, remove special chars (keep alphanumeric/hyphens/underscores/dots), collapse consecutive hyphens, trim edges. Empty becomes `untitled`
- **Frontmatter:** Removes `status` field (if configured), merges template fields, ensures `date` field exists

### GitHub API Patterns

Add new methods to `github-service.ts` using Octokit. Follow the try-catch error handling pattern with descriptive Error objects. Use `this.settings.repoOwner` and `this.settings.repoName`. Add optional `branch` parameter for feature branch support. Status code `404` means file doesn't exist; `422` means branch already exists.

### Testing

Tests use Bun's built-in runner (`bun:test`) with `describe`/`test`/`expect` API. Test files live alongside source in `src/` with `.test.ts` suffix. Mocks are consolidated in `src/test-preload.ts`, loaded via `bunfig.toml`.

### Build

Single-file bundle via Bun: entry `src/main.ts` to output `main.js`. Externals: `obsidian`, `electron`. Bundled: `@octokit/rest`.

### Version and Release

`bun run version` (script: `version-bump.ts`) bumps the version, auto-syncs `manifest.json`/`versions.json`, commits, and tags. Tag push triggers GitHub Actions release (`.github/workflows/release.yml`).

## Code Style

Code style is enforced by Biome. Run `bun run check` before committing. Type imports come before value imports.
