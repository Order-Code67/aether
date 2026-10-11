/**
 * High-level MSP client over a ByteTransport.
 * Status polling + Setup telemetry / calibration (no motor spin, no EEPROM).
 */

import {
  applyMspFrameToSnapshot,
  emptySnapshot,
  encodeMspRequest,
  type MspFrame,
  type MspStatusSnapshot,
} from "./codec";
import {
  MSP_ACC_CALIBRATION,
  MSP_MAG_CALIBRATION,
  MSP_SETUP_LIVE_CMDS,
  MSP_STATUS_POLL_CMDS,
} from "./commands";
import { MspParser } from "./parser";
import type { ByteTransport } from "../transport/types";

const INTER_CMD_MS = 40;
const EXIT_WAIT_MS = 250;
const RESPONSE_WINDOW_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type MspPollResult =
  | { ok: true; snapshot: MspStatusSnapshot }
  | { ok: false; error: string; snapshot: MspStatusSnapshot };

export class MspClient {
  private parser = new MspParser();
  private unsub: (() => void) | null = null;
  private liveSnapshot = emptySnapshot();
  private frameListeners = new Set<(snap: MspStatusSnapshot) => void>();
  private rawListeners = new Set<(frame: MspFrame) => void>();

  constructor(private transport: ByteTransport) {}

  /** Attach continuous ingest for live telemetry. */
  startLive(): void {
    this.stopLive();
    this.parser.reset();
    this.unsub = this.transport.onBytes((bytes) => {
      const frames = this.parser.push(bytes);
      for (const frame of frames) {
        if (frame.direction === "to_fc") continue;
        this.liveSnapshot = applyMspFrameToSnapshot(this.liveSnapshot, frame);
        for (const listener of this.frameListeners) listener(this.liveSnapshot);
        for (const listener of this.rawListeners) listener(frame);
      }
    });
  }

  stopLive(): void {
    this.unsub?.();
    this.unsub = null;
  }

  onSnapshot(listener: (snap: MspStatusSnapshot) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  /** Subscribe to every decoded MSP response (Setup / Modes / etc.). */
  onFrame(listener: (frame: MspFrame) => void): () => void {
    this.rawListeners.add(listener);
    return () => this.rawListeners.delete(listener);
  }

  getSnapshot(): MspStatusSnapshot {
    return this.liveSnapshot;
  }

  async request(cmd: number, payload: number[] | Uint8Array = []): Promise<void> {
    const pl = payload instanceof Uint8Array ? Array.from(payload) : payload;
    await this.transport.writeBytes(encodeMspRequest(cmd, pl));
  }

  /**
   * Send an MSP request and wait for the matching response command.
   * Used by PID / Rates / Filter loaders.
   */
  async requestResponse(
    cmd: number,
    payload: number[] | Uint8Array = [],
    timeoutMs = 900,
  ): Promise<MspFrame | null> {
    if (this.unsub == null) this.startLive();

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        off();
        resolve(null);
      }, timeoutMs);

      const off = this.onFrame((frame) => {
        if (frame.cmd !== cmd) return;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        resolve(frame);
      });

      void this.request(cmd, payload).catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        resolve(null);
      });
    });
  }

  /** Fire a burst of Setup live commands (attitude / RC / IMU / status). */
  async pollSetupLive(): Promise<void> {
    for (const cmd of MSP_SETUP_LIVE_CMDS) {
      await this.request(cmd);
      await sleep(20);
    }
  }

  /**
   * Accelerometer calibration. Craft must be level, still, and disarmed.
   * Does not write EEPROM — FC keeps offsets in RAM until `save`.
   */
  async calibrateAccelerometer(): Promise<{ ok: true } | { ok: false; error: string }> {
    const armed = this.liveSnapshot.status?.armed;
    if (armed) return { ok: false, error: "ARMED" };
    try {
      await this.request(MSP_ACC_CALIBRATION);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "ACC_CAL_FAILED",
      };
    }
  }

  /**
   * Magnetometer calibration. Rotate the craft on all axes after sending.
   */
  async calibrateMagnetometer(): Promise<{ ok: true } | { ok: false; error: string }> {
    const armed = this.liveSnapshot.status?.armed;
    if (armed) return { ok: false, error: "ARMED" };
    try {
      await this.request(MSP_MAG_CALIBRATION);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "MAG_CAL_FAILED",
      };
    }
  }

  /**
   * Exit CLI (best-effort), then poll identity / status / analog / GPS.
   * When already live (e.g. Setup tab), does not reset the parser/snapshot.
   */
  async pollStatus(): Promise<MspPollResult> {
    const wasLive = this.unsub != null;
    if (!wasLive) {
      this.startLive();
      this.liveSnapshot = emptySnapshot();
      this.parser.reset();
    }

    try {
      if (!wasLive) {
        try {
          await this.transport.writeText?.("exit\n");
        } catch {
          // ignore — already in MSP
        }
        await sleep(EXIT_WAIT_MS);
      }

      for (const cmd of MSP_STATUS_POLL_CMDS) {
        await this.request(cmd);
        await sleep(INTER_CMD_MS);
      }

      await sleep(wasLive ? 400 : RESPONSE_WINDOW_MS);

      const snap = this.liveSnapshot;
      const gotIdentity =
        snap.fcVariant != null ||
        snap.apiVersion != null ||
        snap.fcVersion != null;
      if (!gotIdentity && !snap.status && !snap.analog) {
        return { ok: false, error: "MSP_NO_RESPONSE", snapshot: snap };
      }
      return { ok: true, snapshot: snap };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "MSP_POLL_FAILED",
        snapshot: this.liveSnapshot,
      };
    } finally {
      if (!wasLive) this.stopLive();
    }
  }

  dispose(): void {
    this.stopLive();
    this.frameListeners.clear();
    this.rawListeners.clear();
  }
}
