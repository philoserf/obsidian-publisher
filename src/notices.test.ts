import { describe, expect, test } from "bun:test";
import {
  formatBatchNotice,
  formatPreflight,
  formatPublish,
  formatWarnings,
} from "./notices";
import type { BatchPublishResult } from "./types";

function result(
  overrides: Partial<BatchPublishResult> = {},
): BatchPublishResult {
  return {
    total: 0,
    successful: 0,
    failed: 0,
    results: [],
    warnings: [],
    ...overrides,
  };
}

describe("formatBatchNotice", () => {
  test("error wins over empty results (the #193 bug)", () => {
    expect(
      formatBatchNotice(
        result({ total: 0, error: "Filename collision: a.md, b.md" }),
      ),
    ).toBe("✗ Failed to publish: Filename collision: a.md, b.md");
  });

  test("error wins over non-empty results", () => {
    expect(
      formatBatchNotice(
        result({ total: 2, successful: 1, failed: 1, error: "batch abort" }),
      ),
    ).toBe("✗ Failed to publish: batch abort");
  });

  test("no error, total=0 reports empty publish set", () => {
    expect(formatBatchNotice(result())).toBe("No publishable notes found");
  });

  test("all failed", () => {
    expect(
      formatBatchNotice(result({ total: 3, successful: 0, failed: 3 })),
    ).toBe("All files failed to process. No PR created.");
  });

  test("success summary", () => {
    expect(
      formatBatchNotice(result({ total: 3, successful: 2, failed: 1 })),
    ).toBe("Batch publish complete: 2 succeeded, 1 failed");
  });
});

describe("formatWarnings", () => {
  test("returns no messages for no warnings", () => {
    expect(formatWarnings([])).toEqual([]);
  });

  test("dedupes failed-image names into one message", () => {
    const messages = formatWarnings([
      { kind: "image-failed", name: "a.png" },
      { kind: "image-failed", name: "a.png" },
      { kind: "image-failed", name: "b.png" },
    ]);
    expect(messages).toEqual(["Warning: 2 image(s) failed: a.png, b.png"]);
  });

  test("formats basename collisions", () => {
    const messages = formatWarnings([
      {
        kind: "image-collision",
        name: "pic.png",
        paths: ["a/pic.png", "b/pic.png"],
      },
    ]);
    expect(messages).toEqual([
      "Warning: 1 image basename(s) collide, skipped: pic.png",
    ]);
  });

  test("unions target-collision sources per target path", () => {
    const messages = formatWarnings([
      {
        kind: "image-target-collision",
        targetPath: "static/images/pic.png",
        sourceNames: ["Pic.png", "pic.png"],
      },
      {
        kind: "image-target-collision",
        targetPath: "static/images/pic.png",
        sourceNames: ["pic.png", "PIC.png"],
      },
    ]);
    expect(messages).toEqual([
      "Warning: 1 image target(s) collide, overwrites skipped: static/images/pic.png (PIC.png, Pic.png, pic.png)",
    ]);
  });

  test("unions PR label failures into one message", () => {
    const messages = formatWarnings([
      { kind: "pr-label-failed", labels: ["chore", "blog"], error: "403" },
      { kind: "pr-label-failed", labels: ["blog"], error: "403" },
    ]);
    expect(messages).toEqual([
      "Warning: failed to apply PR labels: chore, blog",
    ]);
  });

  test("emits one message per warning kind", () => {
    const messages = formatWarnings([
      { kind: "image-failed", name: "a.png" },
      {
        kind: "image-collision",
        name: "b.png",
        paths: ["x/b.png", "y/b.png"],
      },
      {
        kind: "image-target-collision",
        targetPath: "static/images/c.png",
        sourceNames: ["C.png", "c.png"],
      },
      { kind: "pr-label-failed", labels: ["chore"], error: "403" },
    ]);
    expect(messages).toHaveLength(4);
  });
});

describe("formatBatchNotice reconciliation (#379)", () => {
  test("a declined deletion reads as cancelled, not failed", () => {
    expect(formatBatchNotice(result({ cancelled: true }))).toBe(
      "Publish All cancelled: nothing was committed",
    );
  });

  test("a batch that removed posts says how many", () => {
    expect(
      formatBatchNotice(
        result({ total: 2, successful: 2, deleted: ["a.md", "b.md"] }),
      ),
    ).toBe("Batch publish complete: 2 succeeded, 0 failed, 2 removed");
  });
});

describe("formatPreflight", () => {
  test("a clean pass is the single line ok", () => {
    expect(formatPreflight({ ok: true, warnings: [] })).toBe("ok");
  });

  test("the verdict is the first line and each warning follows", () => {
    expect(
      formatPreflight({
        ok: true,
        warnings: [{ kind: "image-failed", name: "a.png" }],
      }).split("\n"),
    ).toEqual(["ok", "Warning: 1 image(s) failed: a.png"]);
  });

  test("a failure prints its reason in place of ok", () => {
    expect(
      formatPreflight({
        ok: false,
        error: "Invalid frontmatter: date is required",
        warnings: [],
      }),
    ).toBe("Invalid frontmatter: date is required");
  });
});

describe("formatPublish", () => {
  test("a success is ok and the pull request URL", () => {
    expect(
      formatPublish({
        filePath: "a.md",
        success: true,
        warnings: [],
        prUrl: "https://github.com/o/r/pull/1",
      }),
    ).toBe("ok https://github.com/o/r/pull/1");
  });

  test("a success without a URL is the single line ok", () => {
    expect(
      formatPublish({ filePath: "a.md", success: true, warnings: [] }),
    ).toBe("ok");
  });

  test("a failure prints its reason, then each warning", () => {
    expect(
      formatPublish({
        filePath: "a.md",
        success: false,
        error: "boom",
        warnings: [{ kind: "image-failed", name: "a.png" }],
      }).split("\n"),
    ).toEqual(["boom", "Warning: 1 image(s) failed: a.png"]);
  });
});
