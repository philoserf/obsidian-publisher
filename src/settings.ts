import {
  type App,
  debounce,
  Notice,
  PluginSettingTab,
  parseYaml,
  Setting,
  stringifyYaml,
} from "obsidian";
import { GitHubService } from "./github-service";
import type ObsidianPublisher from "./main";
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

export function parseFrontmatter(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const parsed = parseYaml(trimmed);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return parseSimpleFrontmatter(trimmed);
  }
}

function parseSimpleFrontmatter(text: string): Record<string, string> {
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
  private save: () => unknown;

  constructor(app: App, plugin: ObsidianPublisher) {
    super(app, plugin);
    this.plugin = plugin;
    this.save = debounce(() => this.plugin.saveSettings(), 500, true);
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

    new Setting(containerEl)
      .setName("Use Pull Requests")
      .setDesc(
        "Create pull requests instead of committing directly to the base branch",
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.usePullRequests).onChange((value) => {
          settings.usePullRequests = value;
          save();
        }),
      );

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

    new Setting(containerEl)
      .setName("Remove 'status' field")
      .setDesc("Remove 'status: publish' from frontmatter when publishing")
      .addToggle((toggle) =>
        toggle.setValue(settings.removePublishFlag).onChange((value) => {
          settings.removePublishFlag = value;
          save();
        }),
      );

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
      const github = new GitHubService(settings);
      await github.validateConnection();
      new Notice("✓ Connection successful! Repository is accessible.");
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Connection failed: ${message}`);
      console.error("GitHub connection test failed:", error);
    }
  }
}
