import { describe, expect, mock, test } from "bun:test";
import { RequestError } from "@octokit/request-error";
import { GitHubApiGateway } from "./github-api-gateway";
import type { PublisherSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

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

function makeOctokit(overrides: Record<string, unknown> = {}) {
  return {
    repos: {
      get: mock(async () => ({ data: {} })),
    },
    rest: {
      git: {
        getRef: mock(async () => ({
          data: { object: { sha: "base-sha" } },
        })),
        createRef: mock(async () => ({})),
        deleteRef: mock(async () => ({})),
        getCommit: mock(async () => ({
          data: { tree: { sha: "tree-sha" } },
        })),
        createBlob: mock(async () => ({ data: { sha: "blob-sha" } })),
        createTree: mock(async () => ({ data: { sha: "new-tree-sha" } })),
        createCommit: mock(async () => ({
          data: { sha: "new-commit-sha" },
        })),
        updateRef: mock(async () => ({})),
      },
      pulls: {
        create: mock(async () => ({
          data: { html_url: "https://github.com/test/pr/1", number: 1 },
        })),
      },
      issues: {
        addLabels: mock(async () => ({})),
      },
    },
    ...overrides,
  };
}

// Retry backoff is injected as a no-op: these tests assert how many
// attempts happen, not how long the waits are.
function makeService(octokitOverrides: Record<string, unknown> = {}) {
  const service = new GitHubApiGateway(makeSettings(), async () => {});
  const octokit = makeOctokit(octokitOverrides);
  (service as unknown as Record<string, unknown>).octokit = octokit;
  return { service, octokit };
}

describe("GitHubApiGateway.generateBranchName", () => {
  test("generates branch name with prefix", () => {
    const service = new GitHubApiGateway(makeSettings());
    const name = service.generateBranchName("publish");
    expect(name).toMatch(/^publish\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });

  test("uses default prefix", () => {
    const service = new GitHubApiGateway(makeSettings());
    const name = service.generateBranchName();
    expect(name).toStartWith("publish/");
  });
});

describe("GitHubApiGateway.validateConnection", () => {
  test("succeeds when repo is accessible", async () => {
    const { service } = makeService();
    await expect(service.validateConnection()).resolves.toBeUndefined();
  });

  test("throws descriptive error on failure", async () => {
    const { service, octokit } = makeService();
    octokit.repos.get.mockImplementation(async () => {
      throw new Error("Not Found");
    });
    await expect(service.validateConnection()).rejects.toThrow(
      "Failed to access repository",
    );
  });
});

describe("GitHubApiGateway.commitFiles", () => {
  test("builds tree, commit, and updates ref", async () => {
    const { service, octokit } = makeService();

    await service.commitFiles(
      [{ path: "content/test.md", content: "hello" }],
      "test commit",
      "main",
    );

    expect(octokit.rest.git.getRef).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.createTree).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.createCommit).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.updateRef).toHaveBeenCalledTimes(1);
  });

  // #232: text is written by createTree itself, so a text-only batch
  // costs a fixed 5 requests instead of N+5. This is what keeps a
  // 167-note publish from tripping GitHub's secondary rate limits.
  test("sends text inline and makes no blob calls", async () => {
    const { service, octokit } = makeService();

    await service.commitFiles(
      [
        { path: "a.md", content: "one" },
        { path: "b.md", content: "two" },
        { path: "c.md", content: "three" },
      ],
      "batch",
      "main",
    );

    expect(octokit.rest.git.createBlob).not.toHaveBeenCalled();

    const treeCall = octokit.rest.git.createTree.mock.calls[0] as unknown[];
    const { tree } = treeCall[0] as {
      tree: Array<{ path: string; content?: string; sha?: string }>;
    };
    expect(tree).toEqual([
      { path: "a.md", mode: "100644", type: "blob", content: "one" },
      { path: "b.md", mode: "100644", type: "blob", content: "two" },
      { path: "c.md", mode: "100644", type: "blob", content: "three" },
    ]);
  });

  // Binary has no encoding parameter on a tree entry, so images still
  // need a base64 blob and are referenced by sha.
  test("uploads binary as a blob and references it by sha", async () => {
    const { service, octokit } = makeService();
    const image = new Uint8Array([1, 2, 3]).buffer;

    await service.commitFiles(
      [
        { path: "content/post.md", content: "text" },
        { path: "static/images/photo.png", content: image },
      ],
      "mixed",
      "main",
    );

    expect(octokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
    const blobCall = octokit.rest.git.createBlob.mock.calls[0] as unknown[];
    expect((blobCall[0] as { encoding: string }).encoding).toBe("base64");

    const treeCall = octokit.rest.git.createTree.mock.calls[0] as unknown[];
    const { tree } = treeCall[0] as {
      tree: Array<{ path: string; content?: string; sha?: string }>;
    };
    expect(tree[0].content).toBe("text");
    expect(tree[0].sha).toBeUndefined();
    expect(tree[1].sha).toBe("blob-sha");
    expect(tree[1].content).toBeUndefined();
  });

  // Every call in commitFiles is idempotent, so a transient failure is
  // repeated rather than failing the whole batch (#232).
  test("retries a transient failure on createTree", async () => {
    const { service, octokit } = makeService();
    let calls = 0;
    octokit.rest.git.createTree.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new RequestError("busy", 503, {} as never);
      return { data: { sha: "new-tree-sha" } };
    });

    await service.commitFiles([{ path: "a.md", content: "x" }], "msg", "main");

    expect(octokit.rest.git.createTree).toHaveBeenCalledTimes(2);
    expect(octokit.rest.git.createCommit).toHaveBeenCalledTimes(1);
  });

  test("does not retry a non-transient failure", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("bad request", 400, {} as never);
    octokit.rest.git.createTree.mockImplementation(async () => {
      throw requestError;
    });

    await expect(
      service.commitFiles([{ path: "a.md", content: "x" }], "msg", "main"),
    ).rejects.toBe(requestError);
    expect(octokit.rest.git.createTree).toHaveBeenCalledTimes(1);
  });

  test("wraps generic Error with descriptive prefix", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.createCommit.mockImplementation(async () => {
      throw new Error("network down");
    });

    await expect(
      service.commitFiles([{ path: "a.md", content: "x" }], "msg", "main"),
    ).rejects.toThrow("Failed to commit files: network down");
  });

  test("rethrows RequestError unchanged (preserves status)", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("conflict", 409, {} as never);
    octokit.rest.git.createCommit.mockImplementation(async () => {
      throw requestError;
    });

    await expect(
      service.commitFiles([{ path: "a.md", content: "x" }], "msg", "main"),
    ).rejects.toBe(requestError);
  });
});

