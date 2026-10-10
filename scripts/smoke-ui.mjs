#!/usr/bin/env node
/**
 * Hybrid UI smoke runner for Aether.
 * Runs Vitest contracts + Playwright (Vite preview) and prints the manual WebView2 checklist.
 * Full Playwright ↔ WebView2 e2e is intentionally not required here.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(root, "docs", "E2E_SMOKE.md");

console.log("Aether smoke:ui — hybrid (Vitest contracts + Playwright + checklist)\n");

if (!existsSync(docPath)) {
  console.error("Missing docs/E2E_SMOKE.md");
  process.exit(1);
}

const doc = readFileSync(docPath, "utf8");
const checklist = doc
  .split("\n")
  .filter((line) => /^\d+\.\s+\*\*/.test(line.trim()) || /^- \[ \]/.test(line.trim()))
  .slice(0, 32);

console.log("Manual checklist (tauri:dev) — see docs/E2E_SMOKE.md:\n");
for (const line of checklist.length ? checklist : [
  "1. Monaco typing",
  "2. Search focus",
  "3. Terminal inactive while hidden",
  "4. Open in VS Code error paths",
  "5. Upload disconnects Serial + Access denied retry",
  "6. Quick Start / Libraries tabs / Camera / Plotter",
  "7. Save Support Report to Documents/Aether/logs",
]) {
  console.log(`  ${line}`);
}
console.log("");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args) =>
  spawnSync(npmCmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

const contracts = run(["run", "test:contracts"]);
if ((contracts.status ?? 1) !== 0) {
  process.exit(contracts.status ?? 1);
}

const e2e = run(["run", "test:e2e"]);
process.exit(e2e.status ?? 1);
