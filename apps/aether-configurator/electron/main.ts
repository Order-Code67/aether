/**
 * Aether Configurator — Electron main process.
 * Owns native transports (Serial / TCP / UDP), DFU flasher, and dialogs.
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  nativeTheme,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IpcChannels } from "./ipc/channels";
import { SerialManager } from "./serial/SerialManager";
import { NetManager } from "./net/NetManager";
import { DfuManager } from "./dfu/DfuManager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, "../public");

let mainWindow: BrowserWindow | null = null;
const serial = new SerialManager();
const net = new NetManager();
const dfu = new DfuManager();

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Aether Configurator",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b1220" : "#f4f7fb",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(process.env.VITE_PUBLIC!, "branding", "logo.png"),
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(process.env.DIST!, "index.html"));
  }
}

function broadcast(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function registerIpc(): void {
  ipcMain.handle(IpcChannels.SERIAL_LIST, async () => serial.listPorts());
  ipcMain.handle(IpcChannels.SERIAL_OPEN, async (_e, pathName: string, baud: number) =>
    serial.open(pathName, baud),
  );
  ipcMain.handle(IpcChannels.SERIAL_CLOSE, async () => serial.close());
  ipcMain.handle(IpcChannels.SERIAL_WRITE, async (_e, data: string) =>
    serial.write(data),
  );
  ipcMain.handle(IpcChannels.SERIAL_WRITE_BYTES, async (_e, bytes: number[]) =>
    serial.writeBytes(bytes),
  );
  ipcMain.handle(IpcChannels.SERIAL_STATUS, () => serial.getStatus());

  ipcMain.handle(IpcChannels.NET_OPEN_TCP, async (_e, host: string, port: number) =>
    net.openTcp(host, port),
  );
  ipcMain.handle(
    IpcChannels.NET_OPEN_UDP,
    async (_e, host: string, port: number, localPort?: number) =>
      net.openUdp(host, port, localPort ?? 0),
  );
  ipcMain.handle(IpcChannels.NET_CLOSE, async () => net.close());
  ipcMain.handle(IpcChannels.NET_WRITE_BYTES, async (_e, bytes: number[]) =>
    net.writeBytes(bytes),
  );
  ipcMain.handle(IpcChannels.NET_STATUS, () => net.getStatus());

  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => app.getVersion());
  ipcMain.handle(IpcChannels.APP_GET_PATHS, () => ({
    userData: app.getPath("userData"),
    documents: app.getPath("documents"),
    temp: app.getPath("temp"),
  }));
  ipcMain.handle(IpcChannels.APP_CHECK_UPDATE, async () => ({
    supported: false,
    message:
      "Auto-update hook is ready. Wire electron-updater / your feed in a later iteration.",
  }));

  ipcMain.handle(
    IpcChannels.DIALOG_OPEN_FILE,
    async (
      _e,
      opts: { title?: string; filters?: { name: string; extensions: string[] }[] },
    ) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: opts?.title ?? "Open file",
        properties: ["openFile"],
        filters: opts?.filters ?? [{ name: "All", extensions: ["*"] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0]!;
    },
  );

  ipcMain.handle(IpcChannels.FS_READ_FILE, async (_e, filePath: string) => {
    const buf = await fs.readFile(filePath);
    return {
      path: filePath,
      size: buf.length,
      bytes: Array.from(buf.subarray(0, Math.min(buf.length, 256 * 1024))),
      base64:
        buf.length <= 8 * 1024 * 1024 ? buf.toString("base64") : null,
    };
  });

  ipcMain.handle(IpcChannels.DFU_DETECT, async () => dfu.detect());
  ipcMain.handle(IpcChannels.DFU_LIST, async () => dfu.listDevices());
  ipcMain.handle(IpcChannels.DFU_FLASH, async (_e, hexPath: string) => {
    await serial.close();
    await dfu.flashHex(hexPath);
  });

  serial.on("bytes", (bytes: number[]) =>
    broadcast(IpcChannels.SERIAL_BYTES, { bytes }),
  );
  serial.on("data", (data: string) =>
    broadcast(IpcChannels.SERIAL_DATA, { data }),
  );
  serial.on("status", (status) =>
    broadcast(IpcChannels.SERIAL_STATUS_EVENT, status),
  );

  net.on("bytes", (bytes: number[]) =>
    broadcast(IpcChannels.NET_BYTES, { bytes }),
  );
  net.on("status", (status) =>
    broadcast(IpcChannels.NET_STATUS_EVENT, status),
  );

  dfu.on("output", (payload) => broadcast(IpcChannels.DFU_OUTPUT, payload));
  dfu.on("status", (payload) => broadcast(IpcChannels.DFU_STATUS, payload));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  void serial.close();
  void net.close();
  if (process.platform !== "darwin") app.quit();
});
