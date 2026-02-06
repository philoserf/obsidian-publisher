# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Project Overview

Obsidian Publisher is a plugin that publishes Obsidian notes to GitHub for Hugo processing. It uses the GitHub REST API (via Octokit) to enable cross-platform compatibility, including iOS Obsidian where local Git commands are unavailable.

**Key constraint:** All GitHub operations must use the REST API through Octokit. Never use local Git commands or tools that require shell access — the plugin must work on iOS.

## Development Commands

```bash
bun run dev          # Watch mode with source maps
bun run build        # Production build (runs typecheck + lint first)
bun run validate     # Full validation: types, tests, lint, build

bun test                          # Run all tests
bun test src/sanitizer.test.ts    # Run specific test file
bun run test:watch                # Watch mode for tests
bun run typecheck                 # Type checking only

bun run format       # Auto-fix formatting (Biome)
bun run lint         # Lint (Biome)
bun run check        # Format + lint
```

## Architecture

### Publishing Flow

1. **User triggers publish** → `main.ts` command handler
2. **Settings validation** → `publisher.ts` checks GitHub credentials
3. **Branch/PR creation** → `github-service.ts` creates feature branch (if PR workflow enabled)
4. **Content processing** → `content-processor.ts` converts Obsidian syntax to Hugo markdown
5. **File upload** → `github-service.ts` uploads markdown and images via GitHub API
6. **PR creation** → `github-service.ts` creates pull request (if PR workflow enabled)

### Component Responsibilities

- **`main.ts`** — Plugin entry point: registers commands, loads settings, routes to Publisher, handles settings migration
- **`publisher.ts`** — Orchestration: two workflows (`publishNote()` for direct commit, `publishNoteWithPR()` for branch+PR), batch publishing, frontmatter validation
- **`github-service.ts`** — GitHub API wrapper using Octokit. All REST API calls must be iOS-compatible
- **`content-processor.ts`** — Wikilink/image conversion, filename sanitization, frontmatter processing
- **`settings.ts`** — Plugin settings UI with GitHub connection test
- **`types.ts`** — Type definitions: `PublisherSettings`, `PublishResult`, `BatchPublishResult`, `ProcessedContent`

### Two Publishing Workflows

**Direct Commit (`usePullRequests = false`):** Files committed directly to base branch. Legacy mode for backward compatibility.

**Branch + PR (`usePullRequests = true`):** Creates timestamped branch (`publish/2026-01-08-143022`), commits changes, creates PR with labels. Batch publishing uses one branch and one PR for all files. Branch collision handled via `createBranchWithRetry()` with suffix.

### Settings Migration

Existing users default to `usePullRequests = false` (preserves old behavior). New users default to `usePullRequests = true`. Migration logic in `main.ts:loadSettings()` checks for undefined `usePullRequests` field.

## Content Transformations

- **Wikilinks:** `[[Page Name]]` → `[Page Name](page-name.md)` | `[[Page|Custom]]` → `[Custom](page-name.md)`
- **Images:** `![[image.png]]` → `![image.png](/images/image.png)`
- **Filename sanitization:** Lowercase, spaces→hyphens, remove special chars (keep alphanumeric/hyphens/underscores/dots), collapse consecutive hyphens, trim edges. Empty → `untitled`
- **Frontmatter:** Removes `publish` field (if configured), merges template fields, ensures `date` field exists

## Common Patterns

### GitHub API Operations

Add new methods to `github-service.ts` using Octokit. Follow the try-catch error handling pattern with descriptive Error objects. Use `this.settings.repoOwner` and `this.settings.repoName`. Add optional `branch` parameter for feature branch support.

```typescript
try {
  const response = await this.octokit.rest.someApi.method({
    owner: this.settings.repoOwner,
    repo: this.settings.repoName,
  });
  return response.data;
} catch (error) {
  if (error instanceof Error) {
    throw new Error(`Descriptive message: ${error.message}`);
  }
  throw error;
}
```

### Status Codes

- `404`: File doesn't exist (return null in `getFileSha()`)
- `422`: Branch already exists (retry with suffix in `createBranchWithRetry()`)

### User Notifications

Use `new Notice("message")` for user feedback, `console.error()` for errors with stack traces.

### Testing

Tests use Bun's built-in runner (`bun:test`) with `describe`/`test`/`expect` API. Test files live alongside source in `src/` with `.test.ts` suffix.

## Build

Single-file bundle via Bun: entry `src/main.ts` → output `main.js`. Externals: `obsidian`, `electron`. Bundled: `@octokit/rest`. Code style enforced by Biome (type imports before value imports).

## Version & Release

`bun version patch` bumps version, auto-syncs `manifest.json`/`versions.json`, commits, and tags. Tag push triggers GitHub Actions release (`.github/workflows/release.yml`).
