# Obsidian Publisher

Publish [Obsidian](https://obsidian.md/) notes to GitHub for Hugo processing.

## Security

This plugin requires a GitHub Personal Access Token (PAT) to publish content.

- **Use a fine-grained token** scoped to your target repository with `contents:write` permission (add `pull_requests:write` if using the PR workflow). Avoid classic tokens with broad `repo` scope.
- **Token storage:** The token is stored in Obsidian's plugin data file (`data.json`) as plaintext. This is an Obsidian platform constraint — there is no encrypted storage API. Anyone with file system access to your vault can read the token.
- **Recommendations:** Use a token scoped to a single repository. On shared devices, be aware that the token is accessible on disk.
