import { describe, expect, mock, spyOn, test } from "bun:test";
import type { App } from "obsidian";
import type ObsidianPublisher from "./main";
import {
  normalizeShortcodeName,
  PublisherSettingTab,
  parseFrontmatter,
  parseStrippedFieldsInput,
  requiredFieldsIn,
  sanitizeGitHubOwner,
  sanitizePath,
  sanitizeRepoName,
  serializeFrontmatter,
  validateConnection,
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

  // #313 changed these two from repair to rejection. Removing the marker
  // and keeping the rest made the value look checked while leaving the
  // author's intent — "escape the content directory" — partly honoured.
  // An empty return routes into validateSettings(), which fails the
  // publish with "Content directory is required".
  test("rejects parent-directory traversal", () => {
    expect(sanitizePath("../etc/passwd")).toBe("");
  });

  test("rejects a home-directory marker", () => {
    expect(sanitizePath("~/secrets")).toBe("");
  });

  test("rejects a single-dot segment", () => {
    expect(sanitizePath("./posts")).toBe("");
  });

  // The three inputs from #313. Each is a case where removing characters
  // SYNTHESIZED a value worse than the input: subtraction cannot be made
  // safe by ordering, only by not subtracting.
  test("does not reconstruct .. from an interleaved marker", () => {
    expect(sanitizePath(".~./posts")).toBe("");
  });

  test("does not collapse a run of dots into a relative path", () => {
    expect(sanitizePath("..././")).toBe("");
  });

  // The complaint in #313 about this input was the empty segment that
  // `a///b` left behind, which no later normalization removed. A run of
  // four dots is an odd directory name but not a traversal, so it is kept
  // — rejecting it would be narrowing, not fixing.
  test("collapses the empty segment without rejecting a dotted name", () => {
    expect(sanitizePath("a/....//b")).toBe("a/..../b");
  });

  // Guards: rejection must not narrow what a legitimate path may contain.
  // Notably NOT an ASCII allowlist — this repo spent #315 making sure a
  // macron survives a slug, and a Hugo content/artículos directory is
  // ordinary.
  test("preserves a space in a segment", () => {
    expect(sanitizePath("content/my posts")).toBe("content/my posts");
  });

  test("preserves non-ASCII letters", () => {
    expect(sanitizePath("content/artículos")).toBe("content/artículos");
  });

  test("collapses a doubled interior slash rather than rejecting", () => {
    expect(sanitizePath("content//posts")).toBe("content/posts");
  });

  test("preserves interior slashes", () => {
    expect(sanitizePath("content/posts/subdir")).toBe("content/posts/subdir");
  });

  test("trims whitespace", () => {
    expect(sanitizePath("  content/posts  ")).toBe("content/posts");
  });
});

describe("normalizeShortcodeName", () => {
  // #314 retired repair in favour of reject-or-default. `my bad name`
  // used to become `mybadname`, which names a Hugo template that does not
  // exist — a failure at site build time rather than at the point the
  // value was typed. The load path already rejected; now both do.
  test("accepts a legal name as typed", () => {
    expect(normalizeShortcodeName("my-callout_2", "callout")).toBe(
      "my-callout_2",
    );
  });

  test("trims surrounding whitespace", () => {
    expect(normalizeShortcodeName("  callout  ", "callout")).toBe("callout");
  });

  test("rejects a name with a space rather than closing it up", () => {
    expect(normalizeShortcodeName("my bad name", "callout")).toBe("callout");
  });

  test("rejects punctuation rather than stripping it", () => {
    expect(normalizeShortcodeName("call!out", "callout")).toBe("callout");
  });

  test("falls back on empty input", () => {
    expect(normalizeShortcodeName("   ", "mermaid")).toBe("mermaid");
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
});

// #235: these inputs are VALID yaml but not objects, so they parse without
// throwing and were silently discarded. parseFrontmatter still returns {} —
// recovery is impossible, there are no key:value pairs to recover — but the
// settings control now notices the empty result and tells the user.
describe("parseFrontmatter rejects non-object YAML", () => {
  test("a bare line without a colon yields no fields", () => {
    expect(parseFrontmatter("My Custom Value")).toEqual({});
  });

  test("a YAML list yields no fields", () => {
    expect(parseFrontmatter("- a\n- b")).toEqual({});
  });

  test("multi-line prose yields no fields", () => {
    expect(parseFrontmatter("just text\nmore text")).toEqual({});
  });

  test("valid key: value still parses", () => {
    expect(parseFrontmatter("author: Mark")).toEqual({ author: "Mark" });
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

  test("filters out required frontmatter fields (title, date)", () => {
    expect(
      parseStrippedFieldsInput("status, date, lastmod, title, cssclass"),
    ).toEqual(["status", "lastmod", "cssclass"]);
  });

  test("returns empty array when only required fields are given", () => {
    expect(parseStrippedFieldsInput("title, date")).toEqual([]);
  });
});

describe("requiredFieldsIn", () => {
  test("returns required fields present in input", () => {
    expect(requiredFieldsIn(["status", "date", "lastmod"])).toEqual(["date"]);
  });

  test("returns both title and date when present", () => {
    expect(requiredFieldsIn(["title", "status", "date"])).toEqual([
      "title",
      "date",
    ]);
  });

  test("returns empty array when no required fields present", () => {
    expect(requiredFieldsIn(["status", "lastmod"])).toEqual([]);
  });

  test("dedupes repeated required fields", () => {
    expect(requiredFieldsIn(["date", "date", "title"])).toEqual([
      "date",
      "title",
    ]);
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

describe("validateConnection", () => {
  test("returns null for complete settings", () => {
    expect(validateConnection(makeSettings())).toBeNull();
  });

  test("returns error when githubToken missing", () => {
    expect(validateConnection(makeSettings({ githubToken: "" }))).toContain(
      "token",
    );
  });

  test("returns error when repoOwner missing", () => {
    expect(validateConnection(makeSettings({ repoOwner: "" }))).toContain(
      "owner",
    );
  });

  test("returns error when repoName missing", () => {
    expect(validateConnection(makeSettings({ repoName: "" }))).toContain(
      "name",
    );
  });
});

// #319. Deleting parseKeyValueText removed the only code that made a
// throwing parse behave differently from a non-object one, so these
// document the now-uniform branch rather than guarding a regression. The
// old fallback split on the first colon per line and returned a non-empty
// object, which meant the settings control's Notice never fired and a
// value the user never wrote reached the commit.
describe("parseFrontmatter rejects malformed YAML the same way (#319)", () => {
  test("an unclosed flow sequence yields no fields", () => {
    expect(parseFrontmatter("author: [unclosed")).toEqual({});
  });

  test("one bad line rejects the whole input, rather than half of it", () => {
    expect(parseFrontmatter("author: Mark\nbad: [oops")).toEqual({});
  });

  test("an undefined anchor yields no fields", () => {
    expect(parseFrontmatter("key: *undefined-anchor")).toEqual({});
  });

  test("valid YAML is unaffected", () => {
    expect(parseFrontmatter("author: Mark\ntags: [obsidian]")).toEqual({
      author: "Mark",
      tags: ["obsidian"],
    });
  });
});
