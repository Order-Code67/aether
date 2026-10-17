import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  clearLocalTelemetry,
  getLocalTelemetryEvents,
  trackBuildOrUploadFail,
  trackEvent,
} from "@/lib/telemetry";

describe("telemetry", () => {
  beforeEach(() => {
    clearLocalTelemetry();
    useSettingsStore.setState({ telemetryOptIn: false });
  });

  it("does not record build_fail when opt-in is off", () => {
    trackBuildOrUploadFail("build", { tool: "platformio" });
    expect(getLocalTelemetryEvents()).toHaveLength(0);
  });

  it("records build/upload fail locally when opt-in is on", () => {
    useSettingsStore.setState({ telemetryOptIn: true });
    trackBuildOrUploadFail("upload", { tool: "arduino-cli", errorClass: "port" });
    const events = getLocalTelemetryEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("upload_fail");
    expect(events[0]?.props?.tool).toBe("arduino-cli");
  });

  it("redacts path-like strings", () => {
    useSettingsStore.setState({ telemetryOptIn: true });
    trackEvent("build_fail", { path: "D:\\secret\\project", ok: true });
    expect(getLocalTelemetryEvents()[0]?.props?.path).toBe("[redacted]");
    expect(getLocalTelemetryEvents()[0]?.props?.ok).toBe(true);
  });
});
