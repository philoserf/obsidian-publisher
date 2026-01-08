# Obsidian Publisher

Publish Obsidian notes to GitHub for Hugo processing. This plugin automatically
converts Obsidian-specific syntax (wikilinks, image references) to
Hugo-compatible markdown and uploads files via the GitHub API.

## Features

- Publish individual notes or batch publish all notes with `publish: true`
- Convert `[[wikilinks]]` to standard markdown links
- Convert `![[images]]` to Hugo-compatible image paths
- Sanitize filenames for Hugo URLs (lowercase, hyphens, URL-safe)
- Upload images to GitHub static directory
- Process and enhance frontmatter for Hugo
- Settings panel for configuration
- Test GitHub connection before publishing

## Installation

### From Source

1. Clone this repository into your vault's plugins folder:

   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/yourusername/obsidian-publisher.git
   cd obsidian-publisher
   ```

2. Install dependencies with bun:

   ```bash
   bun install
   ```

3. Build the plugin:

   ```bash
   bun run build
   ```

4. Enable the plugin in Obsidian Settings → Community Plugins

## Configuration

### GitHub Token

1. Go to [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Obsidian Publisher")
4. Select the `repo` scope (full control of private repositories)
5. Generate token and copy it
6. Paste it into the plugin settings

### Repository Settings

In the plugin settings, configure:

- **Repository Owner**: Your GitHub username or organization
- **Repository Name**: The name of your Hugo repository
- **Content Directory**: Path to Hugo content (e.g., `content/posts`)
- **Image Directory**: Path to Hugo static images (e.g., `static/images`)
- **Additional Frontmatter**: Optional YAML fields to add to all published notes
- **Remove 'publish' field**: Whether to remove `publish: true` from frontmatter

### Test Connection

Use the "Test GitHub Connection" button in settings to verify your credentials
and repository access.

## Usage

### Publishing a Single Note

1. Add `publish: true` to the note's frontmatter:

   ```yaml
   ---
   title: My Blog Post
   publish: true
   ---
   ```

2. Open the command palette (Cmd/Ctrl + P)
3. Run "Publish current note to GitHub"
4. Check the notification for success/failure

### Publishing All Notes

1. Ensure all notes you want to publish have `publish: true` in frontmatter
2. Open the command palette (Cmd/Ctrl + P)
3. Run "Publish all notes to GitHub"
4. View progress notifications and final summary

## Content Processing

### Wikilink Conversion

Obsidian wikilinks are converted to standard markdown:

- `[[Page Name]]` → `[Page Name](page-name.md)`
- `[[Page Name|Custom Text]]` → `[Custom Text](page-name.md)`

### Image Conversion

Obsidian image references are converted to Hugo paths:

- `![[image.png]]` → `![image.png](/images/image.png)`
- Images are uploaded to the configured static directory
- Filenames are sanitized (lowercase, hyphens)

### Filename Sanitization

Filenames are transformed for Hugo URLs:

- `My Blog Post.md` → `my-blog-post.md`
- `Special Chars!@#.md` → `special-chars.md`
- Spaces → hyphens
- Lowercase only
- Alphanumeric, hyphens, underscores, and dots only

### Frontmatter Processing

- Existing frontmatter is preserved
- Additional template fields are added (if not already present)
- `date` field is added if missing (current timestamp)
- `publish: true` is optionally removed based on settings

## Development

### Prerequisites

- [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- Node.js types for development

### Setup

```bash
# Install dependencies
bun install

# Development mode (watch mode with inline source maps)
bun run dev

# Production build (minified, optimized)
bun run build

# Development build (with inline source maps, no minification)
bun run build:dev

# Run tests (using bun's built-in test runner)
bun test

# Watch mode for tests
bun run test:watch

# Type check
bun run typecheck

# Lint and format
bun run check
bun run format

# Full validation (types, tests, linting, build)
bun run validate
```

### Build Optimization

The project uses bun's bundler with optimizations:

- **Production** (`bun run build`): Minified output (~114 KB)
- **Development** (`bun run dev`): Watch mode with inline source maps for debugging
- **Dev Build** (`bun run build:dev`): One-time build with source maps (~508 KB)

All builds:

- Bundle dependencies (@octokit/rest) into a single file
- Externalize Obsidian API and Electron (provided by Obsidian)
- Target Node.js runtime with CommonJS format
- Output to `main.js` (Obsidian plugin entry point)

### Testing with Bun

The project uses **bun's built-in test runner** (no jest/vitest needed!):

- **Fast**: Native TypeScript execution, no transpilation needed
- **Simple**: Familiar `describe`, `test`, `expect` API
- **Integrated**: Test coverage, watch mode, and filtering built-in

```bash
# Run all tests
bun test

# Watch mode (re-run on file changes)
bun run test:watch

# Run specific test file
bun test src/sanitizer.test.ts
```

### Bun Runtime Features Used

We leverage bun's runtime capabilities for development:

1. **Native TypeScript execution** - Run .ts files directly without compilation
2. **Built-in test runner** - Fast, zero-config testing with `bun:test`
3. **Shell scripting** - `scripts/validate-plugin.ts` uses bun's `$` for shell commands
4. **Fast bundling** - Sub-10ms builds with bun's bundler
5. **Package management** - Faster than npm/yarn with built-in lockfile

### Project Structure

```text
obsidian-publisher/
├── src/
│   ├── main.ts              # Plugin entry point
│   ├── settings.ts          # Settings UI and management
│   ├── github-service.ts    # GitHub API client
│   ├── content-processor.ts # Markdown conversion
│   ├── publisher.ts         # Publishing orchestration
│   └── types.ts             # TypeScript interfaces
├── manifest.json            # Obsidian plugin metadata
├── package.json             # Dependencies
├── tsconfig.json           # TypeScript config
└── biome.json              # Linter/formatter config
```

### Architecture

1. **Main Plugin** (`main.ts`) - Registers commands and initializes components
2. **Settings** (`settings.ts`) - UI for configuration and GitHub connection test
3. **Publisher** (`publisher.ts`) - Orchestrates publishing workflow
4. **Content Processor** (`content-processor.ts`) - Converts Obsidian syntax
5. **GitHub Service** (`github-service.ts`) - Wraps Octokit API client

### Building

The plugin uses bun's bundler to compile TypeScript to a single `main.js` file:

```bash
bun run build
```

Output is compatible with Obsidian's plugin system (CommonJS, Node target).

## Troubleshooting

### Plugin Won't Load

- Check the developer console (Cmd/Ctrl + Shift + I) for errors
- Ensure `main.js` exists in the plugin directory
- Verify Obsidian version is 1.0.0 or higher

### Publishing Fails

- Test your GitHub connection in settings
- Verify your token has `repo` scope
- Check repository owner/name are correct
- Ensure content/image directories exist in your Hugo repo

### Images Not Uploading

- Verify image files exist in your vault
- Check image directory path in settings
- Ensure images have supported extensions (.png, .jpg, etc.)

### Wikilinks Not Converting

- Check that links use double brackets: `[[link]]`
- Verify there are no syntax errors in your markdown
- Review the console for processing errors

## License

MIT

## Contributing

Contributions are welcome! Please follow these guidelines:

- Use bun for package management
- Follow the existing code style (biome formatting)
- Add tests for new features
- Update documentation as needed

## Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Review the developer console for errors
3. Open an issue on GitHub with details
