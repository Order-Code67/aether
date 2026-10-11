/**
 * Generic MSP request/response over the shared serial port.
 * Reuses the same byte bridge as status poll (ingestMspPollBytes).
 */

import {
  encodeMspRequest,
  MspMinimalParser,
  type MspFrame,
} from "@/lib/mspMinimal";
import { writeSerial, writeSerialBytes } from "@/lib/serial";

const EXIT_WAIT_MS = 250;
const INTER_CMD_MS = 40;
const RESPONSE_WINDOW_MS = 1400;

let activeParser: MspMinimalParser | null = null;
let collected: MspFrame[] = [];

export function isMspTransactionActive(): boolean {
  return activeParser != null;
}

/** Feed raw serial bytes while a transaction runs. */
export function ingestMspTransactionBytes(
  bytes: number[] | Uint8Array,
): void {
  if (!activeParser) return;
  const frames = activeParser.push(bytes);
  for (const frame of frames) {
    if (frame.direction === "to_fc") continue;
    collected.push(frame);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function mspRequest(
  cmds: number[],
  opts?: { exitCli?: boolean; waitMs?: number },
): Promise<MspFrame[]> {
  const parser = new MspMinimalParser();
  activeParser = parser;
  collected = [];

  try {
    if (opts?.exitCli !== false) {
      try {
        await writeSerial("exit\n");
      } catch {
        // ignore
      }
      await sleep(EXIT_WAIT_MS);
    }

    for (const cmd of cmds) {
      await writeSerialBytes(encodeMspRequest(cmd));
      await sleep(INTER_CMD_MS);
    }

    await sleep(opts?.waitMs ?? RESPONSE_WINDOW_MS);
    return [...collected];
  } finally {
    activeParser = null;
  }
}

/** Latest payload for a command, or null. */
export function latestPayload(
  frames: MspFrame[],
  cmd: number,
): Uint8Array | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i]!.cmd === cmd) return frames[i]!.payload;
  }
  return null;
}
