import { describe, expect, mock, test } from "bun:test";
import { GitHubService } from "./github-service";
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

function makeService(octokitOverrides: Record<string, unknown> = {}) {
  const service = new GitHubService(makeSettings());
  const octokit = makeOctokit(octokitOverrides);
  (service as unknown as Record<string, unknown>).octokit = octokit;
  return { service, octokit };
}

describe("GitHubService.getRepoUrl", () => {
  test("returns correct URL", () => {
    const service = new GitHubService(makeSettings());
    expect(service.getRepoUrl()).toBe("https://github.com/testowner/testrepo");
  });
});

describe("GitHubService.generateBranchName", () => {
  test("generates branch name with prefix", () => {
    const service = new GitHubService(makeSettings());
    const name = service.generateBranchName("publish");
    expect(name).toMatch(/^publish\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });

  test("uses default prefix", () => {
    const service = new GitHubService(makeSettings());
    const name = service.generateBranchName();
    expect(name).toStartWith("publish/");
  });
});

describe("GitHubService.validateConnection", () => {
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

describe("GitHubService.commitFiles", () => {
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
});

describe("GitHubService.createPullRequest", () => {
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
    expect(result.number).toBe(1);
    expect(octokit.rest.pulls.create).toHaveBeenCalledTimes(1);
    expect(octokit.rest.issues.addLabels).toHaveBeenCalledTimes(1);
  });

  test("skips labels when none provided", async () => {
    const { service, octokit } = makeService();

    await service.createPullRequest("feature", "main", "title", "body");

    expect(octokit.rest.issues.addLabels).not.toHaveBeenCalled();
  });
});

describe("GitHubService.createBranchWithRetry", () => {
  test("creates branch on first attempt", async () => {
    const { service } = makeService();

    const name = await service.createBranchWithRetry("publish", "main");

    expect(name).toMatch(/^publish\//);
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
});
