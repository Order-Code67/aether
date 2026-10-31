import type { ProfileExportBundle } from "@/types";

/** Pure validation for profile import (unit-tested). */
export function validateProfileBundle(
  raw: unknown,
): ProfileExportBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== "aether-gs-profile") return null;
  if (o.version !== 1) return null;
  if (!o.profile || typeof o.profile !== "object") return null;
  const p = o.profile as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.name !== "string") return null;
  if (!Array.isArray(p.deviceIds)) return null;
  return o as unknown as ProfileExportBundle;
}
