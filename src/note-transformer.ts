import { stringifyYaml } from "obsidian";
import type { Frontmatter } from "./schema";
import {
  errorMessage,
  type ProcessedContent,
  type PublisherSettings,
} from "./types";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;

/** A span of the note body. Prose is rewritten by the transform chain;
 * code is opaque to it. */
type Segment = { kind: "prose" | "code"; text: string };

/** Opening fence: optional indent, 3+ backticks or tildes, optional info
 * string. Captured so the closing fence can be required to match the same
 * character and be at least as long, per CommonMark. */
const FENCE_OPEN = /^([ \t]*)(`{3,}|~{3,})([^\n]*)$/;

/**
 * Split a body into prose and code segments.
 *
 * Everything the transform chain does is unsafe inside code: `==` is the
 * equality operator in most languages, and `stripComments`,
 * `convertImageReferences`, `convertNoteEmbeds` and `convertWikilinks` all
 * use character classes that admit newlines, so a match can begin inside a
 * fence and end in prose — taking the closing fence with it.
 *
 * Fenced blocks are matched line-wise so an unterminated fence runs to the
 * end of the note rather than swallowing a later delimiter. Inline spans
 * are matched within prose lines only, and require the same backtick run
 * length to open and close.
 */
export function splitCodeSegments(body: string): Segment[] {
  const segments: Segment[] = [];
  const lines = body.split("\n");

  // Start offset of each line within `body`. Slicing by offset rather than
  // rejoining lines is what makes the split lossless: concatenating every
  // segment's text reproduces the input exactly, newlines included.
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }

  let proseStart = 0;
  const pushProse = (end: number) => {
    if (end > proseStart) {
      segments.push(...splitInlineCode(body.slice(proseStart, end)));
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE_OPEN);
    if (!open) continue;

    pushProse(starts[i]);

    const marker = open[2];
    // CommonMark: the closing fence uses the same character, is at least as
    // long, and carries nothing but whitespace.
    const closer = new RegExp(
      `^[ \\t]*\\${marker[0]}{${marker.length},}[ \\t]*$`,
    );
    let close = i + 1;
    while (close < lines.length && !closer.test(lines[close])) close++;

    // An unterminated fence runs to the end of the note rather than
    // swallowing some later delimiter.
    const lastLine = close < lines.length ? close : lines.length - 1;
    const end =
      lastLine < lines.length - 1 ? starts[lastLine + 1] : body.length;

    segments.push({ kind: "code", text: body.slice(starts[i], end) });
    proseStart = end;
    i = lastLine;
  }

  pushProse(body.length);
  return segments;
}

/** Split one prose run on inline code spans, requiring the opening and
 * closing backtick runs to be the same length so ``a ` b`` works. */
function splitInlineCode(text: string): Segment[] {
  const segments: Segment[] = [];
  const span = /(`+)(?!`)([\s\S]*?[^`]|)\1(?!`)/g;
  let last = 0;
  let m = span.exec(text);
  while (m !== null) {
    if (m.index > last) {
      segments.push({ kind: "prose", text: text.slice(last, m.index) });
    }
    segments.push({ kind: "code", text: m[0] });
    last = m.index + m[0].length;
    m = span.exec(text);
  }
  if (last < text.length) {
    segments.push({ kind: "prose", text: text.slice(last) });
  }
  return segments;
}

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
 */
function slugify(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class NoteTransformer {
  private settings: PublisherSettings;

  constructor(settings: PublisherSettings) {
    this.settings = settings;
  }

  /**
   * Process pre-split frontmatter and body. Callers that have already
   * parsed the content should use this to avoid a redundant parse.
   */
  processFromSplit(
    frontmatter: Frontmatter,
    body: string,
    originalFilename: string,
    publishSet: Set<string> = new Set(),
  ): ProcessedContent {
    const processedFrontmatter = this.processFrontmatter(frontmatter);

    // Code is opaque to the transform chain. Mermaid is the exception: it
    // owns ```mermaid fences, so it runs over code segments while every
    // other transform sees prose only.
    const segments = splitCodeSegments(body);
    const prose = segments
      .filter((seg) => seg.kind === "prose")
      .map((seg) => this.stripComments(seg.text));

    // Images are collected from comment-stripped prose, so a reference
    // that only exists inside %% %% or inside a fence is never queued for
    // upload. Must run before convertImageReferences, which rewrites the
    // ![[...]] syntax out of existence.
    const images = this.extractImages(prose.join("\n"));

    let proseIndex = 0;
    const processedBody = segments
      .map((seg) => {
        if (seg.kind === "code") return this.convertMermaid(seg.text);
        let text = prose[proseIndex++];
        text = this.convertHighlights(text);
        text = this.convertCallouts(text);
        text = this.convertImageReferences(text);
        text = this.convertNoteEmbeds(text, publishSet);
        text = this.convertWikilinks(text, publishSet);
        return text;
      })
      .join("");

    const processedContent = this.assembleDocument(
      processedFrontmatter,
      processedBody,
    );
    const sanitizedFilename = this.sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
    };
  }

  /**
   * Process frontmatter for Hugo
   */
  private processFrontmatter(
    frontmatter: Record<string, unknown>,
  ): Record<string, unknown> {
    const processed = { ...frontmatter };

    // Strip configured fields
    for (const field of this.settings.strippedFrontmatterFields) {
      delete processed[field];
    }

    // Add template fields
    for (const [key, value] of Object.entries(
      this.settings.frontmatterTemplate,
    )) {
      // Don't override existing fields
      if (!(key in processed)) {
        processed[key] = value;
      }
    }

    if ("aliases" in processed) {
      processed.aliases = this.urlizeAliases(processed.aliases);
    }

    return processed;
  }

  /**
   * Turn alias values into the URLs the posts actually had.
   *
   * Hugo emits a redirect stub at whatever path an alias names, verbatim.
   * Aliases here are previous note titles, so an alias of "DNA as Remix
   * Culture" produced a stub at /posts/DNA as Remix Culture/ while the URL
   * the post really used — /posts/dna-as-remix-culture/ — was left dead.
   *
   * sanitizeSlug and postsUrlPath are reused deliberately: they are what
   * generated those URLs in the first place, so reusing them is what makes
   * the redirect land. Values that already name a path are left alone.
   */
  private urlizeAliases(value: unknown): unknown {
    const urlize = (entry: unknown): unknown => {
      if (typeof entry !== "string") return entry;
      const trimmed = entry.trim();
      // Already a path (e.g. "/antifa/") — the author means it literally.
      // Checked before slugifying, since sanitizeSlug strips "/".
      if (trimmed.startsWith("/")) return entry;
      const slug = this.sanitizeSlug(trimmed);
      if (!slug || slug === "untitled") return entry;
      return `${this.postsUrlPath()}${slug}/`;
    };

    return Array.isArray(value) ? value.map(urlize) : urlize(value);
  }

  /**
   * Reassemble the full document: frontmatter block plus body.
   */
  private assembleDocument(
    frontmatter: Record<string, unknown>,
    body: string,
  ): string {
    if (Object.keys(frontmatter).length === 0) {
      return body;
    }

    try {
      const yaml = stringifyYaml(frontmatter);
      return `---\n${yaml}---\n${body}`;
    } catch (error) {
      // Publishing a body without its frontmatter block would corrupt
      // the Hugo page while reporting success; fail the file instead.
      throw new Error(
        `Failed to serialize frontmatter: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Derive the URL path for images from the imageDir setting.
   * Strips leading "static/" since Hugo serves static/ at the root, so
   * "static/images" -> "/images/", "static" -> "/", "assets/img" ->
   * "/assets/img/". Normalizes edge slashes first so "static/images/",
   * "/static/images", and bare "images" all produce "/images/". The
   * boundary regex preserves directories that merely start with
   * "static" but are not "static" or "static/*" (e.g. "static-assets",
   * "staticfiles/img").
   */
  private imageUrlPath(): string {
    const dir = this.settings.imageDir
      .replace(/^\/+|\/+$/g, "")
      .replace(/^static(?:\/|$)/, "");
    return dir ? `/${dir}/` : "/";
  }

  /**
   * Derive the URL prefix for wikilinks from the contentDir setting.
   * Strips leading "content/" so "content/posts" -> "/posts/",
   * "content" -> "/", "content/blog" -> "/blog/". Normalizes edge
   * slashes first so "content/posts/", "/content/posts", and bare
   * "posts" all produce "/posts/".
   */
  private postsUrlPath(): string {
    const dir = this.settings.contentDir
      .replace(/^\/+|\/+$/g, "")
      .replace(/^content(?:\/|$)/, "");
    return dir ? `/${dir}/` : "/";
  }

  /**
   * Strip Obsidian comments (%%...%%) including multiline
   */
  private stripComments(content: string): string {
    return content.replace(/%%[\s\S]*?%%/g, "");
  }

  /**
   * Convert Obsidian highlight syntax (==text==) to HTML mark tags
   */
  private convertHighlights(content: string): string {
    return content.replace(/==((?!=).+?)==/g, "<mark>$1</mark>");
  }

  /**
   * Convert Obsidian callouts to configured shortcode tags, passing the
   * Obsidian type through verbatim (lowercased). The site-side shortcode
   * template handles per-type styling (shipped in hugo-shortcodes/).
   */
  private convertCallouts(content: string): string {
    const name = this.settings.calloutShortcodeName;
    // `\r?\n` in both places, matching FRONTMATTER_REGEX. JS counts `\r`
    // as a line terminator, so `.` never crosses it: with a bare `\n` the
    // header alternative could not match a CRLF note at all, and the body
    // repeat stopped after its first line. Callouts in a CRLF note
    // published as raw `> [!note]` blockquotes.
    return content.replace(
      /^> \[!([\w-]+)\][-+]?(?: (.+))?\r?\n((?:^> .*(?:\r?\n|$))*)/gm,
      (_match, type: string, title: string | undefined, body: string) => {
        const calloutType = type.toLowerCase();
        const cleanBody = body.replace(/^> ?/gm, "").trim();
        const titleAttr = title
          ? ` "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
          : "";
        return `{{< ${name} ${calloutType}${titleAttr} >}}\n${cleanBody}\n{{< /${name} >}}`;
      },
    );
  }

  /**
   * Convert mermaid fenced code blocks to mermaid shortcodes
   */
  private convertMermaid(content: string): string {
    const name = this.settings.mermaidShortcodeName;
    return content.replace(
      /```mermaid\n([\s\S]*?)```/g,
      (_match, body: string) =>
        `{{< ${name} >}}\n${body.trimEnd()}\n{{< /${name} >}}`,
    );
  }

  /**
   * Parse Obsidian's `|alt|size` or `|alt` or `|size` embed suffix.
   * Returns the display alt (or undefined if only a bare size was given).
   */
  private parseImageSuffix(raw: string): { name: string; alt?: string } {
    const parts = raw.split("|");
    const name = parts[0];
    if (parts.length === 1) return { name };

    const SIZE = /^\d+(x\d+)?$/;
    const rest = parts.slice(1);
    // Drop trailing bare-size segments (tolerate incidental whitespace)
    while (rest.length > 0 && SIZE.test(rest[rest.length - 1].trim())) {
      rest.pop();
    }
    if (rest.length === 0) return { name };
    return { name, alt: rest.join("|") };
  }

  /**
   * Extract image references from content (only actual images, not note embeds)
   */
  private extractImages(content: string): string[] {
    const embedRegex = /!\[\[([^\]]+)\]\]/g;
    const images: string[] = [];

    let match = embedRegex.exec(content);
    while (match !== null) {
      const name = this.parseImageSuffix(match[1]).name;
      if (IMAGE_EXTENSIONS.test(name)) {
        images.push(name);
      }
      match = embedRegex.exec(content);
    }

    return images;
  }

  /**
   * Convert Obsidian wikilinks to markdown links when the target slug is
   * in the publish set; otherwise degrade to plain display text.
   * Handles: [[Page]], [[Page|Display]], [[Page#Heading]], [[Page#Heading|Display]],
   * and the same-page forms [[#Heading]], [[#Heading|Display]].
   */
  private convertWikilinks(content: string, publishSet: Set<string>): string {
    const urlPath = this.postsUrlPath();
    return content.replace(
      /\[\[([^\]|#]*)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (match, page, _hashGroup, heading, _pipeGroup, displayText) => {
        // The page part is optional so [[#Heading]] matches, but an empty
        // page with no heading is not a link at all ([[]], [[|x]]) — leave
        // it verbatim rather than emitting a link to nowhere.
        if (!page) {
          if (!heading) return match;
          // A same-page anchor is always valid: it needs no publish-set
          // lookup, because the target is this very document.
          return `[${displayText || heading}](#${this.slugifyHeading(heading)})`;
        }
        const display = displayText || (heading ? `${page}#${heading}` : page);
        const slug = this.sanitizeSlug(page);
        if (!publishSet.has(slug)) return display;
        const fragment = heading ? `#${this.slugifyHeading(heading)}` : "";
        return `[${display}](${urlPath}${slug}/${fragment})`;
      },
    );
  }

  /**
   * Convert note embeds (![[Note Name]]) to markdown links when the
   * target slug is in the publish set; otherwise degrade to plain
   * display text. Image embeds are left alone for convertImageReferences.
   */
  private convertNoteEmbeds(content: string, publishSet: Set<string>): string {
    const urlPath = this.postsUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const nameForCheck = this.parseImageSuffix(raw).name;
      if (IMAGE_EXTENSIONS.test(nameForCheck)) {
        return _match; // leave for convertImageReferences (already processed)
      }
      // For note embeds, pipe is display text: ![[Note|Display]]. The
      // target may still carry an anchor (![[Note#Heading]]), which has to
      // come off before the slug lookup — sanitizeSlug drops the `#` and
      // runs the heading into the name, so "Note#Heading" slugified to
      // "noteheading", never matched the publish set, and every anchored
      // embed degraded to plain text.
      const [target, displayText] = raw.split("|");
      const hash = target.indexOf("#");
      const name = hash === -1 ? target : target.slice(0, hash);
      const heading = hash === -1 ? "" : target.slice(hash + 1);
      const display = displayText ?? target;
      const slug = this.sanitizeSlug(name);
      if (!publishSet.has(slug)) return display;
      const fragment = heading ? `#${this.slugifyHeading(heading)}` : "";
      return `[${display}](${urlPath}${slug}/${fragment})`;
    });
  }

  /**
   * Convert Obsidian image references to Hugo-compatible markdown.
   * Derives the URL path from the imageDir setting.
   */
  private convertImageReferences(content: string): string {
    const urlPath = this.imageUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const { name, alt } = this.parseImageSuffix(raw);
      if (!IMAGE_EXTENSIONS.test(name)) {
        return _match; // not an image — leave for convertNoteEmbeds
      }
      const sanitizedName = this.sanitizeFilename(name);
      const normalizedAlt = alt?.trim();
      const altText = normalizedAlt ? normalizedAlt : name;
      return `![${altText}](${urlPath}${sanitizedName})`;
    });
  }

  /**
   * Core sanitization: the shared slug rule, plus the "untitled" fallback
   * a name needs and an anchor does not — an empty anchor is simply no
   * anchor, but an empty filename is not a file.
   */
  private sanitizeName(value: string): string {
    return slugify(value) || "untitled";
  }

  /**
   * Sanitize a page name into a slug (no extension).
   * Public so the Publisher can compute slugs when building its publish set.
   */
  sanitizeSlug(page: string): string {
    return this.sanitizeName(page);
  }

  /**
   * Slugify a heading into the anchor Hugo will have generated for it.
   * Same rule as a page slug — see slugify — but with no "untitled"
   * fallback, because an anchor that slugifies to nothing is no anchor.
   */
  private slugifyHeading(heading: string): string {
    return slugify(heading);
  }

  /**
   * Sanitize filename for Hugo URLs (preserves extension)
   */
  sanitizeFilename(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

    if (!hasExtension) {
      return this.sanitizeName(filename);
    }

    const name = this.sanitizeName(filename.slice(0, lastDotIndex));
    // Lowercased with the name: leaving it alone made photo.PNG and
    // photo.png distinct target paths, so Publisher.resolveImages saw no
    // collision and committed both — which then collide on checkout on any
    // case-insensitive filesystem.
    const extension = filename.slice(lastDotIndex).toLowerCase();
    return name + extension;
  }
}
