# hugo-shortcodes

Reference templates for the Hugo shortcodes emitted by [obsidian-publisher](../README.md). Copy these into your theme to render callouts and mermaid diagrams.

## Install

1. Copy `callout.html` to `layouts/shortcodes/callout.html` in your theme or site.
2. Copy `mermaid.html` to `layouts/shortcodes/mermaid.html`.
3. Copy `callout.css` to `assets/css/callout.css` (or wherever your theme bundles CSS) and wire it up from `baseof.html`:

   ```html
   {{ $css := resources.Get "css/callout.css" | resources.Minify }}
   <link rel="stylesheet" href="{{ $css.RelPermalink }}" />
   ```

4. Copy `mermaid.js` to `assets/js/mermaid.js` and load from `baseof.html`:

   ```html
   <script type="module" src="{{ (resources.Get "js/mermaid.js").RelPermalink }}"></script>
   ```

## Shortcode names

The plugin emits `{{< callout ... >}}` and `{{< mermaid >}}` by default. If you override `calloutShortcodeName` or `mermaidShortcodeName` in the plugin settings, rename these files to match (e.g., `callout.html` to `notice.html`).

## Callout types

The plugin passes each Obsidian callout type verbatim. `callout.css` ships styles for the common Obsidian types:

- `note`
- `abstract` / `summary` / `tldr`
- `info` / `todo`
- `tip` / `hint` / `important`
- `success` / `check` / `done`
- `question` / `help` / `faq`
- `warning` / `caution` / `attention`
- `failure` / `fail` / `missing`
- `danger` / `error`
- `bug`
- `example`
- `quote` / `cite`

Unknown types fall back to the `.callout` defaults (the `--callout-note-bg` / `--callout-note-accent` custom properties).

## Example

Obsidian source:

```markdown
> [!tip] Pro tip
> Use descriptive alt text on images.
```

After publish:

```html
<div class="callout callout-tip">
  <div class="callout-title">Pro tip</div>
  <div class="callout-body"><p>Use descriptive alt text on images.</p></div>
</div>
```
