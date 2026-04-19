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
      wrap("title: Test\nstatus: publish", "See [[Page Name]] here"),
      "test.md",
    );
    expect(result.content).toContain('[Page Name]({{< ref "page-name" >}})');
  });

  test("converts wikilink with display text", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "See [[Page|Custom Text]] here"),
      "test.md",
    );
    expect(result.content).toContain('[Custom Text]({{< ref "page" >}})');
  });

  test("sanitizes wikilink target", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[My Cool Page]]"),
      "test.md",
    );
    expect(result.content).toContain(
      '[My Cool Page]({{< ref "my-cool-page" >}})',
    );
  });

  test("handles multiple wikilinks", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[One]] and [[Two]]"),
      "test.md",
    );
    expect(result.content).toContain('[One]({{< ref "one" >}})');
    expect(result.content).toContain('[Two]({{< ref "two" >}})');
  });

  test("handles heading anchors", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[Page#My Heading]]"),
      "test.md",
    );
    expect(result.content).toContain(
      '[Page#My Heading]({{< ref "page#my-heading" >}})',
    );
  });

  test("handles heading anchors with display text", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[Page#Section|see this]]"),
      "test.md",
    );
    expect(result.content).toContain('[see this]({{< ref "page#section" >}})');
  });
});

describe("Image reference conversion", () => {
  const cp = makeProcessor();

  test("converts image reference", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[photo.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
  });

  test("sanitizes image filename", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[My Photo.jpg]]"),
      "test.md",
    );
    expect(result.content).toContain("![My Photo.jpg](/images/my-photo.jpg)");
  });

  test("extracts only image names, not note embeds", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
        "![[a.png]] text ![[b.jpg]] and ![[My Note]]",
      ),
      "test.md",
    );
    expect(result.images).toEqual(["a.png", "b.jpg"]);
  });

  test("no images returns empty array", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "no images here"),
      "test.md",
    );
    expect(result.images).toEqual([]);
  });

  test("derives image URL path from imageDir setting", () => {
    const cp2 = makeProcessor({ imageDir: "static/media/photos" });
    const result = cp2.process(
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/media/photos/hero.png)");
  });

  test("handles imageDir without static prefix", () => {
    const cp2 = makeProcessor({ imageDir: "assets/img" });
    const result = cp2.process(
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/assets/img/hero.png)");
  });

  test("strips width sizing from image reference", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[photo.png|300]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
    expect(result.images).toEqual(["photo.png"]);
  });

  test("strips dimension sizing from image reference", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[photo.png|300x200]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
    expect(result.images).toEqual(["photo.png"]);
  });

  test("strips pipe suffix from image in mixed content", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
        "![[a.png|100]] and ![[b.jpg]] and ![[My Note]]",
      ),
      "test.md",
    );
    expect(result.images).toEqual(["a.png", "b.jpg"]);
    expect(result.content).toContain("![a.png](/images/a.png)");
    expect(result.content).toContain("![b.jpg](/images/b.jpg)");
  });
});

