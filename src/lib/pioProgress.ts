/** Build/upload stage inferred from PlatformIO / esptool / avrdude log lines. */
export type PioStage =
  | "idle"
  | "starting"
  | "compiling"
  | "linking"
  | "uploading"
  | "installing"
  | "done"
  | "failed";

export interface PioProgress {
  stage: PioStage;
  /** 0–100 when known (e.g. esptool Writing at … (xx %)). */
  percent: number | null;
  /** Last raw line that advanced progress. */
  detail: string | null;
}

export function emptyPioProgress(): PioProgress {
  return { stage: "idle", percent: null, detail: null };
}

/** Update progress from a single output line. Returns previous if unchanged. */
export function advancePioProgress(
  prev: PioProgress,
  line: string,
  stream: string,
): PioProgress {
  const text = line.trim();
  if (!text) return prev;
  const lower = text.toLowerCase();

  if (stream === "system") {
    if (lower.includes("finished successfully")) {
      return { stage: "done", percent: 100, detail: text };
    }
    if (lower.includes("failed") || lower.includes("cancelled")) {
      return { stage: "failed", percent: prev.percent, detail: text };
    }
    if (lower.startsWith(">") || lower.startsWith("cwd:")) {
      return {
        stage: prev.stage === "idle" ? "starting" : prev.stage,
        percent: prev.percent,
        detail: text,
      };
    }
  }

  // esptool: Writing at 0x00010000... (42 %)
  const pctMatch = text.match(/\((\d{1,3})\s*%\)/);
  if (
    pctMatch &&
    (lower.includes("writing at") ||
      lower.includes("uploaded") ||
      lower.includes("progress"))
  ) {
    const n = Math.min(100, Math.max(0, Number(pctMatch[1])));
    return { stage: "uploading", percent: n, detail: text };
  }

  if (
    lower.includes("compiling") ||
    lower.startsWith("avr-g++") ||
    lower.startsWith("xtensa-") ||
    lower.includes(".c.o") ||
    lower.includes(".cpp.o")
  ) {
    return { stage: "compiling", percent: prev.percent, detail: text };
  }

  if (
    lower.includes("linking") ||
    lower.includes("archiving") ||
    lower.includes("building .pio") ||
    lower.includes("creating bin")
  ) {
    return { stage: "linking", percent: prev.percent, detail: text };
  }

  if (
    lower.includes("uploading") ||
    lower.includes("connecting") ||
    lower.includes("chip is") ||
    lower.includes("writing at") ||
    lower.includes("avrdude") ||
    lower.includes("esptool") ||
    lower.includes("serial port") ||
    lower.includes("flashing")
  ) {
    return {
      stage: "uploading",
      percent: prev.percent ?? 0,
      detail: text,
    };
  }

  if (
    lower.includes("installing") ||
    lower.includes("pkg install") ||
    lower.includes("librarymanager")
  ) {
    return { stage: "installing", percent: prev.percent, detail: text };
  }

  return prev;
}
