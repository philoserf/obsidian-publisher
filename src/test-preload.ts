import { mock } from "bun:test";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

mock.module("obsidian", () => ({
  parseYaml: yamlParse,

  stringifyYaml: yamlStringify,

  // Records what was shown so tests can assert on user-visible text, and
  // implements the setMessage/hide pair the real Notice has
  // (obsidian.d.ts:4643, :4649).
  Notice: class Notice {
    static shown: Array<{ message: string; duration?: number }> = [];
    message: string;
    duration?: number;
    constructor(message: string, duration?: number) {
      this.message = message;
      this.duration = duration;
      (this.constructor as typeof Notice).shown.push({ message, duration });
    }
    setMessage(message: string) {
      this.message = message;
      return this;
    }
    // Kept because main.ts:52 calls it; the tests observe dismissal
    // through Notice.shown and the recorded durations, not through a flag.
    hide() {}
  },

  debounce<T extends unknown[]>(cb: (...args: T) => unknown) {
    // Tests don't exercise timing — invoke immediately. `cancel` is a
    // no-op and is live (main.ts:89, settings.ts:118); Obsidian's
    // Debouncer also has `run`, which the plugin never calls.
    const fn = (...args: T): unknown => cb(...args);
    (fn as unknown as { cancel: () => void }).cancel = () => {};
    return fn;
  },

  // main.ts evaluates `class ObsidianPublisher extends Plugin` at module
  // load, and main.test.ts drives onload(), so this needs the surface that
  // onload/onunload actually touch: app, addCommand, addSettingTab,
  // loadData, saveData. Nothing in src/ uses registerEvent or ribbons.
  Plugin: class Plugin {
    app: unknown;
    commands: Array<Record<string, unknown>> = [];
    settingTabs: unknown[] = [];
    data: unknown = null;
    constructor(app?: unknown) {
      this.app = app;
    }
    addCommand(command: Record<string, unknown>) {
      this.commands.push(command);
      return command;
    }
    addSettingTab(tab: unknown) {
      this.settingTabs.push(tab);
    }
    async loadData() {
      return this.data;
    }
    async saveData(data: unknown) {
      this.data = data;
    }
  },

  PluginSettingTab: class PluginSettingTab {},

  // Bare on purpose: settings.ts imports Setting as a value at module top
  // level (#264), but no test calls PublisherSettingTab.display(), so its
  // builder methods were never invoked. A mock method no test reaches
  // claims the settings UI is exercised when it is not.
  //
  // If you add a test that drives display() against a container stub —
  // #314 collapses the onChange normalizers and is the likely reason to —
  // restore the chainable no-ops along with it.
  Setting: class Setting {},
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