describe("Note embed conversion", () => {
  const cp = makeProcessor();

  test("converts note embed to ref link", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[My Other Post]]"),
      "test.md",
    );
    expect(result.content).toContain(
      '[My Other Post]({{< ref "my-other-post" >}})',
    );
  });

  test("does not treat image embeds as note embeds", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[photo.png]]"),
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
      wrap("title: Test\nstatus: publish", "body"),
      "test.md",
    );
    expect(result.frontmatter.date).toBeDefined();
  });

  test("preserves existing date", () => {
    const cp = makeProcessor();
    const result = cp.process(
      wrap("title: Test\ndate: 2026-01-01\nstatus: publish", "body"),
      "test.md",
    );
    expect(result.frontmatter.date).toBe("2026-01-01");
  });

  test("strips every field in strippedFrontmatterFields", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      strippedFrontmatterFields: ["status", "lastmod", "cssclasses"],
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
status: publish
lastmod: 2026-01-02
cssclasses: [foo, bar]
---
body`,
      "x.md",
    );
    expect(result.frontmatter).not.toHaveProperty("status");
    expect(result.frontmatter).not.toHaveProperty("lastmod");
    expect(result.frontmatter).not.toHaveProperty("cssclasses");
    expect(result.frontmatter.title).toBe("X");
  });

  test("does not strip fields absent from strippedFrontmatterFields", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      strippedFrontmatterFields: ["status"],
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
lastmod: 2026-01-02
---
body`,
      "x.md",
    );
    expect(result.frontmatter.lastmod).toBe("2026-01-02");
  });

  test("keeps status field when not in strippedFrontmatterFields", () => {
    const cp = makeProcessor({ strippedFrontmatterFields: [] });
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "body"),
      "test.md",
    );
    expect(result.frontmatter.status).toBe("publish");
  });

  test("merges template fields without overriding existing", () => {
    const cp = makeProcessor({
      frontmatterTemplate: { author: "Mark", tags: ["obsidian"] },
    });
    const result = cp.process(
      wrap("title: Existing\nauthor: Someone Else\nstatus: publish", "body"),
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
      wrap("title: Test\nstatus: publish", "body"),
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
      wrap("title: Test\nstatus: publish", "before %%secret%% after"),
      "test.md",
    );
    expect(result.content).toContain("before  after");
    expect(result.content).not.toContain("secret");
  });

  test("strips multiline comment", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
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
      wrap("title: Test\nstatus: publish", "%%one%% middle %%two%%"),
      "test.md",
    );
    expect(result.content).toContain(" middle ");
    expect(result.content).not.toContain("one");
    expect(result.content).not.toContain("two");
  });

  test("leaves single percent signs alone", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "100% complete"),
      "test.md",
    );
    expect(result.content).toContain("100% complete");
  });
});

describe("Highlight conversion", () => {
  const cp = makeProcessor();

  test("converts highlight to mark tag", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "this is ==important== text"),
      "test.md",
    );
    expect(result.content).toContain("this is <mark>important</mark> text");
  });

  test("converts multiple highlights on one line", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "==one== and ==two=="),
      "test.md",
    );
    expect(result.content).toContain("<mark>one</mark> and <mark>two</mark>");
  });

  test("leaves single equals signs alone", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "a = b"),
      "test.md",
    );
    expect(result.content).toContain("a = b");
  });

  test("leaves triple equals alone", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "a === b"),
      "test.md",
    );
    expect(result.content).toContain("a === b");
  });
});

