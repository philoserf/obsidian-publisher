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
  /** Whether to remove the status: published field from frontmatter */
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
 * Publishing result for a single note
 */
export interface PublishResult {
  /** Original file path */
  filePath: string;
  /** Whether the publish was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** URL to the published file on GitHub */
  url?: string;
  /** URL to the pull request if created */
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
}

/**
 * Extract a human-readable message from an unknown catch value
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
