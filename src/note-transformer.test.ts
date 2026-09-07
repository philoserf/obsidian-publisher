import { describe, expect, test } from "bun:test";
import { NoteTransformer, splitCodeSegments } from "./note-transformer";
import { splitFrontmatter } from "./schema";
import type { ProcessedContent, PublisherSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

function makeProcessor(
  overrides: Partial<PublisherSettings> = {},
): NoteTransformer {
  return new NoteTransformer({ ...DEFAULT_SETTINGS, ...overrides });
}

// Tests write full document strings; production pre-splits via
// getPublishableFiles. Mirror the production split here so both paths
// exercise the same processFromSplit entry point.
function process(
  cp: NoteTransformer,
  content: string,
  originalFilename: string,
  publishSet: Set<string> = new Set(),
): ProcessedContent {
  const { frontmatter, body } = splitFrontmatter(content);
  return cp.processFromSplit(frontmatter, body, originalFilename, publishSet);
}

function wrap(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

describe("wikilink publish-set gating", () => {
  const cp = makeProcessor();
  const FM = "title: X\ndate: 2026-01-01";

  test("in-set link emits /posts/slug/ URL", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other Note]] for details."),
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain("[Other Note](/posts/other-note/)");
  });

  test("in-set link with display text", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other Note|the other one]]."),
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain("[the other one](/posts/other-note/)");
  });

  test("in-set link with heading anchor", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other Note#Some Heading]]."),
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain(
      "[Other Note#Some Heading](/posts/other-note/#some-heading)",
    );
  });

  // Anchor and display text combined — the only coverage of the
  // `page#heading|display` parse order.
  test("in-set link with both heading anchor and display text", () => {
    const result = process(
      cp,
      wrap(FM, "[[Page#Section|see this]]"),
      "x.md",
      new Set(["page"]),
    );
    expect(result.content).toContain("[see this](/posts/page/#section)");
  });

  // Two distinct targets, so slug resolution is exercised per link
  // rather than once for a repeated target.
  test("multiple in-set links each resolve to their own slug", () => {
    const result = process(
      cp,
      wrap(FM, "[[One]] and [[Two]]"),
      "x.md",
      new Set(["one", "two"]),
    );
    expect(result.content).toContain("[One](/posts/one/)");
    expect(result.content).toContain("[Two](/posts/two/)");
  });

  test("out-of-set link degrades to plain text", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Unpublished Note]] sometime."),
      "x.md",
      new Set([]),
    );
    expect(result.content).toContain("See Unpublished Note sometime.");
    expect(result.content).not.toContain("[[");
    expect(result.content).not.toContain("](");
  });

  test("out-of-set link with display uses display text", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Unpublished|my draft]]."),
      "x.md",
      new Set([]),
    );
    expect(result.content).toContain("See my draft");
    expect(result.content).not.toContain("[[");
  });

  test("note embed in-set uses link", () => {
    const result = process(
      cp,
      wrap(FM, "![[Other Note]]"),
      "x.md",
      new Set(["other-note"]),
    );
    expect(result.content).toContain("[Other Note](/posts/other-note/)");
  });

  test("note embed out-of-set degrades to plain text", () => {
    const result = process(
      cp,
      wrap(FM, "![[Unpublished]]"),
      "x.md",
      new Set([]),
    );
    expect(result.content).toContain("Unpublished");
    expect(result.content).not.toContain("![[");
    expect(result.content).not.toContain("](");
  });

  // No publishSet argument at all — pins the default parameter.
  test("when publishSet omitted, defaults to empty (all out-of-set)", () => {
    const result = process(cp, wrap(FM, "See [[Other]]."), "x.md");
    expect(result.content).toContain("See Other");
    expect(result.content).not.toContain("[[");
  });

  test("URL prefix derives from contentDir (content/blog -> /blog/)", () => {
    const result = process(
      makeProcessor({ contentDir: "content/blog" }),
      wrap(FM, "See [[Other]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/blog/other/)");
  });

  test("URL prefix derives from contentDir (content -> /)", () => {
    const result = process(
      makeProcessor({ contentDir: "content" }),
      wrap(FM, "See [[Other]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/other/)");
  });

  test("normalizes trailing slash in contentDir", () => {
    const result = process(
      makeProcessor({ contentDir: "content/posts/" }),
      wrap(FM, "[[Other]]"),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/posts/other/)");
    expect(result.content).not.toContain("//");
  });

  test("normalizes leading slash in contentDir", () => {
    const result = process(
      makeProcessor({ contentDir: "/content/posts" }),
      wrap(FM, "[[Other]]"),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/posts/other/)");
    expect(result.content).not.toContain("//");
  });

  test("accepts bare directory without content/ prefix", () => {
    const result = process(
      makeProcessor({ contentDir: "posts" }),
      wrap(FM, "[[Other]]"),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/posts/other/)");
  });

  test("preserves contentDir that starts with 'content' but isn't 'content/'", () => {
    const result = process(
      makeProcessor({ contentDir: "content-posts" }),
      wrap(FM, "[[Other]]"),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/content-posts/other/)");
  });

  test("preserves contentDir starting with 'contentful/'", () => {
    const result = process(
      makeProcessor({ contentDir: "contentful/posts" }),
      wrap(FM, "[[Other]]"),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("[Other](/contentful/posts/other/)");
  });

  test("strips apostrophes from heading anchor", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other#What's next?]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain(
      "[Other#What's next?](/posts/other/#whats-next)",
    );
  });

  test("strips parentheses and commas from heading anchor", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other#Setup (advanced, v2)]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain(
      "[Other#Setup (advanced, v2)](/posts/other/#setup-advanced-v2)",
    );
  });

  test("collapses consecutive hyphens and trims edge hyphens in heading anchor", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other#  Multi   Word!  ]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("](/posts/other/#multi-word)");
  });

  test("preserves non-ASCII Latin letters (é, ü) in heading anchor", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other#Café au lait]] and [[Other#Über alles]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("](/posts/other/#café-au-lait)");
    expect(result.content).toContain("](/posts/other/#über-alles)");
  });

  test("preserves CJK characters in heading anchor", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Other#日本語 notes]]."),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("](/posts/other/#日本語-notes)");
  });

  test("NFC-normalizes decomposed diacritics in heading anchor", () => {
    // "café" encoded as c + a + f + e + U+0301 (combining acute)
    const decomposed = `Caf\u0065\u0301`;
    const result = process(
      cp,
      wrap(FM, `See [[Other#${decomposed}]].`),
      "x.md",
      new Set(["other"]),
    );
    expect(result.content).toContain("](/posts/other/#café)");
  });
});

