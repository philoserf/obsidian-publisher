import {
  type App,
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

  constructor(app: App, plugin: ObsidianPublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Publisher Settings" });

    // GitHub Token
    new Setting(containerEl)
      .setName("GitHub Personal Access Token")
      .setDesc(
        "Create a fine-grained token at github.com/settings/tokens with contents:write permission scoped to your target repo. Token is stored in plugin data (unencrypted).",
      )
      .addText((text) =>
        text
          .setPlaceholder("ghp_xxxxxxxxxxxx")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          })
          .inputEl.setAttribute("type", "password"),
      );

    // Repository Owner
    new Setting(containerEl)
      .setName("Repository Owner")
      .setDesc("GitHub username or organization name")
      .addText((text) =>
        text
          .setPlaceholder("username")
          .setValue(this.plugin.settings.repoOwner)
          .onChange(async (value) => {
            this.plugin.settings.repoOwner = sanitizeGitHubOwner(value);
            await this.plugin.saveSettings();
          }),
      );

    // Repository Name
    new Setting(containerEl)
      .setName("Repository Name")
      .setDesc("Name of the Hugo repository")
      .addText((text) =>
        text
          .setPlaceholder("my-blog")
          .setValue(this.plugin.settings.repoName)
          .onChange(async (value) => {
            this.plugin.settings.repoName = sanitizeRepoName(value);
            await this.plugin.saveSettings();
          }),
      );

    // Content Directory
    new Setting(containerEl)
      .setName("Content Directory")
      .setDesc("Path to Hugo content directory (e.g., 'content/posts')")
      .addText((text) =>
        text
          .setPlaceholder("content/posts")
          .setValue(this.plugin.settings.contentDir)
          .onChange(async (value) => {
            this.plugin.settings.contentDir = sanitizePath(value);
            await this.plugin.saveSettings();
          }),
      );

    // Image Directory
    new Setting(containerEl)
      .setName("Image Directory")
      .setDesc("Path to Hugo static images directory (e.g., 'static/images')")
      .addText((text) =>
        text
          .setPlaceholder("static/images")
          .setValue(this.plugin.settings.imageDir)
          .onChange(async (value) => {
            this.plugin.settings.imageDir = sanitizePath(value);
            await this.plugin.saveSettings();
          }),
      );

    // Use Pull Requests
    new Setting(containerEl)
      .setName("Use Pull Requests")
      .setDesc(
        "Create pull requests instead of committing directly to the base branch",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.usePullRequests)
          .onChange(async (value) => {
            this.plugin.settings.usePullRequests = value;
            await this.plugin.saveSettings();
          }),
      );

    // Base Branch
    new Setting(containerEl)
      .setName("Base Branch")
      .setDesc(
        "Branch to create pull requests against (e.g., 'main', 'master')",
      )
      .addText((text) =>
        text
          .setPlaceholder("main")
          .setValue(this.plugin.settings.baseBranch)
          .onChange(async (value) => {
            this.plugin.settings.baseBranch = value.trim() || "main";
            await this.plugin.saveSettings();
          }),
      );

    // Pull Request Labels
    new Setting(containerEl)
      .setName("Pull Request Labels")
      .setDesc("Comma-separated labels to add to pull requests")
      .addText((text) =>
        text
          .setPlaceholder("chore")
          .setValue(this.plugin.settings.prLabels.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.prLabels = value
              .split(",")
              .map((l) => l.trim())
              .filter((l) => l.length > 0);
            await this.plugin.saveSettings();
          }),
      );

    // Remove Publish Flag
    new Setting(containerEl)
      .setName("Remove 'status' field")
      .setDesc("Remove 'status: publish' from frontmatter when publishing")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.removePublishFlag)
          .onChange(async (value) => {
            this.plugin.settings.removePublishFlag = value;
            await this.plugin.saveSettings();
          }),
      );

    // Frontmatter Template
    containerEl.createEl("h3", { text: "Additional Frontmatter" });
    containerEl.createEl("p", {
      text: "Add custom frontmatter fields (one per line, format: key: value)",
      cls: "setting-item-description",
    });

    new Setting(containerEl).addTextArea((text) => {
      text
        .setPlaceholder("author: Your Name\ntags: [obsidian]")
        .setValue(
          serializeFrontmatter(this.plugin.settings.frontmatterTemplate),
        )
        .onChange(async (value) => {
          this.plugin.settings.frontmatterTemplate = parseFrontmatter(value);
          await this.plugin.saveSettings();
        });
      text.inputEl.rows = 6;
      text.inputEl.cols = 50;
    });

    // Test Connection Button
    new Setting(containerEl)
      .setName("Test GitHub Connection")
      .setDesc("Verify that your GitHub credentials and repository are valid")
      .addButton((button) =>
        button.setButtonText("Test Connection").onClick(async () => {
          await this.testConnection();
        }),
      );
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
