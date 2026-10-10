/** Interpret GDB `-data-evaluate-expression` result as a boolean condition. */
export function isConditionTruthy(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === "0" ||
    lower === "false" ||
    lower === "0x0" ||
    lower === '""' ||
    lower === "''" ||
    lower === "null" ||
    lower === "nullptr" ||
    lower === "{}" ||
    lower === "void"
  ) {
    return false;
  }
  // Numeric zero variants
  if (/^0+(\.0+)?$/.test(trimmed)) return false;
  return true;
}

export function normalizeWatchExpression(expr: string): string {
  return expr.trim();
}