describe("Image reference conversion", () => {
  const cp = makeProcessor();

  test("converts image reference", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[photo.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
  });

  test("sanitizes image filename", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[My Photo.jpg]]"),
      "test.md",
    );
    expect(result.content).toContain("![My Photo.jpg](/images/my-photo.jpg)");
  });

  test("extracts only image names, not note embeds", () => {
    const result = process(
      cp,
      wrap(
        "title: Test\nstatus: publish",
        "![[a.png]] text ![[b.jpg]] and ![[My Note]]",
      ),
      "test.md",
    );
    expect(result.images).toEqual(["a.png", "b.jpg"]);
  });

  test("no images returns empty array", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "no images here"),
      "test.md",
    );
    expect(result.images).toEqual([]);
  });

  test("derives image URL path from imageDir setting", () => {
    const cp2 = makeProcessor({ imageDir: "static/media/photos" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/media/photos/hero.png)");
  });

  test("handles imageDir without static prefix", () => {
    const cp2 = makeProcessor({ imageDir: "assets/img" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/assets/img/hero.png)");
  });

  test("imageUrlPath: bare 'static' collapses to root", () => {
    const cp2 = makeProcessor({ imageDir: "static" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/hero.png)");
  });

  test("imageUrlPath: preserves imageDir that starts with 'static' but isn't 'static/'", () => {
    const cp2 = makeProcessor({ imageDir: "static-assets" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/static-assets/hero.png)");
  });

  test("imageUrlPath: preserves imageDir starting with 'staticfiles/'", () => {
    const cp2 = makeProcessor({ imageDir: "staticfiles/img" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/staticfiles/img/hero.png)");
  });

  test("imageUrlPath: normalizes leading and trailing slashes", () => {
    const cp2 = makeProcessor({ imageDir: "/static/images/" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/images/hero.png)");
  });

  test("imageUrlPath: empty imageDir collapses to root", () => {
    const cp2 = makeProcessor({ imageDir: "" });
    const result = process(
      cp2,
      wrap("title: Test\nstatus: publish", "![[hero.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![hero.png](/hero.png)");
  });

  test("strips width sizing from image reference", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[photo.png|300]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
    expect(result.images).toEqual(["photo.png"]);
  });

  test("strips dimension sizing from image reference", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[photo.png|300x200]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png](/images/photo.png)");
    expect(result.images).toEqual(["photo.png"]);
  });

  test("strips pipe suffix from image in mixed content", () => {
    const result = process(
      cp,
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
  const processor = new NoteTransformer(DEFAULT_SETTINGS);

  test("bare embed uses filename as alt", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("pipe with alt text preserves alt", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|alt text]]",
      "x.md",
    );
    expect(result.content).toContain("![alt text](/images/img.png)");
  });

  test("pipe with bare size discards size, no alt", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|300]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("pipe with WxH size discards size, no alt", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|300x200]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("alt-then-size form keeps alt, drops size", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|alt|300]]",
      "x.md",
    );
    expect(result.content).toContain("![alt](/images/img.png)");
  });

  test("trims incidental whitespace around bare size", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|300 ]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("trims whitespace around WxH size", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|alt| 300x200 ]]",
      "x.md",
    );
    expect(result.content).toContain("![alt](/images/img.png)");
  });

  test("empty alt falls back to filename", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("whitespace-only alt falls back to filename", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|   ]]",
      "x.md",
    );
    expect(result.content).toContain("![img.png](/images/img.png)");
  });

  test("trims leading and trailing whitespace from alt", () => {
    const result = process(
      processor,
      "---\ntitle: X\ndate: 2026-01-01\n---\n![[img.png|  nice photo  ]]",
      "x.md",
    );
    expect(result.content).toContain("![nice photo](/images/img.png)");
  });
});

