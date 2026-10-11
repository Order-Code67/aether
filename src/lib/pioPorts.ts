import type { SerialPortInfo } from "@/lib/serial";

/** Prefer last-used if still listed; else first plausible USB/serial device. */
export function pickPreferredPort(
  ports: SerialPortInfo[],
  preferred?: string | null,
): string {
  if (!ports.length) return "";
  const pref = preferred?.trim();
  if (pref && ports.some((p) => p.path === pref)) return pref;

  const score = (p: SerialPortInfo): number => {
    const hay = `${p.path} ${p.name ?? ""} ${p.portType ?? ""}`.toLowerCase();
    if (/bluetooth|bth|incoming/i.test(hay)) return 0;
    if (/usb|ch340|cp210|ftdi|silicon|wch|arduino|esp|serial/i.test(hay)) {
      return 3;
    }
    if (/^com\d+$/i.test(p.path) || /^\/dev\/tty(usb|acm|ama)/i.test(p.path)) {
      return 2;
    }
    return 1;
  };

  const ranked = [...ports].sort((a, b) => score(b) - score(a));
  return ranked[0]?.path ?? "";
}

/** Map PlatformIO board ids / env names to a preferred env in the project list. */
export function matchEnvForBoard(
  envs: string[],
  hint?: string | null,
): string | null {
  if (!envs.length) return null;
  if (!hint) return envs[0] ?? null;
  const h = hint.toLowerCase();
  const exact = envs.find((e) => e.toLowerCase() === h);
  if (exact) return exact;
  const partial = envs.find(
    (e) => e.toLowerCase().includes(h) || h.includes(e.toLowerCase()),
  );
  if (partial) return partial;

  // Wizard / catalog board ids → common env names
  const aliases: Record<string, string[]> = {
    esp32dev: ["esp32dev", "esp32"],
    megaatmega2560: ["megaatmega2560", "mega"],
    nanoatmega328: ["nanoatmega328", "nano"],
    heltec_wifi_lora_32_V3: ["heltec_wifi_lora_32_V3", "heltec"],
    heltec_wifi_lora_32_V2: ["heltec_wifi_lora_32_V2", "heltec"],
    "ttgo-t-beam": ["ttgo-t-beam", "t-beam", "tbeam"],
    "ttgo-lora32-v2": ["ttgo-lora32-v2", "lora32"],
  };
  for (const [board, names] of Object.entries(aliases)) {
    if (h === board || names.some((n) => h.includes(n))) {
      const hit = envs.find((e) =>
        names.some((n) => e.toLowerCase().includes(n)),
      );
      if (hit) return hit;
    }
  }
  return envs[0] ?? null;
}
