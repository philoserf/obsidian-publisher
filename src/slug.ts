/**
 * The one slug rule, shared by page slugs, filenames and heading anchors:
 * NFC-normalize, lowercase, strip everything that is not a Unicode letter,
 * digit, underscore, space or hyphen, then spaces to hyphens with runs
 * collapsed and edges trimmed.
 *
 * It matches Hugo's default goldmark anchor ID generation
 * (autoIDType: "github"). Page slugs used to run an ASCII-only variant
 * instead, so the two halves of a single link disagreed — `[[Café#Café]]`
 * pointed at /posts/caf/#café — and a title like "Rōnin…" published at a
 * visibly broken /posts/rnin-…/.
 *
 * NFC first so decomposed diacritics (`é` as `e + U+0301`) survive the
 * punctuation strip rather than losing the combining mark and silently
 * flattening to `e`.
 *
 * This module exists because the rule has three consumers and used to have
 * no owner: a page slug in a URL, a committed filename, and a heading
 * anchor. `Publisher.buildPublishSet` slugifies while
 * `detectFilenameCollisions` sanitizes filenames, so if the two ever
 * diverge a link resolves against a name that was never committed — and
 * the blast radius of changing the rule is renamed live files, which the
 * gateway has no delete path to clean up.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A page name as a slug: the shared rule plus the "untitled" fallback a
 * name needs and an anchor does not — an empty anchor is simply no anchor,
 * but an empty filename is not a file. A heading anchor therefore calls
 * `slugify` directly.
 */
export function sanitizeSlug(value: string): string {
  return slugify(value) || "untitled";
}

/** A filename as a slug, preserving the extension. */
export function sanitizeFilename(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

  if (!hasExtension) {
    return sanitizeSlug(filename);
  }

  const name = sanitizeSlug(filename.slice(0, lastDotIndex));
  // Lowercased with the name: leaving it alone made photo.PNG and
  // photo.png distinct target paths, so Publisher.resolveImages saw no
  // collision and committed both — which then collide on checkout on any
  // case-insensitive filesystem.
  const extension = filename.slice(lastDotIndex).toLowerCase();
  return name + extension;
}

/**
 * The name half of a vault reference, dropping the directory component:
 * `folder/pic.png` names the file `pic.png`.
 *
 * Obsidian writes a reference path-qualified when the bare basename would
 * be ambiguous, and unconditionally when the vault's "New link format" is
 * set to "Absolute path in vault" or "Relative path to file". The
 * directory is addressing — how to find the file — and the publish set,
 * the committed filename and the URL are all keyed on the name.
 *
 * Deliberately not folded into `slugify`: the slug rule strips `/` as
 * punctuation, so `folder/Note` slugified to `foldernote` and matched
 * nothing (#308). Stripping the directory *before* the rule is a
 * different operation from the rule itself, and an alias like `some/path`
 * still runs the plain rule.
 */
export function vaultBasename(reference: string): string {
  const slash = reference.lastIndexOf("/");
  return slash === -1 ? reference : reference.slice(slash + 1);
}
