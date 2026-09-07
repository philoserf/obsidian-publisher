import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Notice } from "obsidian";
import ObsidianPublisher from "./main";
import { Publisher } from "./publisher";
import type { BatchPublishResult, PublishResult } from "./types";

// The Notice mock records every message; see src/test-preload.ts.
const NoticeMock = Notice as unknown as {
  shown: Array<{ message: string; duration?: number }>;
};
const shown = () => NoticeMock.shown.map((n) => n.message);

type PluginInternals = {
  app: unknown;
  commands: Array<{
    id: string;
    callback?: () => Promise<void>;
    editorCallback?: (
      editor: unknown,
      view: { file: unknown },
    ) => Promise<void>;
  }>;
  data: unknown;
};

function makePlugin() {
  const plugin = new ObsidianPublisher(
    { vault: {} } as never,
    {} as never,
  ) as ObsidianPublisher & PluginInternals;
  plugin.app = { vault: {} };
  plugin.data = {
    githubToken: "ghp_test",
    repoOwner: "o",
    repoName: "r",
  };
  return plugin;
}

const okResult = (over: Partial<PublishResult> = {}): PublishResult =>
  ({ filePath: "a.md", success: true, warnings: [], ...over }) as PublishResult;

const okBatch = (
  over: Partial<BatchPublishResult> = {},
): BatchPublishResult => ({
  total: 1,
  successful: 1,
  failed: 0,
  results: [okResult()],
  warnings: [],
  ...over,
});

const runCurrent = async (
  plugin: ObsidianPublisher & PluginInternals,
  file: unknown,
) => {
  const cmd = plugin.commands.find((c) => c.id === "publish-current-note");
  await cmd?.editorCallback?.(undefined, { file });
};

const runAll = async (plugin: ObsidianPublisher & PluginInternals) => {
  const cmd = plugin.commands.find((c) => c.id === "publish-all-notes");
  await cmd?.callback?.();
};

beforeEach(() => {
  NoticeMock.shown.length = 0;
});

describe("ObsidianPublisher.onload", () => {
  test("loads settings and registers both commands", async () => {
    const plugin = makePlugin();
    await plugin.onload();

    expect(plugin.settings.repoOwner).toBe("o");
    expect(plugin.commands.map((c) => c.id)).toEqual([
      "publish-current-note",
      "publish-all-notes",
    ]);
  });

  test("falls back to defaults when there is no persisted data", async () => {
    const plugin = makePlugin();
    plugin.data = null;
    await plugin.onload();
    expect(plugin.settings.baseBranch).toBe("main");
  });
});

describe("publish-current-note command", () => {
  test("reports when there is no active file", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    await runCurrent(plugin, null);
    expect(shown()).toEqual(["No active file"]);
  });

  test("refuses to publish when settings are invalid", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue("GitHub token is required");
    const publish = spyOn(Publisher.prototype, "publishNote");

    await runCurrent(plugin, { basename: "note", path: "note.md" });

    expect(shown()).toEqual(["Cannot publish: GitHub token is required"]);
    expect(publish).not.toHaveBeenCalled();
    validate.mockRestore();
    publish.mockRestore();
  });

  test("announces start and success", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishNote").mockResolvedValue(
      okResult({ prUrl: "https://github.com/test/pr/1" }),
    );

    await runCurrent(plugin, { basename: "note", path: "note.md" });

    expect(shown()[0]).toBe("Publishing note...");
    expect(shown()[1]).toContain("Pull request created");
    validate.mockRestore();
    publish.mockRestore();
  });

  // #248: the PR URL used to go only to console.log, unreachable on iOS —
  // the platform the REST-API architecture exists for.
  test("puts the PR URL in the notice, with a readable duration (#248)", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishNote").mockResolvedValue(
      okResult({ prUrl: "https://github.com/test/pr/1" }),
    );

    await runCurrent(plugin, { basename: "note", path: "note.md" });

    const notice = NoticeMock.shown.find((n) => n.message.includes("http"));
    expect(notice?.message).toBe(
      "✓ Pull request created: https://github.com/test/pr/1",
    );
    expect(notice?.duration).toBe(10_000);
    validate.mockRestore();
    publish.mockRestore();
  });

  test("falls back to the basename when there is no PR URL", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishNote").mockResolvedValue(
      okResult(),
    );

    await runCurrent(plugin, { basename: "note", path: "note.md" });

    expect(shown()).toContain("✓ Pull request created for note");
    validate.mockRestore();
    publish.mockRestore();
  });

  test("reports a failed result", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishNote").mockResolvedValue(
      {
        filePath: "note.md",
        success: false,
        error: "boom",
        warnings: [],
      } as PublishResult,
    );

    await runCurrent(plugin, { basename: "note", path: "note.md" });

    expect(shown()).toContain("✗ Failed to publish: boom");
    validate.mockRestore();
    publish.mockRestore();
  });

  test("surfaces a thrown error as a notice", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(
      Publisher.prototype,
      "publishNote",
    ).mockImplementation(async () => {
      throw new Error("network down");
    });

    await runCurrent(plugin, { basename: "note", path: "note.md" });

    expect(shown()).toContain("✗ Error: network down");
    validate.mockRestore();
    publish.mockRestore();
  });
});

