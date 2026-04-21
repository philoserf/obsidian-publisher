import { REQUIRED_FRONTMATTER_FIELDS } from "./schema";
import { DEFAULT_SETTINGS, type PublisherSettings } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Resolve strippedFrontmatterFields from persisted data. Accepts the
 * current field; falls back to the legacy removePublishFlag boolean for
 * migration; otherwise returns the default list.
 */
function resolveStrippedFields(d: Record<string, unknown>): string[] {
  if (isStringArray(d.strippedFrontmatterFields)) {
    return filterRequiredFields(d.strippedFrontmatterFields);
  }
  const defaults = [...DEFAULT_SETTINGS.strippedFrontmatterFields];
  if (d.removePublishFlag === false) {
    return filterRequiredFields(defaults.filter((f) => f !== "status"));
  }
  return filterRequiredFields(defaults);
}

function filterRequiredFields(fields: string[]): string[] {
  const required = new Set<string>(REQUIRED_FRONTMATTER_FIELDS);
  return fields.filter((f) => !required.has(f));
}

/**
 * Trim-and-filter persisted prLabels. Whitespace-only labels are dropped
 * (matching the settings UI input sanitizer); an empty result falls back
 * to DEFAULT_SETTINGS.prLabels, symmetric with baseBranch handling.
 */
function resolvePrLabels(value: unknown): string[] {
  if (!isStringArray(value)) return DEFAULT_SETTINGS.prLabels;
  const trimmed = value.map((l) => l.trim()).filter((l) => l.length > 0);
  return trimmed.length > 0 ? trimmed : DEFAULT_SETTINGS.prLabels;
}

/**
 * Validate persisted plugin data against the PublisherSettings shape.
 * Per-field fallback to DEFAULT_SETTINGS on type mismatch — a single
 * corrupted field shouldn't wipe the user's configuration.
 */
export function parseSettings(data: unknown): PublisherSettings {
  const d = isPlainObject(data) ? data : {};
  return {
    githubToken:
      typeof d.githubToken === "string"
        ? d.githubToken
        : DEFAULT_SETTINGS.githubToken,
    repoOwner:
      typeof d.repoOwner === "string"
        ? d.repoOwner
        : DEFAULT_SETTINGS.repoOwner,
    repoName:
      typeof d.repoName === "string" ? d.repoName : DEFAULT_SETTINGS.repoName,
    contentDir:
      typeof d.contentDir === "string"
        ? d.contentDir
        : DEFAULT_SETTINGS.contentDir,
    imageDir:
      typeof d.imageDir === "string" ? d.imageDir : DEFAULT_SETTINGS.imageDir,
    frontmatterTemplate: isPlainObject(d.frontmatterTemplate)
      ? d.frontmatterTemplate
      : DEFAULT_SETTINGS.frontmatterTemplate,
    strippedFrontmatterFields: resolveStrippedFields(d),
    baseBranch:
      typeof d.baseBranch === "string" && d.baseBranch.trim() !== ""
        ? d.baseBranch
        : DEFAULT_SETTINGS.baseBranch,
    prLabels: resolvePrLabels(d.prLabels),
    calloutShortcodeName:
      typeof d.calloutShortcodeName === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(d.calloutShortcodeName)
        ? d.calloutShortcodeName
        : DEFAULT_SETTINGS.calloutShortcodeName,
    mermaidShortcodeName:
      typeof d.mermaidShortcodeName === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(d.mermaidShortcodeName)
        ? d.mermaidShortcodeName
        : DEFAULT_SETTINGS.mermaidShortcodeName,
  };
}
