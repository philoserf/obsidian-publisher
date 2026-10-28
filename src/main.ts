import { Notice, Plugin, type TFile } from "obsidian";
import {
  formatBatchNotice,
  formatPreflight,
  formatPublish,
  formatWarnings,
} from "./notices";
import { Publisher } from "./publisher";
import { PublisherSettingTab, parseSettings } from "./settings";
import {
  type BatchPublishResult,
  errorMessage,
  type PublishConfig,
  type PublisherSettings,
  type PublishWarning,
} from "./types";

/** A GitHub PR URL takes longer than the default ~5s to read on a phone. */
const PR_NOTICE_DURATION_MS = 10_000;

/**
 * The plugin's one failure report, in the shape Periodic Notes'
 * `reportFailure` uses: a prefixed console line carrying the error object,
 * and a notice with the message, since iOS has no console. `summary` is
 * reused in both, so console lines stay greppable.
 */
function reportFailure(summary: string, error: unknown): void {
  console.error(`[Publisher] ${summary}`, error);
  new Notice(`✗ ${summary}: ${errorMessage(error)}`);
}

function notifyWarnings(warnings: PublishWarning[]): void {
  for (const message of formatWarnings(warnings)) {
    new Notice(message);
  }
}

export default class ObsidianPublisher extends Plugin {
  declare settings: PublisherSettings;

  /** The batch progress notice, held so it can be updated in place rather
   * than stacking one toast per file. Cleared by endProgress(). */
  private progress: Notice | undefined;

  /** The publish currently running, if any. One flag covers both commands:
   * publishing the current note while a batch is committing has the same
   * duplicate-branch outcome as two batches. */
  private inFlight: Promise<void> | undefined;

  /** Held so a settings change synced from another device can redraw it. */
  private settingTab: PublisherSettingTab | undefined;

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
      this.publishConfig(),
      onProgress,
      this.app.metadataCache,
    );
  }

  /**
   * The settings with the token read out of secret storage. Read at the
   * moment of use, never cached: the token can change in Settings → Keychain
   * without this plugin's settings changing at all. An unset or missing
   * secret resolves to "", which validation reports as "GitHub token is
   * required".
   */
  publishConfig(): PublishConfig {
    const id = this.settings.githubTokenSecret;
    return {
      ...this.settings,
      githubToken: (id && this.app.secretStorage.getSecret(id)) || "",
    };
  }

  /** Dismiss the progress notice. Called from a finally, not from the
   * progress tick: if preparation throws part-way the tick never reaches
   * done === total, and a duration-0 notice would stay up forever. */
  private endProgress(): void {
    this.progress?.hide();
    this.progress = undefined;
  }

  override async onload() {
    await this.loadSettings();

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

    this.registerCliHandler(
      "publisher:preflight",
      "Check whether a note would publish, without touching GitHub",
      {
        path: {
          value: "<path>",
          description: "Vault path of the note",
          required: true,
        },
      },
      (params) => this.preflight(params.path),
    );

    this.registerCliHandler(
      "publisher:publish",
      "Publish a note to GitHub and print the pull request URL",
      {
        path: {
          value: "<path>",
          description: "Vault path of the note",
          required: true,
        },
      },
      (params) => this.publishFromCli(params.path),
    );
  }

  /**
   * The `publisher:preflight` CLI handler. Outside `runExclusive`: it
   * creates no branch, so it cannot duplicate one. Built without the
   * progress callback, which would raise a notice in the app for a run the
   * user started from a terminal. The token is never required — preflight
   * has to work on a device whose keychain does not hold it, since secrets
   * do not sync.
   */
  private async preflight(notePath: string | undefined): Promise<string> {
    const file = this.cliFile(notePath);
    if (!file) return `File not found: ${notePath ?? ""}`;
    const publisher = new Publisher(
      this.app.vault,
      this.publishConfig(),
      undefined,
      this.app.metadataCache,
    );
    return formatPreflight(await publisher.preflight(file));
  }

  /** Resolve a CLI `path=` to a file. A bare `path` flag arrives as "true". */
  private cliFile(notePath: string | undefined): TFile | null {
    return notePath && notePath !== "true"
      ? this.app.vault.getFileByPath(notePath)
      : null;
  }

  /**
   * The `publisher:publish` CLI handler: the publish-current-note command
   * for a named file, reporting in text instead of notices, since the run
   * was started from a terminal. Inside `runExclusive`, because unlike
   * preflight it opens a branch; a publish already running is reported as
   * the verdict rather than with the guard's notice.
   */
  private async publishFromCli(notePath: string | undefined): Promise<string> {
    if (this.inFlight) return "A publish is already running";
    const file = this.cliFile(notePath);
    if (!file) return `File not found: ${notePath ?? ""}`;
    const publisher = new Publisher(
      this.app.vault,
      this.publishConfig(),
      undefined,
      this.app.metadataCache,
    );
    const validationError = publisher.validateSettings();
    if (validationError) return `Cannot publish: ${validationError}`;

    let output = "";
    await this.runExclusive(async () => {
      try {
        output = formatPublish(await publisher.publishNote(file));
      } catch (error) {
        // Printed, not a notice: the caller is a terminal.
        console.error("[Publisher] Publish failed", error);
        output = `Error: ${errorMessage(error)}`;
      }
    });
    return output;
  }

  /** Load settings. Never saves, so an ordinary reload cannot bounce
   * data.json between devices. */
  async loadSettings() {
    this.settings = parseSettings(await this.loadData());
  }

  /**
   * Adopt a data.json that Sync brought from another device. Without this
   * the plugin kept its in-memory copy, and its next save wrote that stale
   * copy back over the synced one.
   *
   * `loadSettings` is safe to reuse because it never saves. A synced `githubTokenSecret` naming a
   * secret this device lacks needs no handling here: `publishConfig`
   * resolves it to no token at the moment of use.
   *
   * A running publish holds its own snapshot of the settings, so waiting is
   * not for its sake; it keeps a publish's notices and the settings it ran
   * with describing one configuration.
   */
  override async onExternalSettingsChange() {
    // Swallowed: the publish reports its own failure.
    await this.inFlight?.catch(() => {});
    await this.loadSettings();
    this.settingTab?.update();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Publish the current note
   */
  private async publishCurrentNote(file: TFile) {
    const publisher = this.createPublisher();
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
      reportFailure("Publish failed", error);
    }
  }

  /**
   * Publish all notes with status: publish
   */
  private async publishAllNotes() {
    const publisher = this.createPublisher();
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
      reportFailure("Batch publish failed", error);
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
      reportFailure("Batch publish failed", error);
    }
  }
}
