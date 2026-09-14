import { describe, expect, test } from "bun:test";
import { sanitizeFilename, sanitizeSlug, slugify } from "./slug";

// The slug rule's own tests. They live here rather than in
// note-transformer.test.ts because the rule has three consumers — a page
// slug, a committed filename, a heading anchor — and only one of them is
// the transformer. Tests that drive the rule *through* the transform
// chain stay where they are.

describe("Filename sanitization", () => {
  test("converts to lowercase with hyphens", () => {
    expect(sanitizeFilename("My Blog Post.md")).toBe("my-blog-post.md");
  });

  test("removes special characters", () => {
    expect(sanitizeFilename("Special!@#$%Chars.md")).toBe("specialchars.md");
  });

  test("handles empty result", () => {
    expect(sanitizeFilename("@#$%.md")).toBe("untitled.md");
  });
});

describe("slug rule preserves Unicode", () => {
  // The measured production case: this title published at /posts/rnin-…/
  // with the macron dropped.
  test("keeps a macron in a page slug", () => {
    expect(
      sanitizeSlug(
        "Rōnin, hedge knights, and landless European knights compared",
      ),
    ).toBe("rōnin-hedge-knights-and-landless-european-knights-compared");
  });

  test("keeps non-Latin scripts", () => {
    expect(sanitizeSlug("日本語のタイトル")).toBe("日本語のタイトル");
    expect(sanitizeSlug("Émile, résumé & co.")).toBe("émile-résumé-co");
  });

  // NFC first, so a decomposed diacritic keeps its combining mark instead
  // of having it stripped as punctuation and flattening to bare "o".
  test("normalizes decomposed diacritics rather than stripping them", () => {
    expect(sanitizeSlug("Rōnin".normalize("NFD"))).toBe("rōnin");
    expect(sanitizeSlug("Rōnin".normalize("NFD"))).toBe(
      sanitizeSlug("Rōnin".normalize("NFC")),
    );
  });

  // Not every non-ASCII character is a letter: an en dash is punctuation
  // under both the old rule and the new one, so titles using it are
  // untouched by this change.
  test("still strips non-letter punctuation", () => {
    expect(sanitizeSlug("The long tail – and its discontents")).toBe(
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
      expect(sanitizeFilename(`${title}.md`)).toBe(`${sanitizeSlug(title)}.md`);
    }
  });

  test("still falls back to untitled when nothing survives", () => {
    expect(sanitizeSlug("!!!")).toBe("untitled");
    expect(sanitizeFilename("!!!.md")).toBe("untitled.md");
  });
});

describe("heading anchors use the rule without the fallback", () => {
  // sanitizeSlug's "untitled" is what a filename needs and an anchor does
  // not: an empty anchor is simply no anchor. This is the whole difference
  // between the two exported names, and slugifyHeading used to hide it
  // behind a third.
  test("an anchor that slugifies to nothing stays empty", () => {
    expect(slugify("!!!")).toBe("");
    expect(sanitizeSlug("!!!")).toBe("untitled");
  });

  test("otherwise the anchor and the slug agree", () => {
    for (const heading of ["Café", "Rōnin", "日本語", "A Long Heading"]) {
      expect(slugify(heading)).toBe(sanitizeSlug(heading));
    }
  });
});
