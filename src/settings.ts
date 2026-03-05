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
        "Create a token at github.com/settings/tokens with 'repo' scope. Token is stored securely.",
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
            this.plugin.settings.repoOwner = value.trim();
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
            this.plugin.settings.repoName = value.trim();
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
            this.plugin.settings.contentDir = value
              .trim()
              .replace(/^\/+|\/+$/g, "");
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
            this.plugin.settings.imageDir = value
              .trim()
              .replace(/^\/+|\/+$/g, "");
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
          .setPlaceholder("published-from-obsidian")
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
      .setDesc("Remove 'status: published' from frontmatter when publishing")
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
        .setPlaceholder(
          "author: Your Name\ncategories: [blog]\ntags: [obsidian]",
        )
        .setValue(
          this.serializeFrontmatter(this.plugin.settings.frontmatterTemplate),
        )
        .onChange(async (value) => {
          this.plugin.settings.frontmatterTemplate =
            this.parseFrontmatter(value);
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

  private serializeFrontmatter(template: Record<string, unknown>): string {
    if (Object.keys(template).length === 0) return "";
    try {
      return stringifyYaml(template).trim();
    } catch {
      return Object.entries(template)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    }
  }

  private parseFrontmatter(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    if (!trimmed) return {};
    try {
      const parsed = parseYaml(trimmed);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return this.parseSimpleFrontmatter(trimmed);
    }
  }

  private parseSimpleFrontmatter(text: string): Record<string, string> {
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

  private async testConnection(): Promise<void> {
    const settings = this.plugin.settings;

    // Validate settings
    if (!settings.githubToken) {
      new Notice("GitHub token is required");
      return;
    }

    if (!settings.repoOwner || !settings.repoName) {
      new Notice("Repository owner and name are required");
      return;
    }

    try {
      new Notice("Testing GitHub connection...");
      const github = new GitHubService(settings);
      await github.validateConnection();
      new Notice("✓ Connection successful! Repository is accessible.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`✗ Connection failed: ${message}`);
      console.error("GitHub connection test failed:", error);
    }
  }
}
