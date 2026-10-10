import type { FirmwareProfile } from "@/stores/firmwareProfileStore";

export const FIRMWARE_PROFILES_FORMAT = "aether.firmwareProfiles" as const;
export const FIRMWARE_PROFILES_VERSION = 1;

export type FirmwareProfilesIoErrorKey =
  | "profiles.importInvalidJson"
  | "profiles.importInvalidSchema"
  | "profiles.importEmpty";

export interface FirmwareProfilesFile {
  format: typeof FIRMWARE_PROFILES_FORMAT;
  version: number;
  exportedAt: number;
  profiles: FirmwareProfile[];
}

export type ParseFirmwareProfilesResult =
  | { ok: true; profiles: FirmwareProfile[] }
  | { ok: false; errorKey: FirmwareProfilesIoErrorKey };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

function parseProfile(raw: unknown): FirmwareProfile | null {
  if (!isPlainObject(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const env = typeof raw.env === "string" ? raw.env : "";
  const uploadPort = typeof raw.uploadPort === "string" ? raw.uploadPort : "";
  if (!name) return null;

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `fp_import_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const updatedAt =
    typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now();
  const monitorBaud =
    typeof raw.monitorBaud === "number" && Number.isFinite(raw.monitorBaud)
      ? raw.monitorBaud
      : undefined;

  return {
    id,
    name,
    env,
    uploadPort,
    projectRootHint: asOptionalString(raw.projectRootHint),
    sketchPath: asOptionalString(raw.sketchPath),
    monitorBaud,
    updatedAt,
  };
}

/** Validate portable JSON backup of firmware profiles. */
export function parseFirmwareProfilesJson(text: string): ParseFirmwareProfilesResult {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, errorKey: "profiles.importInvalidJson" };
  }

  // Accept either wrapped file or bare array of profiles
  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (isPlainObject(data) && Array.isArray(data.profiles)) {
    if (
      data.format !== undefined &&
      data.format !== FIRMWARE_PROFILES_FORMAT
    ) {
      return { ok: false, errorKey: "profiles.importInvalidSchema" };
    }
    if (
      data.version !== undefined &&
      (typeof data.version !== "number" || data.version < 1)
    ) {
      return { ok: false, errorKey: "profiles.importInvalidSchema" };
    }
    list = data.profiles;
  } else {
    return { ok: false, errorKey: "profiles.importInvalidSchema" };
  }

  const profiles: FirmwareProfile[] = [];
  for (const item of list) {
    const profile = parseProfile(item);
    if (!profile) {
      return { ok: false, errorKey: "profiles.importInvalidSchema" };
    }
    profiles.push(profile);
  }

  if (profiles.length === 0) {
    return { ok: false, errorKey: "profiles.importEmpty" };
  }

  return { ok: true, profiles };
}

export function buildFirmwareProfilesFile(
  profiles: FirmwareProfile[],
): FirmwareProfilesFile {
  return {
    format: FIRMWARE_PROFILES_FORMAT,
    version: FIRMWARE_PROFILES_VERSION,
    exportedAt: Date.now(),
    profiles: profiles.map((p) => ({ ...p })),
  };
}

export function serializeFirmwareProfiles(profiles: FirmwareProfile[]): string {
  return `${JSON.stringify(buildFirmwareProfilesFile(profiles), null, 2)}\n`;
}

/** Merge imported profiles by id (imported wins on conflict). */
export function mergeFirmwareProfiles(
  existing: FirmwareProfile[],
  imported: FirmwareProfile[],
): FirmwareProfile[] {
  const byId = new Map<string, FirmwareProfile>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of imported) byId.set(p.id, p);
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}
