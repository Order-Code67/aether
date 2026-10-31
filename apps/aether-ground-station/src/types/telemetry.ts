/**
 * JSON-протокол диагностической телеметрии.
 * Отсутствующие датчики — null, не вымышленные числа.
 */
export interface DiagnosticsMessage {
  device: string;
  version: string;
  status: string;
  voltage: number | null;
  temperature: number | null;
  [key: string]: unknown;
}

export function parseDiagnosticsMessage(raw: string): DiagnosticsMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.device !== "string") return null;
    if (typeof obj.version !== "string") return null;
    if (typeof obj.status !== "string") return null;
    return {
      ...obj,
      device: obj.device,
      version: obj.version,
      status: obj.status,
      voltage: typeof obj.voltage === "number" ? obj.voltage : null,
      temperature: typeof obj.temperature === "number" ? obj.temperature : null,
    };
  } catch {
    return null;
  }
}
