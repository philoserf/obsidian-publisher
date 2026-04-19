# THEORY.md

This is the why-behind-the-what of obsidian-publisher. Architecture, design tensions, and the choices the code is making on purpose.

## The constraint that shapes everything

Obsidian plugins run on desktop and on iOS from the same codebase. No shell, no local git binary, no Node APIs outside Obsidian's surface. The plugin does everything through the GitHub REST API via Octokit (`src/github-service.ts`). Anything that would require a filesystem, a subprocess, or a platform-specific binary is off the table. This single constraint explains most of the design: the atomic commits via the Git Trees API, the base64 chunking for large binaries, the no-local-git workflow.

## Two pipelines, not one

The plugin has two distinct pipelines. First, a **content pipeline** (`src/content-processor.ts`): a sequence of pure-ish string transforms over one note's body. Second, a **publishing pipeline** (`src/publisher.ts`): orchestration over the vault — scanning, batch preparation, commit, PR creation, error recovery.

They're separated because they answer different questions. The content pipeline answers "what does this note become on Hugo's side?" The publishing pipeline answers "how does the set of notes reach GitHub?" Keeping them distinct lets each evolve independently. It also lets the content processor stay testable in isolation — it takes strings and settings, returns strings.

## Order of body transforms

`ContentProcessor.processFromSplit` runs transforms in a fixed order: strip comments, convert highlights, convert callouts, convert mermaid, convert images, convert note embeds, convert wikilinks. The order is load-bearing.

Comments strip first so commented-out markup never reaches later regexes. Images run before note embeds because both use `![[...]]` syntax and the note-embed converter must not eat image references. Wikilinks run last so that `[[...]]` patterns inside callouts or images aren't re-processed (they're already consumed).

This is the "pipeline structure" the composite spec's alternative design proposed refactoring into pure functions in `src/pipeline/`. That refactor was skipped — the ordered sequence _is_ the pipeline. A more abstract structure would add indirection without changing behavior.

## Publish-set gating

Wikilinks and note embeds only resolve to URLs for notes the user is _actively_ publishing in the current operation. Everything else degrades to plain text. This was a deliberate choice over "ship refs and trust the site to resolve them."

The old `{{< ref >}}` approach coupled the plugin's output to Hugo's build-time ref resolver. A link to a note that wasn't published produced a build-time error on Hugo's side. That error lived far from the author, who couldn't fix it without re-opening the Obsidian note and re-publishing. The degrade-to-plain-text model keeps the error-surface local: the link the author sees in Obsidian reflects the site visitor's experience.

`Publisher.buildPublishSet` computes the set from the current operation's file list, routing each `file.basename` through `sanitizeSlug`. Single-file publish (`publishFileToTarget`) seeds the set with just the current file's own slug, so self-links still resolve.

## Shortcodes over inline HTML

Callouts and mermaid diagrams emit Hugo shortcodes (`{{< callout type "title" >}}`, `{{< mermaid >}}`) rather than rendering HTML inline. Two reasons.

First, themes control rendering. A plain-text publisher that emits `<div class="callout-note">` commits the site to a specific HTML shape. Shortcodes let the theme author decide the shape. `hugo-shortcodes/callout.html` and `hugo-shortcodes/mermaid.html` are shipped as reference templates, not prescription — sites can replace them entirely.

Second, callout types pass through verbatim. The plugin doesn't know what types the site will style; it shouldn't pre-collapse 20+ Obsidian callout types into 7 canonical ones. Styling is a CSS concern (`hugo-shortcodes/callout.css` ships coverage for the common types; unknown types fall back to `.callout` defaults).

## Frontmatter policy

Three rules govern frontmatter handling.

**Required fields are validation-gated.** `title` and `date` must be present and well-formed (`schema.ts:5`). Validation runs before the content pipeline. A note missing either gets a per-file failed result with an error message; the batch continues for valid notes.

**The strip list is configurable.** `strippedFrontmatterFields` defaults to the Obsidian-specific fields users typically don't want on their published site (`cssclasses`, `aliases`, `position`, etc.) plus `status` (the publish-intent sentinel) and `lastmod`. `lastmod` is default-stripped because Hugo's `:git` resolver (via the site repo's commit history) is authoritative — a stale Obsidian-written `lastmod` would freeze the value.

**The template merges without overriding.** `frontmatterTemplate` adds fields the site needs (draft status, author, section, whatever) without clobbering values the note already has. If the note's frontmatter has `author: Someone Else`, that wins over the template's default.

## Two publish flows, one codebase

Direct commit (`usePullRequests = false`) writes straight to `baseBranch`. Branch + PR (`usePullRequests = true`) creates a timestamped branch, commits, opens a PR with configured labels. Both paths remain supported because they answer different workflow needs: direct commit is fast iteration for a personal site; PR flow is review gating for shared or CI-verified sites.

Collapsing the two into one would cost one of those. A single "always PR" flow burns review cycles on notes the author is just iterating on. A single "always direct" flow skips the review gate on sites that need it. The plugin lets the user decide.

## Error surfaces

The plugin's error-surface stance: silent failure is the bug class to avoid. Notes that fail to read surface as per-file failed results, not as console warnings. Filename collisions abort publish with a named-conflict error listing every offending path, not a mystery overwrite. PR label apply failures surface as warnings alongside the successful PR, not as a caught-and-swallowed exception that orphans the PR branch.

Mobile users can't see `console.log` or `console.error`. The `Notice` API is their only feedback channel. Batch-level errors that would otherwise live only in the console are summarized into `BatchPublishResult.error` so `main.ts` can surface them in a Notice.

## Slug collision precheck

Before transforming or committing a batch, `detectFilenameCollisions` walks the publishable set and checks that every `sanitizeFilename` output is unique. Multiple collision groups are reported in one error. No GitHub API activity runs when a collision is detected.

The precheck synthesizes a failed `PublishResult` per publishable file (not just per read failure). Without this, a batch consisting entirely of colliders would have `total === 0` and trigger `main.ts`'s "No publishable notes found" short-circuit, silently swallowing the collision error.

## Out of scope deliberately

Some things the plugin doesn't do, on purpose.

**Slug from title.** The filename is the slug (via `sanitizeFilename`). Letting title override would introduce ambiguity — Obsidian users typically rename the note file, not some internal slug field. The collision precheck guards the filename-is-slug rule.

**Build-time ref resolution.** Emitting `{{< ref >}}` couples the plugin to Hugo's build pipeline. The publish-set gating model emits plain URLs, accepting the trade that dead links are the author's responsibility to fix by republishing.

**Theme design polish.** The shipped `hugo-shortcodes/` CSS covers the common callout types with reasonable defaults, but it's reference-grade, not theme-grade. Sites are expected to override.

**A new pipeline abstraction.** The composite spec's alternative design proposed a pure-function pipeline in `src/pipeline/`. The existing `ContentProcessor.processFromSplit` is that pipeline — just as a method calling private methods. An abstract version would add a module boundary without changing the shape of the transforms.

## The constraint, again

Every design choice above routes through the iOS constraint. The composite-spec alternative design proposed replacing Octokit with `requestUrl` (Obsidian's native HTTP helper) to drop a ~tens-of-KB dependency. The plugin kept Octokit: the working integration was a tested foundation that the alternative didn't materially improve. Keeping `GitHubService.ts` surface-small ensures a future swap stays cheap — but the plugin doesn't take on the swap as cargo-cult ideology.
