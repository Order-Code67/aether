/**
 * ArduPilot-style searchable parameter tree from iNav/Betaflight CLI
 * (`set name = value`, `feature`, `mixer`, dump/diff lines).
 */

export interface FcCliParam {
  name: string;
  value: string;
  /** Source line as captured. */
  raw: string;
  kind: "set" | "feature" | "mixer" | "other";
}

export interface FcCliParamGroup {
  id: string;
  label: string;
  /** Match param name (lowercase) against any of these prefixes. */
  prefixes: string[];
}

/** Groups inspired by iNav + Betaflight + ArduPilot parameter browsers. */
export const FC_PARAM_GROUPS: FcCliParamGroup[] = [
  { id: "pid_mc", label: "PID (multirotor)", prefixes: ["mc_p_", "mc_i_", "mc_d_", "mc_ff_", "mc_cd_"] },
  { id: "pid_fw", label: "PID (airplane / wing)", prefixes: ["fw_p_", "fw_i_", "fw_d_", "fw_ff_", "fw_cd_"] },
  { id: "rates", label: "Rates / expo", prefixes: ["rate_", "rc_", "thr_", "tpa_", "dterm_", "roll_rate", "pitch_rate", "yaw_rate"] },
  { id: "battery", label: "Battery / current", prefixes: ["vbat_", "battery_", "current_", "cell_", "power_"] },
  { id: "failsafe", label: "Failsafe", prefixes: ["failsafe_"] },
  { id: "gps_nav", label: "GPS / Navigation", prefixes: ["nav_", "gps_", "inav_", "rth_", "waypoint_"] },
  { id: "rx", label: "Receiver", prefixes: ["rx_", "serialrx_", "rssi_", "sbus_", "crsf_", "ibus_"] },
  { id: "osd", label: "OSD / VTX", prefixes: ["osd_", "vtx_", "display_"] },
  { id: "filter", label: "Filters", prefixes: ["gyro_", "dterm_lpf", "lpf_", "notch_", "dyn_"] },
  { id: "servo", label: "Servos / mixer", prefixes: ["servo_", "mixer_", "smix_", "platform_"] },
  { id: "misc", label: "Other", prefixes: [] },
];

const SET_RE = /^\s*set\s+([a-zA-Z0-9_]+)\s*=\s*(.+?)\s*$/i;
const FEATURE_RE = /^\s*feature\s+(-)?([a-zA-Z0-9_]+)\s*$/i;
const MIXER_RE = /^\s*mixer\s+([a-zA-Z0-9_]+)\s*$/i;

/** Parse dump / diff / CLI capture into parameters. */
export function parseCliParams(text: string): FcCliParam[] {
  const out: FcCliParam[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const setM = SET_RE.exec(trimmed);
    if (setM) {
      const name = setM[1]!.toLowerCase();
      const value = setM[2]!.trim();
      const key = `set:${name}`;
      if (seen.has(key)) {
        const idx = out.findIndex((p) => p.kind === "set" && p.name === name);
        if (idx >= 0) out[idx] = { name, value, raw: trimmed, kind: "set" };
      } else {
        seen.add(key);
        out.push({ name, value, raw: trimmed, kind: "set" });
      }
      continue;
    }

    const featM = FEATURE_RE.exec(trimmed);
    if (featM) {
      const off = featM[1] === "-";
      const name = featM[2]!.toUpperCase();
      const key = `feature:${name}`;
      const value = off ? "OFF" : "ON";
      if (seen.has(key)) {
        const idx = out.findIndex((p) => p.kind === "feature" && p.name === name);
        if (idx >= 0) out[idx] = { name, value, raw: trimmed, kind: "feature" };
      } else {
        seen.add(key);
        out.push({ name, value, raw: trimmed, kind: "feature" });
      }
      continue;
    }

    const mixM = MIXER_RE.exec(trimmed);
    if (mixM) {
      const name = "mixer";
      const value = mixM[1]!.toUpperCase();
      const key = "mixer";
      if (seen.has(key)) {
        const idx = out.findIndex((p) => p.kind === "mixer");
        if (idx >= 0) out[idx] = { name, value, raw: trimmed, kind: "mixer" };
      } else {
        seen.add(key);
        out.push({ name, value, raw: trimmed, kind: "mixer" });
      }
    }
  }
  return out;
}

export function groupForParam(name: string): string {
  const lower = name.toLowerCase();
  for (const g of FC_PARAM_GROUPS) {
    if (g.id === "misc") continue;
    if (g.prefixes.some((p) => lower.startsWith(p))) return g.id;
  }
  return "misc";
}

export function filterCliParams(
  params: FcCliParam[],
  query: string,
  groupId: string | "all",
): FcCliParam[] {
  const q = query.trim().toLowerCase();
  return params.filter((p) => {
    if (groupId !== "all" && groupForParam(p.name) !== groupId) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.value.toLowerCase().includes(q) ||
      p.raw.toLowerCase().includes(q)
    );
  });
}

/** Format a param write as CLI line(s). */
export function formatCliParamWrite(param: FcCliParam): string {
  if (param.kind === "feature") {
    return param.value.toUpperCase() === "OFF"
      ? `feature -${param.name}`
      : `feature ${param.name}`;
  }
  if (param.kind === "mixer") {
    return `mixer ${param.value}`;
  }
  return `set ${param.name} = ${param.value}`;
}

/** Extract named set-values into a map (lowercase keys). */
export function cliParamsToMap(params: FcCliParam[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of params) {
    if (p.kind === "set") map.set(p.name.toLowerCase(), p.value);
    else if (p.kind === "mixer") map.set("mixer", p.value);
    else if (p.kind === "feature") map.set(`feature:${p.name}`, p.value);
  }
  return map;
}

export function getMapNumber(map: Map<string, string>, key: string): number | null {
  const v = map.get(key.toLowerCase());
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getMapString(map: Map<string, string>, key: string): string | null {
  return map.get(key.toLowerCase()) ?? null;
}
