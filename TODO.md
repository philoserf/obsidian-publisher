# TODO — composite shape

A plugin that's 80% what we already have, with targeted additions where the specs genuinely improve the design.

## Commands

Two commands, as today. "Publish current note" for iteration; "Publish all" for batch. amp's framing matches intent; pi's single-command minimalism loses a real workflow.

## Settings — one coherent block

```text
github:        token, repoOwner, repoName
layout:        contentDir, imageDir, baseBranch
workflow:      usePullRequests, prLabels
transforms:    frontmatterTemplate        (add fields)
               strippedFrontmatterFields  (remove fields — spec default list)
               calloutShortcodeName       (default "callout")
               mermaidShortcodeName       (default "mermaid")
```

`removePublishFlag` retires — it's just `strippedFrontmatterFields` including `status`. Migration: old `true` → add `status` to the list; old `false` → leave it out.

## Publish flow

1. Scan → collect all `status: publish` notes (or the active one).
2. Build publish set.
3. **Slug collision precheck** — block with a named-conflict error. New, from both specs.
4. Transform each note.
5. Collect + dedupe images, keep the basename-collision _warning_ (our addition — specs don't have this, it's legitimately useful).
6. Commit atomically via Git Trees.
7. PR + labels, or direct commit. Report.

## Frontmatter

- Merge template fields (keep).
- Strip configured fields.
- `date` is **required**. Publish rejects notes without an explicit `date` rather than guessing. `date` is publish intent (may be future-dated); no fallback can infer that. Extends the existing frontmatter validator; per-note errors collected in batches (matches the #157 pattern). Drops the `new Date()` fallback in `content-processor.ts`.
- `lastmod` is default-stripped. Hugo's `:git` resolver (via the site repo's commit history) is the source of truth; a stale Obsidian-written `lastmod` would freeze the value and defeat that.
- Drop the "slug from title" idea unless we actually want it — filename-as-slug is simpler and the collision check guards it.

## Body transforms — order matters, keep the chain

- Comments `%%…%%`: unchanged.
- Highlights `==x==` → `<mark>`: keep.
- Callouts: emit `{{< callout type "title" >}}` with `type` passed through verbatim from Obsidian. Drop the 12→7 collapse — let CSS in `hugo-shortcodes/callout.css` decide what to render. Foldable `-`/`+` continues to be stripped; revisit if a user asks.
- Mermaid: configurable name, otherwise unchanged.
- Images: `![[img.png|alt]]` → `![alt](/path/img.png)`; `|300` discarded cleanly. Today alt is lost.
- Wikilinks: `[[Note]]` → `[Note](/posts/note/)`. If target isn't in the publish set, degrade to plain text (the `|Display` text if given, else the page name). Kills `{{< ref >}}` and its build-time coupling.
- Note embeds: same rule as wikilinks (not spec's `{{< ref >}}`).
- Math passthrough: unchanged.

## GitHub layer

Keep Octokit. iOS works. The spec's `requestUrl` mandate trades a working, tested integration for ~tens of KB and ideology. Keep `github-service.ts`'s surface small so a future swap stays cheap — which it already is.

## Shipped assets

Add `hugo-shortcodes/` with `callout.html`, `callout.css`, `mermaid.html`, `mermaid.js`. Users copy them into their theme. Both specs require this; neither is wrong to.

## Pipeline structure

Keep the class. `processFromSplit` already calls transforms in order — it _is_ the pipeline. The spec's "pure-function reduce in `src/pipeline/`" is an aesthetic refactor with no functional payoff. Skip.

## What we keep that neither spec has

- Single-note command.
- `usePullRequests` toggle + direct-commit path.
- `prLabels`.
- `frontmatterTemplate`.
- Image basename-collision warnings.
- Atomic commit + branch-collision retry logic.

## The gap to close, in one paragraph

Add three settings (`calloutShortcodeName`, `mermaidShortcodeName`, `strippedFrontmatterFields` — default-stripping `status` and `lastmod`), retire `removePublishFlag`, add slug-collision precheck, require explicit `date` on publish, change wikilink output to `/posts/slug/` with publish-set gating, pass callout types through unchanged, handle `|alt` in images, and ship `hugo-shortcodes/`. That's the whole thing.

Roughly: a few hours for settings + date + stripped fields; a day for wikilinks (semantics + tests); a day for the shortcode templates and their docs; an hour for slug collision. Everything else stays put.