describe("publish-all-notes command", () => {
  test("announces the scan, the summary, and the PR URL", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishAll").mockResolvedValue(
      okBatch({ prUrl: "https://github.com/test/pr/1" }),
    );

    await runAll(plugin);

    expect(shown()[0]).toBe("Scanning vault for publishable notes...");
    expect(shown()[1]).toContain("1 succeeded, 0 failed");
    expect(shown()[2]).toContain("https://github.com/test/pr/1");
    validate.mockRestore();
    publish.mockRestore();
  });

  test("reports when nothing is publishable and shows no PR", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishAll").mockResolvedValue(
      okBatch({ total: 0, successful: 0, results: [] }),
    );

    await runAll(plugin);

    expect(shown()).toContain("No publishable notes found");
    expect(shown().join("\n")).not.toContain("Pull request created");
    validate.mockRestore();
    publish.mockRestore();
  });

  test("surfaces a thrown error as a notice", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishAll").mockImplementation(
      async () => {
        throw new Error("rate limited");
      },
    );

    await runAll(plugin);

    expect(shown()).toContain("✗ Error: rate limited");
    validate.mockRestore();
    publish.mockRestore();
  });

  // The specific logic #237 calls out: per-file warnings and batch-level
  // warnings must both reach the user. formatWarnings emits one message per
  // kind, so a per-file and a batch-level warning of different kinds produce
  // two notices.
  test("merges per-file warnings with batch-level warnings", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishAll").mockResolvedValue(
      okBatch({
        results: [
          okResult({ warnings: [{ kind: "image-failed", name: "a.png" }] }),
        ],
        warnings: [
          { kind: "pr-label-failed", labels: ["chore"], error: "nope" },
        ],
      }),
    );

    await runAll(plugin);

    const all = shown().join("\n");
    expect(all).toContain("a.png");
    expect(all).toContain("failed to apply PR labels: chore");
    validate.mockRestore();
    publish.mockRestore();
  });
});

describe("settings lifecycle", () => {
  test("saveSettings persists and rebuilds the publisher", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const before = (plugin as unknown as { publisher: Publisher }).publisher;

    plugin.settings.repoName = "changed";
    await plugin.saveSettings();

    expect((plugin.data as { repoName: string }).repoName).toBe("changed");
    // Rebuilt because Publisher captures settings (and its GitHub token) at
    // construction — see the comment on saveSettings.
    expect((plugin as unknown as { publisher: Publisher }).publisher).not.toBe(
      before,
    );
  });

  test("onunload cancels the pending settings save", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const cancel = mock(() => {});
    (
      plugin as unknown as { settingTab: { save: { cancel: () => void } } }
    ).settingTab.save.cancel = cancel;

    plugin.onunload();

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

// #246: onProgress used to build a fresh Notice per file, so a 167-note
// batch stacked 167 toasts that outlived the operation and buried the
// summary, the PR URL and every warning.
describe("batch progress notices (#246)", () => {
  const progressOf = (plugin: ObsidianPublisher) =>
    (
      (plugin as unknown as { publisher: Publisher }).publisher as unknown as {
        onProgress?: (done: number, total: number) => void;
      }
    ).onProgress;

  test("shows one notice and updates it in place", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const onProgress = progressOf(plugin);

    NoticeMock.shown.length = 0;
    onProgress?.(1, 3);
    onProgress?.(2, 3);
    onProgress?.(3, 3);

    expect(NoticeMock.shown).toHaveLength(1);
    const notice = (plugin as unknown as { progress?: { message: string } })
      .progress;
    expect(notice?.message).toBe("Prepared: 3/3");
  });

  test("the progress notice is sticky until dismissed", async () => {
    const plugin = makePlugin();
    await plugin.onload();

    NoticeMock.shown.length = 0;
    progressOf(plugin)?.(1, 2);

    expect(NoticeMock.shown[0].duration).toBe(0);
  });

  // The teardown must not hang off `done === total`: if preparation throws
  // part-way, that tick never arrives and a duration-0 notice would stay up
  // forever. It runs in a finally instead.
  test("dismisses the progress notice even when the batch throws", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishAll").mockImplementation(
      async () => {
        progressOf(plugin)?.(1, 5);
        throw new Error("failed part-way");
      },
    );

    await runAll(plugin);

    const held = (plugin as unknown as { progress?: unknown }).progress;
    expect(held).toBeUndefined();
    expect(shown()).toContain("✗ Error: failed part-way");
    validate.mockRestore();
    publish.mockRestore();
  });

  test("dismisses the progress notice after a successful batch", async () => {
    const plugin = makePlugin();
    await plugin.onload();
    const validate = spyOn(
      Publisher.prototype,
      "validateSettings",
    ).mockReturnValue(null);
    const publish = spyOn(Publisher.prototype, "publishAll").mockImplementation(
      async () => {
        progressOf(plugin)?.(1, 1);
        return okBatch();
      },
    );

    await runAll(plugin);

    expect(
      (plugin as unknown as { progress?: unknown }).progress,
    ).toBeUndefined();
    validate.mockRestore();
    publish.mockRestore();
  });
});
