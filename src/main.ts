import { Notice, Plugin, type TFile } from "obsidian";
import { Publisher } from "./publisher";
import { PublisherSettingTab } from "./settings";
import {
  type BatchPublishResult,
  DEFAULT_SETTINGS,
  errorMessage,
  type PublisherSettings,
  type PublishResult,
  type PublishWarning,
} from "./types";

function notifyWarningKind(
  warnings: PublishWarning[],
  kind: PublishWarning["kind"],
  format: (names: string[]) => string,
): void {
  const filtered = warnings.filter((w) => w.kind === kind);
  if (filtered.length === 0) return;
  const names = [...new Set(filtered.map((w) => w.name))];
  new Notice(format(names));
}

function notifyWarnings(warnings: PublishWarning[]): void {
  notifyWarningKind(
    warnings,
    "image-failed",
    (names) => `Warning: ${names.length} image(s) failed: ${names.join(", ")}`,
  );
  notifyWarningKind(
    warnings,
    "image-collision",
    (names) =>
      `Warning: ${names.length} image basename(s) collide, skipped: ${names.join(", ")}`,
  );
}

export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;

  private get publisher(): Publisher {
    return new Publisher(this.app.vault, this.settings, (done, total) => {
      new Notice(`Prepared: ${done}/${total}`);
    });
  }

  async onload() {
    await this.loadSettings();

    // Register settings tab
    this.addSettingTab(new PublisherSettingTab(this.app, this));

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

  onunload() {}

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // Migration: for existing users, default to false to preserve current behavior
    if (data && data.usePullRequests === undefined) {
      this.settings.usePullRequests = false;
      await this.saveSettings();
    }
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
      let result: PublishResult;

      if (this.settings.usePullRequests) {
        result = await publisher.publishNoteWithPR(file);

        if (result.success && result.prUrl) {
          new Notice(`✓ Pull request created for ${file.basename}`);
          console.log(`Pull Request: ${result.prUrl}`);
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
      } else {
        result = await publisher.publishNote(file);

        if (result.success) {
          new Notice(`✓ Successfully published ${file.basename}`);
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
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
      const result: BatchPublishResult = this.settings.usePullRequests
        ? await publisher.publishAllWithPR()
        : await publisher.publishAll();

      if (result.total === 0) {
        new Notice("No publishable notes found");
        return;
      }

      if (result.error) {
        new Notice(`✗ Failed to publish: ${result.error}`);
      } else if (result.successful === 0) {
        new Notice(
          this.settings.usePullRequests
            ? "All files failed to process. No PR created."
            : "All files failed to process.",
        );
      } else {
        const summary = this.settings.usePullRequests
          ? `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed`
          : `Publishing complete: ${result.successful} succeeded, ${result.failed} failed out of ${result.total} total`;
        new Notice(summary);

        if (result.prUrl) {
          new Notice(`✓ Pull request created: ${result.prUrl}`);
          console.log(`Pull Request: ${result.prUrl}`);
        }
      }

      notifyWarnings(result.results.flatMap((r) => r.warnings));

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