describe("Note embed conversion", () => {
  const cp = makeProcessor();

  test("converts note embed to /posts/slug/ link when in publish set", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[My Other Post]]"),
      "test.md",
      new Set(["my-other-post"]),
    );
    expect(result.content).toContain("[My Other Post](/posts/my-other-post/)");
  });

  test("does not treat image embeds as note embeds", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[photo.png]]"),
      "test.md",
    );
    expect(result.content).toContain("![photo.png]");
    expect(result.content).not.toContain("ref");
  });

  // The anchor used to run into the name, so the slug was "myotherpostwhy"
  // — never in the publish set, so every anchored embed silently degraded
  // to plain text no matter what was being published.
  test("embed with anchor resolves to slug plus heading fragment", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[My Other Post#Why It Works]]"),
      "test.md",
      new Set(["my-other-post"]),
    );
    expect(result.content).toContain(
      "[My Other Post#Why It Works](/posts/my-other-post/#why-it-works)",
    );
  });

  test("embed with anchor and display text", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[My Other Post#Why|the reason]]"),
      "test.md",
      new Set(["my-other-post"]),
    );
    expect(result.content).toContain("[the reason](/posts/my-other-post/#why)");
  });

  test("anchored embed outside the publish set degrades to display text", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "![[Absent Post#Why]]"),
      "test.md",
      new Set(),
    );
    expect(result.content).toContain("Absent Post#Why");
    expect(result.content).not.toContain("](/posts/");
  });
});

