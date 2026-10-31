import type {
  RemoteAllowedAdminSetting,
  RemoteApiResponse,
  RemoteAuditEvent,
  RemoteAuthChallenge,
  RemoteCredentials,
  RemoteLinkQuality,
  RemoteSession,
  RemoteStationSummary,
  RemoteTelemetrySample,
  RemoteTestMode,
  RemoteUserAccount,
  RemoteVideoStreamOffer,
} from "@/types/remote";

export interface AuthenticationService {
  login(credentials: RemoteCredentials): Promise<RemoteApiResponse<RemoteAuthChallenge | RemoteSession>>;
  verifyMfa(challengeId: string, code: string): Promise<RemoteApiResponse<RemoteSession>>;
  logout(sessionId: string): Promise<RemoteApiResponse<null>>;
  revokeAccess(userId: string): Promise<RemoteApiResponse<null>>;
}

export interface DeviceRegistry {
  listStations(): Promise<RemoteApiResponse<RemoteStationSummary[]>>;
  getStation(id: string): Promise<RemoteApiResponse<RemoteStationSummary | null>>;
}

export interface SessionManager {
  listSessions(): Promise<RemoteApiResponse<RemoteSession[]>>;
  endSession(sessionId: string): Promise<RemoteApiResponse<null>>;
  getLinkQuality(sessionId: string): Promise<RemoteApiResponse<RemoteLinkQuality>>;
}

export interface TelemetryService {
  subscribeStation(
    stationId: string,
    onSample: (sample: RemoteTelemetrySample) => void,
  ): Promise<{ unsubscribe: () => void }>;
  getLatest(stationId: string): Promise<RemoteApiResponse<RemoteTelemetrySample | null>>;
}

export interface VideoRelay {
  requestStream(stationId: string): Promise<RemoteApiResponse<RemoteVideoStreamOffer | null>>;
  setTargetBitrate(streamId: string, kbps: number): Promise<RemoteApiResponse<null>>;
}

export interface AuditService {
  listEvents(limit: number): Promise<RemoteApiResponse<RemoteAuditEvent[]>>;
  append(event: Omit<RemoteAuditEvent, "id" | "at">): Promise<RemoteApiResponse<RemoteAuditEvent>>;
}

export interface RemoteGateway {
  readonly testMode: RemoteTestMode;
  connect(endpointUrl: string): Promise<RemoteApiResponse<{ connected: boolean }>>;
  disconnect(): Promise<RemoteApiResponse<null>>;
  auth: AuthenticationService;
  registry: DeviceRegistry;
  sessions: SessionManager;
  telemetry: TelemetryService;
  video: VideoRelay;
  audit: AuditService;
  listUsers(): Promise<RemoteApiResponse<RemoteUserAccount[]>>;
  listAllowedAdminSettings(
    stationId: string,
  ): Promise<RemoteApiResponse<RemoteAllowedAdminSetting[]>>;
}