describe("GitHubApiGateway.createPullRequest", () => {
  test("creates PR and adds labels", async () => {
    const { service, octokit } = makeService();

    const result = await service.createPullRequest(
      "feature",
      "main",
      "title",
      "body",
      ["chore"],
    );

    expect(result.url).toBe("https://github.com/test/pr/1");
    expect(octokit.rest.pulls.create).toHaveBeenCalledTimes(1);
    expect(octokit.rest.issues.addLabels).toHaveBeenCalledTimes(1);
  });

  test("skips labels when none provided", async () => {
    const { service, octokit } = makeService();

    await service.createPullRequest("feature", "main", "title", "body");

    expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
  });

  test("returns empty warnings when labels apply cleanly", async () => {
    const { service } = makeService();

    const result = await service.createPullRequest(
      "feature",
      "main",
      "title",
      "body",
      ["chore"],
    );

    expect(result.warnings).toEqual([]);
  });

  test("surfaces label apply failure as warning, returns PR url", async () => {
    const { service, octokit } = makeService();
    octokit.rest.issues.addLabels.mockImplementation(async () => {
      throw new Error("label not found");
    });

    const result = await service.createPullRequest(
      "feature",
      "main",
      "title",
      "body",
      ["nonexistent"],
    );

    expect(result.url).toBe("https://github.com/test/pr/1");
    expect(result.warnings).toEqual([
      {
        kind: "pr-label-failed",
        labels: ["nonexistent"],
        error: "label not found",
      },
    ]);
  });

  test("throws when PR creation itself fails", async () => {
    const { service, octokit } = makeService();
    octokit.rest.pulls.create.mockImplementation(async () => {
      throw new Error("validation failed");
    });

    await expect(
      service.createPullRequest("feature", "main", "title", "body"),
    ).rejects.toThrow("Failed to create pull request");
  });
});

