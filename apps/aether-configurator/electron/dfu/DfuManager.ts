/**
 * dfu-util wrapper for firmware flashing (STM32 DFU).
 */

import { EventEmitter } from "node:events";
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface DfuUtilInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface DfuListResult {
  toolInstalled: boolean;
  devices: string[];
  raw: string;
  error: string | null;
}

function whichCandidates(): string[] {
  const env = process.env.PATH ?? "";
  const parts = env.split(path.delimiter);
  const names =
    process.platform === "win32"
      ? ["dfu-util.exe", "dfu-util"]
      : ["dfu-util"];
  const out: string[] = [...names];
  for (const dir of parts) {
    for (const name of names) {
      out.push(path.join(dir, name));
    }
  }
  // Common Windows / scoop / chocolatey locations
  out.push(
    "C:\\ProgramData\\chocolatey\\bin\\dfu-util.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "dfu-util.exe"),
  );
  return out;
}

function runFile(
  file: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        code: err && "code" in err ? (err.code as number) : 0,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
      });
    });
  });
}

export class DfuManager extends EventEmitter {
  private flashing = false;

  async detect(): Promise<DfuUtilInfo> {
    for (const candidate of whichCandidates()) {
      try {
        if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue;
        const result = await runFile(candidate, ["--version"]);
        const text = `${result.stdout}\n${result.stderr}`;
        if (/dfu-util/i.test(text)) {
          const m = text.match(/dfu-util\s+([0-9.]+)/i);
          return {
            installed: true,
            path: candidate,
            version: m?.[1] ?? null,
          };
        }
      } catch {
        // try next
      }
    }
    return { installed: false, path: null, version: null };
  }

  async listDevices(): Promise<DfuListResult> {
    const tool = await this.detect();
    if (!tool.installed || !tool.path) {
      return {
        toolInstalled: false,
        devices: [],
        raw: "",
        error: "DFU_UTIL_MISSING",
      };
    }
    const result = await runFile(tool.path, ["-l"]);
    const raw = `${result.stdout}\n${result.stderr}`;
    const devices = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /Found DFU|\[.*:.*\]/i.test(l));
    return {
      toolInstalled: true,
      devices,
      raw,
      error: null,
    };
  }

  async flashHex(hexPath: string): Promise<void> {
    if (this.flashing) throw new Error("DFU_BUSY");
    const tool = await this.detect();
    if (!tool.installed || !tool.path) throw new Error("DFU_UTIL_MISSING");
    if (!fs.existsSync(hexPath)) throw new Error("DFU_HEX_NOT_FOUND");
    const ext = path.extname(hexPath).toLowerCase();
    if (ext !== ".hex" && ext !== ".bin") throw new Error("DFU_HEX_INVALID");

    this.flashing = true;
    this.emit("status", {
      running: true,
      success: null,
      code: null,
      error: null,
    });

    const args =
      ext === ".bin"
        ? ["-a", "0", "-s", "0x08000000:leave", "-D", hexPath]
        : ["-a", "0", "-s", "0x08000000:leave", "-D", hexPath];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(tool.path!, args, { windowsHide: true });
      child.stdout.on("data", (buf: Buffer) => {
        this.emit("output", { stream: "stdout", line: buf.toString() });
      });
      child.stderr.on("data", (buf: Buffer) => {
        this.emit("output", { stream: "stderr", line: buf.toString() });
      });
      child.on("error", (err) => {
        this.flashing = false;
        this.emit("status", {
          running: false,
          success: false,
          code: null,
          error: err.message,
        });
        reject(err);
      });
      child.on("close", (code) => {
        this.flashing = false;
        const ok = code === 0;
        this.emit("status", {
          running: false,
          success: ok,
          code,
          error: ok ? null : "DFU_FLASH_FAILED",
        });
        if (ok) resolve();
        else reject(new Error("DFU_FLASH_FAILED"));
      });
    });
  }
}
