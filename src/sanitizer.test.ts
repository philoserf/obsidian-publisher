/**
 * Tests for filename sanitization logic
 * Run with: bun test
 *
 * These tests focus on the pure functions that don't require Obsidian API
 */

import { describe, expect, test } from "bun:test";

// Duplicate the sanitization logic for testing without Obsidian dependencies
function sanitizeFilename(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

  let name = filename;
  let extension = "";

  if (hasExtension) {
    name = filename.slice(0, lastDotIndex);
    extension = filename.slice(lastDotIndex);
  }

  name = name.toLowerCase().replace(/\s+/g, "-");
  name = name.replace(/[^a-z0-9\-_]/g, "");
  name = name.replace(/-+/g, "-");
  name = name.replace(/^-+|-+$/g, "");

  if (!name) {
    name = "untitled";
  }

  return name + extension;
}

describe("Filename Sanitization", () => {
  test("converts spaces to hyphens", () => {
    expect(sanitizeFilename("My Blog Post.md")).toBe("my-blog-post.md");
  });

  test("converts to lowercase", () => {
    expect(sanitizeFilename("UPPERCASE.md")).toBe("uppercase.md");
  });

  test("removes special characters", () => {
    expect(sanitizeFilename("Special!@#$%Chars.md")).toBe("specialchars.md");
  });

  test("preserves hyphens and underscores", () => {
    expect(sanitizeFilename("valid-file_name.md")).toBe("valid-file_name.md");
  });

  test("removes consecutive hyphens", () => {
    expect(sanitizeFilename("too   many   spaces.md")).toBe(
      "too-many-spaces.md",
    );
  });

  test("handles files without extensions", () => {
    expect(sanitizeFilename("no extension")).toBe("no-extension");
  });

  test("handles empty names", () => {
    expect(sanitizeFilename("@#$%.md")).toBe("untitled.md");
  });

  test("handles images", () => {
    expect(sanitizeFilename("My Image File.png")).toBe("my-image-file.png");
  });

  test("handles complex filenames", () => {
    expect(sanitizeFilename("My Cool Article (2024) - Part #1.md")).toBe(
      "my-cool-article-2024-part-1.md",
    );
  });

  test("removes leading/trailing hyphens", () => {
    expect(sanitizeFilename("---test---.md")).toBe("test.md");
  });
});
