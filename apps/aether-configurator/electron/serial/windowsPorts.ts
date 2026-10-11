/**
 * Windows COM enumeration fallback.
 * serialport's SetupAPI list often returns [] for phantom / odd drivers;
 * PnP still knows the COMx names the user expects (CH340, STM VCP, FTDI…).
 */

import { execFile } from "node:child_process";
import type { SerialPortInfo } from "./SerialManager";

function parseComToken(text: string): string | null {
  const m = text.match(/\((COM\d+)\)/i) ?? text.match(/\b(COM\d+)\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

function run(
  file: string,
  args: string[],
): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 8000,
        maxBuffer: 2 * 1024 * 1024,
      },
      (err, stdout) => {
        resolve({ ok: !err || Boolean(stdout), stdout: String(stdout ?? "") });
      },
    );
  });
}

/** HKLM\HARDWARE\DEVICEMAP\SERIALCOMM — classic mapping, offline. */
export async function listWindowsRegistryPorts(): Promise<SerialPortInfo[]> {
  if (process.platform !== "win32") return [];
  const { stdout } = await run("reg.exe", [
    "query",
    "HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM",
  ]);
  const ports: SerialPortInfo[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/\s(COM\d+)\s*$/i);
    if (!m) continue;
    const path = m[1]!.toUpperCase();
    if (seen.has(path)) continue;
    seen.add(path);
    ports.push({ path, name: path, portType: "serial" });
  }
  return ports;
}

/**
 * List Ports-class PnP devices via PowerShell (works offline, no network).
 * Includes phantom entries so the user can still pick a known COM name.
 */
export async function listWindowsPnpPorts(): Promise<SerialPortInfo[]> {
  if (process.platform !== "win32") return [];

  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "Get-PnpDevice -Class Ports | ForEach-Object {",
    "  $name = $_.FriendlyName",
    "  if (-not $name) { return }",
    "  Write-Output ($name + [char]9 + $_.Status + [char]9 + $_.InstanceId)",
    "}",
  ].join("; ");

  const { stdout } = await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);

  const ports: SerialPortInfo[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name = "", status = "", instanceId = ""] = trimmed.split("\t");
    const path = parseComToken(name);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const present = /^ok$/i.test(status);
    ports.push({
      path,
      name: present ? name : `${name} [${status || "offline"}]`,
      portType: present ? "serial" : "phantom",
      manufacturer: instanceId.includes("VID_")
        ? instanceId.split("\\")[0]
        : undefined,
    });
  }
  return ports;
}

/** Best-effort Windows enumeration used when serialport returns nothing. */
export async function listWindowsPortsFallback(): Promise<SerialPortInfo[]> {
  const pnp = await listWindowsPnpPorts();
  if (pnp.length > 0) {
    return pnp.sort((a, b) =>
      a.path.localeCompare(b.path, undefined, { numeric: true }),
    );
  }
  const reg = await listWindowsRegistryPorts();
  return reg.sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true }),
  );
}

/** Merge by path; prefer richer friendly names / live serialport entries. */
export function mergePortLists(
  primary: SerialPortInfo[],
  secondary: SerialPortInfo[],
): SerialPortInfo[] {
  const map = new Map<string, SerialPortInfo>();
  for (const p of secondary) map.set(p.path.toUpperCase(), p);
  for (const p of primary) {
    const key = p.path.toUpperCase();
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, ...p, name: p.name || prev.name } : p);
  }
  return [...map.values()].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true }),
  );
}
