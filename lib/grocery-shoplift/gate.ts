/**
 * Alert gate — per-camera 20s, per-track 30s, judge confidence >= 0.7
 *
 * Env: SHOPLIFT_CAMERA_COOLDOWN_SECONDS (20), SHOPLIFT_TRACK_COOLDOWN_SECONDS (30), SHOPLIFT_JUDGE_MIN_CONFIDENCE (0.7).
 */

const DEFAULT_CAMERA_COOLDOWN = 20;
const DEFAULT_TRACK_COOLDOWN = 30;
const DEFAULT_JUDGE_MIN_CONFIDENCE = 0.7;

function getCameraCooldown(): number {
  const v = process.env.SHOPLIFT_CAMERA_COOLDOWN_SECONDS;
  if (v === undefined || v === "") return DEFAULT_CAMERA_COOLDOWN;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CAMERA_COOLDOWN;
}

function getTrackCooldown(): number {
  const v = process.env.SHOPLIFT_TRACK_COOLDOWN_SECONDS;
  if (v === undefined || v === "") return DEFAULT_TRACK_COOLDOWN;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TRACK_COOLDOWN;
}

function getJudgeMinConfidence(): number {
  const v = process.env.SHOPLIFT_JUDGE_MIN_CONFIDENCE;
  if (v === undefined || v === "") return DEFAULT_JUDGE_MIN_CONFIDENCE;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_JUDGE_MIN_CONFIDENCE;
}

const lastTriggerByCamera = new Map<string, number>();
const lastTriggerByTrack = new Map<string, number>();

export type GateDecision =
  | { allow: true }
  | { allow: false; reason: "below_confidence" | "camera_cooldown" | "track_cooldown" };

export interface GateInput {
  camera_id: string;
  track_id: string;
  judge_confidence_0_1: number;
  now_ms?: number;
}

export function alertGate(input: GateInput): GateDecision {
  const now = input.now_ms ?? Date.now();
  const minConf = getJudgeMinConfidence();
  if (input.judge_confidence_0_1 < minConf) {
    return { allow: false, reason: "below_confidence" };
  }
  const camCooldown = getCameraCooldown() * 1000;
  const trackCooldown = getTrackCooldown() * 1000;
  const lastCam = lastTriggerByCamera.get(input.camera_id);
  if (lastCam != null && now - lastCam < camCooldown) {
    return { allow: false, reason: "camera_cooldown" };
  }
  const lastTrack = lastTriggerByTrack.get(input.track_id);
  if (lastTrack != null && now - lastTrack < trackCooldown) {
    return { allow: false, reason: "track_cooldown" };
  }
  lastTriggerByCamera.set(input.camera_id, now);
  lastTriggerByTrack.set(input.track_id, now);
  return { allow: true };
}

export function resetGate(): void {
  lastTriggerByCamera.clear();
  lastTriggerByTrack.clear();
}

export function getGateConfig(): {
  cameraCooldownSeconds: number;
  trackCooldownSeconds: number;
  judgeMinConfidence: number;
} {
  return {
    cameraCooldownSeconds: getCameraCooldown(),
    trackCooldownSeconds: getTrackCooldown(),
    judgeMinConfidence: getJudgeMinConfidence(),
  };
}
