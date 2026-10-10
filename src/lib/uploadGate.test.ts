import { describe, expect, it, vi } from "vitest";
import {
  isRetryableUploadPortError,
  releaseSerialBeforeUpload,
  shouldRetryUploadOnPortError,
} from "./uploadGate";

describe("releaseSerialBeforeUpload", () => {
  it("no-ops when already disconnected", async () => {
    const disconnect = vi.fn();
    await expect(
      releaseSerialBeforeUpload({ connected: false, disconnect }),
    ).resolves.toBe("already-free");
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("disconnects when serial is connected", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    await expect(
      releaseSerialBeforeUpload({ connected: true, disconnect }),
    ).resolves.toBe("released");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("reports release-failed when disconnect throws", async () => {
    const disconnect = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      releaseSerialBeforeUpload({ connected: true, disconnect }),
    ).resolves.toBe("release-failed");
  });
});

describe("isRetryableUploadPortError", () => {
  it("matches access denied / busy / failed to open", () => {
    expect(isRetryableUploadPortError("Access is denied")).toBe(true);
    expect(isRetryableUploadPortError("Port busy or access denied")).toBe(true);
    expect(isRetryableUploadPortError("Failed to open COM3")).toBe(true);
    expect(isRetryableUploadPortError("could not open port 'COM5'")).toBe(true);
    expect(isRetryableUploadPortError("SerialException: ...")).toBe(true);
    expect(isRetryableUploadPortError("Порт занят или доступ запрещён")).toBe(
      true,
    );
  });

  it("ignores unrelated build errors", () => {
    expect(isRetryableUploadPortError("error: 'LED_PIN' was not declared")).toBe(
      false,
    );
    expect(isRetryableUploadPortError("")).toBe(false);
  });
});

describe("shouldRetryUploadOnPortError", () => {
  it("retries once for failed upload port errors", () => {
    expect(
      shouldRetryUploadOnPortError({
        task: "upload",
        running: false,
        success: false,
        alreadyRetried: false,
        errorText: "Access is denied",
      }),
    ).toBe(true);
  });

  it("does not retry when already retried or not upload", () => {
    expect(
      shouldRetryUploadOnPortError({
        task: "upload",
        running: false,
        success: false,
        alreadyRetried: true,
        errorText: "Access is denied",
      }),
    ).toBe(false);
    expect(
      shouldRetryUploadOnPortError({
        task: "build",
        running: false,
        success: false,
        alreadyRetried: false,
        errorText: "Access is denied",
      }),
    ).toBe(false);
    expect(
      shouldRetryUploadOnPortError({
        task: "upload",
        running: true,
        success: null,
        alreadyRetried: false,
        errorText: "Access is denied",
      }),
    ).toBe(false);
  });
});
