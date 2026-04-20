import { describe, expect, mock, spyOn, test } from "bun:test";
import { Publisher } from "./publisher";
import {
  DEFAULT_SETTINGS,
  type PublisherSettings,
  type PublishWarning,
} from "./types";

const publishedNote = `---
title: Test Post
status: publish
date: 2026-01-01
---
Hello world`;

const unpublishedNote = `---
title: Draft
status: draft
date: 2026-01-01
---
Not ready`;

const noteWithImage = `---
title: With Image
status: publish
date: 2026-01-01
---
Check ![[photo.png]]`;

function makeSettings(
  overrides: Partial<PublisherSettings> = {},
): PublisherSettings {
  return {
    ...DEFAULT_SETTINGS,
    githubToken: "ghp_test",
    repoOwner: "testowner",
    repoName: "testrepo",
    ...overrides,
  };
}

function makeTFile(name: string, path?: string) {
  return {
    name,
    basename: name.replace(/\.md$/, ""),
    path: path ?? name,
    extension: "md",
    stat: { ctime: 0, mtime: 0, size: 0 },
    vault: {},
    parent: null,
  };
}

function makeVault(
  files: Array<{ name: string; content: string | ArrayBuffer; path?: string }>,
) {
  const mdFiles = files
    .filter((f) => f.name.endsWith(".md"))
    .map((f) => makeTFile(f.name, f.path));
  const allFiles = files.map((f) => ({
    ...makeTFile(f.name, f.path),
    _content: f.content,
  }));
  const contentMap = new Map(files.map((f) => [f.name, f.content]));

  return {
    read: mock(async (file: { name: string }) => {
      const content = contentMap.get(file.name);
      if (content === undefined)
        throw new Error(`File not found: ${file.name}`);
      if (typeof content !== "string") throw new Error("Not a text file");
      return content;
    }),
    readBinary: mock(async (file: { name: string }) => {
      const content = contentMap.get(file.name);
      if (content === undefined)
        throw new Error(`File not found: ${file.name}`);
      if (typeof content === "string")
        return new TextEncoder().encode(content).buffer;
      return content;
    }),
    getMarkdownFiles: mock(() => mdFiles),
    getFiles: mock(() => allFiles),
  };
}

function makeGitHubService() {
  return {
    commitFiles: mock(async () => {}),
    createBranchWithRetry: mock(async () => "publish/2026-01-01-000000"),
    createPullRequest: mock(
      async (): Promise<{
        url: string;
        number: number;
        warnings: PublishWarning[];
      }> => ({
        url: "https://github.com/test/pr/1",
        number: 1,
        warnings: [],
      }),
    ),
    deleteBranch: mock(async () => {}),
  };
}

// Helper to inject mock github service into publisher
function makePublisher(
  vault: ReturnType<typeof makeVault>,
  settings: PublisherSettings,
  githubService?: ReturnType<typeof makeGitHubService>,
) {
  const publisher = new Publisher(vault as never, settings);
  if (githubService) {
    // Replace the real GitHubService with our mock
    (publisher as unknown as Record<string, unknown>).githubService =
      githubService;
  }
  return { publisher, githubService: githubService ?? makeGitHubService() };
}

describe("Publisher.validateSettings", () => {
  test("returns null when all settings are valid", () => {
    const { publisher } = makePublisher(makeVault([]), makeSettings());
    expect(publisher.validateSettings()).toBeNull();
  });

  test("rejects missing token", () => {
    const { publisher } = makePublisher(
      makeVault([]),
      makeSettings({ githubToken: "" }),
    );
    expect(publisher.validateSettings()).toContain("token");
  });

  test("rejects missing repo owner", () => {
    const { publisher } = makePublisher(
      makeVault([]),
      makeSettings({ repoOwner: "" }),
    );
    expect(publisher.validateSettings()).toContain("owner");
  });

  test("rejects missing repo name", () => {
    const { publisher } = makePublisher(
      makeVault([]),
      makeSettings({ repoName: "" }),
    );
    expect(publisher.validateSettings()).toContain("name");
  });

  test("rejects missing content dir", () => {
    const { publisher } = makePublisher(
      makeVault([]),
      makeSettings({ contentDir: "" }),
    );
    expect(publisher.validateSettings()).toContain("Content");
  });

  test("rejects missing image dir", () => {
    const { publisher } = makePublisher(
      makeVault([]),
      makeSettings({ imageDir: "" }),
    );
    expect(publisher.validateSettings()).toContain("Image");
  });
});

