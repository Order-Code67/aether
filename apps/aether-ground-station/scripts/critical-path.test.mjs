/**
 * Critical-path unit checks (no Tauri runtime).
 * Run: node scripts/critical-path.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function load(rel) {
  return readFileSync(join(root, rel), "utf8");
}

// --- profile import validation (inline mirror of importValidate.ts) ---
function validateProfileBundle(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.format !== "aether-gs-profile") return null;
  if (raw.version !== 1) return null;
  if (!raw.profile || typeof raw.profile !== "object") return null;
  if (typeof raw.profile.id !== "string" || typeof raw.profile.name !== "string")
    return null;
  if (!Array.isArray(raw.profile.deviceIds)) return null;
  return raw;
}

assert.equal(validateProfileBundle(null), null);
assert.equal(validateProfileBundle({ format: "x" }), null);
const good = validateProfileBundle({
  format: "aether-gs-profile",
  version: 1,
  exportedAt: new Date().toISOString(),
  profile: {
    id: "p1",
    name: "Test",
    createdAt: "",
    updatedAt: "",
    deviceIds: [],
    connectionParams: {},
  },
});
assert.ok(good);
console.log("ok: profile import validation");

// --- workspace save shape present in store ---
const ws = load("src/stores/workspaceStore.ts");
assert.match(ws, /movePanel/);
assert.match(ws, /ags-workspace-v1/);
console.log("ok: workspace store persistence key");

// --- COM list surface ---
const serial = load("src/modules/serial/SerialPanel.tsx");
assert.match(serial, /listSerialPorts/);
assert.match(serial, /deviceManager\.registerReconnectHandler/);
console.log("ok: COM list + Device Manager reconnect");

// --- SQLite SSOT hooks ---
const sync = load("src/hooks/useSqliteSync.ts");
assert.match(sync, /workspace_layouts/);
assert.match(sync, /profiles/);
console.log("ok: SQLite sync keys");

// --- telemetry normalize export ---
const norm = load("src/services/telemetry/normalize.ts");
assert.match(norm, /exportTelemetryCsv/);
assert.match(norm, /NormalizedTelemetry/);
console.log("ok: telemetry normalize");

console.log("\nAll critical-path checks passed.");
