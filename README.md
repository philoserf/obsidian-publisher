# Obsidian Publisher

Publish [Obsidian](https://obsidian.md/) notes to GitHub for [Hugo](https://gohugo.io/) processing. Tailored for [philoserf.com](https://philoserf.com).

## You probably shouldn't install this

This is personal tooling, not a general-purpose plugin. It is opinionated in ways that only make sense for one person's workflow:

- **Single user.** The only known installation is the maintainer's. Breaking changes ship without migration paths (see `CHANGELOG.md` — 1.4.0 renamed the publish sentinel, 1.5.0 retired `removePublishFlag` and the `{{< ref >}}` wikilinks, 1.6.0 retired the direct-commit publish mode entirely).
- **One target shape.** The Hugo destination is expected to use `content/posts/`, `static/images/`, and the shipped `hugo-shortcodes/` (callout + mermaid) installed in the site's theme. Other layouts will see broken links or missing renderers.
- **PR workflow only, mandatory.** Every publish creates a timestamped feature branch and opens a PR against `baseBranch`. There is no direct-commit escape hatch.
- **Required frontmatter.** Notes must carry `status: publish`, plus a non-empty `title` and `date`. Missing or empty required fields fail the publish per-note.
- **No issue triage for feature requests.** Bugs are welcome; feature requests from other users will almost always be closed as out-of-scope.

If you want something similar, the code is MIT-licensed — fork it and adapt. Don't expect upstream to accommodate your workflow.

## Content Transformations

The plugin converts Obsidian-specific syntax to Hugo-compatible markdown during publish:

| Obsidian                 | Hugo                                                 |
| ------------------------ | ---------------------------------------------------- |
| `[[Page Name]]`          | `[Page Name](/posts/page-name/)` (if in publish set) |
| `[[Page Name#Heading]]`  | `[Page Name#Heading](/posts/page-name/#heading)`     |
| `[[Page\|Display]]`      | `[Display](/posts/page-name/)`                       |
| `![[image.png]]`         | `![image.png](/images/image.png)`                    |
| `![[image.png\|alt]]`    | `![alt](/images/image.png)`                          |
| `![[image.png\|300]]`    | `![image.png](/images/image.png)` (sizing stripped)  |
| `![[Note Name]]` (embed) | `[Note Name](/posts/note-name/)` (if in publish set) |
| `%%comment%%`            | Removed                                              |
| `==highlight==`          | `<mark>highlight</mark>`                             |
| `> [!note] Title`        | `{{< callout note "Title" >}} … {{< /callout >}}`    |
| ` ```mermaid `           | `{{< mermaid >}} … {{< /mermaid >}}`                 |

Wikilinks and note embeds only resolve to URLs for notes in the **current publish set** (the notes being published in this operation). Out-of-set references degrade to plain text — so you can't publish a link to a note that isn't also being published.

Callout types pass through from Obsidian verbatim (no collapse to a fixed set). The destination Hugo site must define `callout` and `mermaid` shortcodes in `layouts/shortcodes/`. Reference implementations ship in `hugo-shortcodes/` — copy them into your theme. The shortcode names are configurable in the plugin settings (default `callout` and `mermaid`).

Heading anchors (`[[Page#Heading]]`) assume the destination Hugo site uses the default `autoIDType: "github"`, which preserves Unicode letters. Sites configured with the opt-in `autoIDType: "github-ascii"` will see mismatched `#fragment` links — pages load, but in-page jumps to non-ASCII headings won't resolve.

## Security

This plugin requires a GitHub Personal Access Token (PAT) to publish content.

- **Use a fine-grained token** scoped to your target repository with `contents:write` and `pull_requests:write` permissions. Avoid classic tokens with broad `repo` scope.
- **Token storage:** The token is stored in Obsidian's plugin data file (`data.json`) as plaintext. This is an Obsidian platform constraint — there is no encrypted storage API. Anyone with file system access to your vault can read the token.
- **Recommendations:** Use a token scoped to a single repository. On shared devices, be aware that the token is accessible on disk.
