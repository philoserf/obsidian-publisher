import { stringifyYaml } from "obsidian";
import type { Frontmatter } from "./schema";
import { sanitizeFilename, sanitizeSlug, slugify, vaultBasename } from "./slug";
import {
  errorMessage,
  type ProcessedContent,
  type PublisherSettings,
} from "./types";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;

/**
 * A span of the note body.
 *
 * - `prose` is rewritten by the transform chain.
 * - `code` is opaque to it — a fence or an inline span. A fence carries
 *   the `info` string the scanner already parsed, so `convertMermaid`
 *   reads it instead of re-matching a narrower fence syntax (#306). A
 *   span has none, which is how the two are told apart.
 * - `comment` is a `%% ... %%` run. It is a *kind* rather than a deletion
 *   so the split stays lossless; assembly and image collection drop it.
 * - `quote` is a contiguous run of `>`-prefixed lines, interior
 *   deliberately unscanned. It is a block container: the callout pass
 *   strips the markers and re-scans the body, which is what lets a fence
 *   or a comment nest inside one (#303).
 */
type Segment = {
  kind: "prose" | "code" | "comment" | "quote";
  text: string;
  info?: string;
};

/** Opening fence: optional indent, 3+ backticks or tildes, optional info
 * string. Captured so the closing fence can be required to match the same
 * character and be at least as long, per CommonMark. */
const FENCE_OPEN = /^([ \t]*)(`{3,}|~{3,})([^\n]*)$/;

/** A blockquote line, which is also how Obsidian writes a callout. The
 * marker needs no trailing space: a bare `>` is Obsidian's own paragraph
 * separator inside a callout (#299). */
const QUOTE_LINE = /^[ \t]*>/;

/**
 * Split a body into segments, resolving every opaque-region delimiter in
 * one left-to-right pass by earliest start position.
 *
 * The competitors are a fence opener at line start, a blockquote run at
 * line start, an inline backtick run, and `%%`. One competition is
 * load-bearing and splitting it would be wrong in both directions:
 *
 * - `%%` must compete with fences, or a comment wrapping a fenced block
 *   is never paired and publishes verbatim (#300).
 * - `%%` must equally compete with backtick spans, or ``before `%%` after``
 *   regresses — the span opens first, so the `%%` stays literal, which is
 *   what Obsidian does.
 * - A `%%` inside a fence is not a delimiter at all, because the fence
 *   was consumed when the scan reached its opening line. `note-transformer
 *   .test.ts` pins this through Mermaid's own `%%` comment syntax.
 *
 * Splitting is lossless: concatenating every segment's text reproduces the
 * input exactly. That is what lets `comment` be a segment rather than a
 * deletion, and the suite asserts it across every kind.
 */
export function splitCodeSegments(body: string): Segment[] {
  const segments: Segment[] = [];
  let proseStart = 0;
  let pos = 0;

  const flushProse = (end: number) => {
    if (end > proseStart) {
      segments.push({ kind: "prose", text: body.slice(proseStart, end) });
    }
  };

  const lineEndAt = (from: number) => {
    const nl = body.indexOf("\n", from);
    return nl === -1 ? body.length : nl + 1;
  };

  while (pos < body.length) {
    const atLineStart = pos === 0 || body[pos - 1] === "\n";

    if (atLineStart) {
      const lineEnd = lineEndAt(pos);
      const line = body.slice(pos, lineEnd).replace(/\r?\n$/, "");

      const open = line.match(FENCE_OPEN);
      if (open) {
        const marker = open[2];
        // CommonMark: the closing fence uses the same character, is at
        // least as long, and carries nothing but whitespace.
        const closer = new RegExp(
          `^[ \\t]*\\${marker[0]}{${marker.length},}[ \\t]*$`,
        );
        let cursor = lineEnd;
        while (cursor < body.length) {
          const nextEnd = lineEndAt(cursor);
          if (closer.test(body.slice(cursor, nextEnd).replace(/\r?\n$/, ""))) {
            cursor = nextEnd;
            break;
          }
          cursor = nextEnd;
        }
        flushProse(pos);
        segments.push({
          kind: "code",
          text: body.slice(pos, cursor),
          info: open[3],
        });
        proseStart = cursor;
        pos = cursor;
        continue;
      }

      if (QUOTE_LINE.test(line)) {
        let cursor = lineEnd;
        while (cursor < body.length) {
          const nextEnd = lineEndAt(cursor);
          if (
            !QUOTE_LINE.test(body.slice(cursor, nextEnd).replace(/\r?\n$/, ""))
          )
            break;
          cursor = nextEnd;
        }
        flushProse(pos);
        segments.push({ kind: "quote", text: body.slice(pos, cursor) });
        proseStart = cursor;
        pos = cursor;
        continue;
      }
    }

    if (body[pos] === "`") {
      const span = matchSpan(body, pos);
      if (span !== null) {
        flushProse(pos);
        segments.push({ kind: "code", text: body.slice(pos, span) });
        proseStart = span;
        pos = span;
        continue;
      }
    }

    if (body.startsWith("%%", pos)) {
      const close = body.indexOf("%%", pos + 2);
      if (close !== -1) {
        const end = close + 2;
        flushProse(pos);
        segments.push({ kind: "comment", text: body.slice(pos, end) });
        proseStart = end;
        pos = end;
        continue;
      }
    }

    pos++;
  }

  flushProse(body.length);
  return segments;
}

