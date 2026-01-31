/**
 * Person crop capture — 3 frames over ~1s, crop to bbox + 15% margin, save to ./alerts/frames/
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Bbox, TrackedPerson } from "./types";

const ALERTS_FRAMES_DIR = "alerts/frames";
const MARGIN = 0.15; // 15% margin around bbox
const CROP_COUNT = 3;

/**
 * Crop bbox with margin (clamped to 0..1 or 0..width/height).
 */
export function cropBoxWithMargin(
  box: Bbox,
  frameWidth: number,
  frameHeight: number,
  margin: number = MARGIN
): { x: number; y: number; w: number; h: number } {
  const w = box.x2 - box.x1;
  const h = box.y2 - box.y1;
  const mw = w * margin;
  const mh = h * margin;
  let x1 = box.x1 - mw;
  let y1 = box.y1 - mh;
  let x2 = box.x2 + mw;
  let y2 = box.y2 + mh;
  x1 = Math.max(0, Math.min(x1, frameWidth - 1));
  y1 = Math.max(0, Math.min(y1, frameHeight - 1));
  x2 = Math.max(0, Math.min(x2, frameWidth));
  y2 = Math.max(0, Math.min(y2, frameHeight));
  if (x2 <= x1) x2 = x1 + 1;
  if (y2 <= y1) y2 = y1 + 1;
  return { x: Math.floor(x1), y: Math.floor(y1), w: Math.ceil(x2 - x1), h: Math.ceil(y2 - y1) };
}

/**
 * Save person crops from frame buffers (e.g. 3 frames over ~1s).
 * frameBuffers: array of { width, height, data: Buffer (RGB or RGBA) } or base64 JPEG strings.
 * Returns paths relative to cwd: ./alerts/frames/<ts>_<cam>_<track>_<i>.jpg
 */
export async function savePersonCrops(
  cameraId: string,
  trackId: string,
  ts: string,
  frameBuffers: Array<{ width: number; height: number; dataUrl?: string }>,
  bboxes: Bbox[]
): Promise<string[]> {
  const dir = path.join(process.cwd(), ALERTS_FRAMES_DIR);
  await mkdir(dir, { recursive: true });
  const safeTs = ts.replace(/[:.]/g, "-").slice(0, 19);
  const safeCam = cameraId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 24);
  const safeTrack = trackId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 16);
  const paths: string[] = [];
  const n = Math.min(CROP_COUNT, frameBuffers.length, bboxes.length);

  for (let i = 0; i < n; i++) {
    const buf = frameBuffers[i];
    const box = bboxes[i];
    if (!buf || !box) continue;
    const ext = buf.dataUrl?.startsWith("data:image/") ? "jpg" : "jpg";
    const fileName = `${safeTs}_${safeCam}_${safeTrack}_${i}.${ext}`;
    const fullPath = path.join(dir, fileName);

    if (buf.dataUrl && buf.dataUrl.startsWith("data:image")) {
      const base64 = buf.dataUrl.split(",")[1];
      if (base64) {
        await writeFile(fullPath, Buffer.from(base64, "base64"));
        paths.push(path.join(ALERTS_FRAMES_DIR, fileName));
      }
    }
  }

  return paths;
}

/**
 * Stub: return fake paths for smoke test when no real frames.
 */
export function stubFramePaths(cameraId: string, trackId: string): string[] {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeCam = cameraId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 24);
  const safeTrack = trackId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 16);
  return [
    path.join(ALERTS_FRAMES_DIR, `${ts}_${safeCam}_${safeTrack}_0.jpg`),
    path.join(ALERTS_FRAMES_DIR, `${ts}_${safeCam}_${safeTrack}_1.jpg`),
    path.join(ALERTS_FRAMES_DIR, `${ts}_${safeCam}_${safeTrack}_2.jpg`),
  ];
}
