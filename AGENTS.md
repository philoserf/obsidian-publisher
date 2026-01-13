# AGENTS.md

Guidance for working with code in this repository.

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

### Version Management

```bash
# Bump patch version (1.0.0 → 1.0.1)
bun version patch

# Bump minor version (1.0.0 → 1.1.0)
bun version minor

# Bump major version (1.0.0 → 2.0.0)
bun version major

# Set specific version
bun version 1.2.3
```

**What it does:**

- Updates `package.json` version
- Updates `manifest.json` version (via `version-bump.ts`)
- Updates `versions.json` with new version entry (via `version-bump.ts`)
- Automatically creates a git commit with message "v{version}"
- Automatically creates a git tag

**Note:** `bun version` automatically commits and tags changes. Use `bun version --no-git-tag-version` for manual control.

## Release Process

GitHub Actions automatically creates releases on tag push (`.github/workflows/release.yml`). Workflow runs `bun run build` and publishes `main.js`, `manifest.json`, `versions.json`.

**Standard workflow:**

```bash
bun version patch  # bumps version, commits, creates tag
git push origin <branch> --follow-tags  # triggers GitHub Actions
```

**For manual control:**

```bash
bun version --no-git-tag-version patch
git add .
git commit -m "chore: bump version to X.Y.Z"
git tag X.Y.Z
git push origin <branch> && git push origin --tags
```

**Version files (auto-synced by `version-bump.ts`):**

- `package.json` - Source of truth
- `manifest.json` - Obsidian plugin metadata
- `versions.json` - Maps versions to minimum Obsidian version (e.g., `{"1.0.0": "1.0.0"}`)

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

**`main.ts`:** Plugin entry point—registers commands, loads settings, routes to Publisher, handles settings migration.

**`publisher.ts`:** Orchestration layer—two workflows (`publishNote()` for direct commit, `publishNoteWithPR()` for branch+PR), batch publishing, frontmatter validation.

**`github-service.ts`:** GitHub API wrapper using Octokit. **Critical:** All REST API calls must be iOS-compatible (no shell access).

**`content-processor.ts`:** Wikilink/image conversions, filename sanitization, frontmatter processing.

**`settings.ts`:** Plugin settings UI with GitHub connection test.

**`types.ts`:** Type definitions for `PublisherSettings`, `PublishResult`, `BatchPublishResult`, `ProcessedContent`.

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

**Wikilinks:** `[[Page Name]]` → `[Page Name](page-name.md)` | `[[Page|Custom]]` → `[Custom](page-name.md)`

**Images:** `![[image.png]]` → `![image.png](/images/image.png)`

**Filename sanitization:** Lowercase, spaces→hyphens, remove special chars (keep alphanumeric/hyphens/underscores/dots), collapse consecutive hyphens, trim edges. Empty → "untitled". Example: `My Blog Post!@#.md` → `my-blog-post.md`

## Build System

**Bun Bundler:**
- Entry: `src/main.ts`
- Output: `main.js` (single file, minified ~120 KB)
- Dependencies bundled: `@octokit/rest` included

**Pre-build Validation:**
The `build` script enforces type checking, linting, and formatting before bundling. If any check fails, the build aborts.

## Code Style

**Enforced by Biome:**

- No inferrable type annotations on default parameters
- Type annotations required for uninitialized variables
- Import organization: type imports before value imports
- Consistent formatting (auto-fixed by `bun run format`)

## Testing

**Test Runner:** Bun's built-in test runner (`bun:test`)

**Current Tests:** `src/sanitizer.test.ts` (filename sanitization)

**Pattern:**
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

Use `new Notice("message")` for feedback, `console.log()` for debugging, `console.error()` for errors with stack traces.

## GitHub API Constraints

**Status Code Handling:**
- `404`: File doesn't exist (return null in `getFileSha()`)
- `422`: Branch already exists (retry with suffix in `createBranchWithRetry()`)

**Authentication:**
- Uses GitHub Personal Access Token (PAT) with `repo` scope
- Token configured in plugin settings
- Token required for all operations (no anonymous access)

**Rate Limits:**
- No explicit rate limit handling implemented
- Authenticated requests: 5,000 requests/hour
- Batch operations create multiple API calls (one per file)
