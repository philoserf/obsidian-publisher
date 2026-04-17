import { describe, expect, test } from "bun:test";
import {
  hasPublishFlag,
  PUBLISH_STATUS_FIELD,
  PUBLISH_STATUS_VALUE,
  REQUIRED_FRONTMATTER_FIELDS,
  splitFrontmatter,
  validateFrontmatter,
} from "./schema";

describe("schema constants", () => {
  test("publish gate uses status: publish", () => {
    expect(PUBLISH_STATUS_FIELD).toBe("status");
    expect(PUBLISH_STATUS_VALUE).toBe("publish");
  });

  test("required fields are title and date", () => {
    expect(REQUIRED_FRONTMATTER_FIELDS).toEqual(["title", "date"]);
  });
});

describe("splitFrontmatter", () => {
  test("extracts frontmatter and body", () => {
    const input = "---\ntitle: Test\ndate: 2026-01-01\n---\nHello world";
    const { frontmatter, body } = splitFrontmatter(input);
    expect(frontmatter).toEqual({ title: "Test", date: "2026-01-01" });
    expect(body).toBe("Hello world");
  });

  test("returns empty frontmatter and full content when no frontmatter block", () => {
    const input = "Just plain content";
    const { frontmatter, body } = splitFrontmatter(input);
    expect(frontmatter).toEqual({});
    expect(body).toBe("Just plain content");
  });

  test("returns empty frontmatter when YAML parse fails", () => {
    const input = "---\n: bad yaml :\n---\nbody";
    const { frontmatter, body } = splitFrontmatter(input);
    expect(frontmatter).toEqual({});
    expect(body).toBe("body");
  });
});

describe("hasPublishFlag", () => {
  test("true when status equals publish", () => {
    expect(hasPublishFlag({ status: "publish" })).toBe(true);
  });

  test("false when status is draft", () => {
    expect(hasPublishFlag({ status: "draft" })).toBe(false);
  });

  test("false when status is the old 'published' value", () => {
    expect(hasPublishFlag({ status: "published" })).toBe(false);
  });

  test("false when status is missing", () => {
    expect(hasPublishFlag({ title: "No status" })).toBe(false);
  });
});

describe("validateFrontmatter", () => {
  test("returns null when all required fields present", () => {
    expect(validateFrontmatter({ title: "T", date: "2026-01-01" })).toBeNull();
  });

  test("returns error naming title when title missing", () => {
    expect(validateFrontmatter({ date: "2026-01-01" })).toContain("title");
  });

  test("returns error naming date when date missing", () => {
    expect(validateFrontmatter({ title: "T" })).toContain("date");
  });

  test("treats empty string as missing", () => {
    expect(validateFrontmatter({ title: "", date: "2026-01-01" })).toContain(
      "title",
    );
  });

  test("treats null as missing", () => {
    expect(validateFrontmatter({ title: null, date: "2026-01-01" })).toContain(
      "title",
    );
  });

  test("treats whitespace-only string as missing", () => {
    expect(validateFrontmatter({ title: "   ", date: "2026-01-01" })).toContain(
      "title",
    );
  });
});
