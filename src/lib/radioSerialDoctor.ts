/** Detect LoRa / radio failure and success phrases in Serial Monitor lines. */

const FAIL_RE =
  /\b(init\s*fail|radio\s*fail|join\s*fail|join\s*failed|no\s*join|failed\s*to\s*join|SX12\d{2}.*fail|RadioLib.*fail|ERROR|error:|begin\s*failed|no\s*packet|timeout)\b/i;

const LORA_CONTEXT_RE =
  /\b(lora|lorawan|radiolib|sx127|sx126|rfm9|heltec|ttn|join|OTAA|RSSI|SNR)\b/i;

const RX_OK_RE = /^RX:\s+/i;
const JOIN_OK_RE =
  /\b(join(?:ed)?\s*ok|network\s*joined|OTAA\s*joined|join\s*success|joined\s+network)\b/i;
const UPLINK_OK_RE = /\b(uplink\s*ok|TX\s*OK|transmit\s*ok|packet\s*sent)\b/i;

export function lineLooksLikeRadioFail(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (!FAIL_RE.test(trimmed)) return false;
  // Prefer lines that mention radio context, or short hard fails
  return LORA_CONTEXT_RE.test(trimmed) || /init\s*fail|begin\s*failed/i.test(trimmed);
}

/** Positive RX packet line from Aether esp32-lora-rx sketch. */
export function lineLooksLikeRadioRxOk(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (RX_OK_RE.test(trimmed)) return true;
  return /\bRSSI\s*=\s*-?\d/i.test(trimmed) && /\bSNR\s*=/i.test(trimmed);
}

/** LoRaWAN Join success. */
export function lineLooksLikeRadioJoinOk(line: string): boolean {
  return JOIN_OK_RE.test(line.trim());
}

/** P2P TX or LoRaWAN uplink ack. */
export function lineLooksLikeRadioUplinkOk(line: string): boolean {
  return UPLINK_OK_RE.test(line.trim());
}
