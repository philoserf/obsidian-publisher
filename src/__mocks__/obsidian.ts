/**
 * Minimal mock of Obsidian APIs for testing.
 * parseYaml/stringifyYaml use JSON as a stand-in since we only need
 * basic object round-tripping in tests.
 */

export function parseYaml(text: string): unknown {
  // Simple YAML parser for test fixtures: handles key: value lines,
  // arrays like [a, b], and quoted strings
  const result: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Parse arrays like [a, b]
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
    }
    // Parse booleans and numbers
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (typeof value === "string" && /^\d+$/.test(value))
      value = Number(value);

    if (key) result[key] = value;
  }
  return result;
}

export function stringifyYaml(obj: Record<string, unknown>): string {
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
}

export class Notice {}
