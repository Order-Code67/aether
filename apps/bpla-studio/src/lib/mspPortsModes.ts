/**
 * Read/write iNav Ports (serial) and Modes via MSP + CLI fallback.
 */

import { saveAutoDiffBackup } from "@/lib/inavMspBackup";
import {
  encodeSetCfSerialConfigRequest,
  encodeSetModeRangeRequest,
  formatCliSerialLine,
  formatConfigBackupText,
  MSP_BOXIDS,
  MSP_BOXNAMES,
  MSP_CF_SERIAL_CONFIG,
  MSP_EEPROM_WRITE,
  MSP_MODE_RANGES,
  parseBoxIds,
  parseBoxNames,
  parseCfSerialConfig,
  parseCliSerialLines,
  parseModeRanges,
  type MspModeRange,
  type MspModesSnapshot,
  type MspSerialPort,
} from "@/lib/mspConfig";
import { encodeMspRequest } from "@/lib/mspMinimal";
import { latestPayload, mspRequest } from "@/lib/mspTransaction";
import { writeSerial, writeSerialBytes } from "@/lib/serial";
import { useInavStore } from "@/stores/inavStore";

const CLI_CAPTURE_MS = 1600;
const CLI_STEP_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type PortsSource = "msp" | "cli" | "none";

export interface PortsReadResult {
  ports: MspSerialPort[];
  source: PortsSource;
  /** Human-readable notice when MSP is unavailable on iNav. */
  notice?: string;
  error?: string;
}

export interface ModesReadResult {
  modes: MspModesSnapshot | null;
  error?: string;
}

/** Snapshot CLI lines appended during a short window. */
async function captureCliExchange(commands: string[]): Promise<string> {
  const startLen = useInavStore.getState().cliLines.length;
  for (const cmd of commands) {
    await writeSerial(`${cmd}\n`);
    await sleep(CLI_STEP_MS);
  }
  await sleep(CLI_CAPTURE_MS);
  const lines = useInavStore.getState().cliLines.slice(startLen);
  return lines.join("\n");
}

/**
 * Read UART roles. Tries MSP_CF_SERIAL_CONFIG first (often unused on iNav),
 * then CLI `serial`.
 */
export async function readSerialPorts(): Promise<PortsReadResult> {
  try {
    const frames = await mspRequest([MSP_CF_SERIAL_CONFIG]);
    const payload = latestPayload(frames, MSP_CF_SERIAL_CONFIG);
    if (payload && payload.length > 0) {
      const ports = parseCfSerialConfig(payload);
      if (ports && ports.length > 0) {
        return { ports, source: "msp" };
      }
    }
  } catch {
    // fall through to CLI
  }

  try {
    const text = await captureCliExchange(["#", "serial", "exit"]);
    const ports = parseCliSerialLines(text);
    if (ports.length > 0) {
      return {
        ports,
        source: "cli",
        notice:
          "MSP_CF_SERIAL_CONFIG is deprecated/unused on iNav; used CLI serial listing.",
      };
    }
    return {
      ports: [],
      source: "none",
      error: "PORTS_NO_DATA",
      notice:
        "MSP_CF_SERIAL_CONFIG returned nothing (expected on modern iNav). CLI serial parse also empty — ensure the FC is connected and not busy.",
    };
  } catch (e) {
    return {
      ports: [],
      source: "none",
      error: e instanceof Error ? e.message : "PORTS_READ_FAILED",
    };
  }
}

/**
 * Write serial port mapping. Prefers CLI on iNav (MSP set is deprecated).
 * Caller must confirm. Auto-backs up current config first.
 */
export async function writeSerialPorts(
  ports: MspSerialPort[],
  previous: MspSerialPort[],
  source: PortsSource,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  try {
    const backup = formatConfigBackupText({
      kind: "ports",
      ports: previous,
      source,
    });
    const backupPath = await saveAutoDiffBackup(backup, "ports_prewrite");

    if (source === "msp") {
      await writeSerialBytes(encodeSetCfSerialConfigRequest(ports));
      await sleep(80);
      return { ok: true, backupPath };
    }

    await writeSerial("#\n");
    await sleep(CLI_STEP_MS);
    for (const p of ports) {
      await writeSerial(`${formatCliSerialLine(p)}\n`);
      await sleep(60);
    }
    await writeSerial("exit\n");
    await sleep(CLI_STEP_MS);
    return { ok: true, backupPath };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "PORTS_WRITE_FAILED",
    };
  }
}

export async function readModes(): Promise<ModesReadResult> {
  try {
    const frames = await mspRequest([
      MSP_BOXNAMES,
      MSP_BOXIDS,
      MSP_MODE_RANGES,
    ]);
    const namesPl = latestPayload(frames, MSP_BOXNAMES);
    const idsPl = latestPayload(frames, MSP_BOXIDS);
    const rangesPl = latestPayload(frames, MSP_MODE_RANGES);
    if (!namesPl && !idsPl && !rangesPl) {
      return { modes: null, error: "MODES_NO_RESPONSE" };
    }
    const modes: MspModesSnapshot = {
      boxNames: namesPl ? parseBoxNames(namesPl) : [],
      boxIds: idsPl ? parseBoxIds(idsPl) : [],
      ranges: rangesPl ? parseModeRanges(rangesPl) : [],
    };
    return { modes };
  } catch (e) {
    return {
      modes: null,
      error: e instanceof Error ? e.message : "MODES_READ_FAILED",
    };
  }
}

/**
 * Write mode ranges via MSP_SET_MODE_RANGE for each slot.
 * Caller must confirm. Auto-backs up first.
 */
export async function writeModes(
  ranges: MspModeRange[],
  previous: MspModesSnapshot,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  try {
    const backup = formatConfigBackupText({
      kind: "modes",
      modes: previous,
      source: "msp",
    });
    const backupPath = await saveAutoDiffBackup(backup, "modes_prewrite");

    try {
      await writeSerial("exit\n");
    } catch {
      // ignore
    }
    await sleep(200);
    for (const r of ranges) {
      await writeSerialBytes(encodeSetModeRangeRequest(r));
      await sleep(40);
    }
    return { ok: true, backupPath };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "MODES_WRITE_FAILED",
    };
  }
}

/** Explicit EEPROM save (MSP) — never automatic. */
export async function eepromWriteMsp(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    try {
      await writeSerial("exit\n");
    } catch {
      // ignore
    }
    await sleep(200);
    await writeSerialBytes(encodeMspRequest(MSP_EEPROM_WRITE));
    await sleep(400);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "EEPROM_WRITE_FAILED",
    };
  }
}
