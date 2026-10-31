import type { RemoteGateway } from "./types";
import { remoteMeta, type RemoteApiResponse } from "@/types/remote";

/**
 * Sandbox gateway: architecture smoke-tests only.
 * Never returns fake stations/telemetry presented as real.
 */
function empty<T>(data: T): RemoteApiResponse<T> {
  return {
    meta: remoteMeta("sandbox", true),
    data,
  };
}

const notImplemented = <T>(data: T): Promise<RemoteApiResponse<T>> =>
  Promise.resolve({
    ...empty(data),
    error: "Remote Gateway не реализован (этап после локальной версии)",
  });

export function createSandboxRemoteGateway(): RemoteGateway {
  return {
    testMode: "sandbox",
    connect: (endpointUrl) =>
      Promise.resolve({
        meta: remoteMeta("sandbox", true),
        data: { connected: false },
        error: `Sandbox: подключение к ${endpointUrl} не выполняется`,
      }),
    disconnect: () => notImplemented(null),
    auth: {
      login: () => notImplemented({ requiresMfa: false }),
      verifyMfa: () =>
        notImplemented({
          id: "",
          userId: "",
          stationId: "",
          startedAt: new Date().toISOString(),
          roles: [],
        }),
      logout: () => notImplemented(null),
      revokeAccess: () => notImplemented(null),
    },
    registry: {
      listStations: () => notImplemented([]),
      getStation: () => notImplemented(null),
    },
    sessions: {
      listSessions: () => notImplemented([]),
      endSession: () => notImplemented(null),
      getLinkQuality: () =>
        notImplemented({ reconnectCount: 0 }),
    },
    telemetry: {
      subscribeStation: async () => ({ unsubscribe: () => undefined }),
      getLatest: () => notImplemented(null),
    },
    video: {
      requestStream: () => notImplemented(null),
      setTargetBitrate: () => notImplemented(null),
    },
    audit: {
      listEvents: () => notImplemented([]),
      append: async (event) =>
        notImplemented({
          id: `audit_sandbox`,
          at: new Date().toISOString(),
          ...event,
        }),
    },
    listUsers: () => notImplemented([]),
    listAllowedAdminSettings: () => notImplemented([]),
  };
}
