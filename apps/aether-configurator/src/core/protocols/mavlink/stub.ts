/**
 * MAVLink adapter — heartbeat probe + param list entry point.
 */

import type { ProtocolAdapter } from "../../plugins/types";
import type { ByteTransport } from "../transport/types";
import {
  craftFromMavType,
  encodeParamRequestList,
  MAVLINK_MSG_HEARTBEAT,
  MavlinkParser,
  parseHeartbeat,
} from "./codec";

export function looksLikeMavlink(bytes: Uint8Array): boolean {
  return bytes.length > 0 && (bytes[0] === 0xfe || bytes[0] === 0xfd);
}

export function createMavlinkAdapter(transport: ByteTransport): ProtocolAdapter {
  let unsub: (() => void) | null = null;
  const parser = new MavlinkParser();

  return {
    id: "mavlink",
    label: "MAVLink (ArduPilot)",
    async probe() {
      const status = transport.getStatus();
      if (!status.connected) {
        return { ok: false, detail: "Transport not connected" };
      }

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          unsub?.();
          unsub = null;
          resolve({
            ok: false,
            detail: "No HEARTBEAT yet — check TCP/UDP endpoint (SITL :5760 / :14550).",
          });
        }, 2500);

        unsub = transport.onBytes((bytes) => {
          const frames = parser.push(bytes);
          for (const f of frames) {
            if (f.msgid !== MAVLINK_MSG_HEARTBEAT) continue;
            const hb = parseHeartbeat(f.payload);
            if (!hb) continue;
            clearTimeout(timer);
            unsub?.();
            unsub = null;
            resolve({
              ok: true,
              detail: `HEARTBEAT · ${craftFromMavType(hb.type)} · AP ${hb.autopilot}`,
            });
            return;
          }
        });

        // Nudge param list / keep link active; heartbeat usually arrives unsolicited.
        void transport.writeBytes(encodeParamRequestList()).catch(() => {
          /* ignore */
        });
      });
    },
    dispose() {
      unsub?.();
      unsub = null;
    },
  };
}
