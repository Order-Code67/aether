import type { RemoteGateway } from "./types";
import {
  remoteMeta,
  type RemoteApiResponse,
  type RemoteAuditEvent,
} from "@/types/remote";
import { dbAudit } from "@/services/database";

/**
 * Local Remote Gateway stub (v0.3 API surface).
 * Separate process/deployment is documented; this in-process stub validates
 * client wiring: TLS/session/audit placeholders without pilot/combat channels.
 */
function ok<T>(data: T, synthetic = true): RemoteApiResponse<T> {
  return { meta: remoteMeta("integration", synthetic), data };
}

const auditLog: RemoteAuditEvent[] = [];

export function createLocalGatewayStub(): RemoteGateway {
  return {
    testMode: "integration",
    async connect(endpointUrl) {
      await dbAudit(null, "remote.connect_attempt", { endpointUrl, tls: true });
      auditLog.push({
        id: `aud_${Date.now()}`,
        at: new Date().toISOString(),
        actorUserId: "system",
        action: "connect_attempt",
        details: { endpointUrl, vpn: "external", tls: true },
      });
      return {
        ...ok({ connected: false }),
        error:
          "Gateway stub: внешний Remote Gateway ещё не развёрнут. TLS/VPN/сессии описаны в API; канал пилотирования не предоставляется.",
      };
    },
    async disconnect() {
      await dbAudit(null, "remote.disconnect", {});
      return ok(null);
    },
    auth: {
      async login() {
        return {
          ...ok({ requiresMfa: true, challengeId: "stub-mfa" }),
          error: "Auth stub — без боевых/пилотных ролей",
        };
      },
      async verifyMfa() {
        return {
          ...ok({
            id: "",
            userId: "",
            stationId: "",
            startedAt: new Date().toISOString(),
            roles: ["operator" as const],
          }),
          error: "MFA stub",
        };
      },
      async logout(sessionId) {
        await dbAudit(null, "remote.logout", { sessionId });
        return ok(null);
      },
      async revokeAccess(userId) {
        await dbAudit(null, "remote.revoke", { userId });
        return ok(null);
      },
    },
    registry: {
      listStations: async () => ok([]),
      getStation: async () => ok(null),
    },
    sessions: {
      listSessions: async () => ok([]),
      endSession: async () => ok(null),
      getLinkQuality: async () =>
        ok({
          latencyMs: undefined,
          packetLossPct: undefined,
          reconnectCount: 0,
        }),
    },
    telemetry: {
      subscribeStation: async () => ({ unsubscribe: () => undefined }),
      getLatest: async () => ok(null),
    },
    video: {
      requestStream: async () => ok(null),
      setTargetBitrate: async () => ok(null),
    },
    audit: {
      listEvents: async (limit) => ok(auditLog.slice(0, limit)),
      append: async (event) => {
        const row: RemoteAuditEvent = {
          id: `aud_${Date.now().toString(36)}`,
          at: new Date().toISOString(),
          ...event,
        };
        auditLog.unshift(row);
        await dbAudit(
          event.actorUserId,
          event.action,
          event.details as Record<string, unknown> | undefined,
        );
        return ok(row);
      },
    },
    listUsers: async () => ok([]),
    listAllowedAdminSettings: async () =>
      ok([
        {
          key: "display_brightness",
          label: "Яркость UI",
          valueType: "number",
        },
        {
          key: "event_log_retention",
          label: "Хранение журнала",
          valueType: "number",
        },
      ]),
  };
}
