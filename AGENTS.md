# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Obsidian Publisher is a plugin that publishes Obsidian notes to GitHub for
Hugo processing. It uses the GitHub REST API (via Octokit) to enable
cross-platform compatibility, including iOS Obsidian where local Git commands
are unavailable.

**Key constraint:** All GitHub operations must use the REST API through
Octokit. Never suggest using local Git commands or tools that require shell
access on iOS.

## Development Commands

### Building and Testing

```bash
# Development (watch mode with source maps)
bun run dev

# Production build (minified, ~120 KB)
bun run build

# Full validation (types, tests, lint, build)
bun run validate

# Run all tests
bun test

# Run specific test file
bun test src/sanitizer.test.ts

# Watch mode for tests
bun run test:watch

# Type checking only
bun run typecheck
```

### Code Quality

```bash
# Format code (auto-fix)
bun run format

# Lint code
bun run lint

# Check everything (format + lint)
bun run check
```

**Note:** This project uses Bun, not npm/yarn. Bun provides native TypeScript
execution, built-in test runner, and fast bundling. The `bun test` command
requires no configuration.

## Architecture

### Component Responsibilities

**`main.ts` (Plugin Entry Point)**
- Registers Obsidian commands and loads/saves settings

**`publisher.ts` (Orchestration Layer)**
- Two workflows: `publishNote()` (direct commit) and `publishNoteWithPR()` (branch + PR)
- Batch variants: `publishAll()` and `publishAllWithPR()`
- Validates `publish: true` flag in frontmatter

**`github-service.ts` (GitHub API Client)**
- All GitHub operations via Octokit REST API (required for iOS compatibility)
- Branch management: `createBranch()`, `getBranchSha()`, `createBranchWithRetry()`
- File operations: `createOrUpdateFile()`, `uploadImage()`, `getFileSha()`
- `createPullRequest()` with label support
- Pass optional `branch` parameter on file operations for feature branch workflow

**`content-processor.ts` (Content Transformation)**
- Converts wikilinks and image references
- Sanitizes filenames (lowercase, hyphens, URL-safe)
- Processes frontmatter (adds date, merges templates, removes `publish` flag)

**`settings.ts` (Configuration UI)**
- Obsidian PluginSettingTab with GitHub connection validation

**`types.ts` (Type Definitions)**
- `PublisherSettings`, `PublishResult`, `BatchPublishResult`, `ProcessedContent`

### Publishing Workflows

**Direct Commit (Legacy, `usePullRequests = false`):**

- Files committed directly to base branch
- No branch creation, no PRs
- Backward compatible with existing installations

**Branch + PR (Current, `usePullRequests = true`):**

- Creates timestamped branch: `publish/2026-01-08-143022`
- Commits all changes to branch (multiple commits for batch)
- Creates single PR with label (default: `published-from-obsidian`)
- Batch publishing: one branch, one PR for all files
- Branch collision handling via `createBranchWithRetry()` with suffix

### Settings Migration

New settings default differently for existing vs. new users:

- **Existing users:** `usePullRequests = false` (preserves old behavior)
- **New users:** `usePullRequests = true` (recommended workflow)

Migration logic in `main.ts:loadSettings()` checks for undefined
`usePullRequests` field.

## Content Transformations

### Wikilink Conversion

```text
[[Page Name]]           → [Page Name](page-name.md)
[[Page Name|Custom]]    → [Custom](page-name.md)
```

### Image Reference Conversion

```text
![[image.png]]          → ![image.png](/images/image.png)
```

### Filename Sanitization Rules

- Lowercase only
- Spaces → hyphens
- Special chars removed (keep alphanumeric, hyphens, underscores, dots)
- Consecutive hyphens collapsed
- Leading/trailing hyphens removed
- Empty result → "untitled"

Example: `My Blog Post!@#.md` → `my-blog-post.md`

## Build System

**Bun Bundler Configuration:**
- Entry: `src/main.ts` → `main.js` (single CommonJS file)
- Externals: `obsidian`, `electron` (provided by Obsidian runtime)
- Production: minified, Development: inline source maps

## Code Style

**Enforced by Biome:**

- No inferrable type annotations on default parameters
- Type annotations required for uninitialized variables
- Import organization: type imports before value imports
- Consistent formatting (auto-fixed by `bun run format`)

## Testing

**Test Runner:** Bun's built-in test runner (`bun:test`)

**Current Tests:**
- `src/sanitizer.test.ts`: Filename sanitization edge cases

## Common Patterns

### Adding New GitHub API Operations

1. Add method to `github-service.ts` using Octokit
2. Follow error handling pattern: `try-catch` with descriptive Error objects
3. Include JSDoc comments
4. Pass settings via `this.settings.repoOwner`, `this.settings.repoName`
5. Use optional `branch` parameter if operation should support feature
   branches

### Error Handling

All GitHub operations follow this pattern:

```typescript
try {
  const response = await this.octokit.rest.someApi.method({
    owner: this.settings.repoOwner,
    repo: this.settings.repoName,
    // ...params
  });
  return response.data;
} catch (error) {
  if (error instanceof Error) {
    throw new Error(`Descriptive message: ${error.message}`);
  }
  throw error;
}
```

### User Notifications

- Use `new Notice("message")` for user-visible feedback
- Use `console.log()` for debugging details
- Use `console.error()` for errors with full stack traces

### GitHub API Handling

**Status Codes:**
- `404`: File doesn't exist (return null in `getFileSha()`)
- `422`: Branch already exists (retry with suffix in `createBranchWithRetry()`)

**Authentication:**
- Uses GitHub Personal Access Token (PAT) with `repo` scope
- Token required for all operations (no anonymous access)

**Rate Limits:**
- Authenticated requests: 5,000 requests/hour
- Batch operations create multiple API calls (one per file)

## Version Information

- Plugin version tracked in both `package.json` and `manifest.json`
- Must match for Obsidian plugin validation
- Minimum Obsidian version: 1.0.0
- `isDesktopOnly: false` - explicitly supports mobile/iOS
