import { describe, expect, it } from "vitest";
import { formatSupportReport, type SupportReportSnapshot } from "./supportReport";

const base: SupportReportSnapshot = {
  aetherVersion: "0.2.6",
  os: "Win32 | test",
  locale: "en",
  pioInstalled: true,
  pioVersion: "6.1.0",
  selectedEnv: "esp32dev",
  uploadPort: "COM3",
  lastTask: "upload",
  lastSuccess: false,
  lastError: "port busy",
  lastOutputTail: "error: port busy",
  clangdInstalled: true,
  clangdVersion: "18.1.0",
  clangdRunning: false,
  clangdError: null,
};

describe("formatSupportReport", () => {
  it("includes key fields in English", () => {
    const text = formatSupportReport(base);
    expect(text).toContain("Aether support report");
    expect(text).toContain("0.2.6");
    expect(text).toContain("esp32dev");
    expect(text).toContain("COM3");
    expect(text).toContain("port busy");
    expect(text).toContain("clangd");
    expect(text).toContain("Output tail");
    expect(text).toContain("error: port busy");
    expect(text).toContain("failure");
  });

  it("uses Russian labels for ru locale", () => {
    const text = formatSupportReport({ ...base, locale: "ru" });
    expect(text).toContain("Отчёт поддержки Aether");
    expect(text).toContain("Версия Aether");
    expect(text).toContain("Порт загрузки");
    expect(text).toContain("Хвост вывода");
    expect(text).toContain("ошибка");
  });

  it("includes last task and env for triage", () => {
    const text = formatSupportReport({
      ...base,
      lastTask: "build",
      lastSuccess: true,
      lastError: null,
      lastOutputTail: "SUCCESS",
    });
    expect(text).toContain("Last task: build");
    expect(text).toContain("success");
    expect(text).toContain("SUCCESS");
  });
});
