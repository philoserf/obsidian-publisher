import { describe, expect, test } from "bun:test";
import { batchNoticeText } from "./main";
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

describe("batchNoticeText", () => {
  test("error wins over empty results (the #193 bug)", () => {
    expect(
      batchNoticeText(
        result({ total: 0, error: "Filename collision: a.md, b.md" }),
      ),
    ).toBe("✗ Failed to publish: Filename collision: a.md, b.md");
  });

  test("error wins over non-empty results", () => {
    expect(
      batchNoticeText(
        result({ total: 2, successful: 1, failed: 1, error: "batch abort" }),
      ),
    ).toBe("✗ Failed to publish: batch abort");
  });

  test("no error, total=0 reports empty publish set", () => {
    expect(batchNoticeText(result())).toBe("No publishable notes found");
  });

  test("all failed", () => {
    expect(
      batchNoticeText(result({ total: 3, successful: 0, failed: 3 })),
    ).toBe("All files failed to process. No PR created.");
  });

  test("success summary", () => {
    expect(
      batchNoticeText(result({ total: 3, successful: 2, failed: 1 })),
    ).toBe("Batch publish complete: 2 succeeded, 1 failed");
  });
});
