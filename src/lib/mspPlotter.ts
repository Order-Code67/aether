import type { MspStatusSnapshot } from "@/lib/mspMinimal";
import type { PlotSample } from "@/lib/serialPlotter";

/** Map MSP status snapshot into plotter channels (RSSI / voltage / GPS). */
export function mspSnapshotToPlotSample(
  snap: MspStatusSnapshot | null | undefined,
): PlotSample | null {
  if (!snap) return null;
  const sample: PlotSample = {};
  if (snap.analog) {
    sample.RSSI = snap.analog.rssi;
    sample.voltage = snap.analog.voltage;
    sample.mAh = snap.analog.mAhDrawn;
    if (snap.analog.amperage != null) {
      sample.amps = snap.analog.amperage;
    }
  }
  if (snap.status) {
    sample.cycle_us = snap.status.cycleTime;
    if (snap.status.cpuLoad != null) sample.cpu = snap.status.cpuLoad;
  }
  if (snap.gps && snap.gps.fix >= 1) {
    sample.sats = snap.gps.numSat;
    sample.alt = snap.gps.alt;
    sample.gspeed = snap.gps.speed;
  }
  return Object.keys(sample).length > 0 ? sample : null;
}
