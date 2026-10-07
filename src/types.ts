/**
 * Plugin settings interface
 */
export interface PublisherSettings {
  /** ID of the GitHub token in Obsidian's secret storage (Settings →
   * Keychain) — never the token itself, which data.json would hold in
   * plaintext and Obsidian Sync would copy to every device (#352) */
  githubTokenSecret: string;
  /** Repository owner (username or organization) */
  repoOwner: string;
  /** Repository name */
  repoName: string;
  /** Content directory path in the Hugo repository (e.g., "content/posts") */
  contentDir: string;
  /** Image directory path in the Hugo repository (e.g., "static/images") */
  imageDir: string;
  /** Additional frontmatter fields to inject during publishing */
  frontmatterTemplate: Record<string, unknown>;
  /** Frontmatter field names to strip when publishing */
  strippedFrontmatterFields: string[];
  /** Base branch to create PRs against (default: "main") */
  baseBranch: string;
  /** Labels to apply to pull requests */
  prLabels: string[];
  /** Hugo shortcode name for Obsidian callouts (default: "callout") */
  calloutShortcodeName: string;
  /** Hugo shortcode name for mermaid diagrams (default: "mermaid") */
  mermaidShortcodeName: string;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: PublisherSettings = {
  githubTokenSecret: "",
  repoOwner: "",
  repoName: "",
  contentDir: "content/posts",
  imageDir: "static/images",
  frontmatterTemplate: {},
  // "aliases" is deliberately absent: Hugo reads it as the redirect list,
  // so stripping it would discard every redirect the publisher emits.
  strippedFrontmatterFields: [
    "status",
    "lastmod",
    "cssclass",
    "cssclasses",
    "position",
    "created",
    "modified",
  ],
  baseBranch: "main",
  prLabels: ["chore"],
  calloutShortcodeName: "callout",
  mermaidShortcodeName: "mermaid",
};

/**
 * Settings with the GitHub token resolved out of secret storage. Built in
 * one place, `ObsidianPublisher.publishConfig()`, at the moment it is
 * needed, and never persisted.
 */
export type PublishConfig = PublisherSettings & { githubToken: string };

/**
 * Processed content result
 */
export interface ProcessedContent {
  /** Processed markdown content */
  content: string;
  /** Sanitized filename */
  filename: string;
  /** List of image references found in the content */
  images: string[];
}

/**
 * Non-fatal condition noticed during publish. Tagged for test stability
 * and per-kind display in main.ts.
 */
export type PublishWarning =
  | { kind: "image-failed"; name: string }
  | { kind: "image-collision"; name: string; paths: string[] }
  | {
      kind: "image-target-collision";
      targetPath: string;
      sourceNames: string[];
    }
  | { kind: "pr-label-failed"; labels: string[]; error: string };

/**
 * Publishing result for a single note. A discriminated union so the
 * compiler enforces that failures carry an error and successes never do.
 * The `error?: undefined` / `prUrl?: undefined` members keep `.error` and
 * `.prUrl` readable on the union without narrowing.
 */
export type PublishResult = PublishSuccess | PublishFailure;

export interface PublishSuccess {
  /** Original file path */
  filePath: string;
  success: true;
  error?: undefined;
  /** Non-fatal conditions noticed during publish; always present, [] when none */
  warnings: PublishWarning[];
  /** URL to the pull request if created (single-file PR workflow only);
   * absent and undefined both mean no URL */
  prUrl?: string | undefined;
}

export interface PublishFailure {
  /** Original file path */
  filePath: string;
  success: false;
  /** Error message */
  error: string;
  /** Non-fatal conditions noticed during publish; always present, [] when none */
  warnings: PublishWarning[];
  prUrl?: undefined;
}

/**
 * Batch publishing summary
 */
export interface BatchPublishResult {
  /** Total number of notes attempted */
  total: number;
  /** Number of successful publishes */
  successful: number;
  /** Number of failed publishes */
  failed: number;
  /** Individual results */
  results: PublishResult[];
  /** URL to the pull request if created; absent and undefined both mean none */
  prUrl?: string | undefined;
  /** Batch-level failure (e.g. commitFiles or PR creation threw); absent and
   * undefined both mean none */
  error?: string | undefined;
  /** Batch-level non-fatal conditions (e.g. PR label apply failed); always present, [] when none */
  warnings: PublishWarning[];
}

/**
 * A capture group the pattern makes mandatory. TypeScript types every group as
 * possibly undefined, but a group outside any optional part always takes part
 * in a match — so a miss means the pattern was edited, and this fails loudly
 * rather than letting `undefined` flow on.
 */
export function captured(match: RegExpMatchArray, group: number): string {
  const value = match[group];
  if (value === undefined) {
    throw new Error(`capture group ${group} did not take part in the match`);
  }
  return value;
}

/**
 * Extract a human-readable message from an unknown catch value
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
