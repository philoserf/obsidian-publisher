import { parseYaml, stringifyYaml } from "obsidian";
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
    const { frontmatter, body } = this.extractFrontmatter(content);

    // Process frontmatter
    const processedFrontmatter = this.processFrontmatter(frontmatter);

    // Find all images in the content
    const images = this.extractImages(body);

    // Convert content
    let processedBody = body;
    processedBody = this.stripComments(processedBody);
    processedBody = this.convertImageReferences(processedBody);
    processedBody = this.convertNoteEmbeds(processedBody);
    processedBody = this.convertWikilinks(processedBody);

    // Reassemble content with frontmatter
    const processedContent = this.assembleFrontmatter(
      processedFrontmatter,
      processedBody,
    );

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(originalFilename);

    return {
      content: processedContent,
      filename: sanitizedFilename,
      images,
      frontmatter: processedFrontmatter,
    };
  }

  /**
   * Extract frontmatter and body from markdown content
   */
  private extractFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    try {
      const frontmatter = parseYaml(match[1]) || {};
      const body = match[2];
      return {
        frontmatter: typeof frontmatter === "object" ? frontmatter : {},
        body,
      };
    } catch (error) {
      console.error("Failed to parse frontmatter:", error);
      return { frontmatter: {}, body: content };
    }
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
   * Extract image references from content (only actual images, not note embeds)
   */
  private extractImages(content: string): string[] {
    const embedRegex = /!\[\[([^\]]+)\]\]/g;
    const images: string[] = [];

    let match = embedRegex.exec(content);
    while (match !== null) {
      if (IMAGE_EXTENSIONS.test(match[1])) {
        images.push(match[1]);
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
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, name) => {
      if (IMAGE_EXTENSIONS.test(name)) {
        return _match; // leave for convertImageReferences (already processed)
      }
      const slug = this.sanitizeSlug(name);
      return `[${name}]({{< ref "${slug}" >}})`;
    });
  }

  /**
   * Convert Obsidian image references to Hugo-compatible markdown.
   * Derives the URL path from the imageDir setting.
   */
  private convertImageReferences(content: string): string {
    const urlPath = this.imageUrlPath();
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, imageName) => {
      if (!IMAGE_EXTENSIONS.test(imageName)) {
        return _match; // not an image — leave for convertNoteEmbeds
      }
      const sanitizedName = this.sanitizeFilename(imageName);
      return `![${imageName}](${urlPath}/${sanitizedName})`;
    });
  }

  /**
   * Sanitize a page name into a slug (no extension)
   */
  private sanitizeSlug(page: string): string {
    return (
      page
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "") || "untitled"
    );
  }

  /**
   * Sanitize filename for Hugo URLs
   */
  sanitizeFilename(filename: string): string {
    // Extract extension if present
    const lastDotIndex = filename.lastIndexOf(".");
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

    let name = filename;
    let extension = "";

    if (hasExtension) {
      name = filename.slice(0, lastDotIndex);
      extension = filename.slice(lastDotIndex); // includes the dot
    }

    // Convert to lowercase and replace spaces with hyphens
    name = name.toLowerCase().replace(/\s+/g, "-");

    // Remove special characters, keep only alphanumeric, hyphens, and underscores
    name = name.replace(/[^a-z0-9\-_]/g, "");

    // Remove consecutive hyphens
    name = name.replace(/-+/g, "-");

    // Remove leading/trailing hyphens
    name = name.replace(/^-+|-+$/g, "");

    // If name is empty after sanitization, use a default
    if (!name) {
      name = "untitled";
    }

    return name + extension;
  }

  /**
   * Get the sanitized image filename
   */
  sanitizeImageName(imageName: string): string {
    return this.sanitizeFilename(imageName);
  }
}
