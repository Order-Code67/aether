const SENSITIVE_KEY = /pass(word)?|secret|token|api[_-]?key|credential|auth/i;

/** Секреты не должны попадать в журналы и экспорт. */
export function redactSecrets(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[скрыто]";
      continue;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out[key] = redactSecrets(raw as Record<string, unknown>);
      continue;
    }
    out[key] = raw;
  }
  return out;
}
