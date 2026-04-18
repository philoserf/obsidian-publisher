/**
 * Plugin settings interface
 */
export interface PublisherSettings {
  /** GitHub personal access token */
  githubToken: string;
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
  /** Whether to remove the status: publish field from frontmatter */
  removePublishFlag: boolean;
  /** Base branch to create PRs against (default: "main") */
  baseBranch: string;
  /** Labels to apply to pull requests */
  prLabels: string[];
  /** Whether to use branch/PR workflow (vs direct commit) */
  usePullRequests: boolean;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: PublisherSettings = {
  githubToken: "",
  repoOwner: "",
  repoName: "",
  contentDir: "content/posts",
  imageDir: "static/images",
  frontmatterTemplate: {},
  removePublishFlag: false,
  baseBranch: "main",
  prLabels: ["chore"],
  usePullRequests: true,
};

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
  /** Processed frontmatter */
  frontmatter: Record<string, unknown>;
}

/**
 * Non-fatal condition noticed during publish. Tagged for test stability
 * and per-kind display in main.ts.
 */
export type PublishWarning =
  | { kind: "image-failed"; name: string }
  | { kind: "image-collision"; name: string; paths: string[] }
  | { kind: "pr-label-failed"; labels: string[]; error: string };

/**
 * Publishing result for a single note
 */
export interface PublishResult {
  /** Original file path */
  filePath: string;
  /** Whether the publish was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Non-fatal conditions noticed during publish; always present, [] when none */
  warnings: PublishWarning[];
  /** URL to the pull request if created (single-file PR workflow only) */
  prUrl?: string;
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
  /** URL to the pull request if created */
  prUrl?: string;
  /** Batch-level failure (e.g. commitFiles or PR creation threw) */
  error?: string;
  /** Batch-level non-fatal conditions (e.g. PR label apply failed) */
  warnings?: PublishWarning[];
}

/**
 * Extract a human-readable message from an unknown catch value
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Validate persisted plugin data against the PublisherSettings shape.
 * Per-field fallback to DEFAULT_SETTINGS on type mismatch — a single
 * corrupted field shouldn't wipe the user's configuration.
 */
export function parseSettings(data: unknown): PublisherSettings {
  const d = isPlainObject(data) ? data : {};
  return {
    githubToken:
      typeof d.githubToken === "string"
        ? d.githubToken
        : DEFAULT_SETTINGS.githubToken,
    repoOwner:
      typeof d.repoOwner === "string"
        ? d.repoOwner
        : DEFAULT_SETTINGS.repoOwner,
    repoName:
      typeof d.repoName === "string" ? d.repoName : DEFAULT_SETTINGS.repoName,
    contentDir:
      typeof d.contentDir === "string"
        ? d.contentDir
        : DEFAULT_SETTINGS.contentDir,
    imageDir:
      typeof d.imageDir === "string" ? d.imageDir : DEFAULT_SETTINGS.imageDir,
    frontmatterTemplate: isPlainObject(d.frontmatterTemplate)
      ? d.frontmatterTemplate
      : DEFAULT_SETTINGS.frontmatterTemplate,
    removePublishFlag:
      typeof d.removePublishFlag === "boolean"
        ? d.removePublishFlag
        : DEFAULT_SETTINGS.removePublishFlag,
    baseBranch:
      typeof d.baseBranch === "string"
        ? d.baseBranch
        : DEFAULT_SETTINGS.baseBranch,
    prLabels: isStringArray(d.prLabels)
      ? d.prLabels
      : DEFAULT_SETTINGS.prLabels,
    usePullRequests:
      typeof d.usePullRequests === "boolean"
        ? d.usePullRequests
        : DEFAULT_SETTINGS.usePullRequests,
  };
}
