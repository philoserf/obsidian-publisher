# CLAUDE.md

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

### Core Publishing Flow

1. **User triggers publish** → `main.ts` command handler
2. **Settings validation** → `publisher.ts` checks GitHub credentials
3. **Branch/PR creation** → `github-service.ts` creates feature branch (if
   PR workflow enabled)
4. **Content processing** → `content-processor.ts` converts Obsidian syntax
5. **File upload** → `github-service.ts` uploads markdown and images via
   GitHub API
6. **PR creation** → `github-service.ts` creates pull request (if PR
   workflow enabled)

### Component Responsibilities

**`main.ts` (Plugin Entry Point)**

- Registers Obsidian commands
- Loads/saves settings
- Routes commands to Publisher
- Implements settings migration for backward compatibility

**`publisher.ts` (Orchestration Layer)**

- Two workflows: `publishNote()` (direct commit) and `publishNoteWithPR()`
  (branch + PR)
- Batch publishing: `publishAll()` and `publishAllWithPR()`
- Validates frontmatter for `publish: true` flag
- Orchestrates content processing and GitHub uploads
- Error handling and user notifications

**`github-service.ts` (GitHub API Client)**

- Wraps Octokit for all GitHub operations
- Branch management: `createBranch()`, `getBranchSha()`,
  `createBranchWithRetry()`
- Pull request creation: `createPullRequest()` with label support
- File operations: `createOrUpdateFile()`, `uploadImage()`, `getFileSha()`
- Branch parameter on all file operations to support feature branch workflow
- **Critical:** All API calls use REST endpoints compatible with iOS

**`content-processor.ts` (Content Transformation)**

- Converts `[[wikilinks]]` → `[text](slug.md)`
- Converts `![[images]]` → `![alt](/images/filename)`
- Sanitizes filenames (lowercase, hyphens, URL-safe)
- Processes frontmatter (adds date, merges templates, removes publish flag)
- Uses Obsidian's `parseYaml`/`stringifyYaml` for frontmatter

**`settings.ts` (Configuration UI)**

- Obsidian PluginSettingTab implementation
- GitHub connection test using `validateConnection()`
- Settings include PR workflow toggles (new in v1.0)

**`types.ts` (Type Definitions)**

- `PublisherSettings`: All configuration including new PR settings
- `PublishResult`: Single file publish result with optional `prUrl`
- `BatchPublishResult`: Batch operation summary with optional `prUrl`
- `ProcessedContent`: Transformed markdown content and metadata

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

- Entry: `src/main.ts`
- Output: `main.js` (single file)
- Target: Node.js, CommonJS format
- Externals: `obsidian`, `electron` (provided by Obsidian runtime)
- Dependencies bundled: `@octokit/rest` included in output
- Production: minified (~120 KB)
- Development: inline source maps (~508 KB)

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

**Testing Pattern:**

```typescript
import { describe, test, expect } from "bun:test";

describe("Component", () => {
  test("should do something", () => {
    expect(result).toBe(expected);
  });
});
```

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

## GitHub API Constraints

**Status Code Handling:**

- `404`: File doesn't exist (return null in `getFileSha()`)
- `422`: Branch already exists (retry with suffix in
  `createBranchWithRetry()`)

**Authentication:**

- Uses GitHub Personal Access Token (PAT) with `repo` scope
- Token configured in plugin settings
- Token required for all operations (no anonymous access)

**Rate Limits:**

- No explicit rate limit handling implemented
- Authenticated requests: 5,000 requests/hour
- Batch operations create multiple API calls (one per file)

## Version Information

- Plugin version tracked in both `package.json` and `manifest.json`
- Must match for Obsidian plugin validation
- Minimum Obsidian version: 1.0.0
- `isDesktopOnly: false` - explicitly supports mobile/iOS
