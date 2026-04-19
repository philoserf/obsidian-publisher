import { stringifyYaml } from "obsidian";
import { type Frontmatter, splitFrontmatter } from "./schema";
import type { ProcessedContent, PublisherSettings } from "./types";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;

export class ContentProcessor {
  private settings: PublisherSettings;

  constructor(settings: PublisherSettings) {
    this.settings = settings;
  }

  /**
   * Process a markdown file for Hugo publishing.
   * `publishSet` contains slugs of notes being published in this run;
   * wikilinks targeting slugs outside the set degrade to plain text.
   */
  process(
    content: string,
    originalFilename: string,
    publishSet: Set<string> = new Set(),
  ): ProcessedContent {
    const { frontmatter, body } = splitFrontmatter(content);
    return this.processFromSplit(
      frontmatter,
      body,
      originalFilename,
      publishSet,
    );
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
    const images = this.extractImages(body);

    let processedBody = body;
    processedBody = this.stripComments(processedBody);
    processedBody = this.convertHighlights(processedBody);
    processedBody = this.convertCallouts(processedBody);
    processedBody = this.convertMermaid(processedBody);
    processedBody = this.convertImageReferences(processedBody);
    processedBody = this.convertNoteEmbeds(processedBody, publishSet);
    processedBody = this.convertWikilinks(processedBody, publishSet);

    const processedContent = this.assembleFrontmatter(
      processedFrontmatter,
      processedBody,
    );
    const sanitizedFilename = this.sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
      frontmatter: processedFrontmatter,
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

    return processed;
  }

  /**
   * Reassemble frontmatter and body
   */
  private assembleFrontmatter(
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
      console.error("Failed to stringify frontmatter:", error);
      return body;
    }
  }

  /**
   * Derive the URL path for images from the imageDir setting.
   * Strips "static/" prefix since Hugo serves static/ at the root.
   */
  private imageUrlPath(): string {
    return `/${this.settings.imageDir.replace(/^static\/?/, "")}`;
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
    return content.replace(
      /^> \[!([\w-]+)\][-+]?(?: (.+))?\n((?:^> .*(?:\n|$))*)/gm,
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
   * Strip Obsidian sizing suffix (|300 or |300x200) from an embed name
   */
  private stripImageSize(name: string): string {
    return name.split("|")[0];
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
      const name = this.stripImageSize(match[1]);
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
   * Handles: [[Page]], [[Page|Display]], [[Page#Heading]], [[Page#Heading|Display]]
   */
  private convertWikilinks(content: string, publishSet: Set<string>): string {
    const urlPath = this.postsUrlPath();
    return content.replace(
      /\[\[([^\]|#]+)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (_match, page, _hashGroup, heading, _pipeGroup, displayText) => {
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
      const nameForCheck = this.stripImageSize(raw);
      if (IMAGE_EXTENSIONS.test(nameForCheck)) {
        return _match; // leave for convertImageReferences (already processed)
      }
      // For note embeds, pipe is display text: ![[Note|Display]]
      const [name, displayText] = raw.split("|");
      const display = displayText ?? name;
      const slug = this.sanitizeSlug(name);
      if (!publishSet.has(slug)) return display;
      return `[${display}](${urlPath}${slug}/)`;
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
      return `![${altText}](${urlPath}/${sanitizedName})`;
    });
  }

  /**
   * Core sanitization: lowercase, spaces→hyphens, strip special chars,
   * collapse hyphens, trim edges, fallback to "untitled".
   */
  private sanitizeName(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "") || "untitled"
    );
  }

  /**
   * Sanitize a page name into a slug (no extension).
   * Public so the Publisher can compute slugs when building its publish set.
   */
  sanitizeSlug(page: string): string {
    return this.sanitizeName(page);
  }

  /**
   * Slugify a heading to match Hugo's default goldmark anchor ID generation:
   * lowercase, strip punctuation, spaces -> hyphens, collapse and trim hyphens.
   */
  private slugifyHeading(heading: string): string {
    return heading
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
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
    const extension = filename.slice(lastDotIndex);
    return name + extension;
  }

  /**
   * Sanitize an image filename (preserves extension)
   */
  sanitizeImageName(imageName: string): string {
    return this.sanitizeFilename(imageName);
  }
}
