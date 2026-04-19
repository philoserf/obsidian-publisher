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

  test("converts simple wikilink to /posts/slug/ URL when in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "See [[Page Name]] here"),
      "test.md",
      new Set(["page-name"]),
    );
    expect(result.content).toContain("[Page Name](/posts/page-name/)");
  });

  test("converts wikilink with display text when in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "See [[Page|Custom Text]] here"),
      "test.md",
      new Set(["page"]),
    );
    expect(result.content).toContain("[Custom Text](/posts/page/)");
  });

  test("sanitizes wikilink target when in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[My Cool Page]]"),
      "test.md",
      new Set(["my-cool-page"]),
    );
    expect(result.content).toContain("[My Cool Page](/posts/my-cool-page/)");
  });

  test("handles multiple wikilinks when all in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[One]] and [[Two]]"),
      "test.md",
      new Set(["one", "two"]),
    );
    expect(result.content).toContain("[One](/posts/one/)");
    expect(result.content).toContain("[Two](/posts/two/)");
  });

  test("handles heading anchors when in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[Page#My Heading]]"),
      "test.md",
      new Set(["page"]),
    );
    expect(result.content).toContain(
      "[Page#My Heading](/posts/page/#my-heading)",
    );
  });

  test("handles heading anchors with display text when in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "[[Page#Section|see this]]"),
      "test.md",
      new Set(["page"]),
    );
    expect(result.content).toContain("[see this](/posts/page/#section)");
  });
});

describe("wikilink publish-set gating", () => {
  test("in-set link emits /posts/slug/ URL", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other Note]] for details.`,
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain("[Other Note](/posts/other-note/)");
  });

  test("in-set link with display text", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other Note|the other one]].`,
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain("[the other one](/posts/other-note/)");
  });

  test("in-set link with heading anchor", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other Note#Some Heading]].`,
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain(
      "[Other Note#Some Heading](/posts/other-note/#some-heading)",
    );
  });

  test("out-of-set link degrades to plain text", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Unpublished Note]] sometime.`,
      "x.md",
      new Set([]),
    );
    expect(result.content).toContain("See Unpublished Note sometime.");
    expect(result.content).not.toContain("[[");
    expect(result.content).not.toContain("](");
  });

  test("out-of-set link with display uses display text", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Unpublished|my draft]].`,
      "x.md",
      new Set([]),
    );
    expect(result.content).toContain("See my draft");
    expect(result.content).not.toContain("[[");
  });

  test("note embed in-set uses link", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
![[Other Note]]`,
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain("[Other Note](/posts/other-note/)");
  });

  test("note embed out-of-set degrades to plain text", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
![[Unpublished]]`,
      "x.md",
      new Set([]),
    );
    expect(result.content).toContain("Unpublished");
    expect(result.content).not.toContain("![[");
    expect(result.content).not.toContain("](");
  });

  test("when publishSet omitted, defaults to empty (all out-of-set)", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other]].`,
      "x.md",
    );
    expect(result.content).toContain("See Other");
    expect(result.content).not.toContain("[[");
  });

  test("URL prefix derives from contentDir (content/blog -> /blog/)", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      contentDir: "content/blog",
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other]].`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/blog/other/)");
  });

  test("URL prefix derives from contentDir (content -> /)", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      contentDir: "content",
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other]].`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/other/)");
  });

  test("normalizes trailing slash in contentDir", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      contentDir: "content/posts/",
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
[[Other]]`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/posts/other/)");
    expect(result.content).not.toContain("//");
  });

  test("normalizes leading slash in contentDir", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      contentDir: "/content/posts",
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
[[Other]]`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/posts/other/)");
    expect(result.content).not.toContain("//");
  });

  test("accepts bare directory without content/ prefix", () => {
    const processor = new ContentProcessor({
      ...DEFAULT_SETTINGS,
      contentDir: "posts",
    });
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
[[Other]]`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/posts/other/)");
  });

  test("strips apostrophes from heading anchor", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other#What's next?]].`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain(
      "[Other#What's next?](/posts/other/#whats-next)",
    );
  });

  test("strips parentheses and commas from heading anchor", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other#Setup (advanced, v2)]].`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain(
      "[Other#Setup (advanced, v2)](/posts/other/#setup-advanced-v2)",
    );
  });

  test("collapses consecutive hyphens and trims edge hyphens in heading anchor", () => {
    const processor = new ContentProcessor(DEFAULT_SETTINGS);
    const result = processor.process(
      `---
title: X
date: 2026-01-01
---
See [[Other#  Multi   Word!  ]].`,
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("](/posts/other/#multi-word)");
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

describe("image alt text", () => {
  const processor = new ContentProcessor(DEFAULT_SETTINGS);

  test("bare embed uses filename as alt", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("pipe with alt text preserves alt", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|alt text]]",
      "x.md",
    );
    expect(result.content).toContain("![alt text](/images/img.png)");
  });

  test("pipe with bare size discards size, no alt", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|300]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("pipe with WxH size discards size, no alt", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|300x200]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("alt-then-size form keeps alt, drops size", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|alt|300]]",
      "x.md",
    );
    expect(result.content).toContain("![alt](/images/img.png)");
  });

  test("trims incidental whitespace around bare size", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|300 ]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("trims whitespace around WxH size", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|alt| 300x200 ]]",
      "x.md",
    );
    expect(result.content).toContain("![alt](/images/img.png)");
  });

  test("empty alt falls back to filename", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("whitespace-only alt falls back to filename", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|   ]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("trims leading and trailing whitespace from alt", () => {
    const result = processor.process(
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|  nice photo  ]]",
      "x.md",
    );
    expect(result.content).toContain("![nice photo](/images/img.png)");
  });
});

describe("Note embed conversion", () => {
  const cp = makeProcessor();

  test("converts note embed to /posts/slug/ link when in publish set", () => {
    const result = cp.process(
      wrap("title: Test\nstatus: publish", "![[My Other Post]]"),
      "test.md",
      new Set(["my-other-post"]),
    );
    expect(result.content).toContain("[My Other Post](/posts/my-other-post/)");
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
    const result = cp.process(input, "My Post.md", new Set(["world"]));

    expect(result.filename).toBe("my-post.md");
    expect(result.content).toContain("[World](/posts/world/)");
    expect(result.content).toContain(
      "![screenshot.png](/images/screenshot.png)",
    );
    expect(result.images).toEqual(["screenshot.png"]);
    expect(result.frontmatter.title).toBe("My Post");
    expect("status" in result.frontmatter).toBe(false);
  });
});
