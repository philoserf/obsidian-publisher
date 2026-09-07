import { mock } from "bun:test";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

mock.module("obsidian", () => ({
  parseYaml: yamlParse,

  stringifyYaml: yamlStringify,

  Notice: class Notice {},

  debounce<T extends unknown[]>(cb: (...args: T) => unknown) {
    // Tests don't exercise timing — invoke immediately.
    // cancel is a no-op; run invokes the callback.
    const fn = (...args: T): unknown => cb(...args);
    (fn as unknown as { cancel: () => void }).cancel = () => {};
    (fn as unknown as { run: (...args: T) => unknown }).run = (
      ...args: T
    ): unknown => cb(...args);
    return fn;
  },

  // Needed once main.test.ts exists (#237): main.ts evaluates
  // `class ObsidianPublisher extends Plugin` at module load.
  Plugin: class Plugin {},

  PluginSettingTab: class PluginSettingTab {},

  Setting: class Setting {
    setName() {
      return this;
    }
    setDesc() {
      return this;
    }
    addText() {
      return this;
    }
    addTextArea() {
      return this;
    }
    addButton() {
      return this;
    }
  },
}));

mock.module("@octokit/rest", () => ({
  Octokit: class MockOctokit {},
}));

mock.module("@octokit/request-error", () => ({
  // The real third argument requires `request`, which tests don't need;
  // call sites pass `{} as never` unless they're exercising the
  // header-gated 403 branch, which reads response.headers.
  RequestError: class RequestError extends Error {
    status: number;
    response?: { headers?: Record<string, string> };
    constructor(
      message: string,
      statusCode: number,
      options?: { response?: { headers?: Record<string, string> } },
    ) {
      super(message);
      this.status = statusCode;
      this.response = options?.response;
    }
  },
}));