describe("Callout conversion", () => {
  const cp = makeProcessor();

  test("converts basic callout with title", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
        "> [!note] Important\n> This is a note",
      ),
      "test.md",
    );
    expect(result.content).toContain(
      '{{< callout note "Important" >}}\nThis is a note\n{{< /callout >}}',
    );
  });

  test("converts callout without title", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "> [!warning]\n> Be careful"),
      "test.md",
    );
    expect(result.content).toContain(
      "{{< callout warning >}}\nBe careful\n{{< /callout >}}",
    );
  });

  test("converts multiline callout body", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
        "> [!tip] Hint\n> Line one\n> Line two\n> Line three",
      ),
      "test.md",
    );
    expect(result.content).toContain(
      '{{< callout tip "Hint" >}}\nLine one\nLine two\nLine three\n{{< /callout >}}',
    );
  });

  test("passes every known Obsidian callout type through verbatim", () => {
    const types = [
      "note",
      "abstract",
      "summary",
      "tldr",
      "info",
      "todo",
      "tip",
      "hint",
      "important",
      "success",
      "check",
      "done",
      "question",
      "help",
      "faq",
      "warning",
      "caution",
      "attention",
      "failure",
      "fail",
      "missing",
      "danger",
      "error",
      "bug",
      "example",
      "quote",
      "cite",
    ];
    for (const type of types) {
      const result = cp.process(
        wrap("title: Test\nstatus: publish", `> [!${type}]\n> content`),
        "test.md",
      );
      expect(result.content).toContain(`{{< callout ${type} >}}`);
    }
  });

  test("strips foldable markers (+ and -)", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "> [!note]+ Title\n> Content"),
      "test.md",
    );
    expect(result.content).toContain('{{< callout note "Title" >}}');

    const result2 = cp.process(
      wrap("title: Test\nstatus: publish", "> [!note]- Title\n> Content"),
      "test.md",
    );
    expect(result2.content).toContain('{{< callout note "Title" >}}');
  });

  test("passes custom callout type through verbatim", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "> [!custom]\n> Content"),
      "test.md",
    );
    expect(result.content).toContain("{{< callout custom >}}");
  });

  test("handles callout type case-insensitively", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "> [!WARNING]\n> Content"),
      "test.md",
    );
    expect(result.content).toContain("{{< callout warning >}}");
  });

  test("leaves regular blockquotes untouched", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "> Just a regular quote"),
      "test.md",
    );
    expect(result.content).toContain("> Just a regular quote");
    expect(result.content).not.toContain("callout");
  });

  test("emits configured callout shortcode name", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      calloutShortcodeName: "notice",
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
> [!note] Heads up
> body`,
      "x.md",
    );
    expect(result.content).toContain("{{< notice note");
    expect(result.content).toContain("{{< /notice >}}");
  });

  test("transforms multiple callouts in a single document", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
> [!first] Heading A
> body one

> [!second]
> body two

> [!third]
> body three`,
      "x.md",
    );
    expect(result.content).toContain("{{< callout first");
    expect(result.content).toContain("{{< callout second >}}");
    expect(result.content).toContain("{{< callout third >}}");
  });

  test("escapes double quotes in callout title", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
> [!note] He said "hi"
> body`,
      "x.md",
    );
    expect(result.content).toContain('{{< callout note "He said \\"hi\\"" >}}');
  });

  test("escapes backslashes in callout title", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
> [!note] path\\to\\file
> body`,
      "x.md",
    );
    expect(result.content).toContain(
      '{{< callout note "path\\\\to\\\\file" >}}',
    );
  });

  test("lowercases the type but preserves it", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
> [!WARNING]
> x`,
      "x.md",
    );
    expect(result.content).toContain("{{< callout warning >}}");
  });
});

describe("Mermaid conversion", () => {
  const cp = makeProcessor();

  test("converts mermaid code block to shortcode", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "```mermaid\ngraph TD; A-->B\n```"),
      "test.md",
    );
    expect(result.content).toContain(
      "{{< mermaid >}}\ngraph TD; A-->B\n{{< /mermaid >}}",
    );
  });

  test("converts multiline mermaid diagram", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
        "```mermaid\ngraph TD\n  A-->B\n  B-->C\n```",
      ),
      "test.md",
    );
    expect(result.content).toContain(
      "{{< mermaid >}}\ngraph TD\n  A-->B\n  B-->C\n{{< /mermaid >}}",
    );
  });

  test("leaves non-mermaid code blocks untouched", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "```javascript\nconst x = 1;\n```"),
      "test.md",
    );
    expect(result.content).toContain("```javascript\nconst x = 1;\n```");
    expect(result.content).not.toContain("mermaid");
  });

  test("handles multiple mermaid blocks", () => {
    const result = cp.process(
      wrap(
        "title: Test\nstatus: publish",
        "```mermaid\ngraph TD; A-->B\n```\n\ntext\n\n```mermaid\ngraph LR; X-->Y\n```",
      ),
      "test.md",
    );
    expect(result.content).toContain(
      "{{< mermaid >}}\ngraph TD; A-->B\n{{< /mermaid >}}",
    );
    expect(result.content).toContain(
      "{{< mermaid >}}\ngraph LR; X-->Y\n{{< /mermaid >}}",
    );
  });

  test("emits configured mermaid shortcode name", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      mermaidShortcodeName: "diagram",
    });
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n```mermaid\nflowchart TD\nA --> B\n```",
      "x.md",
    );
    expect(result.content).toContain("{{< diagram >}}");
    expect(result.content).toContain("{{< /diagram >}}");
  });
});

describe("Full process pipeline", () => {
  test("transforms complete note", () => {
    const cp = makeProcessor({ strippedFrontmatterFields: ["status"] });
    const input = wrap(
      "title: My Post\nstatus: publish",
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
