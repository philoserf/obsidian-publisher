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
    addToggle() {
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
  RequestError: class RequestError extends Error {
    status: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.status = statusCode;
    }
  },
}));
