/**
 * Read-only MSP status poll over the shared serial port.
 * Sends `exit` first so the FC leaves CLI mode when possible.
 */

import {
  applyMspFrameToSnapshot,
  emptySnapshot,
  encodeMspRequest,
  MspMinimalParser,
  MSP_STATUS_POLL_CMDS,
  type MspStatusSnapshot,
} from "@/lib/mspMinimal";
import { writeSerial, writeSerialBytes } from "@/lib/serial";

const INTER_CMD_MS = 40;
const EXIT_WAIT_MS = 250;
const RESPONSE_WINDOW_MS = 1200;

export type MspPollResult =
  | { ok: true; snapshot: MspStatusSnapshot }
  | { ok: false; error: string; snapshot: MspStatusSnapshot };

/** Module-level parser shared with the serial-bytes bridge while a poll runs. */
let activeParser: MspMinimalParser | null = null;
let activeSnapshot: MspStatusSnapshot | null = null;

export function isMspPollActive(): boolean {
  return activeParser != null;
}

/** Feed raw serial bytes into the active poll parser (no-op if idle). */
export function ingestMspPollBytes(bytes: number[] | Uint8Array): void {
  if (!activeParser || !activeSnapshot) return;
  const frames = activeParser.push(bytes);
  for (const frame of frames) {
    if (frame.direction === "to_fc") continue;
    activeSnapshot = applyMspFrameToSnapshot(activeSnapshot, frame);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Exit CLI (best-effort), then request identity / status / analog / GPS.
 * Read-only — never writes EEPROM or motors.
 */
export async function pollMspStatus(): Promise<MspPollResult> {
  const parser = new MspMinimalParser();
  activeParser = parser;
  activeSnapshot = emptySnapshot();

  try {
    // Leave CLI if the user was stuck there (`#` prompt). Harmless in MSP mode.
    try {
      await writeSerial("exit\n");
    } catch {
      // ignore — port may already be in MSP
    }
    await sleep(EXIT_WAIT_MS);

    for (const cmd of MSP_STATUS_POLL_CMDS) {
      const frame = encodeMspRequest(cmd);
      await writeSerialBytes(frame);
      await sleep(INTER_CMD_MS);
    }

    await sleep(RESPONSE_WINDOW_MS);

    const snap = activeSnapshot ?? emptySnapshot();
    const gotIdentity =
      snap.fcVariant != null ||
      snap.apiVersion != null ||
      snap.fcVersion != null;
    if (!gotIdentity && !snap.status && !snap.analog) {
      return {
        ok: false,
        error: "MSP_NO_RESPONSE",
        snapshot: snap,
      };
    }
    return { ok: true, snapshot: snap };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "MSP_POLL_FAILED",
      snapshot: activeSnapshot ?? emptySnapshot(),
    };
  } finally {
    activeParser = null;
    // Keep last snapshot in caller; clear module binding.
    activeSnapshot = null;
  }
}