describe("same-page heading links", () => {
  const cp = makeProcessor();
  const FM = "title: X\ndate: 2026-01-01";

  // No publish-set lookup: the target is this very document, so the link
  // is valid whatever else is being published.
  test("[[#Heading]] emits a bare fragment", () => {
    const result = process(
      cp,
      wrap(FM, "Jump to [[#Why It Works]]."),
      "x.md",
      new Set(),
    );
    expect(result.content).toContain("[Why It Works](#why-it-works)");
  });

  test("[[#Heading|Display]] uses the display text", () => {
    const result = process(
      cp,
      wrap(FM, "Jump [[#Why It Works|down]]."),
      "x.md",
    );
    expect(result.content).toContain("[down](#why-it-works)");
  });

  test("empty wikilink is left verbatim", () => {
    const result = process(cp, wrap(FM, "Not a link: [[]]"), "x.md");
    expect(result.content).toContain("[[]]");
  });

  test("pipe with no page or heading is left verbatim", () => {
    const result = process(cp, wrap(FM, "Not a link: [[|x]]"), "x.md");
    expect(result.content).toContain("[[|x]]");
  });

  test("page links still require the publish set", () => {
    const result = process(
      cp,
      wrap(FM, "See [[Absent#Why]]."),
      "x.md",
      new Set(),
    );
    expect(result.content).toContain("Absent#Why");
    expect(result.content).not.toContain("](/posts/");
  });
});

