import { parseYaml, stringifyYaml } from "obsidian";
import type { ProcessedContent, PublisherSettings } from "./types";

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
    processedBody = this.convertWikilinks(processedBody);
    processedBody = this.convertImageReferences(processedBody);

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
   * Extract all image references from content
   */
  private extractImages(content: string): string[] {
    const imageRegex = /!\[\[([^\]]+)\]\]/g;
    const images: string[] = [];

    let match = imageRegex.exec(content);
    while (match !== null) {
      images.push(match[1]);
      match = imageRegex.exec(content);
    }

    return images;
  }

  /**
   * Convert Obsidian wikilinks to markdown links
   * Handles: [[Page]] and [[Page|Display Text]]
   */
  private convertWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
      (_match, page, _, displayText) => {
        const display = displayText || page;
        const slug = this.sanitizeFilename(page);
        return `[${display}](${slug})`;
      },
    );
  }

  /**
   * Convert Obsidian image references to Hugo-compatible markdown
   * Handles: ![[image.png]]
   */
  private convertImageReferences(content: string): string {
    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, imageName) => {
      const sanitizedName = this.sanitizeFilename(imageName);
      // Hugo paths are relative to content directory
      // Images in static/images are referenced as /images/
      return `![${imageName}](/images/${sanitizedName})`;
    });
  }

  /**
   * Sanitize filename for Hugo URLs
   * - Convert to lowercase
   * - Replace spaces with hyphens
   * - Remove special characters
   * - Keep alphanumeric, hyphens, underscores, and dots
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
