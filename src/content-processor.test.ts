import { describe, expect, test } from "bun:test";
import { ContentProcessor } from "./content-processor";
import type { PublisherSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

function makeProcessor(
  overrides: Partial<PublisherSettings> = {},
): ContentProcessor {
  return new ContentProcessor({ ...DEFAULT_SETTINGS, ...overrides });
}

function wrap(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

describe("Wikilink conversion", () => {
  const cp = makeProcessor();

  test("converts simple wikilink to Hugo ref shortcode", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "See [[Page Name]] here"),
      "test.md",
    );
    expect(result.content).toContain('[Page Name]({{< ref "page-name" >}})');
  });

  test("converts wikilink with display text", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "See [[Page|Custom Text]] here"),
      "test.md",
    );
    expect(result.content).toContain('[Custom Text]({{< ref "page" >}})');
  });

  test("sanitizes wikilink target", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "[[My Cool Page]]"),
      "test.md",
    );
    expect(result.content).toContain(
      '[My Cool Page]({{< ref "my-cool-page" >}})',
    );
  });

  test("handles multiple wikilinks", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "[[One]] and [[Two]]"),
      "test.md",
    );
    expect(result.content).toContain('[One]({{< ref "one" >}})');
    expect(result.content).toContain('[Two]({{< ref "two" >}})');
  });

  test("handles heading anchors", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "[[Page#My Heading]]"),
      "test.md",
    );
    expect(result.content).toContain(
      '[Page#My Heading]({{< ref "page#my-heading" >}})',
    );
  });

  test("handles heading anchors with display text", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "[[Page#Section|see this]]"),
      "test.md",
    );
    expect(result.content).toContain('[see this]({{< ref "page#section" >}})');
  });
});

describe("Image reference conversion", () => {
  const cp = makeProcessor();

  test("converts image reference", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "![[photo.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
  });

  test("sanitizes image filename", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "![[My Photo.jpg]]"),
      "test.md",
    );
    expect(result.content).toContain("![My Photo.jpg](/images/my-photo.jpg)");
  });

  test("extracts only image names, not note embeds", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: published",
        "![[a.png]] text ![[b.jpg]] and ![[My Note]]",
      ),
      "test.md",
    );
    expect(result.images).toEqual(["a.png", "b.jpg"]);
  });

  test("no images returns empty array", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "no images here"),
      "test.md",
    );
    expect(result.images).toEqual([]);
  });

  test("derives image URL path from imageDir setting", () => {
    const cp2 = makeProcessor({ imageDir: "static/media/photos" });
    const result = cp2.process(
      wrap("title: Test\nstatus: published", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/media/photos/hero.png)");
  });

  test("handles imageDir without static prefix", () => {
    const cp2 = makeProcessor({ imageDir: "assets/img" });
    const result = cp2.process(
      wrap("title: Test\nstatus: published", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/assets/img/hero.png)");
  });
});

describe("Note embed conversion", () => {
  const cp = makeProcessor();

  test("converts note embed to ref link", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "![[My Other Post]]"),
      "test.md",
    );
    expect(result.content).toContain(
      '[My Other Post]({{< ref "my-other-post" >}})',
    );
  });

  test("does not treat image embeds as note embeds", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "![[photo.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png]");
    expect(result.content).not.toContain("ref");
  });
});

describe("Frontmatter processing", () => {
  test("adds date when missing", () => {
    const cp = makeProcessor();
    const result = cp.process(
      wrap("title: Test\nstatus: published", "body"),
      "test.md",
    );
    expect(result.frontmatter.date).toBeDefined();
  });

  test("preserves existing date", () => {
    const cp = makeProcessor();
    const result = cp.process(
      wrap("title: Test\ndate: 2026-01-01\nstatus: published", "body"),
      "test.md",
    );
    expect(result.frontmatter.date).toBe("2026-01-01");
  });

  test("removes status field when removePublishFlag is true", () => {
    const cp = makeProcessor({ removePublishFlag: true });
    const result = cp.process(
      wrap("title: Test\nstatus: published", "body"),
      "test.md",
    );
    expect(result.frontmatter.status).toBeUndefined();
    expect("status" in result.frontmatter).toBe(false);
  });

  test("keeps status field when removePublishFlag is false", () => {
    const cp = makeProcessor({ removePublishFlag: false });
    const result = cp.process(
      wrap("title: Test\nstatus: published", "body"),
      "test.md",
    );
    expect(result.frontmatter.status).toBe("published");
  });

  test("merges template fields without overriding existing", () => {
    const cp = makeProcessor({
      frontmatterTemplate: { author: "Mark", tags: ["obsidian"] },
    });
    const result = cp.process(
      wrap("title: Existing\nauthor: Someone Else\nstatus: published", "body"),
      "test.md",
    );
    expect(result.frontmatter.author).toBe("Someone Else");
    expect(result.frontmatter.tags).toEqual(["obsidian"]);
  });

  test("adds template fields when not present", () => {
    const cp = makeProcessor({
      frontmatterTemplate: { author: "Mark" },
    });
    const result = cp.process(
      wrap("title: Test\nstatus: published", "body"),
      "test.md",
    );
    expect(result.frontmatter.author).toBe("Mark");
  });
});

describe("Filename sanitization", () => {
  const cp = makeProcessor();

  test("converts to lowercase with hyphens", () => {
    expect(cp.sanitizeFilename("My Blog Post.md")).toBe("my-blog-post.md");
  });

  test("removes special characters", () => {
    expect(cp.sanitizeFilename("Special!@#$%Chars.md")).toBe("specialchars.md");
  });

  test("handles empty result", () => {
    expect(cp.sanitizeFilename("@#$%.md")).toBe("untitled.md");
  });
});

describe("Comment stripping", () => {
  const cp = makeProcessor();

  test("strips inline comment", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "before %%secret%% after"),
      "test.md",
    );
    expect(result.content).toContain("before  after");
    expect(result.content).not.toContain("secret");
  });

  test("strips multiline comment", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: published",
        "before\n%%\nthis is\na secret\n%%\nafter",
      ),
      "test.md",
    );
    expect(result.content).toContain("before\n");
    expect(result.content).toContain("\nafter");
    expect(result.content).not.toContain("secret");
  });

  test("strips multiple comments", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "%%one%% middle %%two%%"),
      "test.md",
    );
    expect(result.content).toContain(" middle ");
    expect(result.content).not.toContain("one");
    expect(result.content).not.toContain("two");
  });

  test("leaves single percent signs alone", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: published", "100% complete"),
      "test.md",
    );
    expect(result.content).toContain("100% complete");
  });
});

describe("Full process pipeline", () => {
  test("transforms complete note", () => {
    const cp = makeProcessor({ removePublishFlag: true });
    const input = wrap(
      "title: My Post\nstatus: published",
      "Hello [[World]]!\n\n![[screenshot.png]]\n",
    );
    const result = cp.process(input, "My Post.md");

    expect(result.filename).toBe("my-post.md");
    expect(result.content).toContain('[World]({{< ref "world" >}})');
    expect(result.content).toContain(
      "![screenshot.png](/images/screenshot.png)",
    );
    expect(result.images).toEqual(["screenshot.png"]);
    expect(result.frontmatter.title).toBe("My Post");
    expect("status" in result.frontmatter).toBe(false);
  });
});
