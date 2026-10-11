/** Detect LoRa / radio failure phrases in Serial Monitor lines. */

const FAIL_RE =
  /\b(init\s*fail|radio\s*fail|join\s*fail|join\s*failed|no\s*join|failed\s*to\s*join|SX12\d{2}.*fail|RadioLib.*fail|ERROR|error:|begin\s*failed|no\s*packet|timeout)\b/i;

const LORA_CONTEXT_RE =
  /\b(lora|lorawan|radiolib|sx127|sx126|rfm9|heltec|ttn|join|OTAA|RSSI|SNR)\b/i;

export function lineLooksLikeRadioFail(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (!FAIL_RE.test(trimmed)) return false;
  // Prefer lines that mention radio context, or short hard fails
  return LORA_CONTEXT_RE.test(trimmed) || /init\s*fail|begin\s*failed/i.test(trimmed);
}
