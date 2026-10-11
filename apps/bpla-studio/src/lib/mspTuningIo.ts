/**
 * Read/write FC tuning via CLI (+ MSP for live RC/attitude).
 * Auto-backup before writes. Never EEPROM unless caller uses eepromWriteMsp.
 */

import { saveAutoDiffBackup } from "@/lib/inavMspBackup";
import {
  formatBatteryCliLines,
  formatFailsafeCliLines,
  formatMixerCliLines,
  formatPidCliLines,
  formatRatesCliLines,
  MSP_ATTITUDE,
  MSP_RC,
  parseAttitude,
  parseRcChannels,
  tuningFromCliText,
  type AttitudeSnapshot,
  type BatteryConfig,
  type FailsafeConfig,
  type MixerInfo,
  type PidProfile,
  type RatesProfile,
  type RcChannels,
  type TuningSnapshot,
} from "@/lib/mspTuning";
import { latestPayload, mspRequest } from "@/lib/mspTransaction";
import { writeSerial } from "@/lib/serial";
import { useInavStore } from "@/stores/inavStore";

const CLI_STEP_MS = 60;
const CLI_CAPTURE_MS = 2200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
 * Load tuning snapshot. Prefers existing diffBuffer; otherwise runs `diff all`.
 */
export async function readTuningSnapshot(opts?: {
  forceRefresh?: boolean;
}): Promise<
  { ok: true; snapshot: TuningSnapshot } | { ok: false; error: string }
> {
  try {
    let text = useInavStore.getState().diffBuffer.trim();
    if (!text || opts?.forceRefresh) {
      useInavStore.getState().setDiffBuffer("");
      useInavStore.getState().setCapturingDiff(true);
      const captured = await captureCliExchange(["#", "diff all", "exit"]);
      useInavStore.getState().setCapturingDiff(false);
      text = captured;
      if (text.trim()) {
        useInavStore.getState().setDiffBuffer(text);
      }
    }
    if (!text.trim()) {
      return { ok: false, error: "TUNING_NO_DATA" };
    }
    return { ok: true, snapshot: tuningFromCliText(text) };
  } catch (e) {
    useInavStore.getState().setCapturingDiff(false);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "TUNING_READ_FAILED",
    };
  }
}

/** Send CLI lines inside a # … exit session with backup. */
export async function writeCliLines(
  lines: string[],
  backupLabel: string,
  backupBody?: string,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  if (lines.length === 0) {
    return { ok: false, error: "TUNING_EMPTY_WRITE" };
  }
  try {
    const body =
      backupBody ??
      `# Aether pre-write backup (${backupLabel})\n${lines.join("\n")}\n`;
    const backupPath = await saveAutoDiffBackup(body, backupLabel);

    await writeSerial("#\n");
    await sleep(CLI_STEP_MS);
    for (const line of lines) {
      await writeSerial(`${line}\n`);
      await sleep(CLI_STEP_MS);
    }
    await writeSerial("exit\n");
    await sleep(CLI_STEP_MS);
    return { ok: true, backupPath };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "TUNING_WRITE_FAILED",
    };
  }
}

export async function writePidProfile(
  pid: PidProfile,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  const lines = formatPidCliLines(pid);
  return writeCliLines(lines, "pid_prewrite", lines.join("\n") + "\n");
}

export async function writeRatesProfile(
  rates: RatesProfile,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  const lines = formatRatesCliLines(rates);
  return writeCliLines(lines, "rates_prewrite", lines.join("\n") + "\n");
}

export async function writeBatteryConfig(
  bat: BatteryConfig,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  const lines = formatBatteryCliLines(bat);
  return writeCliLines(lines, "battery_prewrite", lines.join("\n") + "\n");
}

export async function writeFailsafeConfig(
  fs: FailsafeConfig,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  const lines = formatFailsafeCliLines(fs);
  return writeCliLines(lines, "failsafe_prewrite", lines.join("\n") + "\n");
}

export async function writeMixerConfig(
  mixer: MixerInfo,
): Promise<
  { ok: true; backupPath: string | null } | { ok: false; error: string }
> {
  const lines = formatMixerCliLines(mixer);
  return writeCliLines(lines, "mixer_prewrite", lines.join("\n") + "\n");
}

export async function pollRcChannels(): Promise<
  { ok: true; rc: RcChannels } | { ok: false; error: string }
> {
  try {
    const frames = await mspRequest([MSP_RC], { waitMs: 600 });
    const payload = latestPayload(frames, MSP_RC);
    if (!payload) return { ok: false, error: "RC_NO_RESPONSE" };
    const rc = parseRcChannels(payload);
    if (!rc) return { ok: false, error: "RC_PARSE_FAILED" };
    return { ok: true, rc };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "RC_POLL_FAILED",
    };
  }
}

export async function pollAttitude(): Promise<
  { ok: true; attitude: AttitudeSnapshot } | { ok: false; error: string }
> {
  try {
    const frames = await mspRequest([MSP_ATTITUDE], { waitMs: 500 });
    const payload = latestPayload(frames, MSP_ATTITUDE);
    if (!payload) return { ok: false, error: "ATT_NO_RESPONSE" };
    const attitude = parseAttitude(payload);
    if (!attitude) return { ok: false, error: "ATT_PARSE_FAILED" };
    return { ok: true, attitude };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ATT_POLL_FAILED",
    };
  }
}
