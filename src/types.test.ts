import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, parseSettings } from "./types";

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

  test("falls back when prLabels is an empty array", () => {
    const result = parseSettings({ prLabels: [] });
    expect(result.prLabels).toEqual(DEFAULT_SETTINGS.prLabels);
  });

  test("falls back when prLabels contains only whitespace", () => {
    expect(parseSettings({ prLabels: [""] }).prLabels).toEqual(
      DEFAULT_SETTINGS.prLabels,
    );
    expect(parseSettings({ prLabels: ["  ", "\t"] }).prLabels).toEqual(
      DEFAULT_SETTINGS.prLabels,
    );
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
      "aliases",
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
      "aliases",
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

describe("strippedFrontmatterFields migration", () => {
  test("migrates removePublishFlag=true to default list", () => {
    const result = parseSettings({ removePublishFlag: true });
    expect(result.strippedFrontmatterFields).toContain("status");
    expect(result.strippedFrontmatterFields).toContain("lastmod");
  });

  test("migrates removePublishFlag=false to default list minus status", () => {
    const result = parseSettings({ removePublishFlag: false });
    expect(result.strippedFrontmatterFields).not.toContain("status");
    expect(result.strippedFrontmatterFields).toContain("lastmod");
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

  test("filters required fields from legacy removePublishFlag migration", () => {
    // Hypothetical: if a future default-list change included a required
    // field, the migration path must still filter it. Regression guard for
    // the branch that builds from defaults rather than the persisted array.
    const result = parseSettings({ removePublishFlag: false });
    expect(result.strippedFrontmatterFields).not.toContain("date");
    expect(result.strippedFrontmatterFields).not.toContain("title");
  });
});
