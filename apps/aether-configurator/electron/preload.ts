/**
 * Preload bridge — exposes a typed, minimal API to the renderer.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const IpcChannels = {
  SERIAL_LIST: "serial:list",
  SERIAL_OPEN: "serial:open",
  SERIAL_CLOSE: "serial:close",
  SERIAL_WRITE: "serial:write",
  SERIAL_WRITE_BYTES: "serial:write-bytes",
  SERIAL_STATUS: "serial:status",
  SERIAL_DATA: "serial:data",
  SERIAL_BYTES: "serial:bytes",
  SERIAL_STATUS_EVENT: "serial:status-event",
  NET_OPEN_TCP: "net:open-tcp",
  NET_OPEN_UDP: "net:open-udp",
  NET_CLOSE: "net:close",
  NET_WRITE_BYTES: "net:write-bytes",
  NET_STATUS: "net:status",
  NET_BYTES: "net:bytes",
  NET_STATUS_EVENT: "net:status-event",
  APP_GET_VERSION: "app:get-version",
  APP_GET_PATHS: "app:get-paths",
  APP_CHECK_UPDATE: "app:check-update",
  DIALOG_OPEN_FILE: "dialog:open-file",
  FS_READ_FILE: "fs:read-file",
  DFU_DETECT: "dfu:detect",
  DFU_LIST: "dfu:list",
  DFU_FLASH: "dfu:flash",
  DFU_OUTPUT: "dfu:output",
  DFU_STATUS: "dfu:status",
} as const;

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

const aetherApi = {
  serial: {
    list: (): Promise<SerialPortInfo[]> =>
      ipcRenderer.invoke(IpcChannels.SERIAL_LIST),
    open: (path: string, baudRate: number): Promise<SerialStatus> =>
      ipcRenderer.invoke(IpcChannels.SERIAL_OPEN, path, baudRate),
    close: (): Promise<SerialStatus> =>
      ipcRenderer.invoke(IpcChannels.SERIAL_CLOSE),
    write: (data: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.SERIAL_WRITE, data),
    writeBytes: (bytes: number[]): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.SERIAL_WRITE_BYTES, bytes),
    getStatus: (): Promise<SerialStatus> =>
      ipcRenderer.invoke(IpcChannels.SERIAL_STATUS),
    onBytes: (handler: (bytes: number[]) => void): Unsubscribe => {
      const listener = (_e: IpcRendererEvent, payload: { bytes: number[] }) =>
        handler(payload.bytes);
      ipcRenderer.on(IpcChannels.SERIAL_BYTES, listener);
      return () => ipcRenderer.removeListener(IpcChannels.SERIAL_BYTES, listener);
    },
    onData: (handler: (data: string) => void): Unsubscribe => {
      const listener = (_e: IpcRendererEvent, payload: { data: string }) =>
        handler(payload.data);
      ipcRenderer.on(IpcChannels.SERIAL_DATA, listener);
      return () => ipcRenderer.removeListener(IpcChannels.SERIAL_DATA, listener);
    },
    onStatus: (handler: (status: SerialStatus) => void): Unsubscribe => {
      const listener = (_e: IpcRendererEvent, status: SerialStatus) =>
        handler(status);
      ipcRenderer.on(IpcChannels.SERIAL_STATUS_EVENT, listener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.SERIAL_STATUS_EVENT, listener);
    },
  },
  net: {
    openTcp: (host: string, port: number): Promise<NetStatus> =>
      ipcRenderer.invoke(IpcChannels.NET_OPEN_TCP, host, port),
    openUdp: (host: string, port: number, localPort?: number): Promise<NetStatus> =>
      ipcRenderer.invoke(IpcChannels.NET_OPEN_UDP, host, port, localPort),
    close: (): Promise<NetStatus> => ipcRenderer.invoke(IpcChannels.NET_CLOSE),
    writeBytes: (bytes: number[]): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.NET_WRITE_BYTES, bytes),
    getStatus: (): Promise<NetStatus> =>
      ipcRenderer.invoke(IpcChannels.NET_STATUS),
    onBytes: (handler: (bytes: number[]) => void): Unsubscribe => {
      const listener = (_e: IpcRendererEvent, payload: { bytes: number[] }) =>
        handler(payload.bytes);
      ipcRenderer.on(IpcChannels.NET_BYTES, listener);
      return () => ipcRenderer.removeListener(IpcChannels.NET_BYTES, listener);
    },
    onStatus: (handler: (status: NetStatus) => void): Unsubscribe => {
      const listener = (_e: IpcRendererEvent, status: NetStatus) =>
        handler(status);
      ipcRenderer.on(IpcChannels.NET_STATUS_EVENT, listener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.NET_STATUS_EVENT, listener);
    },
  },
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IpcChannels.APP_GET_VERSION),
    getPaths: (): Promise<{
      userData: string;
      documents: string;
      temp: string;
    }> => ipcRenderer.invoke(IpcChannels.APP_GET_PATHS),
    checkUpdate: (): Promise<{ supported: boolean; message: string }> =>
      ipcRenderer.invoke(IpcChannels.APP_CHECK_UPDATE),
    openFile: (opts?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.DIALOG_OPEN_FILE, opts ?? {}),
    readFile: (
      filePath: string,
    ): Promise<{
      path: string;
      size: number;
      bytes: number[];
      base64: string | null;
    }> => ipcRenderer.invoke(IpcChannels.FS_READ_FILE, filePath),
  },
  dfu: {
    detect: (): Promise<{
      installed: boolean;
      path: string | null;
      version: string | null;
    }> => ipcRenderer.invoke(IpcChannels.DFU_DETECT),
    list: (): Promise<{
      toolInstalled: boolean;
      devices: string[];
      raw: string;
      error: string | null;
    }> => ipcRenderer.invoke(IpcChannels.DFU_LIST),
    flash: (hexPath: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.DFU_FLASH, hexPath),
    onOutput: (
      handler: (payload: { stream: string; line: string }) => void,
    ): Unsubscribe => {
      const listener = (
        _e: IpcRendererEvent,
        payload: { stream: string; line: string },
      ) => handler(payload);
      ipcRenderer.on(IpcChannels.DFU_OUTPUT, listener);
      return () => ipcRenderer.removeListener(IpcChannels.DFU_OUTPUT, listener);
    },
    onStatus: (
      handler: (payload: {
        running: boolean;
        success: boolean | null;
        code: number | null;
        error: string | null;
      }) => void,
    ): Unsubscribe => {
      const listener = (
        _e: IpcRendererEvent,
        payload: {
          running: boolean;
          success: boolean | null;
          code: number | null;
          error: string | null;
        },
      ) => handler(payload);
      ipcRenderer.on(IpcChannels.DFU_STATUS, listener);
      return () => ipcRenderer.removeListener(IpcChannels.DFU_STATUS, listener);
    },
  },
};

contextBridge.exposeInMainWorld("aether", aetherApi);

export type AetherApi = typeof aetherApi;
