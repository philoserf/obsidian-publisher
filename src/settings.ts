import {
  type App,
  Notice,
  PluginSettingTab,
  parseYaml,
  SecretComponent,
  type SettingDefinitionItem,
  stringifyYaml,
} from "obsidian";
import { GitHubApiGateway } from "./github-api-gateway";
import type ObsidianPublisher from "./main";
import { REQUIRED_FRONTMATTER_FIELDS } from "./schema";
import {
  DEFAULT_SETTINGS,
  errorMessage,
  type PublishConfig,
  type PublisherSettings,
} from "./types";

/** The fields a note must carry; stripping one would make every note
 * fail validation. Hoisted so the three consumers cannot drift. */
const REQUIRED_SET = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);

export function sanitizeGitHubOwner(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 39);
}

export function sanitizeRepoName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_.]/g, "")
    .slice(0, 100);
}

/**
 * Validate a directory prefix, rather than sanitizing one by subtraction.
 *
 * The previous version removed `..`, then `~`, then edge slashes — and a
 * sanitizer that removes characters can *synthesize* the value it was
 * written to remove. `.~./posts` became `../posts`: stripping `..` left
 * `.~./`, and stripping `~` closed the gap. `..././` became `./.` and
 * `a/....//b` left an empty segment no later step removed (#313).
 *
 * No ordering of removals fixes that, so nothing is removed. A path is
 * either acceptable as written or rejected whole, and rejection returns
 * `""`, which routes into `validatePublish` and fails the publish with
 * "Content directory is required" — loud, rather than
 * silently publishing somewhere odd.
 *
 * Deliberately *not* an allowlist of permitted characters: a space and a
 * non-ASCII letter are both legitimate in a Hugo content directory, and
 * narrowing what a path may contain is a separate decision from fixing
 * the reconstruction bug. Only the two markers that mean "leave this
 * directory" are rejected. `~` is kept from the original; its threat
 * model here is unclear — there is no shell, and GitHub's tree API does
 * not expand it — but relaxing it is its own call.
 */
export function sanitizePath(value: string): string {
  const segments = value
    .trim()
    .split("/")
    .filter((segment) => segment.length > 0);
  const hazardous = segments.some(
    (segment) => segment === "." || segment === ".." || segment.includes("~"),
  );
  return hazardous ? "" : segments.join("/");
}

/**
 * A shortcode name is accepted as typed or replaced by the default.
 *
 * It used to be repaired on the way in (`my callout!` became `mycallout`)
 * and rejected on the way out, so the same input meant two different
 * things depending on which layer saw it. Rejection is the one to keep:
 * a silently rewritten shortcode name points at a Hugo template that does
 * not exist, which fails at build time rather than here (#314).
 */
export function normalizeShortcodeName(
  value: string,
  fallback: string,
): string {
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : fallback;
}

export function serializeFrontmatter(
  template: Record<string, unknown>,
): string {
  if (Object.keys(template).length === 0) return "";
  return stringifyYaml(template).trim();
}

/** Split a comma-separated list once; the caller derives both the kept
 * fields and the blocked ones from the same split rather than re-splitting. */
export function splitFieldsInput(value: string): string[] {
  return value
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

export function filterRequiredFields(fields: string[]): string[] {
  return fields.filter((f) => !REQUIRED_SET.has(f));
}

export function requiredFieldsIn(fields: string[]): string[] {
  return [...new Set(fields.filter((f) => REQUIRED_SET.has(f)))];
}

export function parseFrontmatter(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const parsed = parseYaml(trimmed);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    // Broken YAML behaves like non-object YAML: empty result, which the
    // settings control notices and reports. Recovering it by splitting on
    // the first colon per line was the one path that could put a value the
    // user did not write into a commit — `author: [unclosed` became
    // `{ author: "[unclosed" }`, non-empty, so no Notice fired (#319).
    return {};
  }
}

/**
 * Is this configuration enough to reach GitHub?
 *
 * Deliberately narrower than `validatePublish`: a connection test does not
 * need a content directory, and requiring one would block the button whose
 * whole job is telling the user their token works.
 */
export function validateConnection(settings: PublishConfig): string | null {
  if (!settings.githubToken) return "GitHub token is required";
  if (!settings.repoOwner || !settings.repoName) {
    return "Repository owner and name are required";
  }
  return null;
}

/**
 * Is this configuration enough to publish?
 *
 * Derived from `validateConnection` rather than restating its two checks —
 * the field sets differ on purpose, but "a usable configuration needs a
 * token and an owner/name pair" is one piece of knowledge and used to be
 * stated twice, in two modules, in two vocabularies that the user met in
 * the same settings session (#318).
 *
 * One vocabulary now: "… is required". A field added to `PublisherSettings`
 * that publishing needs goes here, and there is no second place to forget.
 */
export function validatePublish(settings: PublishConfig): string | null {
  const connection = validateConnection(settings);
  if (connection) return connection;
  if (!settings.contentDir) return "Content directory is required";
  if (!settings.imageDir) return "Image directory is required";
  return null;
}

