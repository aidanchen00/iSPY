/**
 * Person tracking — IOU-based match, track_id, bbox history, last_seen
 */

import type { Bbox, PersonDetection, Point, TrackedPerson } from "./types";

const IOU_THRESHOLD = 0.3;
const MAX_BBOX_HISTORY = 10;
let nextTrackId = 1;

function iou(a: Bbox, b: Bbox): number {
  const xi1 = Math.max(a.x1, b.x1);
  const yi1 = Math.max(a.y1, b.y1);
  const xi2 = Math.min(a.x2, b.x2);
  const yi2 = Math.min(a.y2, b.y2);
  const interW = Math.max(0, xi2 - xi1);
  const interH = Math.max(0, yi2 - yi1);
  const inter = interW * interH;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

const activeTracks = new Map<string, TrackedPerson>();

/**
 * Update tracks with new detections. Match by IOU > 0.3.
 * Returns per-frame tracked persons: [{ track_id, bbox, confidence }].
 */
export function updateTracks(
  detections: PersonDetection[],
  nowMs: number = Date.now()
): TrackedPerson[] {
  const matched = new Set<string>();
  const result: TrackedPerson[] = [];

  for (const det of detections) {
    let bestTrack: TrackedPerson | null = null;
    let bestIou = IOU_THRESHOLD;

    for (const track of Array.from(activeTracks.values())) {
      if (matched.has(track.track_id)) continue;
      const score = iou(track.bbox, det.bbox);
      if (score > bestIou) {
        bestIou = score;
        bestTrack = track;
      }
    }

    if (bestTrack) {
      matched.add(bestTrack.track_id);
      const history = [...bestTrack.bbox_history, det.bbox].slice(-MAX_BBOX_HISTORY);
      const updated: TrackedPerson = {
        track_id: bestTrack.track_id,
        bbox: det.bbox,
        confidence: det.confidence,
        bbox_history: history,
        last_seen: nowMs,
        first_seen: bestTrack.first_seen,
      };
      activeTracks.set(bestTrack.track_id, updated);
      result.push(updated);
    } else {
      const trackId = `t${nextTrackId++}`;
      const newTrack: TrackedPerson = {
        track_id: trackId,
        bbox: det.bbox,
        confidence: det.confidence,
        bbox_history: [det.bbox],
        last_seen: nowMs,
        first_seen: nowMs,
      };
      activeTracks.set(trackId, newTrack);
      result.push(newTrack);
    }
  }

  // Drop tracks not seen this frame (optional: prune by age elsewhere)
  return result;
}

/**
 * Get bbox center (normalized 0-1 if bbox is in pixel coords, pass width/height to normalize).
 */
export function bboxCenter(box: Bbox, frameWidth?: number, frameHeight?: number): Point {
  const x = (box.x1 + box.x2) / 2;
  const y = (box.y1 + box.y2) / 2;
  if (frameWidth != null && frameHeight != null) {
    return { x: x / frameWidth, y: y / frameHeight };
  }
  return { x, y };
}

/**
 * Torso width/height ratio from bbox (proxy: width/height of box).
 */
export function bboxTorsoRatio(box: Bbox): number {
  const w = box.x2 - box.x1;
  const h = box.y2 - box.y1;
  if (h <= 0) return 0;
  return w / h;
}

/**
 * Reset tracking state (for tests).
 */
export function resetTracks(): void {
  activeTracks.clear();
  nextTrackId = 1;
}

export function getActiveTracks(): TrackedPerson[] {
  return Array.from(activeTracks.values());
}
