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
   * Process a markdown file for Hugo publishing
   */
  process(content: string, originalFilename: string): ProcessedContent {
    const { frontmatter, body } = splitFrontmatter(content);
    return this.processFromSplit(frontmatter, body, originalFilename);
  }

  /**
   * Process pre-split frontmatter and body. Callers that have already
   * parsed the content should use this to avoid a redundant parse.
   */
  processFromSplit(
    frontmatter: Frontmatter,
    body: string,
    originalFilename: string,
  ): ProcessedContent {
    const processedFrontmatter = this.processFrontmatter(frontmatter);
    const images = this.extractImages(body);

    let processedBody = body;
    processedBody = this.stripComments(processedBody);
    processedBody = this.convertHighlights(processedBody);
    processedBody = this.convertCallouts(processedBody);
    processedBody = this.convertMermaid(processedBody);
    processedBody = this.convertImageReferences(processedBody);
    processedBody = this.convertNoteEmbeds(processedBody);
    processedBody = this.convertWikilinks(processedBody);

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

    // Remove status field if configured
    if (this.settings.removePublishFlag) {
      delete processed.status;
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

    // Ensure date field exists (Hugo requirement)
    if (!processed.date) {
      processed.date = new Date().toISOString();
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

  private static readonly CALLOUT_TYPE_MAP: Record<string, string> = {
    note: "note",
    abstract: "note",
    summary: "note",
    tldr: "note",
    info: "info",
    todo: "info",
    tip: "tip",
    hint: "tip",
    important: "tip",
    success: "tip",
    check: "tip",
    done: "tip",
    question: "question",
    help: "question",
    faq: "question",
    warning: "warning",
    caution: "warning",
    attention: "warning",
    failure: "error",
    fail: "error",
    missing: "error",
    danger: "error",
    error: "error",
    bug: "error",
    example: "example",
    quote: "note",
    cite: "note",
  };

  /**
   * Convert Obsidian callouts to hugo-coder notice shortcodes
   */
  private convertCallouts(content: string): string {
    return content.replace(
      /^> \[!([\w-]+)\][-+]?(?: (.+))?\n((?:^> .*(?:\n|$))*)/gm,
      (_match, type: string, title: string | undefined, body: string) => {
        const noticeType =
          ContentProcessor.CALLOUT_TYPE_MAP[type.toLowerCase()] ?? "note";
        const cleanBody = body.replace(/^> ?/gm, "").trim();
        const titleAttr = title ? ` "${title}"` : "";
        return `{{< notice ${noticeType}${titleAttr} >}}\n${cleanBody}\n{{< /notice >}}`;
      },
    );
  }

  /**
   * Convert mermaid fenced code blocks to hugo-coder mermaid shortcodes
   */
  private convertMermaid(content: string): string {
    return content.replace(
      /```mermaid\n([\s\S]*?)```/g,
      (_match, body: string) =>
        `{{< mermaid >}}\n${body.trimEnd()}\n{{< /mermaid >}}`,
    );
  }

  /**
   * Strip Obsidian sizing suffix (|300 or |300x200) from an embed name
   */
  private stripImageSize(name: string): string {
    return name.split("|")[0];
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
   * Convert Obsidian wikilinks to Hugo ref shortcodes
   * Handles: [[Page]], [[Page|Display]], [[Page#Heading]], [[Page#Heading|Display]]
   */
  private convertWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|#]+)(#([^\]|]+))?(\|([^\]]+))?\]\]/g,
      (_match, page, _hashGroup, heading, _pipeGroup, displayText) => {
        const display = displayText || (heading ? `${page}#${heading}` : page);
        const slug = this.sanitizeSlug(page);
        const fragment = heading
          ? `#${heading.toLowerCase().replace(/\s+/g, "-")}`
          : "";
        return `[${display}]({{< ref "${slug}${fragment}" >}})`;
      },
    );
  }

  /**
   * Convert note embeds (![[Note Name]]) to Hugo ref links.
   * Only matches embeds that are NOT image files.
   */
  private convertNoteEmbeds(content: string): string {
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const nameForCheck = this.stripImageSize(raw);
      if (IMAGE_EXTENSIONS.test(nameForCheck)) {
        return _match; // leave for convertImageReferences (already processed)
      }
      // For note embeds, pipe is display text: ![[Note|Display]]
      const [name, displayText] = raw.split("|");
      const display = displayText ?? name;
      const slug = this.sanitizeSlug(name);
      return `[${display}]({{< ref "${slug}" >}})`;
    });
  }

  /**
   * Convert Obsidian image references to Hugo-compatible markdown.
   * Derives the URL path from the imageDir setting.
   */
  private convertImageReferences(content: string): string {
    const urlPath = this.imageUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const imageName = this.stripImageSize(raw);
      if (!IMAGE_EXTENSIONS.test(imageName)) {
        return _match; // not an image — leave for convertNoteEmbeds
      }
      const sanitizedName = this.sanitizeFilename(imageName);
      return `![${imageName}](${urlPath}/${sanitizedName})`;
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
   * Sanitize a page name into a slug (no extension)
   */
  private sanitizeSlug(page: string): string {
    return this.sanitizeName(page);
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