/** A branch name is trimmed and must be non-empty: unlike PR labels, you
 * cannot publish without one. */
export function normalizeBaseBranch(value: string): string {
  return value.trim() || DEFAULT_SETTINGS.baseBranch;
}

/**
 * Labels are trimmed and emptied of blanks. An empty result is kept, not
 * replaced: publishing with no labels is a thing a user may want, and
 * replacing `[]` with the default meant clearing the field never stuck
 * across a reload (#314). Only a value that is not a string array at all
 * falls back.
 */
export function normalizePrLabels(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    return [...DEFAULT_SETTINGS.prLabels];
  }
  return value.map((l) => l.trim()).filter((l) => l.length > 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One normalizer per field, applied on load as well as on input.
 *
 * Two questions, and each field needs both answered. **Absent or the
 * wrong type** falls back to the default — a single corrupted field must
 * not wipe the rest of a configuration. **Present but unnormalized**
 * runs the same function the settings control runs, so the value a
 * reload produces is the value the control would have stored.
 *
 * Previously the load path answered only the first question and the
 * control only the second, which meant all nine fields could disagree
 * about what a bad value is. A persisted `../escape` survived untouched;
 * `  main  ` kept its spaces; `[]` labels came back as the default. This
 * is the one place to add a field, and adding it here is what keeps the
 * two sides from drifting again.
 */
export function parseSettings(data: unknown): PublisherSettings {
  const d = isPlainObject(data) ? data : {};
  const str = (value: unknown, fallback: string) =>
    typeof value === "string" ? value : fallback;

  return {
    // Only the secret's ID. A plaintext `githubToken` from before #352 is
    // never carried into the result; `legacyGithubToken` reads it once so
    // loadSettings can move it into secret storage.
    githubTokenSecret: str(
      d.githubTokenSecret,
      DEFAULT_SETTINGS.githubTokenSecret,
    ),
    repoOwner:
      typeof d.repoOwner === "string"
        ? sanitizeGitHubOwner(d.repoOwner)
        : DEFAULT_SETTINGS.repoOwner,
    repoName:
      typeof d.repoName === "string"
        ? sanitizeRepoName(d.repoName)
        : DEFAULT_SETTINGS.repoName,
    contentDir:
      typeof d.contentDir === "string"
        ? sanitizePath(d.contentDir)
        : DEFAULT_SETTINGS.contentDir,
    imageDir:
      typeof d.imageDir === "string"
        ? sanitizePath(d.imageDir)
        : DEFAULT_SETTINGS.imageDir,
    frontmatterTemplate: isPlainObject(d.frontmatterTemplate)
      ? d.frontmatterTemplate
      : { ...DEFAULT_SETTINGS.frontmatterTemplate },
    strippedFrontmatterFields: filterRequiredFields(
      Array.isArray(d.strippedFrontmatterFields) &&
        d.strippedFrontmatterFields.every((v) => typeof v === "string")
        ? (d.strippedFrontmatterFields as string[])
        : DEFAULT_SETTINGS.strippedFrontmatterFields,
    ),
    baseBranch: normalizeBaseBranch(
      str(d.baseBranch, DEFAULT_SETTINGS.baseBranch),
    ),
    prLabels: normalizePrLabels(d.prLabels),
    calloutShortcodeName: normalizeShortcodeName(
      str(d.calloutShortcodeName, ""),
      DEFAULT_SETTINGS.calloutShortcodeName,
    ),
    mermaidShortcodeName: normalizeShortcodeName(
      str(d.mermaidShortcodeName, ""),
      DEFAULT_SETTINGS.mermaidShortcodeName,
    ),
  };
}

/** The plaintext token a pre-#352 data.json carried, or "" when there is none. */
export function legacyGithubToken(data: unknown): string {
  return isPlainObject(data) && typeof data.githubToken === "string"
    ? data.githubToken
    : "";
}

export class PublisherSettingTab extends PluginSettingTab {
  plugin: ObsidianPublisher;

  constructor(app: App, plugin: ObsidianPublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** Three fields are not strings but are edited as text. */
  override getControlValue(key: string): unknown {
    const settings = this.plugin.settings;
    switch (key) {
      case "prLabels":
        return settings.prLabels.join(", ");
      case "strippedFrontmatterFields":
        return settings.strippedFrontmatterFields.join(", ");
      case "frontmatterTemplate":
        return serializeFrontmatter(settings.frontmatterTemplate);
      default:
        return settings[key as keyof PublisherSettings];
    }
  }

  /**
   * Every control writes through `parseSettings`, the path a reload takes,
   * so the value a control stores is the value a reload would produce and
   * the field's one normalizer is the only one. The default implementation
   * would store the raw input.
   */
  override async setControlValue(key: string, value: unknown): Promise<void> {
    const text = typeof value === "string" ? value : "";
    let decoded: unknown = value;
    if (key === "prLabels" || key === "strippedFrontmatterFields") {
      decoded = splitFieldsInput(text);
    } else if (key === "frontmatterTemplate") {
      decoded = parseFrontmatter(text);
    }
    this.plugin.settings = parseSettings({
      ...this.plugin.settings,
      [key]: decoded,
    });
    await this.plugin.saveSettings();
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    // `validate` rejects an edit inline and stores nothing; parseSettings
    // still normalizes on load, since validate never repairs stored data.
    const path = (value: string) =>
      value.trim() && !sanitizePath(value)
        ? "A path cannot contain '.' or '..' segments, or '~'."
        : undefined;
    const shortcode = (value: string) =>
      value.trim() && !normalizeShortcodeName(value, "")
        ? "Letters, digits, '_' and '-' only."
        : undefined;

    return [
      {
        type: "group",
        heading: "GitHub",
        items: [
          {
            name: "GitHub token",
            desc: "A fine-grained token scoped to the site repository, with contents:write and pull_requests:write — every publish opens a pull request, so contents:write alone commits and then fails. Kept in Obsidian's keychain on this device; only its name is saved with the plugin's settings, so each device that publishes needs it chosen once.",
            // No declarative secret control exists, so this row is drawn by
            // hand and saves by hand.
            render: (setting) => {
              new SecretComponent(this.app, setting.controlEl)
                .setValue(this.plugin.settings.githubTokenSecret)
                .onChange(async (id) => {
                  this.plugin.settings.githubTokenSecret = id;
                  await this.plugin.saveSettings();
                });
            },
          },
          {
            name: "Repository owner",
            desc: "GitHub username or organization name.",
            control: {
              type: "text",
              key: "repoOwner",
              placeholder: "username",
            },
          },
          {
            name: "Repository name",
            desc: "Name of the Hugo repository.",
            control: { type: "text", key: "repoName", placeholder: "my-blog" },
          },
          {
            name: "Base branch",
            desc: "Branch to open pull requests against.",
            control: { type: "text", key: "baseBranch", placeholder: "main" },
          },
          {
            name: "Pull request labels",
            desc: "Comma-separated labels to add to pull requests.",
            control: { type: "text", key: "prLabels", placeholder: "chore" },
          },
          {
            name: "Test connection",
            desc: "Check that the token can reach the repository.",
            action: () => void this.testConnection(),
          },
        ],
      },
      {
        type: "group",
        heading: "Hugo",
        items: [
          {
            name: "Content directory",
            desc: "Path to the Hugo content directory.",
            control: {
              type: "text",
              key: "contentDir",
              placeholder: "content/posts",
              validate: path,
            },
          },
          {
            name: "Image directory",
            desc: "Path to the Hugo static images directory.",
            control: {
              type: "text",
              key: "imageDir",
              placeholder: "static/images",
              validate: path,
            },
          },
          {
            name: "Callout shortcode name",
            desc: "Hugo shortcode used for Obsidian callouts. Ship hugo-shortcodes/callout.html in your theme to match.",
            control: {
              type: "text",
              key: "calloutShortcodeName",
              placeholder: "callout",
              validate: shortcode,
            },
          },
          {
            name: "Mermaid shortcode name",
            desc: "Hugo shortcode used for mermaid code fences.",
            control: {
              type: "text",
              key: "mermaidShortcodeName",
              placeholder: "mermaid",
              validate: shortcode,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "Frontmatter",
        items: [
          {
            name: "Fields to strip",
            desc: "Comma-separated frontmatter fields removed when publishing. aliases is not stripped: Hugo uses it to emit redirects from a note's previous titles.",
            control: {
              type: "textarea",
              key: "strippedFrontmatterFields",
              placeholder: "status, lastmod, cssclasses",
              validate: (value) => {
                const blocked = requiredFieldsIn(splitFieldsInput(value));
                return blocked.length > 0
                  ? `Cannot strip ${blocked.join(", ")}: publishing requires ${blocked.length > 1 ? "them" : "it"}.`
                  : undefined;
              },
            },
          },
          {
            name: "Additional frontmatter",
            desc: "Fields added to every published note, as YAML 'key: value' lines.",
            control: {
              type: "textarea",
              key: "frontmatterTemplate",
              placeholder: "author: Your Name\ntags: [obsidian]",
              validate: (value) =>
                value.trim() &&
                Object.keys(parseFrontmatter(value)).length === 0
                  ? "Must be YAML 'key: value' lines."
                  : undefined,
            },
          },
        ],
      },
    ];
  }

  private async testConnection(): Promise<void> {
    const config = this.plugin.publishConfig();

    const validationError = validateConnection(config);
    if (validationError) {
      new Notice(validationError);
      return;
    }

    try {
      new Notice("Testing GitHub connection...");
      const github = new GitHubApiGateway(config);
      await github.validateConnection();
      new Notice("✓ Connection successful! Repository is accessible.");
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Connection failed: ${message}`);
      console.error("GitHub connection test failed:", error);
    }
  }
}
