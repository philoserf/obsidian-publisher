#!/usr/bin/env bun

/**
 * Validation script that runs before publishing
 * Uses bun's native runtime for fast execution
 */

import { readFileSync } from "node:fs";
import { $ } from "bun";

console.log("🔍 Validating Obsidian Publisher plugin...\n");

let errors = 0;

// Check manifest.json
try {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));
  console.log("✓ manifest.json is valid JSON");

  if (!manifest.id || !manifest.name || !manifest.version) {
    console.error("✗ manifest.json missing required fields");
    errors++;
  } else {
    console.log(`  Plugin: ${manifest.name} v${manifest.version}`);
  }
} catch (error) {
  console.error("✗ manifest.json is invalid:", error);
  errors++;
}

// Check package.json version matches manifest
try {
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
  const manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));

  if (pkg.version !== manifest.version) {
    console.error(
      `✗ Version mismatch: package.json (${pkg.version}) != manifest.json (${manifest.version})`,
    );
    errors++;
  } else {
    console.log("✓ Version numbers match");
  }
} catch (error) {
  console.error("✗ Version check failed:", error);
  errors++;
}

// Run TypeScript type checking
console.log("\n📝 Type checking...");
const typecheckResult = await $`bun run typecheck`.nothrow();
if (typecheckResult.exitCode === 0) {
  console.log("✓ Type checking passed");
} else {
  console.error("✗ Type checking failed");
  errors++;
}

// Run tests
console.log("\n🧪 Running tests...");
const testResult = await $`bun test`.nothrow();
if (testResult.exitCode === 0) {
  console.log("✓ All tests passed");
} else {
  console.error("✗ Tests failed");
  errors++;
}

// Run linter
console.log("\n🔧 Linting...");
const lintResult = await $`bun run check`.nothrow();
if (lintResult.exitCode === 0) {
  console.log("✓ Linting passed");
} else {
  console.error("✗ Linting failed");
  errors++;
}

// Build the plugin
console.log("\n📦 Building plugin...");
const buildResult = await $`bun run build`.nothrow();
if (buildResult.exitCode === 0) {
  console.log("✓ Build successful");

  // Check if main.js exists
  const mainFile = Bun.file("main.js");
  if (await mainFile.exists()) {
    const size = mainFile.size / 1024;
    console.log(`  Output: main.js (${size.toFixed(2)} KB)`);
  } else {
    console.error("✗ main.js not found after build");
    errors++;
  }
} else {
  console.error("✗ Build failed");
  errors++;
}

// Summary
console.log(`\n${"=".repeat(50)}`);
if (errors === 0) {
  console.log("✅ All validations passed! Plugin is ready.");
  process.exit(0);
} else {
  console.log(`❌ Validation failed with ${errors} error(s).`);
  process.exit(1);
}
