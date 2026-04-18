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
      removePublishFlag: true,
      baseBranch: "trunk",
      prLabels: ["chore", "publish"],
      usePullRequests: false,
    });
    expect(result.githubToken).toBe("ghp_abc");
    expect(result.repoOwner).toBe("me");
    expect(result.repoName).toBe("site");
    expect(result.contentDir).toBe("content/blog");
    expect(result.imageDir).toBe("static/img");
    expect(result.frontmatterTemplate).toEqual({ author: "Mark" });
    expect(result.removePublishFlag).toBe(true);
    expect(result.baseBranch).toBe("trunk");
    expect(result.prLabels).toEqual(["chore", "publish"]);
    expect(result.usePullRequests).toBe(false);
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

  test("falls back when boolean field has wrong type", () => {
    const result = parseSettings({
      removePublishFlag: "true",
      usePullRequests: 1,
    });
    expect(result.removePublishFlag).toBe(DEFAULT_SETTINGS.removePublishFlag);
    expect(result.usePullRequests).toBe(DEFAULT_SETTINGS.usePullRequests);
  });

  test("falls back when prLabels is not an array", () => {
    const result = parseSettings({ prLabels: "chore" });
    expect(result.prLabels).toEqual(DEFAULT_SETTINGS.prLabels);
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
});
