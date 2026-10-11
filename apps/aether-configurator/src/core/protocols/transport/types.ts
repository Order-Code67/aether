/** Abstract byte transport used by MSP / MAVLink clients. */

export type TransportKind = "serial" | "tcp" | "udp";

export interface TransportStatus {
  connected: boolean;
  kind: TransportKind | null;
  label: string | null;
  error: string | null;
}

export type BytesHandler = (bytes: Uint8Array) => void;
export type StatusHandler = (status: TransportStatus) => void;

export interface ByteTransport {
  readonly kind: TransportKind;
  connect(options: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
  writeBytes(bytes: Uint8Array | number[]): Promise<void>;
  writeText?(text: string): Promise<void>;
  onBytes(handler: BytesHandler): () => void;
  onStatus(handler: StatusHandler): () => void;
  getStatus(): TransportStatus;
}