describe("GitHubApiGateway.createBranchWithRetry", () => {
  test("creates branch on first attempt", async () => {
    const { service, octokit } = makeService();
    const name = await service.createBranchWithRetry("publish", "main");
    expect(name).toMatch(/^publish\//);
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(1);
  });

  test("throws when branch creation fails", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw new Error("Server error");
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 2),
    ).rejects.toThrow("Failed to create branch");
  });

  // A plain Error carries no status, so it is not retryable: one attempt.
  test("does not retry an error without a status", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw new Error("Server error");
    });
    await expect(
      service.createBranchWithRetry("publish", "main"),
    ).rejects.toThrow();
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(1);
  });

  // 401 is permanent. Uses the default maxRetries so the predicate, not
  // the loop bound, is what stops the retry.
  test("does not retry a 401 and rethrows it unchanged", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("unauthorized", 401, {} as never);
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw requestError;
    });
    await expect(service.createBranchWithRetry("publish", "main")).rejects.toBe(
      requestError,
    );
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(1);
  });

  test("retries with suffix after a 422 collision", async () => {
    const { service, octokit } = makeService();
    let calls = 0;
    octokit.rest.git.createRef.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new RequestError("exists", 422, {} as never);
      return {};
    });
    const name = await service.createBranchWithRetry("publish", "main");
    expect(name).toMatch(/-1$/);
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(2);
  });

  test("retries a 429 until attempts are exhausted, then rethrows", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("rate limited", 429, {} as never);
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw requestError;
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toBe(requestError);
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(3);
  });

  test("retries a 5xx until attempts are exhausted, then rethrows", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("bad gateway", 502, {} as never);
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw requestError;
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toBe(requestError);
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(3);
  });

  // #242: getBranchSha is the FIRST call inside createBranch, so a
  // transient failure there used to be wrapped into a plain Error, lose
  // its status, and fail on attempt one. Count getRef — createRef is
  // never reached because createBranch fails before it.
  test("retries a 503 from getRef (#242)", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("unavailable", 503, {} as never);
    octokit.rest.git.getRef.mockImplementation(async () => {
      throw requestError;
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toBe(requestError);
    expect(octokit.rest.git.getRef).toHaveBeenCalledTimes(3);
    expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
  });

  // #242 also produced a stuttering message, because getBranchSha and
  // createBranch each wrapped the same error. A RequestError now passes
  // through both untouched.
  test("does not double-wrap a RequestError from getRef", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.getRef.mockImplementation(async () => {
      throw new RequestError("Not Found", 404, {} as never);
    });
    const error = await service
      .createBranchWithRetry("publish", "main", 1)
      .catch((e: Error) => e);
    expect(error.message).toBe("Not Found");
    expect(error).toBeInstanceOf(RequestError);
  });

  // #233: GitHub signals secondary rate limiting with 403, but 403 also
  // covers "token lacks scope". Only the rate-limit shape is retried.
  test("retries a 403 that carries retry-after", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw new RequestError("slow down", 403, {
        response: { headers: { "retry-after": "60" } },
      } as never);
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toThrow();
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(3);
  });

  test("retries a 403 with x-ratelimit-remaining: 0", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw new RequestError("rate limited", 403, {
        response: { headers: { "x-ratelimit-remaining": "0" } },
      } as never);
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toThrow();
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(3);
  });

  // A scope/permission 403 has no rate-limit headers: fail immediately
  // rather than burning three attempts on a permanent error.
  test("does not retry a 403 without rate-limit headers", async () => {
    const { service, octokit } = makeService();
    const requestError = new RequestError("Forbidden", 403, {} as never);
    octokit.rest.git.createRef.mockImplementation(async () => {
      throw requestError;
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toBe(requestError);
    expect(octokit.rest.git.createRef).toHaveBeenCalledTimes(1);
  });

  // A non-RequestError still gets the descriptive prefix.
  test("prefixes a plain Error from getRef", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.getRef.mockImplementation(async () => {
      throw new Error("socket hang up");
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 1),
    ).rejects.toThrow("Failed to get SHA for branch main: socket hang up");
  });
});