describe("Frontmatter processing", () => {
  test("preserves existing date", () => {
    const cp = makeProcessor();
    const result = process(
      cp,
      wrap("title: Test\ndate: 2026-01-01\nstatus: publish", "body"),
      "test.md",
    );
    expect(splitFrontmatter(result.content).frontmatter.date).toBe(
      "2026-01-01",
    );
  });

  test("strips every field in strippedFrontmatterFields", () => {
    const processor = new NoteTransformer({
      ...DEFAULT_SETTINGS,
      strippedFrontmatterFields: ["status", "lastmod", "cssclasses"],
    });
    const result = process(
      processor,
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
    expect(splitFrontmatter(result.content).frontmatter).not.toHaveProperty(
      "status",
    );
    expect(splitFrontmatter(result.content).frontmatter).not.toHaveProperty(
      "lastmod",
    );
    expect(splitFrontmatter(result.content).frontmatter).not.toHaveProperty(
      "cssclasses",
    );
    expect(splitFrontmatter(result.content).frontmatter.title).toBe("X");
  });

  test("does not strip fields absent from strippedFrontmatterFields", () => {
    const processor = new NoteTransformer({
      ...DEFAULT_SETTINGS,
      strippedFrontmatterFields: ["status"],
    });
    const result = process(
      processor,
      `---
title: X
date: 2026-01-01
lastmod: 2026-01-02
---
body`,
      "x.md",
    );
    expect(splitFrontmatter(result.content).frontmatter.lastmod).toBe(
      "2026-01-02",
    );
  });

  test("keeps status field when not in strippedFrontmatterFields", () => {
    const cp = makeProcessor({ strippedFrontmatterFields: [] });
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "body"),
      "test.md",
    );
    expect(splitFrontmatter(result.content).frontmatter.status).toBe("publish");
  });

  test("merges template fields without overriding existing", () => {
    const cp = makeProcessor({
      frontmatterTemplate: { author: "Mark", tags: ["obsidian"] },
    });
    const result = process(
      cp,
      wrap("title: Existing\nauthor: Someone Else\nstatus: publish", "body"),
      "test.md",
    );
    expect(splitFrontmatter(result.content).frontmatter.author).toBe(
      "Someone Else",
    );
    expect(splitFrontmatter(result.content).frontmatter.tags).toEqual([
      "obsidian",
    ]);
  });

  test("adds template fields when not present", () => {
    const cp = makeProcessor({
      frontmatterTemplate: { author: "Mark" },
    });
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "body"),
      "test.md",
    );
    expect(splitFrontmatter(result.content).frontmatter.author).toBe("Mark");
  });

  test("throws instead of silently dropping frontmatter when serialization fails", () => {
    const cp = makeProcessor();
    const unserializable = { title: "Test", bad: Symbol("nope") };
    expect(() =>
      cp.processFromSplit(unserializable, "body", "test.md"),
    ).toThrow(/Failed to serialize frontmatter/);
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

describe("slug rule preserves Unicode", () => {
  const cp = makeProcessor();

  // The measured production case: this title published at /posts/rnin-…/
  // with the macron dropped.
  test("keeps a macron in a page slug", () => {
    expect(
      cp.sanitizeSlug(
        "Rōnin, hedge knights, and landless European knights compared",
      ),
    ).toBe("rōnin-hedge-knights-and-landless-european-knights-compared");
  });

  test("keeps non-Latin scripts", () => {
    expect(cp.sanitizeSlug("日本語のタイトル")).toBe("日本語のタイトル");
    expect(cp.sanitizeSlug("Émile, résumé & co.")).toBe("émile-résumé-co");
  });

  // NFC first, so a decomposed diacritic keeps its combining mark instead
  // of having it stripped as punctuation and flattening to bare "o".
  test("normalizes decomposed diacritics rather than stripping them", () => {
    expect(cp.sanitizeSlug("Rōnin".normalize("NFD"))).toBe("rōnin");
    expect(cp.sanitizeSlug("Rōnin".normalize("NFD"))).toBe(
      cp.sanitizeSlug("Rōnin".normalize("NFC")),
    );
  });

  // Not every non-ASCII character is a letter: an en dash is punctuation
  // under both the old rule and the new one, so titles using it are
  // untouched by this change.
  test("still strips non-letter punctuation", () => {
    expect(cp.sanitizeSlug("The long tail – and its discontents")).toBe(
      "the-long-tail-and-its-discontents",
    );
  });

  // sanitizeSlug and sanitizeFilename are both wrappers over the same
  // rule, and must stay that way: Publisher.buildPublishSet slugifies
  // while detectFilenameCollisions sanitizes filenames, so if the two
  // ever diverge a link resolves against a name that was never committed.
  test("filename and slug agree on the same input", () => {
    for (const title of [
      "Rōnin, hedge knights",
      "Café",
      "日本語のタイトル",
      "Émile, résumé & co.",
      "@#$%",
    ]) {
      expect(cp.sanitizeFilename(`${title}.md`)).toBe(
        `${cp.sanitizeSlug(title)}.md`,
      );
    }
  });

  test("still falls back to untitled when nothing survives", () => {
    expect(cp.sanitizeSlug("!!!")).toBe("untitled");
    expect(cp.sanitizeFilename("!!!.md")).toBe("untitled.md");
  });

  // The bug the unification fixes: the slug dropped the accent the anchor
  // kept, so the two halves of one link pointed at different places.
  test("slug and heading anchor agree for [[Café#Café]]", () => {
    const result = process(
      cp,
      wrap("title: X\ndate: 2026-01-01", "See [[Café#Café]]."),
      "x.md",
      new Set(["café"]),
    );
    expect(result.content).toContain("[Café#Café](/posts/café/#café)");
  });
});

describe("Comment stripping", () => {
  const cp = makeProcessor();

  test("strips inline comment", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "before %%secret%% after"),
      "test.md",
    );
    expect(result.content).toContain("before  after");
    expect(result.content).not.toContain("secret");
  });

  test("strips multiline comment", () => {
    const result = process(
      cp,
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
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "%%one%% middle %%two%%"),
      "test.md",
    );
    expect(result.content).toContain(" middle ");
    expect(result.content).not.toContain("one");
    expect(result.content).not.toContain("two");
  });

  test("leaves single percent signs alone", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "100% complete"),
      "test.md",
    );
    expect(result.content).toContain("100% complete");
  });
});

describe("Highlight conversion", () => {
  const cp = makeProcessor();

  test("converts highlight to mark tag", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "this is ==important== text"),
      "test.md",
    );
    expect(result.content).toContain("this is <mark>important</mark> text");
  });

  test("converts multiple highlights on one line", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "==one== and ==two=="),
      "test.md",
    );
    expect(result.content).toContain("<mark>one</mark> and <mark>two</mark>");
  });

  test("leaves single equals signs alone", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "a = b"),
      "test.md",
    );
    expect(result.content).toContain("a = b");
  });

  test("leaves triple equals alone", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "a === b"),
      "test.md",
    );
    expect(result.content).toContain("a === b");
  });
});

