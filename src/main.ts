import { Notice, Plugin, type TFile } from "obsidian";
import { formatBatchNotice, formatWarnings } from "./notices";
import { Publisher } from "./publisher";
import { PublisherSettingTab } from "./settings";
import { parseSettings } from "./settings-parse";
import {
  type BatchPublishResult,
  errorMessage,
  type PublisherSettings,
  type PublishWarning,
} from "./types";

/** A GitHub PR URL takes longer than the default ~5s to read on a phone. */
const PR_NOTICE_DURATION_MS = 10_000;

function notifyWarnings(warnings: PublishWarning[]): void {
  for (const message of formatWarnings(warnings)) {
    new Notice(message);
  }
}

export default class ObsidianPublisher extends Plugin {
  declare settings: PublisherSettings;
  private settingTab?: PublisherSettingTab;
  private publisher!: Publisher;

  /** The batch progress notice, held so it can be updated in place rather
   * than stacking one toast per file. Cleared by endProgress(). */
  private progress?: Notice;

  /** The publish currently running, if any. One flag covers both commands:
   * publishing the current note while a batch is committing has the same
   * duplicate-branch outcome as two batches. */
  private inFlight?: Promise<void>;

  /**
   * Run a publish, or refuse if one is already running.
   *
   * Obsidian invokes a command again while the previous invocation's
   * promise is still pending — a second hotkey press, or a tap on a mobile
   * toolbar button that did not appear to respond because the network is
   * slow. Each invocation used to run the full workflow, producing two
   * branches and two identical pull requests, both of which had to be
   * cleaned up by hand since the gateway has no delete path. Re-tapping is
   * the natural response to a slow cellular publish, which is exactly the
   * case this plugin exists for (#307).
   *
   * The guard belongs here rather than on `Publisher`, which stays a pure
   * orchestrator the tests can drive concurrently. It also protects
   * `this.progress`, a single field that two live batches would otherwise
   * interleave counts into.
   */
  private async runExclusive(work: () => Promise<void>): Promise<void> {
    if (this.inFlight) {
      new Notice("A publish is already running");
      return;
    }
    // Cleared in a finally so a thrown publish cannot wedge the plugin
    // until reload.
    const task = work().finally(() => {
      this.inFlight = undefined;
    });
    this.inFlight = task;
    await task;
  }

  private createPublisher(): Publisher {
    const onProgress = (done: number, total: number) => {
      const message = `Prepared: ${done}/${total}`;
      // Duration 0 keeps it up until we dismiss it; a per-file toast would
      // otherwise bury the summary, the PR URL and every warning.
      if (this.progress) this.progress.setMessage(message);
      else this.progress = new Notice(message, 0);
    };

    return new Publisher(
      this.app.vault,
      this.settings,
      onProgress,
      this.app.metadataCache,
    );
  }

  /** Dismiss the progress notice. Called from a finally, not from the
   * progress tick: if preparation throws part-way the tick never reaches
   * done === total, and a duration-0 notice would stay up forever. */
  private endProgress(): void {
    this.progress?.hide();
    this.progress = undefined;
  }

  async onload() {
    await this.loadSettings();
    this.publisher = this.createPublisher();

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

        await this.runExclusive(() => this.publishCurrentNote(file));
      },
    });

    this.addCommand({
      id: "publish-all-notes",
      name: "Publish all notes to GitHub",
      callback: async () => {
        await this.runExclusive(() => this.publishAllNotes());
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
    // Publisher captures settings (and its GitHub client's token) at
    // construction; rebuild so changes take effect without a reload.
    this.publisher = this.createPublisher();
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

      if (result.success) {
        // The URL has to be in the notice: iOS has no console, and iOS is
        // why this plugin uses the REST API instead of git. Longer duration
        // because a GitHub URL takes a moment to read on a phone.
        new Notice(
          result.prUrl
            ? `✓ Pull request created: ${result.prUrl}`
            : `✓ Pull request created for ${file.basename}`,
          PR_NOTICE_DURATION_MS,
        );
        if (result.prUrl) console.log(`Pull Request: ${result.prUrl}`);
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

    let result: BatchPublishResult;
    try {
      result = await publisher.publishAll();
    } catch (error) {
      const message = errorMessage(error);
      new Notice(`✗ Error: ${message}`);
      console.error("Batch publish error:", error);
      return;
    } finally {
      // Runs whether publishAll resolved or threw, so a failure part-way
      // through preparation cannot strand the duration-0 progress notice.
      this.endProgress();
    }

    try {
      new Notice(formatBatchNotice(result));

      if (!result.error && result.successful > 0 && result.prUrl) {
        new Notice(
          `✓ Pull request created: ${result.prUrl}`,
          PR_NOTICE_DURATION_MS,
        );
        console.log(`Pull Request: ${result.prUrl}`);
      }

      notifyWarnings([
        ...result.results.flatMap((r) => r.warnings),
        ...result.warnings,
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
