/**
 * Remote Connectivity API contracts (v0.3).
 * Server implementation is deferred — interfaces only.
 */

export type RemoteTestMode = "disabled" | "sandbox" | "integration";

/** Explicit marker: never present values as live if synthetic. */
export interface RemoteResultMeta {
  /** true = not a live station reading; UI must label accordingly */
  synthetic: boolean;
  testMode: RemoteTestMode;
  at: string;
}

export type RemoteConnectionState =
  | "offline"
  | "connecting"
  | "online"
  | "degraded"
  | "lost"
  | "error";

export type RemoteRole = "operator" | "admin" | "auditor";

export interface RemoteCredentials {
  username: string;
  /** Never log. Password must not be stored plaintext. */
  password?: string;
  mfaCode?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface RemoteUserAccount {
  id: string;
  username: string;
  displayName: string;
  roles: RemoteRole[];
  mfaEnabled: boolean;
  revoked: boolean;
  maxSessions: number;
}

export interface RemoteStationSummary {
  id: string;
  name: string;
  region?: string;
  connectionState: RemoteConnectionState;
  lastSeenAt?: string;
  latencyMs?: number;
  packetLossPct?: number;
  profileId?: string;
}

export interface RemoteSession {
  id: string;
  userId: string;
  stationId: string;
  startedAt: string;
  expiresAt?: string;
  roles: RemoteRole[];
}

export interface RemoteLinkQuality {
  latencyMs?: number;
  packetLossPct?: number;
  bandwidthKbps?: number;
  reconnectCount: number;
}

export interface RemoteTelemetrySample {
  stationId: string;
  capturedAt: string;
  /** Missing sensors stay null — never invent readings. */
  voltage: number | null;
  temperature: number | null;
  status: string;
  diagnostics: string[];
}

export interface RemoteVideoStreamOffer {
  stationId: string;
  streamId: string;
  /** SDP / WebRTC signaling payload — opaque until Video Relay is implemented */
  signaling?: unknown;
}

export interface RemoteAuditEvent {
  id: string;
  at: string;
  actorUserId: string;
  action: string;
  stationId?: string;
  details?: Record<string, unknown>;
}

export interface RemoteAuthChallenge {
  requiresMfa: boolean;
  challengeId?: string;
}

export interface RemoteAllowedAdminSetting {
  key: string;
  label: string;
  valueType: "string" | "number" | "boolean";
}

/** Envelope for every remote API response in this stage. */
export interface RemoteApiResponse<T> {
  meta: RemoteResultMeta;
  data: T;
  error?: string;
}

export function remoteMeta(
  testMode: RemoteTestMode,
  synthetic: boolean,
): RemoteResultMeta {
  return {
    synthetic,
    testMode,
    at: new Date().toISOString(),
  };
}
