import { describe, expect, it } from "vitest";
import {
  looksLikeEsp32Cam,
  normalizeCameraUrl,
  suggestCameraUrlFromSerialLine,
} from "./cameraIp";

describe("suggestCameraUrlFromSerialLine", () => {
  it("parses Connected. IP: lines", () => {
    expect(suggestCameraUrlFromSerialLine("Connected. IP: 192.168.1.42")).toBe(
      "http://192.168.1.42/capture",
    );
  });

  it("parses WiFi connected with IP", () => {
    expect(
      suggestCameraUrlFromSerialLine("WiFi connected, IP address: 10.0.0.5"),
    ).toBe("http://10.0.0.5/capture");
  });

  it("keeps /stream path from full URL", () => {
    expect(
      suggestCameraUrlFromSerialLine("Stream ready at http://192.168.4.1/stream"),
    ).toBe("http://192.168.4.1/stream");
  });

  it("ignores unrelated lines", () => {
    expect(suggestCameraUrlFromSerialLine("temp:23.5 humidity:40")).toBeNull();
    expect(suggestCameraUrlFromSerialLine("hello")).toBeNull();
  });
});

describe("normalizeCameraUrl", () => {
  it("adds scheme and /capture", () => {
    expect(normalizeCameraUrl("192.168.1.10")).toBe(
      "http://192.168.1.10/capture",
    );
  });

  it("preserves explicit path", () => {
    expect(normalizeCameraUrl("http://10.0.0.1/stream")).toBe(
      "http://10.0.0.1/stream",
    );
  });
});

describe("looksLikeEsp32Cam", () => {
  it("matches env / profile / capture URL", () => {
    expect(looksLikeEsp32Cam("", { env: "esp32cam" })).toBe(true);
    expect(looksLikeEsp32Cam("", { profileName: "My ESP32-CAM" })).toBe(true);
    expect(looksLikeEsp32Cam("http://192.168.4.1/capture")).toBe(true);
    expect(looksLikeEsp32Cam("http://10.0.0.8/stream")).toBe(true);
  });

  it("ignores unrelated URLs", () => {
    expect(looksLikeEsp32Cam("https://example.com/photo.jpg")).toBe(false);
    expect(looksLikeEsp32Cam("", { env: "uno" })).toBe(false);
  });
});
