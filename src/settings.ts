import {
  type App,
  type Debouncer,
  debounce,
  Notice,
  PluginSettingTab,
  parseYaml,
  Setting,
  stringifyYaml,
} from "obsidian";
import { GitHubApiGateway } from "./github-api-gateway";
import type ObsidianPublisher from "./main";
import { REQUIRED_FRONTMATTER_FIELDS } from "./schema";
import {
  DEFAULT_SETTINGS,
  errorMessage,
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

export function parseStrippedFieldsInput(value: string): string[] {
  return filterRequiredFields(splitFieldsInput(value));
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
export function validateConnection(settings: PublisherSettings): string | null {
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
export function validatePublish(settings: PublisherSettings): string | null {
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
    githubToken: str(d.githubToken, DEFAULT_SETTINGS.githubToken),
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

export class PublisherSettingTab extends PluginSettingTab {
  plugin: ObsidianPublisher;
  readonly save: Debouncer<[], Promise<void>>;

  constructor(app: App, plugin: ObsidianPublisher) {
    super(app, plugin);
    this.plugin = plugin;
    this.save = debounce(() => this.plugin.saveSettings(), 500, true);
  }

  hide(): void {
    this.save.cancel();
    void this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const settings = this.plugin.settings;
    const save = this.save;

    containerEl.createEl("h2", { text: "Obsidian Publisher Settings" });

    this.addTextSetting(containerEl, {
      name: "GitHub Personal Access Token",
      desc: "Create a fine-grained token at github.com/settings/tokens with contents:write permission scoped to your target repo. Token is stored in plugin data (unencrypted).",
      placeholder: "ghp_xxxxxxxxxxxx",
      getValue: () => settings.githubToken,
      onChange: (value) => {
        settings.githubToken = value;
        save();
      },
      inputType: "password",
    });

    this.addTextSetting(containerEl, {
      name: "Repository Owner",
      desc: "GitHub username or organization name",
      placeholder: "username",
      getValue: () => settings.repoOwner,
      onChange: (value) => {
        settings.repoOwner = sanitizeGitHubOwner(value);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Repository Name",
      desc: "Name of the Hugo repository",
      placeholder: "my-blog",
      getValue: () => settings.repoName,
      onChange: (value) => {
        settings.repoName = sanitizeRepoName(value);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Content Directory",
      desc: "Path to Hugo content directory (e.g., 'content/posts')",
      placeholder: "content/posts",
      getValue: () => settings.contentDir,
      onChange: (value) => {
        settings.contentDir = sanitizePath(value);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Image Directory",
      desc: "Path to Hugo static images directory (e.g., 'static/images')",
      placeholder: "static/images",
      getValue: () => settings.imageDir,
      onChange: (value) => {
        settings.imageDir = sanitizePath(value);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Base Branch",
      desc: "Branch to create pull requests against (e.g., 'main', 'master')",
      placeholder: "main",
      getValue: () => settings.baseBranch,
      onChange: (value) => {
        settings.baseBranch = normalizeBaseBranch(value);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Pull Request Labels",
      desc: "Comma-separated labels to add to pull requests",
      placeholder: "chore",
      getValue: () => settings.prLabels.join(", "),
      onChange: (value) => {
        settings.prLabels = splitFieldsInput(value);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Callout Shortcode Name",
      desc: "Hugo shortcode name used for Obsidian callouts. Ship hugo-shortcodes/callout.html in your theme to match.",
      placeholder: "callout",
      getValue: () => settings.calloutShortcodeName,
      onChange: (value) => {
        settings.calloutShortcodeName = normalizeShortcodeName(
          value,
          DEFAULT_SETTINGS.calloutShortcodeName,
        );
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Mermaid Shortcode Name",
      desc: "Hugo shortcode name used for mermaid code fences.",
      placeholder: "mermaid",
      getValue: () => settings.mermaidShortcodeName,
      onChange: (value) => {
        settings.mermaidShortcodeName = normalizeShortcodeName(
          value,
          DEFAULT_SETTINGS.mermaidShortcodeName,
        );
        save();
      },
    });

    containerEl.createEl("h3", { text: "Frontmatter Field Stripping" });
    containerEl.createEl("p", {
      text: "Comma-separated list of frontmatter fields to remove when publishing. Default: status, lastmod, cssclass, cssclasses, position, created, modified. Note: aliases is not stripped — Hugo uses it to emit redirects from a note's previous titles.",
      cls: "setting-item-description",
    });

    new Setting(containerEl).addTextArea((text) => {
      // Track previously seen required fields so the Notice fires only when
      // a required field first appears in the input, not on every keystroke
      // that follows.
      let lastBlocked = new Set<string>(
        requiredFieldsIn(settings.strippedFrontmatterFields),
      );
      text
        .setPlaceholder("status, lastmod, cssclasses")
        .setValue(settings.strippedFrontmatterFields.join(", "))
        .onChange((value) => {
          const raw = splitFieldsInput(value);
          const blocked = requiredFieldsIn(raw);
          const newlyBlocked = blocked.filter((f) => !lastBlocked.has(f));
          settings.strippedFrontmatterFields = filterRequiredFields(raw);
          if (newlyBlocked.length > 0) {
            new Notice(
              `Cannot strip required frontmatter field${newlyBlocked.length > 1 ? "s" : ""}: ${newlyBlocked.join(", ")}. Required for publishing; ignored.`,
            );
          }
          lastBlocked = new Set(blocked);
          save();
        });
      text.inputEl.rows = 3;
      text.inputEl.cols = 50;
    });

    containerEl.createEl("h3", { text: "Additional Frontmatter" });
    containerEl.createEl("p", {
      text: "Add custom frontmatter fields (one per line, format: key: value)",
      cls: "setting-item-description",
    });

    new Setting(containerEl).addTextArea((text) => {
      // Non-empty input that yields no fields is silently discarded
      // otherwise: a line without a colon is valid YAML (a plain string),
      // so it never throws, it just isn't an object. Track the last state
      // so the Notice fires when the input first goes bad, not on every
      // keystroke after.
      let lastRejected = false;
      text
        .setPlaceholder("author: Your Name\ntags: [obsidian]")
        .setValue(serializeFrontmatter(settings.frontmatterTemplate))
        .onChange((value) => {
          const parsed = parseFrontmatter(value);
          const rejected =
            value.trim().length > 0 && Object.keys(parsed).length === 0;
          settings.frontmatterTemplate = parsed;
          if (rejected && !lastRejected) {
            new Notice(
              "Additional frontmatter must be 'key: value' lines; input ignored.",
            );
          }
          lastRejected = rejected;
          save();
        });
      text.inputEl.rows = 6;
      text.inputEl.cols = 50;
    });

    new Setting(containerEl)
      .setName("Test GitHub Connection")
      .setDesc("Verify that your GitHub credentials and repository are valid")
      .addButton((button) =>
        button.setButtonText("Test Connection").onClick(async () => {
          await this.testConnection();
        }),
      );
  }

  private addTextSetting(
    containerEl: HTMLElement,
    config: {
      name: string;
      desc: string;
      placeholder: string;
      getValue: () => string;
      onChange: (value: string) => void;
      inputType?: "text" | "password";
    },
  ): void {
    new Setting(containerEl)
      .setName(config.name)
      .setDesc(config.desc)
      .addText((text) => {
        text
          .setPlaceholder(config.placeholder)
          .setValue(config.getValue())
          .onChange(config.onChange);
        if (config.inputType === "password") {
          text.inputEl.setAttribute("type", "password");
        }
      });
  }

  private async testConnection(): Promise<void> {
    const settings = this.plugin.settings;

    const validationError = validateConnection(settings);
    if (validationError) {
      new Notice(validationError);
      return;
    }

    try {
      new Notice("Testing GitHub connection...");
      const github = new GitHubApiGateway(settings);
      await github.validateConnection();
      new Notice("✓ Connection successful! Repository is accessible.");
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Connection failed: ${message}`);
      console.error("GitHub connection test failed:", error);
    }
  }
}
