export {
  listCaptureDevices,
  openCaptureStream,
  stopStream,
  readVideoMetrics,
  createRecorder,
} from "./captureService";

export {
  getVideoAdapter,
  mediaDevicesAdapter,
  rtspAdapter,
  webrtcAdapter,
} from "./adapters";
export type { VideoAdapter, VideoAdapterKind } from "./adapters";
export { saveRecordingToDisk } from "./recording";

export function isVideoCaptureAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
}
