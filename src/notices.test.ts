import { describe, expect, test } from "bun:test";
import { formatBatchNotice, formatWarnings } from "./notices";
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
