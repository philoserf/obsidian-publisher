import { describe, expect, test } from "bun:test";
import { parseSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./types";

describe("parseSettings", () => {
  test("returns defaults when input is not a populated plain object", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("string")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(42)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(true)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test("preserves valid fields", () => {
    const result = parseSettings({
      githubToken: "ghp_abc",
      repoOwner: "me",
      repoName: "site",
      contentDir: "content/blog",
      imageDir: "static/img",
      frontmatterTemplate: { author: "Mark" },
      strippedFrontmatterFields: ["status", "lastmod"],
      baseBranch: "trunk",
      prLabels: ["chore", "publish"],
    });
    expect(result.githubToken).toBe("ghp_abc");
    expect(result.repoOwner).toBe("me");
    expect(result.repoName).toBe("site");
    expect(result.contentDir).toBe("content/blog");
    expect(result.imageDir).toBe("static/img");
    expect(result.frontmatterTemplate).toEqual({ author: "Mark" });
    expect(result.strippedFrontmatterFields).toEqual(["status", "lastmod"]);
    expect(result.baseBranch).toBe("trunk");
    expect(result.prLabels).toEqual(["chore", "publish"]);
  });

  test("falls back when string field has wrong type", () => {
    const result = parseSettings({
      githubToken: 42,
      repoOwner: null,
      repoName: ["array"],
    });
    expect(result.githubToken).toBe(DEFAULT_SETTINGS.githubToken);
    expect(result.repoOwner).toBe(DEFAULT_SETTINGS.repoOwner);
    expect(result.repoName).toBe(DEFAULT_SETTINGS.repoName);
  });

  test("falls back when prLabels is not an array", () => {
    const result = parseSettings({ prLabels: "chore" });
    expect(result.prLabels).toEqual(DEFAULT_SETTINGS.prLabels);
  });

  // #314 changed these two. An empty array is what the control stores
  // when the user clears the field, so replacing it with the default
  // meant clearing never stuck — there was no way to publish without
  // labels. A wrong *type* still falls back, because that is corruption
  // rather than a choice.
  test("keeps an empty prLabels, so clearing the field sticks", () => {
    const result = parseSettings({ prLabels: [] });
    expect(result.prLabels).toEqual([]);
  });

  test("normalizes a whitespace-only prLabels to empty, as the control does", () => {
    expect(parseSettings({ prLabels: [""] }).prLabels).toEqual([]);
    expect(parseSettings({ prLabels: ["  ", "\t"] }).prLabels).toEqual([]);
  });

  test("trims prLabels entries", () => {
    const result = parseSettings({ prLabels: ["  chore ", "publish"] });
    expect(result.prLabels).toEqual(["chore", "publish"]);
  });

  test("falls back when baseBranch is empty or whitespace", () => {
    expect(parseSettings({ baseBranch: "" }).baseBranch).toBe(
      DEFAULT_SETTINGS.baseBranch,
    );
    expect(parseSettings({ baseBranch: "   " }).baseBranch).toBe(
      DEFAULT_SETTINGS.baseBranch,
    );
  });

  test("falls back when prLabels contains non-string items", () => {
    const result = parseSettings({ prLabels: ["chore", 42, "publish"] });
    expect(result.prLabels).toEqual(DEFAULT_SETTINGS.prLabels);
  });

  test("falls back when frontmatterTemplate is null", () => {
    const result = parseSettings({ frontmatterTemplate: null });
    expect(result.frontmatterTemplate).toEqual(
      DEFAULT_SETTINGS.frontmatterTemplate,
    );
  });

  test("falls back when frontmatterTemplate is an array", () => {
    const result = parseSettings({ frontmatterTemplate: ["a", "b"] });
    expect(result.frontmatterTemplate).toEqual(
      DEFAULT_SETTINGS.frontmatterTemplate,
    );
  });

  test("preserves valid fields when other fields are corrupted", () => {
    const result = parseSettings({
      githubToken: "ghp_valid",
      prLabels: "broken",
      repoOwner: 42,
      baseBranch: "develop",
    });
    expect(result.githubToken).toBe("ghp_valid");
    expect(result.baseBranch).toBe("develop");
    expect(result.prLabels).toEqual(DEFAULT_SETTINGS.prLabels);
    expect(result.repoOwner).toBe(DEFAULT_SETTINGS.repoOwner);
  });

  test("ignores unknown fields", () => {
    const result = parseSettings({
      githubToken: "ghp_x",
      legacyField: "value",
      anotherUnknown: { deep: true },
    });
    expect(result).not.toHaveProperty("legacyField");
    expect(result).not.toHaveProperty("anotherUnknown");
    expect(result.githubToken).toBe("ghp_x");
  });

  test("parseSettings accepts strippedFrontmatterFields as string array", () => {
    const result = parseSettings({
      strippedFrontmatterFields: ["status", "lastmod"],
    });
    expect(result.strippedFrontmatterFields).toEqual(["status", "lastmod"]);
  });

  test("parseSettings defaults strippedFrontmatterFields to full list", () => {
    const result = parseSettings({});
    expect(result.strippedFrontmatterFields).toEqual([
      "status",
      "lastmod",
      "cssclass",
      "cssclasses",
      "position",
      "created",
      "modified",
    ]);
  });

  test("parseSettings rejects non-string-array strippedFrontmatterFields", () => {
    const result = parseSettings({ strippedFrontmatterFields: "not-an-array" });
    expect(result.strippedFrontmatterFields).toEqual([
      "status",
      "lastmod",
      "cssclass",
      "cssclasses",
      "position",
      "created",
      "modified",
    ]);
  });

  test("parseSettings accepts calloutShortcodeName and mermaidShortcodeName", () => {
    const result = parseSettings({
      calloutShortcodeName: "notice",
      mermaidShortcodeName: "diagram",
    });
    expect(result.calloutShortcodeName).toBe("notice");
    expect(result.mermaidShortcodeName).toBe("diagram");
  });

  test("parseSettings defaults shortcode names", () => {
    const result = parseSettings({});
    expect(result.calloutShortcodeName).toBe("callout");
    expect(result.mermaidShortcodeName).toBe("mermaid");
  });

  test("parseSettings rejects shortcode name with invalid characters", () => {
    const result = parseSettings({ calloutShortcodeName: "my bad name" });
    expect(result.calloutShortcodeName).toBe("callout");
  });

  test("parseSettings rejects shortcode name with template delimiters", () => {
    const result = parseSettings({ mermaidShortcodeName: "foo{{<bar" });
    expect(result.mermaidShortcodeName).toBe("mermaid");
  });

  test("parseSettings accepts valid shortcode name with hyphens and underscores", () => {
    const result = parseSettings({
      calloutShortcodeName: "my_custom-callout",
      mermaidShortcodeName: "some-diagram_v2",
    });
    expect(result.calloutShortcodeName).toBe("my_custom-callout");
    expect(result.mermaidShortcodeName).toBe("some-diagram_v2");
  });
});

describe("strippedFrontmatterFields guards required fields", () => {
  test("filters title and date from persisted list", () => {
    const result = parseSettings({
      strippedFrontmatterFields: ["status", "date", "title", "lastmod"],
    });
    expect(result.strippedFrontmatterFields).toEqual(["status", "lastmod"]);
  });

  test("keeps non-required entries intact", () => {
    const result = parseSettings({
      strippedFrontmatterFields: ["status", "cssclasses"],
    });
    expect(result.strippedFrontmatterFields).toEqual(["status", "cssclasses"]);
  });
});

describe("parseSettings does not alias DEFAULT_SETTINGS", () => {
  // DEFAULT_SETTINGS is a shared module-level const and saveSettings
  // persists whatever the settings object holds, so handing out the
  // defaults by reference would let one in-place mutation corrupt every
  // later load. toEqual can't catch this; identity has to be asserted.
  test("fallback values are copies, not the shared defaults", () => {
    const result = parseSettings({});

    expect(result.prLabels).toEqual(DEFAULT_SETTINGS.prLabels);
    expect(result.prLabels).not.toBe(DEFAULT_SETTINGS.prLabels);
    expect(result.frontmatterTemplate).not.toBe(
      DEFAULT_SETTINGS.frontmatterTemplate,
    );
    expect(result.strippedFrontmatterFields).not.toBe(
      DEFAULT_SETTINGS.strippedFrontmatterFields,
    );
  });

  test("two loads do not share array instances", () => {
    expect(parseSettings({}).prLabels).not.toBe(parseSettings({}).prLabels);
  });
});

// #314. The settings UI normalizes every value on the way in, and
// parseSettings normalizes it again on the way out — but the two layers
// encoded different policies, so for every one of these fields the value
// the UI held and the value the next load produced disagreed. These
// assert the load path agrees with what the control would have stored.
describe("the load path applies the same normalizer as the UI (#314)", () => {
  test("a hazardous contentDir is rejected, not passed through", () => {
    expect(parseSettings({ contentDir: "../escape" }).contentDir).toBe("");
  });

  test("a hazardous imageDir is rejected, not passed through", () => {
    expect(parseSettings({ imageDir: "~/x" }).imageDir).toBe("");
  });

  test("an illegal repoOwner is repaired", () => {
    expect(parseSettings({ repoOwner: "my owner!" }).repoOwner).toBe("myowner");
  });

  test("an illegal repoName is repaired", () => {
    expect(parseSettings({ repoName: "my repo!!" }).repoName).toBe("myrepo");
  });

  test("baseBranch is trimmed, as the control trims it", () => {
    expect(parseSettings({ baseBranch: "  main  " }).baseBranch).toBe("main");
  });

  // Not a consistency nit but a user-facing bug: clearing the labels field
  // stored [], and the next load turned it back into the default. There
  // was no way to publish without labels. The comment called this
  // "symmetric with baseBranch", which is false — you must have a branch,
  // you may have no labels.
  test("an empty prLabels round-trips as empty", () => {
    expect(parseSettings({ prLabels: [] }).prLabels).toEqual([]);
  });

  test("a missing prLabels still falls back to the default", () => {
    expect(parseSettings({}).prLabels).toEqual(["chore"]);
  });

  // The property that catches the next field added to only one side.
  test("normalizing is idempotent across the boundary", () => {
    const settings = parseSettings({
      contentDir: "content/posts",
      imageDir: "static/images",
      repoOwner: "philoserf",
      repoName: "site",
      baseBranch: "main",
      prLabels: ["chore", "docs"],
      calloutShortcodeName: "callout",
      mermaidShortcodeName: "mermaid",
    });
    expect(parseSettings(settings)).toEqual(settings);
  });
});
