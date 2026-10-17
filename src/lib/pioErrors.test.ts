import { describe, expect, it } from "vitest";
import { friendlyPioError } from "./pioErrors";

describe("friendlyPioError", () => {
  it("maps access denied with close-other-apps hint (en)", () => {
    const msg = friendlyPioError("OSError: [Errno 13] Access is denied", "en");
    expect(msg.toLowerCase()).toMatch(/access denied|port busy/);
    expect(msg).toMatch(/Arduino IDE|Serial Monitor/i);
    expect(msg.toLowerCase()).toMatch(/cable|driver/);
  });

  it("maps access denied with close-other-apps hint (ru)", () => {
    const msg = friendlyPioError("Permission denied: COM3", "ru");
    expect(msg).toMatch(/порт|доступ/i);
    expect(msg).toMatch(/Arduino IDE|Serial Monitor/i);
    expect(msg).toMatch(/кабел|драйвер/i);
  });

  it("maps failed to open serial (en)", () => {
    const msg = friendlyPioError("Failed to open COM4: FileNotFoundError", "en");
    expect(msg.toLowerCase()).toMatch(/could not open|serial port/);
    expect(msg.toLowerCase()).toMatch(/ch340|cp210x|driver/);
  });

  it("maps vscode-unrelated pio missing", () => {
    expect(friendlyPioError("PlatformIO CLI not found", "en")).toMatch(
      /PlatformIO CLI not found/,
    );
  });

  it("maps registry timeout (en/ru)", () => {
    const en = friendlyPioError(
      "PlatformIO timed out after 12s (offline or slow registry?).",
      "en",
    );
    expect(en.toLowerCase()).toMatch(/timed out|offline/);
    const ru = friendlyPioError(
      "PlatformIO timed out after 12s (offline or slow registry?).",
      "ru",
    );
    expect(ru).toMatch(/таймаут|офлайн/i);
  });

  it("maps unmapped Arduino FQBN with board name (en/ru)", () => {
    const raw =
      "No Arduino FQBN mapping for board 'weird_board'. Switch build tool to PlatformIO.";
    const en = friendlyPioError(raw, "en");
    expect(en).toMatch(/weird_board/);
    expect(en.toLowerCase()).toMatch(/platformio|fqbn/);
    const ru = friendlyPioError(raw, "ru");
    expect(ru).toMatch(/weird_board/);
    expect(ru).toMatch(/FQBN|PlatformIO/i);
  });

  it("maps Arduino core install failure (en)", () => {
    const msg = friendlyPioError(
      "Failed to install Arduino core 'esp32:esp32': network error",
      "en",
    );
    expect(msg.toLowerCase()).toMatch(/core|esp32|avr/);
  });
});
