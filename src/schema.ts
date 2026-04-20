import { parseYaml } from "obsidian";

export const PUBLISH_STATUS_FIELD = "status" as const;
export const PUBLISH_STATUS_VALUE = "publish" as const;
export const REQUIRED_FRONTMATTER_FIELDS = ["title", "date"] as const;

export type Frontmatter = Record<string, unknown>;

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function splitFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
  /** Set when the frontmatter block existed but YAML parsing failed; distinguishes malformed YAML from a missing block or validation failure. */
  error?: string;
} {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const parsed = parseYaml(match[1]);
    const frontmatter =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Frontmatter)
        : {};
    return { frontmatter, body: match[2] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      frontmatter: {},
      body: match[2],
      error: `Malformed frontmatter YAML: ${message}`,
    };
  }
}

export function hasPublishFlag(frontmatter: Frontmatter): boolean {
  return frontmatter[PUBLISH_STATUS_FIELD] === PUBLISH_STATUS_VALUE;
}

type RequiredField = (typeof REQUIRED_FRONTMATTER_FIELDS)[number];

function validateField(value: unknown, field: RequiredField): string | null {
  if (value === undefined || value === null) return `${field} is missing`;
  if (typeof value === "string") {
    return value.trim() === "" ? `${field} is missing` : null;
  }
  if (field === "date" && value instanceof Date) return null;
  const expected = field === "date" ? "string or date" : "string";
  return `${field} must be a ${expected}`;
}

export function validateFrontmatter(frontmatter: Frontmatter): string | null {
  const issues: string[] = [];
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    const issue = validateField(frontmatter[field], field);
    if (issue) issues.push(issue);
  }
  return issues.length === 0
    ? null
    : `Invalid frontmatter: ${issues.join("; ")}`;
}