describe("Publisher.publishNote", () => {
  test("creates branch, commits, and opens PR", async () => {
    const vault = makeVault([{ name: "test.md", content: publishedNote }]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("test.md") as never);

    expect(result.success).toBe(true);
    expect(result.prUrl).toBe("https://github.com/test/pr/1");
    expect(gh.createBranchWithRetry).toHaveBeenCalledTimes(1);
    expect(gh.commitFiles).toHaveBeenCalledTimes(1);
    expect(gh.createPullRequest).toHaveBeenCalledTimes(1);
  });

  test("rejects file without publish flag", async () => {
    const vault = makeVault([{ name: "draft.md", content: unpublishedNote }]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("draft.md") as never);

    expect(result.success).toBe(false);
    expect(gh.createBranchWithRetry).not.toHaveBeenCalled();
  });

  test("returns success with label warning when label apply fails", async () => {
    const vault = makeVault([{ name: "test.md", content: publishedNote }]);
    const gh = makeGitHubService();
    gh.createPullRequest.mockImplementation(async () => ({
      url: "https://github.com/test/pr/2",
      number: 2,
      warnings: [
        {
          kind: "pr-label-failed" as const,
          labels: ["chore"],
          error: "label not found",
        },
      ],
    }));
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("test.md") as never);

    expect(result.success).toBe(true);
    expect(result.prUrl).toBe("https://github.com/test/pr/2");
    expect(result.warnings).toContainEqual({
      kind: "pr-label-failed",
      labels: ["chore"],
      error: "label not found",
    });
    expect(gh.deleteBranch).not.toHaveBeenCalled();
  });

  test("cleans up branch on publish failure", async () => {
    const vault = makeVault([{ name: "test.md", content: publishedNote }]);
    const gh = makeGitHubService();
    gh.commitFiles.mockImplementation(async () => {
      throw new Error("commit failed");
    });
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("test.md") as never);

    expect(result.success).toBe(false);
    expect(gh.deleteBranch).toHaveBeenCalledTimes(1);
  });

  test("logs a warning when branch cleanup itself fails", async () => {
    const vault = makeVault([{ name: "test.md", content: publishedNote }]);
    const gh = makeGitHubService();
    gh.commitFiles.mockImplementation(async () => {
      throw new Error("commit failed");
    });
    gh.deleteBranch.mockImplementation(async () => {
      throw new Error("delete refused");
    });
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("test.md") as never);

    expect(result.success).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    const firstArg = warnSpy.mock.calls[0]?.[0] as string;
    expect(firstArg).toContain("Failed to clean up branch");
    warnSpy.mockRestore();
  });

  test("accepts quoted status value", async () => {
    const quotedStatus = `---
title: Test Post
status: "publish"
date: 2026-01-01
---
Hello`;
    const vault = makeVault([{ name: "quoted.md", content: quotedStatus }]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("quoted.md") as never);

    expect(result.success).toBe(true);
  });

  test("includes images in the commit", async () => {
    const imageData = new Uint8Array([1, 2, 3]).buffer;
    const vault = makeVault([
      { name: "post.md", content: noteWithImage },
      { name: "photo.png", content: imageData as unknown as string },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("post.md") as never);

    expect(result.success).toBe(true);
    const commitCall = gh.commitFiles.mock.calls[0] as unknown[];
    const entries = commitCall[0] as Array<{ path: string }>;
    expect(entries).toHaveLength(2);
    expect(entries[1].path).toBe("static/images/photo.png");
  });

  test("returns empty warnings on clean publish", async () => {
    const vault = makeVault([{ name: "test.md", content: publishedNote }]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("test.md") as never);

    expect(result.warnings).toEqual([]);
  });

  test("reports image-failed warning when image missing from vault", async () => {
    const vault = makeVault([{ name: "post.md", content: noteWithImage }]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("post.md") as never);

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      { kind: "image-failed", name: "photo.png" },
    ]);
  });

  test("reports image-failed warning when readBinary throws", async () => {
    const imageData = new Uint8Array([1, 2, 3]).buffer;
    const vault = makeVault([
      { name: "post.md", content: noteWithImage },
      { name: "photo.png", content: imageData as unknown as string },
    ]);
    vault.readBinary.mockImplementation(async () => {
      throw new Error("disk read error");
    });
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("post.md") as never);

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      { kind: "image-failed", name: "photo.png" },
    ]);
    const commitCall = gh.commitFiles.mock.calls[0] as unknown[];
    const entries = commitCall[0] as Array<{ path: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("content/posts/post.md");
  });

  test("reports image-collision warning with paths sorted", async () => {
    const imageData = new Uint8Array([1, 2, 3]).buffer;
    // Intentionally reverse-alphabetical to prove paths are sorted on output.
    const vault = makeVault([
      { name: "post.md", content: noteWithImage },
      {
        name: "photo.png",
        content: imageData as unknown as string,
        path: "folder-b/photo.png",
      },
      {
        name: "photo.png",
        content: imageData as unknown as string,
        path: "folder-a/photo.png",
      },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("post.md") as never);

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      {
        kind: "image-collision",
        name: "photo.png",
        paths: ["folder-a/photo.png", "folder-b/photo.png"],
      },
    ]);
    // Image should NOT be in the commit — only the markdown file
    const commitCall = gh.commitFiles.mock.calls[0] as unknown[];
    const entries = commitCall[0] as Array<{ path: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("content/posts/post.md");
  });

  test("emits one warning when same image referenced twice in a note", async () => {
    const noteWithDupeRefs = `---
title: Dupe
status: publish
date: 2026-01-01
---
First ![[photo.png]] and again ![[photo.png]]`;
    const vault = makeVault([
      { name: "post.md", content: noteWithDupeRefs },
      {
        name: "photo.png",
        content: new Uint8Array([1]).buffer as unknown as string,
        path: "a/photo.png",
      },
      {
        name: "photo.png",
        content: new Uint8Array([2]).buffer as unknown as string,
        path: "b/photo.png",
      },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("post.md") as never);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].kind).toBe("image-collision");
  });
});

