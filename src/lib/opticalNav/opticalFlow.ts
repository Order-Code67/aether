import type { GrayFrame, OpticalFlowResult, OpticalNavConfig } from "./types";

function sample(frame: GrayFrame, x: number, y: number): number {
  const xi = Math.max(0, Math.min(frame.width - 1, x | 0));
  const yi = Math.max(0, Math.min(frame.height - 1, y | 0));
  return frame.data[yi * frame.width + xi]!;
}

function blockVariance(
  frame: GrayFrame,
  ox: number,
  oy: number,
  block: number,
): number {
  let sum = 0;
  let sumSq = 0;
  const n = block * block;
  for (let y = 0; y < block; y++) {
    for (let x = 0; x < block; x++) {
      const v = sample(frame, ox + x, oy + y);
      sum += v;
      sumSq += v * v;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function sad(
  prev: GrayFrame,
  curr: GrayFrame,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  block: number,
): number {
  let err = 0;
  for (let y = 0; y < block; y++) {
    for (let x = 0; x < block; x++) {
      err += Math.abs(
        sample(prev, ox + x, oy + y) - sample(curr, ox + x + dx, oy + y + dy),
      );
    }
  }
  return err;
}

/**
 * Dense block-matching optical flow (down-looking camera).
 * Image +Y is down; for a nadir camera, +dy (image) ≈ aircraft moving North
 * when heading=0 after body→NED rotation (handled in deadReckoning).
 */
export function estimateOpticalFlow(
  prev: GrayFrame,
  curr: GrayFrame,
  config: Pick<
    OpticalNavConfig,
    "blockSize" | "searchRadius" | "minBlockVariance"
  >,
): OpticalFlowResult {
  const block = Math.max(4, config.blockSize | 0);
  const radius = Math.max(1, config.searchRadius | 0);
  const margin = block + radius;
  const step = block;

  let sumDx = 0;
  let sumDy = 0;
  let sumRes = 0;
  let inliers = 0;
  let candidates = 0;

  for (let y = margin; y + margin < prev.height; y += step) {
    for (let x = margin; x + margin < prev.width; x += step) {
      candidates += 1;
      if (blockVariance(prev, x, y, block) < config.minBlockVariance) {
        continue;
      }

      let best = Infinity;
      let bestDx = 0;
      let bestDy = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const e = sad(prev, curr, x, y, dx, dy, block);
          if (e < best) {
            best = e;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      // Reject uniform / ambiguous matches (zero shift with huge residual)
      const n = block * block;
      const meanSad = best / n;
      if (meanSad > 45) continue;

      sumDx += bestDx;
      sumDy += bestDy;
      sumRes += meanSad;
      inliers += 1;
    }
  }

  if (inliers === 0) {
    return {
      dxPx: 0,
      dyPx: 0,
      quality: 0,
      residual: Infinity,
      inliers: 0,
    };
  }

  return {
    dxPx: sumDx / inliers,
    dyPx: sumDy / inliers,
    quality: candidates > 0 ? inliers / candidates : 0,
    residual: sumRes / inliers,
    inliers,
  };
}

/** Convert ImageData / canvas RGBA into a GrayFrame. */
export function rgbaToGray(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  timestampMs = Date.now(),
): GrayFrame {
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    // ITU-R BT.601 luma
    data[i] =
      0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  }
  return { width, height, data, timestampMs };
}

/**
 * Draw a Blob/URL into an offscreen canvas, downscale, return grayscale.
 * Uses createImageBitmap so JPEG from ESP32-CAM works without <img> CORS taint
 * when bytes were fetched in Tauri / same-origin.
 */
export async function decodeImageToGray(
  source: Blob | ImageBitmap,
  maxSide: number,
  timestampMs = Date.now(),
): Promise<GrayFrame> {
  const bitmap =
    source instanceof ImageBitmap
      ? source
      : await createImageBitmap(source);

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(16, Math.round(bitmap.width * scale));
    const height = Math.max(16, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2d context unavailable");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const img = ctx.getImageData(0, 0, width, height);
    return rgbaToGray(img.data, width, height, timestampMs);
  } finally {
    if (source instanceof Blob) {
      bitmap.close();
    }
  }
}
