import type { PlotterParseMode } from "@/stores/plotterStore";

export type PlotterEmptyReason =
  | "need_connect"
  | "paused"
  | "waiting_text"
  | "waiting_mavlink"
  | "waiting_msp"
  | "channels_hidden";

export type SerialEmptyReason =
  | "need_connect"
  | "no_ports"
  | "waiting_data"
  | "recording_empty";

export function plotterEmptyReason(opts: {
  connected: boolean;
  paused: boolean;
  parseMode: PlotterParseMode;
  preset: string;
  hasPoints: boolean;
  visibleChannelCount: number;
  channelCount: number;
}): PlotterEmptyReason | null {
  if (opts.hasPoints && opts.visibleChannelCount > 0) return null;
  if (!opts.connected) return "need_connect";
  if (opts.paused) return "paused";
  if (opts.hasPoints && opts.channelCount > 0 && opts.visibleChannelCount === 0) {
    return "channels_hidden";
  }
  if (opts.preset === "msp") return "waiting_msp";
  if (opts.parseMode === "mavlink") return "waiting_mavlink";
  return "waiting_text";
}

export function serialEmptyReason(opts: {
  connected: boolean;
  portsEmpty: boolean;
  hasLines: boolean;
}): SerialEmptyReason | null {
  if (opts.hasLines) return null;
  if (opts.portsEmpty && !opts.connected) return "no_ports";
  if (!opts.connected) return "need_connect";
  return "waiting_data";
}
