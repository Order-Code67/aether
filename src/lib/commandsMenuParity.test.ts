import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getCommands, runCommandById } from "./commands";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function menuCommandIdsFromRust(): string[] {
  const menuRs = readFileSync(join(root, "src-tauri/src/menu.rs"), "utf8");
  const ids = [
    ...menuRs.matchAll(/MenuItem::with_id\(\s*app,\s*"([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(ids)];
}

describe("native menu ↔ command registry", () => {
  it("maps every custom menu id to a command", () => {
    const menuIds = menuCommandIdsFromRust();
    expect(menuIds.length).toBeGreaterThan(10);
    const commandIds = new Set(getCommands().map((c) => c.id));
    const missing = menuIds.filter((id) => !commandIds.has(id));
    expect(missing).toEqual([]);
  });

  it("runs every registered command without throwing synchronously", () => {
    for (const cmd of getCommands()) {
      expect(() => {
        const result = cmd.run();
        if (
          result != null &&
          typeof (result as Promise<void>).catch === "function"
        ) {
          void (result as Promise<void>).catch(() => undefined);
        }
      }).not.toThrow();
    }
  });

  it("surfaces unknown command ids", () => {
    expect(runCommandById("__no_such_command__")).toBe(false);
  });
});