/**
 * End offset of an inline code span opening at `start`, or null.
 *
 * The closing run must be the same length as the opening one, so
 * ``a ` b`` works. The span may not cross a blank line: CommonMark matches
 * a span within a paragraph, and admitting `\n\s*\n` let two unmatched
 * backticks in different paragraphs pair up and exempt everything between
 * them from the transform chain — comments included (#305).
 */
function matchSpan(text: string, start: number): number | null {
  let runEnd = start;
  while (text[runEnd] === "`") runEnd++;
  const runLength = runEnd - start;

  const blank = /\n[ \t]*\n/g;
  blank.lastIndex = start;
  const blankAt = blank.exec(text);
  const limit = blankAt ? blankAt.index : text.length;

  let cursor = runEnd;
  while (cursor < limit) {
    if (text[cursor] !== "`") {
      cursor++;
      continue;
    }
    let closeEnd = cursor;
    while (text[closeEnd] === "`") closeEnd++;
    if (closeEnd - cursor === runLength && closeEnd <= limit) return closeEnd;
    cursor = closeEnd;
  }
  return null;
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

    // One pass over the segments. Each carries its own text, so there is
    // no second array to re-pair by index (#310) and no synthetic joined
    // string to collect images from.
    //
    // Code is opaque to the transform chain. Mermaid is the exception: it
    // owns mermaid fences, so it runs over code segments while every other
    // transform sees prose. A comment contributes nothing — not to the
    // output and not to the image set — which is what makes a reference
    // hidden inside `%% %%` never queued for upload.
    const images: string[] = [];
    const processedBody = this.transformBody(body, publishSet, images);

    const processedContent = this.assembleDocument(
      processedFrontmatter,
      processedBody,
    );
    const sanitizedFilename = sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
    };
  }

  /**
   * Scan a body into segments and transform each one.
   *
   * Called recursively: a quote block strips its markers and re-enters
   * here, which is what makes it a container rather than a leaf. Without
   * the recursion the scanner emits quote/fence/quote and the callout is
   * fragmented again, which is the case #303 proved a local fix cannot
   * reach.
   *
   * Images are collected per level from prose only, before any transform
   * rewrites the `![[...]]` syntax out of existence. A quote's images are
   * collected by its own recursion, and a comment's are never collected
   * at all.
   */
  private transformBody(
    body: string,
    publishSet: Set<string>,
    images: string[],
  ): string {
    const segments = splitCodeSegments(body);

    for (const seg of segments) {
      if (seg.kind === "prose") images.push(...this.extractImages(seg.text));
    }

    return segments
      .map((seg) => {
        if (seg.kind === "comment") return "";
        if (seg.kind === "code") return this.convertMermaid(seg);
        if (seg.kind === "quote")
          return this.transformQuote(seg.text, publishSet, images);
        return this.transformProse(seg.text, publishSet);
      })
      .join("");
  }

  /**
   * Transform one blockquote run: strip the markers, re-scan the body,
   * then emit either a callout shortcode or the blockquote again.
   *
   * Stripping with `^[ \t]*> ?` — the space optional — is what admits
   * Obsidian's bare `>` paragraph separator. The old body regex required
   * `> ` and so ended the callout at that line, publishing the remainder
   * as a raw blockquote welded to the closing shortcode (#299). The
   * author's own `cleanBody` already used the optional-space form; only
   * the matching regex disagreed, three lines apart.
   *
   * The callout header is recognized on the first line only, which is
   * where Obsidian requires it. The old `gm` regex could match one
   * mid-block.
   */
  private transformQuote(
    text: string,
    publishSet: Set<string>,
    images: string[],
  ): string {
    const trailingNewline = text.endsWith("\n") ? "\n" : "";
    const lines = text.replace(/\n$/, "").split("\n");
    const stripped = lines.map((line) => line.replace(/^[ \t]*> ?/, ""));

    // `\r?$` so a CRLF note's title does not carry its carriage return
    // into the shortcode attribute.
    const header = stripped[0].match(/^\[!([\w-]+)\][-+]?(?: (.+))?\r?$/);

    if (!header) {
      const inner = this.transformBody(stripped.join("\n"), publishSet, images);
      return (
        inner
          .split("\n")
          .map((line) => (line === "" ? ">" : `> ${line}`))
          .join("\n") + trailingNewline
      );
    }

    const name = this.settings.calloutShortcodeName;
    const calloutType = header[1].toLowerCase();
    const title = header[2];
    const titleAttr = title
      ? ` "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : "";
    const inner = this.transformBody(
      stripped.slice(1).join("\n"),
      publishSet,
      images,
    );
    return `{{< ${name} ${calloutType}${titleAttr} >}}\n${inner.trim()}\n{{< /${name} >}}${trailingNewline}`;
  }

  /** The prose transform chain, in the order the transforms depend on. */
  private transformProse(text: string, publishSet: Set<string>): string {
    let out = this.convertHighlights(text);
    out = this.convertEmbeds(out, publishSet);
    out = this.convertWikilinks(out, publishSet);
    return out;
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
      const slug = sanitizeSlug(trimmed);
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

  /**
   * Convert mermaid fenced code blocks to mermaid shortcodes
   */
  /**
   * Rewrite a mermaid fence to its shortcode.
   *
   * Takes the segment rather than its text so it can read the `info`
   * string the scanner already parsed. Re-matching the fence with a
   * second, stricter pattern is what made tilde fences, four-backtick
   * fences and any info string beyond the bare language publish raw
   * (#306) — and an inline span, which has no `info`, is never a fence.
   */
  private convertMermaid(segment: Segment): string {
    if (segment.info === undefined) return segment.text;
    if (segment.info.trim().split(/\s+/)[0] !== "mermaid") return segment.text;

    const name = this.settings.mermaidShortcodeName;
    const lines = segment.text.split("\n");
    // Drop the opening fence line, and the closing one when it is present
    // — an unterminated fence runs to the end of the note.
    const body = lines.slice(1, lines[lines.length - 1] === "" ? -2 : -1);
    return `{{< ${name} >}}\n${body.join("\n").trimEnd()}\n{{< /${name} >}}`;
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
          return `[${displayText || heading}](#${slugify(heading)})`;
        }
        const display = displayText || (heading ? `${page}#${heading}` : page);
        // The lookup drops the directory; the display text above keeps it,
        // because an unresolved link should degrade to what the author
        // wrote — which is what Obsidian shows too.
        const slug = sanitizeSlug(vaultBasename(page));
        if (!publishSet.has(slug)) return display;
        const fragment = heading ? `#${slugify(heading)}` : "";
        return `[${display}](${urlPath}${slug}/${fragment})`;
      },
    );
  }

  /**
   * Convert an embed, `![[...]]`, to the markdown it becomes.
   *
   * Obsidian's embed syntax has one form, so this is one pass with one
   * classification: an image extension makes it an image reference, and
   * anything else is a note embed, converted to a link when its slug is in
   * the publish set and degraded to plain display text when it is not.
   *
   * This used to be two methods, each a full pass that matched every embed
   * and returned half of them verbatim. That forced them to agree about
   * classification forever, with the dependency recorded only in two
   * comments pointing at each other — and made the second one's image
   * guard unreachable, since the first had already consumed every image
   * embed (#301).
   */
  private convertEmbeds(content: string, publishSet: Set<string>): string {
    const imageUrl = this.imageUrlPath();
    const postsUrl = this.postsUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw: string) => {
      // One front end for both arms: `name` is the text before the first
      // pipe, which is the image filename and equally the note target.
      const { name, alt } = this.parseImageSuffix(raw);

      if (IMAGE_EXTENSIONS.test(name)) {
        const fileName = vaultBasename(name);
        const normalizedAlt = alt?.trim();
        // Alt falls back to the file's name, not the path the author
        // happened to write it with — `![[pic.png]]` and
        // `![[folder/pic.png]]` name one image and should render alike.
        const altText = normalizedAlt ? normalizedAlt : fileName;
        return `![${altText}](${imageUrl}${sanitizeFilename(fileName)})`;
      }

      // For note embeds the pipe is display text: ![[Note|Display]]. That
      // is not `alt` — parseImageSuffix joins everything after the first
      // pipe, which is right for an image caption and wrong here.
      //
      // The target may still carry an anchor (![[Note#Heading]]), which has
      // to come off before the slug lookup — sanitizeSlug drops the `#` and
      // runs the heading into the name, so "Note#Heading" slugified to
      // "noteheading", never matched the publish set, and every anchored
      // embed degraded to plain text.
      const displayText = raw.split("|")[1];
      const hash = name.indexOf("#");
      const page = hash === -1 ? name : name.slice(0, hash);
      const heading = hash === -1 ? "" : name.slice(hash + 1);
      const display = displayText ?? name;
      const slug = sanitizeSlug(vaultBasename(page));
      if (!publishSet.has(slug)) return display;
      const fragment = heading ? `#${slugify(heading)}` : "";
      return `[${display}](${postsUrl}${slug}/${fragment})`;
    });
  }
}
