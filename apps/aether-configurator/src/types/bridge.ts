/** Renderer-facing Electron bridge types (mirrors preload API). */

export interface SerialPortInfo {
  path: string;
  name: string;
  portType: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
}

export interface SerialStatus {
  connected: boolean;
  path: string | null;
  baudRate: number | null;
  error: string | null;
  transport: "serial";
}

export interface NetStatus {
  connected: boolean;
  kind: "tcp" | "udp" | null;
  host: string | null;
  port: number | null;
  error: string | null;
  transport: "tcp" | "udp" | null;
}

type Unsubscribe = () => void;

export interface AetherApi {
  serial: {
    list: () => Promise<SerialPortInfo[]>;
    open: (path: string, baudRate: number) => Promise<SerialStatus>;
    close: () => Promise<SerialStatus>;
    write: (data: string) => Promise<void>;
    writeBytes: (bytes: number[]) => Promise<void>;
    getStatus: () => Promise<SerialStatus>;
    onBytes: (handler: (bytes: number[]) => void) => Unsubscribe;
    onData: (handler: (data: string) => void) => Unsubscribe;
    onStatus: (handler: (status: SerialStatus) => void) => Unsubscribe;
  };
  net: {
    openTcp: (host: string, port: number) => Promise<NetStatus>;
    openUdp: (
      host: string,
      port: number,
      localPort?: number,
    ) => Promise<NetStatus>;
    close: () => Promise<NetStatus>;
    writeBytes: (bytes: number[]) => Promise<void>;
    getStatus: () => Promise<NetStatus>;
    onBytes: (handler: (bytes: number[]) => void) => Unsubscribe;
    onStatus: (handler: (status: NetStatus) => void) => Unsubscribe;
  };
  app: {
    getVersion: () => Promise<string>;
    getPaths: () => Promise<{
      userData: string;
      documents: string;
      temp: string;
    }>;
    checkUpdate: () => Promise<{ supported: boolean; message: string }>;
    openFile: (opts?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
    }) => Promise<string | null>;
    readFile: (filePath: string) => Promise<{
      path: string;
      size: number;
      bytes: number[];
      base64: string | null;
    }>;
  };
  dfu: {
    detect: () => Promise<{
      installed: boolean;
      path: string | null;
      version: string | null;
    }>;
    list: () => Promise<{
      toolInstalled: boolean;
      devices: string[];
      raw: string;
      error: string | null;
    }>;
    flash: (hexPath: string) => Promise<void>;
    onOutput: (
      handler: (payload: { stream: string; line: string }) => void,
    ) => Unsubscribe;
    onStatus: (
      handler: (payload: {
        running: boolean;
        success: boolean | null;
        code: number | null;
        error: string | null;
      }) => void,
    ) => Unsubscribe;
  };
}
