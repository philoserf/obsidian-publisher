import { Notice, Plugin, type TFile } from "obsidian";
import { Publisher } from "./publisher";
import { PublisherSettingTab } from "./settings";
import {
  type BatchPublishResult,
  errorMessage,
  type PublisherSettings,
  type PublishWarning,
  parseSettings,
} from "./types";

type NamedImageWarning = Extract<PublishWarning, { name: string }>;

function notifyImageWarnings(
  warnings: PublishWarning[],
  kind: NamedImageWarning["kind"],
  format: (names: string[]) => string,
): void {
  const filtered = warnings.filter(
    (w): w is NamedImageWarning => w.kind === kind,
  );
  if (filtered.length === 0) return;
  const names = [...new Set(filtered.map((w) => w.name))];
  new Notice(format(names));
}

export function batchNoticeText(result: BatchPublishResult): string {
  if (result.error) return `✗ Failed to publish: ${result.error}`;
  if (result.total === 0) return "No publishable notes found";
  if (result.successful === 0) {
    return "All files failed to process. No PR created.";
  }
  return `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed`;
}

function notifyWarnings(warnings: PublishWarning[]): void {
  notifyImageWarnings(
    warnings,
    "image-failed",
    (names) => `Warning: ${names.length} image(s) failed: ${names.join(", ")}`,
  );
  notifyImageWarnings(
    warnings,
    "image-collision",
    (names) =>
      `Warning: ${names.length} image basename(s) collide, skipped: ${names.join(", ")}`,
  );
  const labelFailures = warnings.filter((w) => w.kind === "pr-label-failed");
  if (labelFailures.length > 0) {
    const all = [...new Set(labelFailures.flatMap((w) => w.labels))];
    new Notice(`Warning: failed to apply PR labels: ${all.join(", ")}`);
  }
}

export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;
  private settingTab?: PublisherSettingTab;

  // Constructs a fresh Publisher on each access; assign to a local once per command.
  // Reading `this.publisher` twice yields two distinct instances.
  private get publisher(): Publisher {
    return new Publisher(this.app.vault, this.settings, (done, total) => {
      new Notice(`Prepared: ${done}/${total}`);
    });
  }

  async onload() {
    await this.loadSettings();

    // Register settings tab
    this.settingTab = new PublisherSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    // Register commands
    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note to GitHub",
      editorCallback: async (_editor, view) => {
        const file = view.file;
        if (!file) {
          new Notice("No active file");
          return;
        }

        await this.publishCurrentNote(file);
      },
    });

    this.addCommand({
      id: "publish-all-notes",
      name: "Publish all notes to GitHub",
      callback: async () => {
        await this.publishAllNotes();
      },
    });
  }

  onunload() {
    this.settingTab?.save.cancel();
    void this.saveSettings();
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = parseSettings(data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Publish the current note
   */
  private async publishCurrentNote(file: TFile) {
    const publisher = this.publisher;
    const validationError = publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    new Notice(`Publishing ${file.basename}...`);

    try {
      const result = await publisher.publishNote(file);

      if (result.success && result.prUrl) {
        new Notice(`✓ Pull request created for ${file.basename}`);
        console.log(`Pull Request: ${result.prUrl}`);
      } else {
        new Notice(`✗ Failed to publish: ${result.error}`);
      }

      notifyWarnings(result.warnings);
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Error: ${message}`);
      console.error("Publish error:", error);
    }
  }

  /**
   * Publish all notes with status: publish
   */
  private async publishAllNotes() {
    const publisher = this.publisher;
    const validationError = publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    new Notice("Scanning vault for publishable notes...");

    try {
      const result: BatchPublishResult = await publisher.publishAll();

      new Notice(batchNoticeText(result));

      if (!result.error && result.successful > 0 && result.prUrl) {
        new Notice(`✓ Pull request created: ${result.prUrl}`);
        console.log(`Pull Request: ${result.prUrl}`);
      }

      notifyWarnings([
        ...result.results.flatMap((r) => r.warnings),
        ...(result.warnings ?? []),
      ]);

      if (result.failed > 0) {
        console.log("Failed publishes:");
        for (const r of result.results) {
          if (!r.success) {
            console.log(`  ${r.filePath}: ${r.error}`);
          }
        }
      }

      if (result.successful > 0) {
        console.log("Successful publishes:");
        for (const r of result.results) {
          if (r.success) {
            console.log(`  ${r.filePath}`);
          }
        }
      }
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Error: ${message}`);
      console.error("Batch publish error:", error);
    }
  }
}