describe("Publisher.publishAll", () => {
  test("batches all publishable files into one PR", async () => {
    const vault = makeVault([
      { name: "a.md", content: publishedNote },
      { name: "b.md", content: publishedNote },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.successful).toBe(2);
    expect(result.prUrl).toBe("https://github.com/test/pr/1");
    expect(gh.commitFiles).toHaveBeenCalledTimes(1);
    expect(gh.createPullRequest).toHaveBeenCalledTimes(1);
  });

  test("skips PR when all files fail", async () => {
    const vault = makeVault([{ name: "bad.md", content: publishedNote }]);
    // Make the vault read throw during prepareBatch's content processing
    vault.read.mockImplementation(async () => publishedNote);
    const gh = makeGitHubService();
    gh.commitFiles.mockImplementation(async () => {
      throw new Error("commit failed");
    });
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.successful).toBe(0);
    expect(result.prUrl).toBeUndefined();
    expect(result.error).toContain("commit failed");
    expect(gh.deleteBranch).toHaveBeenCalled();
  });

  test("returns empty when no publishable files", async () => {
    const vault = makeVault([{ name: "draft.md", content: unpublishedNote }]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.total).toBe(0);
    expect(gh.createBranchWithRetry).not.toHaveBeenCalled();
  });

  test("attaches batch warnings when PR label apply fails", async () => {
    const vault = makeVault([
      { name: "a.md", content: publishedNote },
      { name: "b.md", content: publishedNote },
    ]);
    const gh = makeGitHubService();
    gh.createPullRequest.mockImplementation(async () => ({
      url: "https://github.com/test/pr/3",
      number: 3,
      warnings: [
        {
          kind: "pr-label-failed" as const,
          labels: ["chore"],
          error: "forbidden",
        },
      ],
    }));
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.successful).toBe(2);
    expect(result.prUrl).toBe("https://github.com/test/pr/3");
    expect(result.warnings).toContainEqual({
      kind: "pr-label-failed",
      labels: ["chore"],
      error: "forbidden",
    });
    expect(gh.deleteBranch).not.toHaveBeenCalled();
  });

  test("sets batch error when branch creation throws", async () => {
    const vault = makeVault([
      { name: "a.md", content: publishedNote },
      { name: "b.md", content: publishedNote },
    ]);
    const gh = makeGitHubService();
    gh.createBranchWithRetry.mockImplementation(async () => {
      throw new Error("branch exists");
    });
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.error).toContain("branch exists");
    expect(result.successful).toBe(0);
    expect(result.total).toBe(2);
    expect(result.failed).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => !r.success)).toBe(true);
  });

  test("includes read failures in PR result alongside successful files", async () => {
    const vault = makeVault([
      { name: "ok.md", content: publishedNote },
      { name: "broken.md", content: publishedNote },
    ]);
    vault.read.mockImplementation(async (file: { name: string }) => {
      if (file.name === "broken.md") throw new Error("EACCES");
      return publishedNote;
    });
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.prUrl).toBe("https://github.com/test/pr/1");
    const broken = result.results.find((r) => r.filePath === "broken.md");
    expect(broken?.success).toBe(false);
    expect(broken?.error).toContain("Failed to read");
    expect(gh.createBranchWithRetry).toHaveBeenCalledTimes(1);
    expect(gh.createPullRequest).toHaveBeenCalledTimes(1);
  });

  test("skips branch and PR creation when only read failures exist", async () => {
    const vault = makeVault([
      { name: "a.md", content: publishedNote },
      { name: "b.md", content: publishedNote },
    ]);
    vault.read.mockImplementation(async () => {
      throw new Error("disk error");
    });
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.total).toBe(2);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.prUrl).toBeUndefined();
    expect(result.error).toBe("Failed to read 2 files");
    expect(gh.createBranchWithRetry).not.toHaveBeenCalled();
    expect(gh.createPullRequest).not.toHaveBeenCalled();
  });

  test("sets batch error and marks results failed when PR creation throws", async () => {
    const vault = makeVault([{ name: "a.md", content: publishedNote }]);
    const gh = makeGitHubService();
    gh.createPullRequest.mockImplementation(async () => {
      throw new Error("PR creation failed");
    });
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.error).toContain("PR creation failed");
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(false);
    expect(gh.deleteBranch).toHaveBeenCalled();
  });

  test("invokes onProgress for each prepared file", async () => {
    const vault = makeVault([
      { name: "a.md", content: publishedNote },
      { name: "b.md", content: publishedNote },
      { name: "c.md", content: publishedNote },
    ]);
    const gh = makeGitHubService();
    const progress = mock((_done: number, _total: number) => {});
    const publisher = new Publisher(vault as never, makeSettings(), progress);
    (publisher as unknown as Record<string, unknown>).githubService = gh;

    await publisher.publishAll();

    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress.mock.calls[0]).toEqual([1, 3]);
    expect(progress.mock.calls[2]).toEqual([3, 3]);
  });

  test("batch publish fails per-file on missing required field", async () => {
    const missingDate = `---
title: No Date
status: publish
---
body`;
    const vault = makeVault([
      { name: "good.md", content: publishedNote },
      { name: "bad.md", content: missingDate },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
    const badResult = result.results.find((r) => r.filePath === "bad.md");
    expect(badResult?.success).toBe(false);
    expect(badResult?.error).toContain("date");
  });

  test("surfaces read failures as per-file failed results", async () => {
    const vault = makeVault([
      { name: "ok.md", content: publishedNote },
      { name: "broken.md", content: publishedNote },
    ]);
    vault.read.mockImplementation(async (file: { name: string }) => {
      if (file.name === "broken.md") throw new Error("EACCES");
      return publishedNote;
    });
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
    const broken = result.results.find((r) => r.filePath === "broken.md");
    expect(broken?.success).toBe(false);
    expect(broken?.error).toContain("Failed to read");
    expect(broken?.error).toContain("EACCES");
    expect(gh.commitFiles).toHaveBeenCalledTimes(1);
  });
});

