import { describe, expect, mock, spyOn, test } from "bun:test";
import type { App } from "obsidian";
import type ObsidianPublisher from "./main";
import {
  PublisherSettingTab,
  parseFrontmatter,
  parseStrippedFieldsInput,
  sanitizeGitHubOwner,
  sanitizePath,
  sanitizeRepoName,
  serializeFrontmatter,
  validateConnectionSettings,
} from "./settings";
import { DEFAULT_SETTINGS, type PublisherSettings } from "./types";

function makeSettings(
  overrides: Partial<PublisherSettings> = {},
): PublisherSettings {
  return {
    ...DEFAULT_SETTINGS,
    githubToken: "ghp_test",
    repoOwner: "owner",
    repoName: "repo",
    ...overrides,
  };
}

describe("sanitizeGitHubOwner", () => {
  test("strips characters outside [a-zA-Z0-9-]", () => {
    expect(sanitizeGitHubOwner("my_owner!@#")).toBe("myowner");
  });

  test("trims whitespace", () => {
    expect(sanitizeGitHubOwner("  owner  ")).toBe("owner");
  });

  test("caps at 39 characters (GitHub username limit)", () => {
    expect(sanitizeGitHubOwner("a".repeat(50))).toBe("a".repeat(39));
  });

  test("preserves hyphens", () => {
    expect(sanitizeGitHubOwner("my-owner-name")).toBe("my-owner-name");
  });

  test("returns empty string for all-disallowed input", () => {
    expect(sanitizeGitHubOwner("!@#$%")).toBe("");
  });
});

describe("sanitizeRepoName", () => {
  test("strips characters outside [a-zA-Z0-9-_.]", () => {
    expect(sanitizeRepoName("my repo!@#")).toBe("myrepo");
  });

  test("preserves dots, underscores, hyphens", () => {
    expect(sanitizeRepoName("my-repo_name.v2")).toBe("my-repo_name.v2");
  });

  test("caps at 100 characters", () => {
    expect(sanitizeRepoName("x".repeat(120))).toBe("x".repeat(100));
  });

  test("trims whitespace", () => {
    expect(sanitizeRepoName("  repo  ")).toBe("repo");
  });
});

describe("sanitizePath", () => {
  test("strips leading and trailing slashes", () => {
    expect(sanitizePath("/content/posts/")).toBe("content/posts");
  });

  test("strips repeated leading/trailing slashes", () => {
    expect(sanitizePath("///a/b///")).toBe("a/b");
  });

  test("removes parent-directory traversal", () => {
    expect(sanitizePath("../etc/passwd")).toBe("etc/passwd");
  });

  test("removes home-directory marker and resulting leading slash", () => {
    expect(sanitizePath("~/secrets")).toBe("secrets");
  });

  test("preserves interior slashes", () => {
    expect(sanitizePath("content/posts/subdir")).toBe("content/posts/subdir");
  });

  test("trims whitespace", () => {
    expect(sanitizePath("  content/posts  ")).toBe("content/posts");
  });
});

describe("serializeFrontmatter", () => {
  test("returns empty string for empty object", () => {
    expect(serializeFrontmatter({})).toBe("");
  });

  test("serializes simple key-value pairs", () => {
    const result = serializeFrontmatter({ author: "Mark", tag: "obsidian" });
    expect(result).toContain("author: Mark");
    expect(result).toContain("tag: obsidian");
  });
});

describe("parseFrontmatter", () => {
  test("returns empty object for empty string", () => {
    expect(parseFrontmatter("")).toEqual({});
  });

  test("returns empty object for whitespace-only", () => {
    expect(parseFrontmatter("   \n  \n")).toEqual({});
  });

  test("parses simple key: value lines", () => {
    const result = parseFrontmatter("author: Mark\ntags: obsidian");
    expect(result.author).toBe("Mark");
  });

  test("round-trips through serialize", () => {
    const input = { author: "Mark", tag: "obsidian" };
    const parsed = parseFrontmatter(serializeFrontmatter(input));
    expect(parsed.author).toBe("Mark");
    expect(parsed.tag).toBe("obsidian");
  });
});

describe("parseStrippedFieldsInput", () => {
  test("parses simple comma-separated list", () => {
    expect(parseStrippedFieldsInput("status,lastmod,cssclass")).toEqual([
      "status",
      "lastmod",
      "cssclass",
    ]);
  });

  test("trims whitespace around each field", () => {
    expect(
      parseStrippedFieldsInput(" status , lastmod ,  , cssclass "),
    ).toEqual(["status", "lastmod", "cssclass"]);
  });

  test("filters out empty segments from trailing/double commas", () => {
    expect(parseStrippedFieldsInput("status,,lastmod,")).toEqual([
      "status",
      "lastmod",
    ]);
  });

  test("returns empty array for empty string", () => {
    expect(parseStrippedFieldsInput("")).toEqual([]);
  });

  test("returns empty array for whitespace-only input", () => {
    expect(parseStrippedFieldsInput("   ,  ,   ")).toEqual([]);
  });
});

describe("PublisherSettingTab.hide", () => {
  test("cancels pending debounced save and flushes immediately", () => {
    const saveSettings = mock(() => Promise.resolve());
    const plugin = { saveSettings } as unknown as ObsidianPublisher;
    const tab = new PublisherSettingTab({} as App, plugin);
    const cancelSpy = spyOn(tab.save, "cancel");
    tab.hide();
    expect(cancelSpy).toHaveBeenCalled();
    expect(saveSettings).toHaveBeenCalled();
  });
});

describe("validateConnectionSettings", () => {
  test("returns null for complete settings", () => {
    expect(validateConnectionSettings(makeSettings())).toBeNull();
  });

  test("returns error when githubToken missing", () => {
    expect(
      validateConnectionSettings(makeSettings({ githubToken: "" })),
    ).toContain("token");
  });

  test("returns error when repoOwner missing", () => {
    expect(
      validateConnectionSettings(makeSettings({ repoOwner: "" })),
    ).toContain("owner");
  });

  test("returns error when repoName missing", () => {
    expect(
      validateConnectionSettings(makeSettings({ repoName: "" })),
    ).toContain("name");
  });
});
