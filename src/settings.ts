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
import { errorMessage, type PublisherSettings } from "./types";

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

export function sanitizePath(value: string): string {
  return value
    .trim()
    .replace(/\.\./g, "")
    .replace(/~/g, "")
    .replace(/^\/+|\/+$/g, "");
}

export function sanitizeShortcodeName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

export function serializeFrontmatter(
  template: Record<string, unknown>,
): string {
  if (Object.keys(template).length === 0) return "";
  try {
    return stringifyYaml(template).trim();
  } catch {
    return Object.entries(template)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  }
}

export function parseStrippedFieldsInput(value: string): string[] {
  const required = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);
  return value
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && !required.has(f));
}

export function requiredFieldsIn(fields: string[]): string[] {
  const required = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);
  return [...new Set(fields.filter((f) => required.has(f)))];
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
    return parseKeyValueText(trimmed);
  }
}

function parseKeyValueText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const colonIndex = t.indexOf(":");
    if (colonIndex === -1) continue;
    const key = t.slice(0, colonIndex).trim();
    const value = t.slice(colonIndex + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

export function validateConnectionSettings(
  settings: PublisherSettings,
): string | null {
  if (!settings.githubToken) return "GitHub token is required";
  if (!settings.repoOwner || !settings.repoName) {
    return "Repository owner and name are required";
  }
  return null;
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
        settings.baseBranch = value.trim() || "main";
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Pull Request Labels",
      desc: "Comma-separated labels to add to pull requests",
      placeholder: "chore",
      getValue: () => settings.prLabels.join(", "),
      onChange: (value) => {
        settings.prLabels = value
          .split(",")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Callout Shortcode Name",
      desc: "Hugo shortcode name used for Obsidian callouts. Ship hugo-shortcodes/callout.html in your theme to match.",
      placeholder: "callout",
      getValue: () => settings.calloutShortcodeName,
      onChange: (value) => {
        settings.calloutShortcodeName =
          sanitizeShortcodeName(value) || "callout";
        save();
      },
    });

    this.addTextSetting(containerEl, {
      name: "Mermaid Shortcode Name",
      desc: "Hugo shortcode name used for mermaid code fences.",
      placeholder: "mermaid",
      getValue: () => settings.mermaidShortcodeName,
      onChange: (value) => {
        settings.mermaidShortcodeName =
          sanitizeShortcodeName(value) || "mermaid";
        save();
      },
    });

    containerEl.createEl("h3", { text: "Frontmatter Field Stripping" });
    containerEl.createEl("p", {
      text: "Comma-separated list of frontmatter fields to remove when publishing. Default: status, lastmod, cssclass, cssclasses, aliases, position, created, modified.",
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
          const raw = value
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f.length > 0);
          const blocked = requiredFieldsIn(raw);
          const newlyBlocked = blocked.filter((f) => !lastBlocked.has(f));
          settings.strippedFrontmatterFields = parseStrippedFieldsInput(value);
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
      text
        .setPlaceholder("author: Your Name\ntags: [obsidian]")
        .setValue(serializeFrontmatter(settings.frontmatterTemplate))
        .onChange((value) => {
          settings.frontmatterTemplate = parseFrontmatter(value);
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

    const validationError = validateConnectionSettings(settings);
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
