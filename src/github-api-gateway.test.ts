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
  test("creates blobs, tree, commit, and updates ref", async () => {
    const { service, octokit } = makeService();

    await service.commitFiles(
      [{ path: "content/test.md", content: "hello" }],
      "test commit",
      "main",
    );

    expect(octokit.rest.git.getRef).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.createTree).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.createCommit).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.updateRef).toHaveBeenCalledTimes(1);
  });

  test("creates one blob per file", async () => {
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

    expect(octokit.rest.git.createBlob).toHaveBeenCalledTimes(3);
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

  // Documents #242. getBranchSha hand-rolls a catch that wraps
  // RequestError into a plain Error, destroying .status, so a transient
  // failure on the FIRST call of createBranch is treated as permanent.
  // getRef is the call to count here: createRef is never reached.
  // This assertion flips to 3 when #242 is fixed.
  test("does NOT retry a 503 from getRef (#242 — status is destroyed)", async () => {
    const { service, octokit } = makeService();
    octokit.rest.git.getRef.mockImplementation(async () => {
      throw new RequestError("service unavailable", 503, {} as never);
    });
    await expect(
      service.createBranchWithRetry("publish", "main", 3),
    ).rejects.toThrow();
    expect(octokit.rest.git.getRef).toHaveBeenCalledTimes(1);
    expect(octokit.rest.git.createRef).not.toHaveBeenCalled();
  });
});
