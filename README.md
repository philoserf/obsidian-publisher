# Obsidian Publisher

Publish [Obsidian](https://obsidian.md/) notes to GitHub for [Hugo](https://gohugo.io/) processing. Tailored for [hugo-coder](https://github.com/luizdepra/hugo-coder) as used by [philoserf.com](https://philoserf.com).

## Content Transformations

The plugin converts Obsidian-specific syntax to Hugo-compatible markdown during publish:

| Obsidian                 | Hugo                                                |
| ------------------------ | --------------------------------------------------- |
| `[[Page Name]]`          | `[Page Name]({{< ref "page-name" >}})`              |
| `![[image.png]]`         | `![image.png](/images/image.png)`                   |
| `![[image.png\|300]]`    | `![image.png](/images/image.png)` (sizing stripped) |
| `![[Note Name]]` (embed) | `[Note Name]({{< ref "note-name" >}})`              |
| `%%comment%%`            | Removed                                             |
| `==highlight==`          | `<mark>highlight</mark>`                            |
| `> [!note] Title`        | `{{< notice note "Title" >}}` (hugo-coder)          |
| ` ```mermaid `           | `{{< mermaid >}}` (hugo-coder)                      |

Callout types are mapped from Obsidian's ~20 types to hugo-coder's 7 notice types (`note`, `tip`, `info`, `question`, `warning`, `error`, `example`).

## Security

This plugin requires a GitHub Personal Access Token (PAT) to publish content.

- **Use a fine-grained token** scoped to your target repository with `contents:write` permission (add `pull_requests:write` if using the PR workflow). Avoid classic tokens with broad `repo` scope.
- **Token storage:** The token is stored in Obsidian's plugin data file (`data.json`) as plaintext. This is an Obsidian platform constraint — there is no encrypted storage API. Anyone with file system access to your vault can read the token.
- **Recommendations:** Use a token scoped to a single repository. On shared devices, be aware that the token is accessible on disk.
