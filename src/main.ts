import { Notice, Plugin, type TFile } from "obsidian";
import { Publisher } from "./publisher";
import { PublisherSettingTab } from "./settings";
import {
  type BatchPublishResult,
  DEFAULT_SETTINGS,
  type PublisherSettings,
  type PublishResult,
} from "./types";

export default class ObsidianPublisher extends Plugin {
  settings!: PublisherSettings;

  private get publisher(): Publisher {
    return new Publisher(this.app.vault, this.settings);
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

    console.log("Obsidian Publisher plugin loaded");
  }

  onunload() {
    console.log("Obsidian Publisher plugin unloaded");
  }

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
    // Validate settings
    const validationError = this.publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    new Notice(`Publishing ${file.basename}...`);

    try {
      let result: PublishResult & { prUrl?: string };

      if (this.settings.usePullRequests) {
        // Use PR workflow
        result = await this.publisher.publishNoteWithPR(file);

        if (result.success && result.prUrl) {
          new Notice(`✓ Pull request created for ${file.basename}`);
          console.log(`Pull Request: ${result.prUrl}`);
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
      } else {
        // Fallback to direct commit workflow
        result = await this.publisher.publishNote(file);

        if (result.success) {
          new Notice(`✓ Successfully published ${file.basename}`);
          if (result.url) {
            console.log(`Published to: ${result.url}`);
          }
        } else {
          new Notice(`✗ Failed to publish: ${result.error}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`✗ Error: ${message}`);
      console.error("Publish error:", error);
    }
  }

  /**
   * Publish all notes with status: published
   */
  private async publishAllNotes() {
    // Validate settings
    const validationError = this.publisher.validateSettings();
    if (validationError) {
      new Notice(`Cannot publish: ${validationError}`);
      return;
    }

    try {
      let result: BatchPublishResult & { prUrl?: string };

      if (this.settings.usePullRequests) {
        // Use PR workflow
        result = await this.publisher.publishAllWithPR();

        if (result.total === 0) {
          new Notice("No publishable notes found");
          return;
        }

        const summary = `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed`;
        new Notice(summary);

        if (result.prUrl) {
          new Notice(`✓ Pull request created: ${result.prUrl}`);
          console.log(`Pull Request: ${result.prUrl}`);
        }
      } else {
        // Fallback to direct commit workflow
        result = await this.publisher.publishAll();

        if (result.total === 0) {
          new Notice("No publishable notes found");
          return;
        }

        const summary = `Publishing complete: ${result.successful} succeeded, ${result.failed} failed out of ${result.total} total`;
        new Notice(summary);
      }

      // Log failures
      if (result.failed > 0) {
        console.log("Failed publishes:");
        for (const r of result.results) {
          if (!r.success) {
            console.log(`  ${r.filePath}: ${r.error}`);
          }
        }
      }

      // Log successes
      if (result.successful > 0) {
        console.log("Successful publishes:");
        for (const r of result.results) {
          if (r.success) {
            console.log(`  ${r.filePath}: ${r.url || "no url"}`);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`✗ Error: ${message}`);
      console.error("Batch publish error:", error);
    }
  }
}
