/**
 * TCP / UDP transport for MAVLink and networked MSP bridges.
 */

import { EventEmitter } from "node:events";
import net from "node:net";
import dgram from "node:dgram";

export type NetTransportKind = "tcp" | "udp";

export interface NetStatus {
  connected: boolean;
  kind: NetTransportKind | null;
  host: string | null;
  port: number | null;
  error: string | null;
  transport: "tcp" | "udp" | null;
}

export class NetManager extends EventEmitter {
  private tcp: net.Socket | null = null;
  private udp: dgram.Socket | null = null;
  private remote: { host: string; port: number } | null = null;
  private kind: NetTransportKind | null = null;
  private lastError: string | null = null;

  getStatus(): NetStatus {
    const connected =
      (this.kind === "tcp" && this.tcp != null && !this.tcp.destroyed) ||
      (this.kind === "udp" && this.udp != null);
    return {
      connected,
      kind: this.kind,
      host: this.remote?.host ?? null,
      port: this.remote?.port ?? null,
      error: this.lastError,
      transport: this.kind,
    };
  }

  async openTcp(host: string, port: number): Promise<NetStatus> {
    await this.close();
    this.lastError = null;

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        this.tcp = socket;
        this.kind = "tcp";
        this.remote = { host, port };
        const status = this.getStatus();
        this.emit("status", status);
        resolve(status);
      });

      socket.on("data", (chunk: Buffer) => {
        this.emit("bytes", Array.from(chunk));
      });

      socket.on("error", (err: Error) => {
        this.lastError = err.message;
        this.emit("status", this.getStatus());
        if (!this.tcp) reject(err);
      });

      socket.on("close", () => {
        this.tcp = null;
        if (this.kind === "tcp") this.kind = null;
        this.emit("status", this.getStatus());
      });
    });
  }

  async openUdp(host: string, port: number, localPort = 0): Promise<NetStatus> {
    await this.close();
    this.lastError = null;

    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4");

      socket.on("message", (msg) => {
        this.emit("bytes", Array.from(msg));
      });

      socket.on("error", (err: Error) => {
        this.lastError = err.message;
        this.emit("status", this.getStatus());
        reject(err);
      });

      socket.bind(localPort, () => {
        this.udp = socket;
        this.kind = "udp";
        this.remote = { host, port };
        const status = this.getStatus();
        this.emit("status", status);
        resolve(status);
      });
    });
  }

  async close(): Promise<NetStatus> {
    if (this.tcp) {
      this.tcp.destroy();
      this.tcp = null;
    }
    if (this.udp) {
      await new Promise<void>((resolve) => {
        this.udp!.close(() => resolve());
      });
      this.udp = null;
    }
    this.kind = null;
    this.remote = null;
    const status = this.getStatus();
    this.emit("status", status);
    return status;
  }

  async writeBytes(bytes: number[] | Uint8Array): Promise<void> {
    const buf = Buffer.from(
      bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes),
    );

    if (this.kind === "tcp" && this.tcp) {
      return new Promise((resolve, reject) => {
        this.tcp!.write(buf, (err) => (err ? reject(err) : resolve()));
      });
    }

    if (this.kind === "udp" && this.udp && this.remote) {
      return new Promise((resolve, reject) => {
        this.udp!.send(buf, this.remote!.port, this.remote!.host, (err) =>
          err ? reject(err) : resolve(),
        );
      });
    }

    throw new Error("NET_NOT_CONNECTED");
  }
}