describe("Callout conversion", () => {
  const cp = makeProcessor();

  test("converts basic callout with title", () => {
    const result = process(
      cp,
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

  // JS counts `\r` as a line terminator, so `.` never crosses it: with a
  // bare `\n` in the pattern a CRLF note's callouts did not match at all
  // and published as raw `> [!note]` blockquotes.
  test("converts a CRLF callout with a title", () => {
    const result = process(
      cp,
      `---\r\ntitle: Test\r\nstatus: publish\r\n---\r\n> [!note] Important\r\n> This is a note\r\n`,
      "test.md",
    );
    expect(result.content).toContain('{{< callout note "Important" >}}');
    expect(result.content).toContain("{{< /callout >}}");
    expect(result.content).not.toContain("> [!note]");
    // The title must not carry the carriage return into the shortcode.
    expect(result.content).not.toContain('"Important\r"');
  });

  test("converts a CRLF callout without a title", () => {
    const result = process(
      cp,
      `---\r\ntitle: Test\r\nstatus: publish\r\n---\r\n> [!warning]\r\n> Be careful\r\n`,
      "test.md",
    );
    expect(result.content).toContain("{{< callout warning >}}");
    expect(result.content).not.toContain("> [!warning]");
  });

  test("converts a multiline CRLF callout body", () => {
    const result = process(
      cp,
      `---\r\ntitle: Test\r\nstatus: publish\r\n---\r\n> [!tip] T\r\n> one\r\n> two\r\n`,
      "test.md",
    );
    expect(result.content).toContain("one");
    expect(result.content).toContain("two");
    expect(result.content).not.toContain("> one");
    expect(result.content).not.toContain("> two");
  });

  test("converts callout without title", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "> [!warning]\n> Be careful"),
      "test.md",
    );
    expect(result.content).toContain(
      "{{< callout warning >}}\nBe careful\n{{< /callout >}}",
    );
  });

  test("converts multiline callout body", () => {
    const result = process(
      cp,
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
      const result = process(
        cp,
        wrap("title: Test\nstatus: publish", `> [!${type}]\n> content`),
        "test.md",
      );
      expect(result.content).toContain(`{{< callout ${type} >}}`);
    }
  });

  test("strips foldable markers (+ and -)", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "> [!note]+ Title\n> Content"),
      "test.md",
    );
    expect(result.content).toContain('{{< callout note "Title" >}}');

    const result2 = process(
      cp,
      wrap("title: Test\nstatus: publish", "> [!note]- Title\n> Content"),
      "test.md",
    );
    expect(result2.content).toContain('{{< callout note "Title" >}}');
  });

  test("passes custom callout type through verbatim", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "> [!custom]\n> Content"),
      "test.md",
    );
    expect(result.content).toContain("{{< callout custom >}}");
  });

  test("handles callout type case-insensitively", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "> [!WARNING]\n> Content"),
      "test.md",
    );
    expect(result.content).toContain("{{< callout warning >}}");
  });

  test("leaves regular blockquotes untouched", () => {
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "> Just a regular quote"),
      "test.md",
    );
    expect(result.content).toContain("> Just a regular quote");
    expect(result.content).not.toContain("callout");
  });

  test("emits configured callout shortcode name", () => {
    const processor = new NoteTransformer({
      ...DEFAULT_SETTINGS,
      calloutShortcodeName: "notice",
    });
    const result = process(
      processor,
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
    const processor = new NoteTransformer(DEFAULT_SETTINGS);
    const result = process(
      processor,
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
    const processor = new NoteTransformer(DEFAULT_SETTINGS);
    const result = process(
      processor,
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
    const processor = new NoteTransformer(DEFAULT_SETTINGS);
    const result = process(
      processor,
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
    const processor = new NoteTransformer(DEFAULT_SETTINGS);
    const result = process(
      processor,
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
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "```mermaid\ngraph TD; A-->B\n```"),
      "test.md",
    );
    expect(result.content).toContain(
      "{{< mermaid >}}\ngraph TD; A-->B\n{{< /mermaid >}}",
    );
  });

  test("converts multiline mermaid diagram", () => {
    const result = process(
      cp,
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
    const result = process(
      cp,
      wrap("title: Test\nstatus: publish", "```javascript\nconst x = 1;\n```"),
      "test.md",
    );
    expect(result.content).toContain("```javascript\nconst x = 1;\n```");
    expect(result.content).not.toContain("mermaid");
  });

  test("handles multiple mermaid blocks", () => {
    const result = process(
      cp,
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
    const processor = new NoteTransformer({
      ...DEFAULT_SETTINGS,
      mermaidShortcodeName: "diagram",
    });
    const result = process(
      processor,
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
    const result = process(cp, input, "My Post.md", new Set(["world"]));

    expect(result.filename).toBe("my-post.md");
    expect(result.content).toContain("[World](/posts/world/)");
    expect(result.content).toContain(
      "![screenshot.png](/images/screenshot.png)",
    );
    expect(result.images).toEqual(["screenshot.png"]);
    expect(splitFrontmatter(result.content).frontmatter.title).toBe("My Post");
    expect("status" in splitFrontmatter(result.content).frontmatter).toBe(
      false,
    );
  });
});

// #243 / #244. Every transform used to run over the whole body, so a code
// sample containing ==, [[ or %% was silently rewritten — and because
// stripComments, convertImageReferences, convertNoteEmbeds and
// convertWikilinks all match across newlines, a match could begin inside a
// fence and end in prose, taking the closing fence with it.
describe("code is opaque to the transform chain", () => {
  const cp = makeProcessor();
  const FM = "title: X\ndate: 2026-01-01";

  test("a fenced block survives every transform verbatim", () => {
    const fence = [
      "```js",
      "if (a == b && c == d) return;",
      "const link = '[[Some Page]]';",
      "const img = '![[photo.png]]';",
      "// %%not a comment%%",
      "```",
    ].join("\n");
    const result = process(
      cp,
      wrap(FM, `Intro.\n\n${fence}\n\nOutro.`),
      "x.md",
      new Set(["some-page"]),
    );
    expect(result.content).toContain(fence);
    expect(result.content).not.toContain("<mark>");
  });

  test("an image referenced only inside a fence is not uploaded", () => {
    const result = process(cp, wrap(FM, "```\n![[secret.png]]\n```"), "x.md");
    expect(result.images).toEqual([]);
  });

  // #244 proper: stripComments removes the reference, so resolveImages must
  // never see it — otherwise a deliberately disabled image is committed, and
  // a missing one raises a spurious image-failed warning.
  test("an image referenced only inside a %% comment is not uploaded", () => {
    const result = process(
      cp,
      wrap(FM, "Visible.\n\n%%\n![[secret.png]]\n%%\n"),
      "x.md",
    );
    expect(result.images).toEqual([]);
    expect(result.content).not.toContain("secret.png");
  });

  test("an image referenced in prose is still uploaded", () => {
    const result = process(cp, wrap(FM, "See ![[photo.png]]"), "x.md");
    expect(result.images).toEqual(["photo.png"]);
  });

  test("inline code spans are protected too", () => {
    const result = process(
      cp,
      wrap(FM, "Use `a == b` not `a = b`, and `[[literal]]` stays."),
      "x.md",
      new Set(["literal"]),
    );
    expect(result.content).toContain("`a == b`");
    expect(result.content).toContain("`[[literal]]`");
    expect(result.content).not.toContain("<mark>");
  });

  test("prose around a fence is still transformed", () => {
    const result = process(
      cp,
      wrap(FM, "==hi== before\n\n```\n==raw==\n```\n\n==bye== after"),
      "x.md",
    );
    expect(result.content).toContain("<mark>hi</mark>");
    expect(result.content).toContain("<mark>bye</mark>");
    expect(result.content).toContain("==raw==");
  });

  // %% is Mermaid's own comment syntax. stripComments ran before
  // convertMermaid over the whole body, so it paired a mermaid comment with
  // the next %% anywhere and deleted the diagram between them.
  test("a mermaid diagram keeps its %% comments", () => {
    const result = process(
      cp,
      wrap(FM, "```mermaid\n%% layout note\ngraph TD\nA-->B\n```"),
      "x.md",
    );
    expect(result.content).toContain("graph TD");
    expect(result.content).toContain("A-->B");
    expect(result.content).toContain("{{< mermaid >}}");
  });

  test("an unterminated fence does not swallow later content", () => {
    const segments = splitCodeSegments("prose\n```\nnever closed");
    expect(segments.map((seg) => seg.text).join("")).toBe(
      "prose\n```\nnever closed",
    );
    expect(segments[0].kind).toBe("prose");
  });

  test("splitting is lossless", () => {
    const body = "a\n\n```js\nx == y\n```\n\nb `inline` c\n~~~\ntilde\n~~~\n";
    expect(
      splitCodeSegments(body)
        .map((seg) => seg.text)
        .join(""),
    ).toBe(body);
  });
});

// #279. Hugo emits its redirect stub at whatever path an alias names,
// verbatim. These aliases are previous note titles, so the stub landed at
// /posts/DNA as Remix Culture/ while the URL the post actually had was left
// dead. Measured across philoserf/site: 166 aliases, all once-live files,
// 164 since deleted.
describe("alias urlization", () => {
  const cp = makeProcessor();

  const aliasesOf = (fm: string, publishSet = new Set<string>()) => {
    const result = process(cp, fm, "x.md", publishSet);
    return splitFrontmatter(result.content).frontmatter.aliases;
  };

  test("a previous title becomes the URL that title produced", () => {
    expect(
      aliasesOf(
        wrap(
          "title: X\ndate: 2026-01-01\naliases:\n  - DNA as Remix Culture",
          "body",
        ),
      ),
    ).toEqual(["/posts/dna-as-remix-culture/"]);
  });

  test("handles every alias in a list", () => {
    expect(
      aliasesOf(
        wrap(
          "title: X\ndate: 2026-01-01\naliases:\n  - Identity Goals vs. Action Goals\n  - AI vs Human Collaboration",
          "body",
        ),
      ),
    ).toEqual([
      "/posts/identity-goals-vs-action-goals/",
      "/posts/ai-vs-human-collaboration/",
    ]);
  });

  // philoserf/site carries "- /antifa/" — an author-written path, not a
  // title. Slugifying it would destroy it, since sanitizeSlug strips "/".
  test("leaves an existing path alias untouched", () => {
    expect(
      aliasesOf(
        wrap("title: X\ndate: 2026-01-01\naliases:\n  - /antifa/", "body"),
      ),
    ).toEqual(["/antifa/"]);
  });

  test("is idempotent — republishing does not re-slugify", () => {
    expect(
      aliasesOf(
        wrap(
          "title: X\ndate: 2026-01-01\naliases:\n  - /posts/dna-as-remix-culture/",
          "body",
        ),
      ),
    ).toEqual(["/posts/dna-as-remix-culture/"]);
  });

  test("follows contentDir, matching the URLs that dir produces", () => {
    const blog = makeProcessor({ contentDir: "content/blog" });
    const result = process(
      blog,
      wrap("title: X\ndate: 2026-01-01\naliases:\n  - Old Title", "body"),
      "x.md",
    );
    expect(splitFrontmatter(result.content).frontmatter.aliases).toEqual([
      "/blog/old-title/",
    ]);
  });

  test("leaves a value that sanitizes to nothing alone", () => {
    expect(
      aliasesOf(
        wrap('title: X\ndate: 2026-01-01\naliases:\n  - "!!!"', "body"),
      ),
    ).toEqual(["!!!"]);
  });

  test("notes without aliases are unaffected", () => {
    const result = process(
      cp,
      wrap("title: X\ndate: 2026-01-01", "body"),
      "x.md",
    );
    expect(splitFrontmatter(result.content).frontmatter).not.toHaveProperty(
      "aliases",
    );
  });
});
