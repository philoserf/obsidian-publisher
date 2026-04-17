import { parseYaml } from "obsidian";

export const PUBLISH_STATUS_FIELD = "status" as const;
export const PUBLISH_STATUS_VALUE = "publish" as const;
export const REQUIRED_FRONTMATTER_FIELDS = ["title", "date"] as const;

export type Frontmatter = Record<string, unknown>;

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function splitFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const parsed = parseYaml(match[1]);
    const frontmatter =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Frontmatter)
        : {};
    return { frontmatter, body: match[2] };
  } catch (error) {
    console.error("Failed to parse frontmatter:", error);
    return { frontmatter: {}, body: match[2] };
  }
}

export function hasPublishFlag(frontmatter: Frontmatter): boolean {
  return frontmatter[PUBLISH_STATUS_FIELD] === PUBLISH_STATUS_VALUE;
}

export function validateFrontmatter(frontmatter: Frontmatter): string | null {
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    const value = frontmatter[field];
    if (value === undefined || value === null || value === "") {
      return `Missing required frontmatter field: ${field}`;
    }
  }
  return null;
}
