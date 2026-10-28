import type {
  BatchPublishResult,
  Preflight,
  PublishResult,
  PublishWarning,
} from "./types";

type NamedImageWarning = Extract<PublishWarning, { name: string }>;

export function formatBatchNotice(result: BatchPublishResult): string {
  if (result.cancelled) return "Publish All cancelled: nothing was committed";
  if (result.error) return `✗ Failed to publish: ${result.error}`;
  if (result.total === 0) return "No publishable notes found";
  if (result.successful === 0) {
    return "All files failed to process. No PR created.";
  }
  const removed = result.deleted?.length
    ? `, ${result.deleted.length} removed`
    : "";
  return `Batch publish complete: ${result.successful} succeeded, ${result.failed} failed${removed}`;
}

function formatNamedImageWarnings(
  warnings: PublishWarning[],
  kind: NamedImageWarning["kind"],
  format: (names: string[]) => string,
): string | undefined {
  const filtered = warnings.filter(
    (w): w is NamedImageWarning => w.kind === kind,
  );
  if (filtered.length === 0) return undefined;
  const names = [...new Set(filtered.map((w) => w.name))];
  return format(names);
}

/**
 * Format non-fatal publish warnings into user-facing notice strings,
 * one per warning kind that occurred.
 */
export function formatWarnings(warnings: PublishWarning[]): string[] {
  const messages: string[] = [];

  const failed = formatNamedImageWarnings(
    warnings,
    "image-failed",
    (names) => `Warning: ${names.length} image(s) failed: ${names.join(", ")}`,
  );
  if (failed) messages.push(failed);

  const collisions = formatNamedImageWarnings(
    warnings,
    "image-collision",
    (names) =>
      `Warning: ${names.length} image basename(s) collide, skipped: ${names.join(", ")}`,
  );
  if (collisions) messages.push(collisions);

  const targetCollisions = warnings.filter(
    (w): w is Extract<PublishWarning, { kind: "image-target-collision" }> =>
      w.kind === "image-target-collision",
  );
  if (targetCollisions.length > 0) {
    // One warning per (file, collision) pair can mean multiple warnings for
    // the same targetPath when 3+ sources collide. Union sourceNames per
    // target so every contributor reaches the user.
    const byTarget = new Map<string, Set<string>>();
    for (const w of targetCollisions) {
      const names = byTarget.get(w.targetPath) ?? new Set<string>();
      for (const n of w.sourceNames) names.add(n);
      byTarget.set(w.targetPath, names);
    }
    const details = [...byTarget.entries()]
      .map(([target, names]) => `${target} (${[...names].sort().join(", ")})`)
      .join("; ");
    messages.push(
      `Warning: ${byTarget.size} image target(s) collide, overwrites skipped: ${details}`,
    );
  }

  const labelFailures = warnings.filter((w) => w.kind === "pr-label-failed");
  if (labelFailures.length > 0) {
    const all = [...new Set(labelFailures.flatMap((w) => w.labels))];
    messages.push(`Warning: failed to apply PR labels: ${all.join(", ")}`);
  }

  return messages;
}

/**
 * The `publisher:preflight` CLI output: `ok`, or the reason the note would
 * fail, then one line per warning. Line-oriented and stable, because the
 * vault's `/publish` skill parses it — the first line is the verdict.
 */
export function formatPreflight(preflight: Preflight): string {
  const verdict = preflight.ok ? "ok" : preflight.error;
  return [verdict, ...formatWarnings(preflight.warnings)].join("\n");
}

/**
 * The `publisher:publish` CLI output, in `formatPreflight`'s shape: `ok`
 * and the pull request URL, or the reason the publish failed, then one line
 * per warning. The first line is the verdict.
 */
export function formatPublish(result: PublishResult): string {
  const verdict = result.success
    ? ["ok", result.prUrl].filter(Boolean).join(" ")
    : result.error;
  return [verdict, ...formatWarnings(result.warnings)].join("\n");
}
