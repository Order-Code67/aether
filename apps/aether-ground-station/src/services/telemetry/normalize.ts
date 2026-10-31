import type { DiagnosticsMessage } from "@/types";
import { parseDiagnosticsMessage } from "@/types";

/** UI-facing telemetry — never carries vendor wire format. */
export interface NormalizedTelemetry {
  deviceId: string;
  deviceLabel: string;
  firmware?: string;
  online: boolean;
  voltageV: number | null;
  temperatureC: number | null;
  rawStatus: string;
  receivedAt: string;
  warnings: string[];
}

export interface TelemetrySample {
  at: string;
  voltageV: number | null;
  temperatureC: number | null;
}

export type TelemetryAdapterId = "esp32-json" | "generic-json";

export interface TelemetryAdapter {
  id: TelemetryAdapterId;
  label: string;
  parse(line: string): NormalizedTelemetry | null;
}

function fromDiagnostics(msg: DiagnosticsMessage): NormalizedTelemetry {
  const warnings: string[] = [];
  if (msg.voltage === null) warnings.push("Нет данных напряжения");
  if (msg.temperature === null) warnings.push("Нет данных температуры");
  if (msg.status !== "online") warnings.push(`Статус: ${msg.status}`);
  return {
    deviceId: msg.device,
    deviceLabel: msg.device,
    firmware: msg.version,
    online: msg.status === "online",
    voltageV: msg.voltage,
    temperatureC: msg.temperature,
    rawStatus: msg.status,
    receivedAt: new Date().toISOString(),
    warnings,
  };
}

export const esp32JsonAdapter: TelemetryAdapter = {
  id: "esp32-json",
  label: "ESP32 / Arduino JSON",
  parse(line: string) {
    const msg = parseDiagnosticsMessage(line);
    return msg ? fromDiagnostics(msg) : null;
  },
};

export const genericJsonAdapter: TelemetryAdapter = {
  id: "generic-json",
  label: "Generic JSON",
  parse(line: string) {
    try {
      const o = JSON.parse(line) as Record<string, unknown>;
      const device = String(o.device ?? o.id ?? "unknown");
      const status = String(o.status ?? "unknown");
      const voltage =
        typeof o.voltage === "number"
          ? o.voltage
          : typeof o.voltageV === "number"
            ? o.voltageV
            : null;
      const temperature =
        typeof o.temperature === "number"
          ? o.temperature
          : typeof o.temperatureC === "number"
            ? o.temperatureC
            : null;
      return fromDiagnostics({
        device,
        version: String(o.version ?? o.firmware ?? ""),
        status,
        voltage,
        temperature,
      });
    } catch {
      return null;
    }
  },
};

const ADAPTERS: TelemetryAdapter[] = [esp32JsonAdapter, genericJsonAdapter];

export function normalizeTelemetryLine(
  line: string,
  preferred: TelemetryAdapterId = "esp32-json",
): NormalizedTelemetry | null {
  const first = ADAPTERS.find((a) => a.id === preferred) ?? esp32JsonAdapter;
  return first.parse(line) ?? genericJsonAdapter.parse(line);
}

export function exportTelemetryCsv(samples: TelemetrySample[]): string {
  const header = "at,voltage_v,temperature_c";
  const rows = samples.map(
    (s) =>
      `${s.at},${s.voltageV ?? ""},${s.temperatureC ?? ""}`,
  );
  return [header, ...rows].join("\n");
}
