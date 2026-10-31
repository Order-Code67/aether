export {
  listCaptureDevices,
  openCaptureStream,
  stopStream,
  readVideoMetrics,
  createRecorder,
} from "./captureService";

export function isVideoCaptureAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
}
