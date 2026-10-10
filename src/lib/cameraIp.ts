/** Extract camera / stream URL hints from Serial Monitor lines. */

const IPV4_RE =
  /\b((?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d))\b/;

const URL_RE = /https?:\/\/[^\s"'<>]+/i;

/**
 * If the line announces Wi-Fi / IP / a stream URL, return a suggested camera base URL
 * (scheme + host, optional path). Prefer `/capture` when only an IP is found.
 */
export function suggestCameraUrlFromSerialLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(URL_RE);
  if (urlMatch?.[0]) {
    const raw = urlMatch[0].replace(/[.,;)]+$/, "");
    try {
      const u = new URL(raw);
      if (!u.hostname) return null;
      // Keep path if it looks like stream/capture; else use host root for /capture
      const path = u.pathname.replace(/\/$/, "");
      if (/\/(capture|stream|jpg|mjpeg)/i.test(path)) {
        return `${u.protocol}//${u.host}${path}`;
      }
      return `${u.protocol}//${u.host}/capture`;
    } catch {
      // fall through to IP
    }
  }

  const looksLikeIpAnnounce =
    /wifi\s*connected|connected\.?\s*ip|ip\s*address|local\s*ip|http\s*server|stream\s*ready|camera\s*ready/i.test(
      trimmed,
    ) ||
    /^ip[:\s]/i.test(trimmed) ||
    /:\s*\d{1,3}(?:\.\d{1,3}){3}/.test(trimmed);

  if (!looksLikeIpAnnounce && !IPV4_RE.test(trimmed)) {
    return null;
  }

  // Prefer IP near "IP" keywords; else first IPv4 that is not 0.0.0.0 / 127.*
  const all = trimmed.match(
    /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g,
  );
  if (!all?.length) return null;

  const ip =
    all.find((candidate) => {
      if (candidate === "0.0.0.0" || candidate.startsWith("127.")) return false;
      return true;
    }) ?? null;

  if (!ip) return null;
  if (!looksLikeIpAnnounce && !/ip/i.test(trimmed)) {
    // Bare IP without context — still accept common ESP log shapes
    if (!/^\s*(?:ip|address)/i.test(trimmed) && all.length === 1 && trimmed.length > 40) {
      return null;
    }
  }

  return `http://${ip}/capture`;
}

/** Normalize user input into a fetchable snapshot/stream URL. */
export function normalizeCameraUrl(input: string): string {
  let s = input.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  try {
    const u = new URL(s);
    if (!u.pathname || u.pathname === "/") {
      u.pathname = "/capture";
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return s;
  }
}
