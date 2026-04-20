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
    ...overrides,
  };
}

describe("batchNoticeText", () => {
  test("error wins over empty results (the #193 bug)", () => {
    expect(
      batchNoticeText(
        result({ total: 0, error: "Filename collision: a.md, b.md" }),
        false,
      ),
    ).toBe("✗ Failed to publish: Filename collision: a.md, b.md");
  });

  test("error wins over non-empty results", () => {
    expect(
      batchNoticeText(
        result({ total: 2, successful: 1, failed: 1, error: "batch abort" }),
        true,
      ),
    ).toBe("✗ Failed to publish: batch abort");
  });

  test("no error, total=0 reports empty publish set", () => {
    expect(batchNoticeText(result(), false)).toBe("No publishable notes found");
  });

  test("all failed, PR workflow", () => {
    expect(
      batchNoticeText(result({ total: 3, successful: 0, failed: 3 }), true),
    ).toBe("All files failed to process. No PR created.");
  });

  test("all failed, direct commit", () => {
    expect(
      batchNoticeText(result({ total: 3, successful: 0, failed: 3 }), false),
    ).toBe("All files failed to process.");
  });

  test("success summary, PR workflow", () => {
    expect(
      batchNoticeText(result({ total: 3, successful: 2, failed: 1 }), true),
    ).toBe("Batch publish complete: 2 succeeded, 1 failed");
  });

  test("success summary, direct commit", () => {
    expect(
      batchNoticeText(result({ total: 3, successful: 2, failed: 1 }), false),
    ).toBe("Publishing complete: 2 succeeded, 1 failed out of 3 total");
  });
});