describe("Publisher filename collision precheck", () => {
  test("aborts batch when two notes slugify to same filename", async () => {
    const vault = makeVault([
      {
        name: "Hello World.md",
        content: publishedNote,
        path: "notes/Hello World.md",
      },
      {
        name: "hello world.md",
        content: publishedNote,
        path: "other/hello world.md",
      },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.error).toContain("Filename collision");
    expect(result.error).toContain("notes/Hello World.md");
    expect(result.error).toContain("other/hello world.md");
    expect(result.error).toContain('"hello-world.md"');
    expect(gh.commitFiles).not.toHaveBeenCalled();
    expect(gh.createBranchWithRetry).not.toHaveBeenCalled();
    expect(gh.createPullRequest).not.toHaveBeenCalled();
  });

  test("no collision → normal publish proceeds", async () => {
    const vault = makeVault([
      { name: "alpha.md", content: publishedNote },
      { name: "beta.md", content: publishedNote },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.error).toBeUndefined();
    expect(gh.commitFiles).toHaveBeenCalledTimes(1);
    expect(result.successful).toBe(2);
  });

  test("reports all independent collision groups in one error", async () => {
    const vault = makeVault([
      { name: "A.md", content: publishedNote, path: "notes/A.md" },
      { name: "a.md", content: publishedNote, path: "other/a.md" },
      { name: "B.md", content: publishedNote, path: "notes/B.md" },
      { name: "b.md", content: publishedNote, path: "other/b.md" },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.error).toContain("Filename collisions");
    expect(result.error).toContain('"a.md"');
    expect(result.error).toContain('"b.md"');
    expect(result.error).toContain("notes/A.md");
    expect(result.error).toContain("other/a.md");
    expect(result.error).toContain("notes/B.md");
    expect(result.error).toContain("other/b.md");
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });

  test("3-way collision names all three paths", async () => {
    const vault = makeVault([
      { name: "Hello.md", content: publishedNote, path: "one/Hello.md" },
      { name: "hello.md", content: publishedNote, path: "two/hello.md" },
      { name: "HELLO.md", content: publishedNote, path: "three/HELLO.md" },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.error).toContain("Filename collision");
    expect(result.error).toContain("one/Hello.md");
    expect(result.error).toContain("two/hello.md");
    expect(result.error).toContain("three/HELLO.md");
    expect(result.error).toContain('"hello.md"');
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });

  test("collision result surfaces through main.ts guard (total > 0)", async () => {
    const vault = makeVault([
      {
        name: "Hello World.md",
        content: publishedNote,
        path: "notes/Hello World.md",
      },
      {
        name: "hello world.md",
        content: publishedNote,
        path: "other/hello world.md",
      },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.total).toBe(2);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Filename collision");
    expect(result.results).toHaveLength(2);
    for (const r of result.results) {
      expect(r.success).toBe(false);
      expect(r.error).toContain("Filename collision");
    }
  });
});

describe("Publisher wikilink publish-set gating", () => {
  const sourceLinkingToTarget = `---
title: Source
status: publish
date: 2026-01-01
---
See [[Target]] for details.`;

  const targetPublished = `---
title: Target
status: publish
date: 2026-01-01
---
Target body`;

  const sourceLinkingToUnpublished = `---
title: Source
status: publish
date: 2026-01-01
---
See [[Not Published]] for details.`;

  test("batch emits /posts/slug/ URL for links to other files in publish set", async () => {
    const vault = makeVault([
      { name: "source.md", content: sourceLinkingToTarget },
      { name: "target.md", content: targetPublished },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.successful).toBe(2);
    const commitCall = gh.commitFiles.mock.calls[0] as unknown[];
    const entries = commitCall[0] as Array<{ path: string; content: string }>;
    const sourceEntry = entries.find(
      (e) => e.path === "content/posts/source.md",
    );
    expect(sourceEntry).toBeDefined();
    expect(sourceEntry?.content).toContain("[Target](/posts/target/)");
    expect(sourceEntry?.content).not.toContain("{{< ref");
  });

  test("batch degrades links to notes not in publish set to plain text", async () => {
    const vault = makeVault([
      { name: "source.md", content: sourceLinkingToUnpublished },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishAll();

    expect(result.successful).toBe(1);
    const commitCall = gh.commitFiles.mock.calls[0] as unknown[];
    const entries = commitCall[0] as Array<{ path: string; content: string }>;
    const sourceEntry = entries.find(
      (e) => e.path === "content/posts/source.md",
    );
    expect(sourceEntry).toBeDefined();
    expect(sourceEntry?.content).toContain("See Not Published for details.");
    expect(sourceEntry?.content).not.toContain("[[");
    expect(sourceEntry?.content).not.toContain("{{< ref");
  });

  test("single-file publish links to self work; links to others degrade", async () => {
    const selfRef = `---
title: Source
status: publish
date: 2026-01-01
---
I am [[Source]] and I link to [[Other]].`;
    const vault = makeVault([
      { name: "source.md", content: selfRef },
      { name: "other.md", content: targetPublished },
    ]);
    const gh = makeGitHubService();
    const { publisher } = makePublisher(vault, makeSettings(), gh);

    const result = await publisher.publishNote(makeTFile("source.md") as never);

    expect(result.success).toBe(true);
    const commitCall = gh.commitFiles.mock.calls[0] as unknown[];
    const entries = commitCall[0] as Array<{ path: string; content: string }>;
    const sourceEntry = entries.find(
      (e) => e.path === "content/posts/source.md",
    );
    expect(sourceEntry?.content).toContain("[Source](/posts/source/)");
    expect(sourceEntry?.content).toContain("I link to Other.");
  });
});
