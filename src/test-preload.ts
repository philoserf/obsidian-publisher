import { mock } from "bun:test";

mock.module("obsidian", () => ({
  parseYaml(text: string): unknown {
    const result: Record<string, unknown> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      let value: unknown = trimmed.slice(colonIdx + 1).trim();

      if (
        typeof value === "string" &&
        value.startsWith("[") &&
        value.endsWith("]")
      ) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (typeof value === "string" && /^\d+$/.test(value))
        value = Number(value);
      else if (
        typeof value === "string" &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }

      if (key) result[key] = value;
    }
    return result;
  },

  stringifyYaml(obj: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.join(", ")}]`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    return `${lines.join("\n")}\n`;
  },

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
