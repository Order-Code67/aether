/**
 * Renderer-side ByteTransport implementations backed by the preload bridge.
 */

import type {
  ByteTransport,
  BytesHandler,
  StatusHandler,
  TransportKind,
  TransportStatus,
} from "./types";

function requireApi() {
  const api = window.aether;
  if (!api) {
    throw new Error(
      "Electron bridge unavailable. Run via `npm run dev` (Electron), not a plain browser tab.",
    );
  }
  return api;
}

export class SerialTransport implements ByteTransport {
  readonly kind: TransportKind = "serial";
  private status: TransportStatus = {
    connected: false,
    kind: null,
    label: null,
    error: null,
  };
  private byteHandlers = new Set<BytesHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private unsubs: Array<() => void> = [];

  async connect(options: Record<string, unknown>): Promise<void> {
    const api = requireApi();
    const path = String(options.path ?? "");
    const baudRate = Number(options.baudRate ?? 115200);
    if (!path) throw new Error("SERIAL_PATH_REQUIRED");

    this.detach();
    this.unsubs.push(
      api.serial.onBytes((bytes) => {
        const u8 = Uint8Array.from(bytes);
        for (const h of this.byteHandlers) h(u8);
      }),
      api.serial.onStatus((s) => {
        this.status = {
          connected: s.connected,
          kind: s.connected ? "serial" : null,
          label: s.path ? `${s.path} @ ${s.baudRate}` : null,
          error: s.error,
        };
        for (const h of this.statusHandlers) h(this.status);
      }),
    );

    const result = await api.serial.open(path, baudRate);
    this.status = {
      connected: result.connected,
      kind: "serial",
      label: result.path ? `${result.path} @ ${result.baudRate}` : null,
      error: result.error,
    };
  }

  async disconnect(): Promise<void> {
    const api = window.aether;
    if (api) await api.serial.close();
    this.detach();
    this.status = {
      connected: false,
      kind: null,
      label: null,
      error: null,
    };
  }

  async writeBytes(bytes: Uint8Array | number[]): Promise<void> {
    const list = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
    await requireApi().serial.writeBytes(list);
  }

  async writeText(text: string): Promise<void> {
    await requireApi().serial.write(text);
  }

  onBytes(handler: BytesHandler): () => void {
    this.byteHandlers.add(handler);
    return () => this.byteHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  private detach(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}

export class TcpTransport implements ByteTransport {
  readonly kind: TransportKind = "tcp";
  private status: TransportStatus = {
    connected: false,
    kind: null,
    label: null,
    error: null,
  };
  private byteHandlers = new Set<BytesHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private unsubs: Array<() => void> = [];

  async connect(options: Record<string, unknown>): Promise<void> {
    const api = requireApi();
    const host = String(options.host ?? "127.0.0.1");
    const port = Number(options.port ?? 5760);
    this.detach();
    this.unsubs.push(
      api.net.onBytes((bytes) => {
        const u8 = Uint8Array.from(bytes);
        for (const h of this.byteHandlers) h(u8);
      }),
      api.net.onStatus((s) => {
        this.status = {
          connected: s.connected,
          kind: s.connected ? "tcp" : null,
          label: s.host ? `tcp://${s.host}:${s.port}` : null,
          error: s.error,
        };
        for (const h of this.statusHandlers) h(this.status);
      }),
    );
    const result = await api.net.openTcp(host, port);
    this.status = {
      connected: result.connected,
      kind: "tcp",
      label: `tcp://${host}:${port}`,
      error: result.error,
    };
  }

  async disconnect(): Promise<void> {
    await window.aether?.net.close();
    this.detach();
    this.status = { connected: false, kind: null, label: null, error: null };
  }

  async writeBytes(bytes: Uint8Array | number[]): Promise<void> {
    const list = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
    await requireApi().net.writeBytes(list);
  }

  onBytes(handler: BytesHandler): () => void {
    this.byteHandlers.add(handler);
    return () => this.byteHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  private detach(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}

export class UdpTransport implements ByteTransport {
  readonly kind: TransportKind = "udp";
  private status: TransportStatus = {
    connected: false,
    kind: null,
    label: null,
    error: null,
  };
  private byteHandlers = new Set<BytesHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private unsubs: Array<() => void> = [];

  async connect(options: Record<string, unknown>): Promise<void> {
    const api = requireApi();
    const host = String(options.host ?? "127.0.0.1");
    const port = Number(options.port ?? 14550);
    const localPort = Number(options.localPort ?? 0);
    this.detach();
    this.unsubs.push(
      api.net.onBytes((bytes) => {
        const u8 = Uint8Array.from(bytes);
        for (const h of this.byteHandlers) h(u8);
      }),
      api.net.onStatus((s) => {
        this.status = {
          connected: s.connected,
          kind: s.connected ? "udp" : null,
          label: s.host ? `udp://${s.host}:${s.port}` : null,
          error: s.error,
        };
        for (const h of this.statusHandlers) h(this.status);
      }),
    );
    const result = await api.net.openUdp(host, port, localPort);
    this.status = {
      connected: result.connected,
      kind: "udp",
      label: `udp://${host}:${port}`,
      error: result.error,
    };
  }

  async disconnect(): Promise<void> {
    await window.aether?.net.close();
    this.detach();
    this.status = { connected: false, kind: null, label: null, error: null };
  }

  async writeBytes(bytes: Uint8Array | number[]): Promise<void> {
    const list = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
    await requireApi().net.writeBytes(list);
  }

  onBytes(handler: BytesHandler): () => void {
    this.byteHandlers.add(handler);
    return () => this.byteHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  private detach(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
