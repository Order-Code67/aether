/**
 * Serial port manager for MSP / raw binary FC traffic.
 * Lives in the Electron main process (native serialport bindings).
 */

import { EventEmitter } from "node:events";
import { SerialPort } from "serialport";
import {
  listWindowsPortsFallback,
  mergePortLists,
} from "./windowsPorts";

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

function normalizePath(pathName: string): string {
  const t = pathName.trim();
  if (!t) return t;
  // Accept "com4" / "COM4" / "\\.\COM4"
  const m = t.match(/^(?:\\\\\.\\)?(COM\d+)$/i);
  if (m) return m[1]!.toUpperCase();
  return t;
}

export class SerialManager extends EventEmitter {
  private port: SerialPort | null = null;
  private lastError: string | null = null;

  getStatus(): SerialStatus {
    return {
      connected: this.port?.isOpen ?? false,
      path: this.port?.path ?? null,
      baudRate: this.port?.baudRate ?? null,
      error: this.lastError,
      transport: "serial",
    };
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    let native: SerialPortInfo[] = [];
    let nativeError: string | null = null;
    try {
      const ports = await SerialPort.list();
      native = ports.map((p) => ({
        path: normalizePath(p.path),
        name: p.friendlyName || p.path,
        portType: p.pnpId || "serial",
        manufacturer: p.manufacturer,
        vendorId: p.vendorId,
        productId: p.productId,
      }));
    } catch (e) {
      nativeError = e instanceof Error ? e.message : String(e);
      this.lastError = nativeError;
    }

    let fallback: SerialPortInfo[] = [];
    if (process.platform === "win32") {
      try {
        fallback = await listWindowsPortsFallback();
      } catch {
        // ignore — native list may still be enough
      }
    }

    const merged = mergePortLists(native, fallback);
    if (merged.length === 0 && nativeError) {
      throw new Error(nativeError);
    }
    return merged;
  }

  async open(pathName: string, baudRate: number): Promise<SerialStatus> {
    await this.close();
    this.lastError = null;
    const path = normalizePath(pathName);
    if (!path) {
      throw new Error("SERIAL_PATH_REQUIRED");
    }

    // On Windows, open via \\.\COMx so COM10+ and some USB adapters work.
    const openPath =
      process.platform === "win32" && /^COM\d+$/i.test(path)
        ? `\\\\.\\${path}`
        : path;

    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path: openPath,
        baudRate,
        autoOpen: false,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
      });

      port.on("data", (chunk: Buffer) => {
        const bytes = Array.from(chunk);
        this.emit("bytes", bytes);
        this.emit("data", chunk.toString("utf8"));
      });

      port.on("error", (err: Error) => {
        this.lastError = err.message;
        this.emit("status", this.getStatus());
      });

      port.on("close", () => {
        this.port = null;
        this.emit("status", this.getStatus());
      });

      port.open((err) => {
        if (err) {
          this.lastError = err.message;
          const hint =
            /file not found|cannot find|ENOENT|Unknown error/i.test(err.message)
              ? ` — ${path} is not available (unplugged, phantom driver, or in use by another app)`
              : "";
          reject(new Error(`${err.message}${hint}`));
          return;
        }
        this.port = port;
        const status = this.getStatus();
        // Report friendly COM name, not \\.\COM path
        status.path = path;
        this.emit("status", status);
        resolve({ ...status, path });
      });
    });
  }

  async close(): Promise<SerialStatus> {
    const port = this.port;
    this.port = null;
    if (!port) {
      return this.getStatus();
    }

    return new Promise((resolve) => {
      if (!port.isOpen) {
        resolve(this.getStatus());
        return;
      }
      port.close(() => {
        const status = this.getStatus();
        this.emit("status", status);
        resolve(status);
      });
    });
  }

  async write(data: string): Promise<void> {
    await this.writeBytes(Buffer.from(data, "utf8"));
  }

  async writeBytes(bytes: number[] | Uint8Array | Buffer): Promise<void> {
    const port = this.port;
    if (!port?.isOpen) {
      throw new Error("SERIAL_NOT_CONNECTED");
    }
    const buf = Buffer.isBuffer(bytes)
      ? bytes
      : Buffer.from(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));

    return new Promise((resolve, reject) => {
      port.write(buf, (err) => {
        if (err) {
          this.lastError = err.message;
          reject(err);
          return;
        }
        port.drain((drainErr) => {
          if (drainErr) {
            this.lastError = drainErr.message;
            reject(drainErr);
            return;
          }
          resolve();
        });
      });
    });
  }
}
