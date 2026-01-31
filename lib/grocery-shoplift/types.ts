/**
 * Grocery Shoplift (Person-Only) — Types
 *
 * Bbox: pixel or normalized. Point: normalized 0-1.
 */

export interface Bbox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Point {
  x: number;
  y: number;
}

export type ZoneType = "high_theft" | "checkout" | "exit" | "entrance" | "general" | "staff_only";

export interface ZoneConfig {
  id: string;
  name: string;
  type: ZoneType;
  polygon: Point[];
  enabled?: boolean;
}

/** One person detection in a frame */
export interface PersonDetection {
  bbox: Bbox;
  confidence: number;
}

/** Tracked person across frames (IOU tracking) */
export interface TrackedPerson {
  track_id: string;
  bbox: Bbox;
  confidence: number;
  bbox_history: Bbox[];
  last_seen: number; // ms
  first_seen: number;
}

/** Per-frame input for suspicion */
export interface SuspicionInput {
  track: TrackedPerson;
  camera_id: string;
  location_label: string;
  zones: ZoneConfig[];
  now_ms: number;
  /** Zone IDs this track has been in (with timestamps) for checkout memory */
  zone_history: { zone_id: string; zone_type: ZoneType; entered_ms: number }[];
}

/** Output of suspicion module: 0..100 */
export interface SuspicionResult {
  suspicion_score: number;
  reasons: string[];
  exit_without_checkout: boolean;
  dwell_high_theft_sec: number;
  torso_ratio_spike: boolean;
}

/** Judge result (local or MiniMax) */
export interface JudgeResult {
  concealment_likely: boolean;
  confidence_0_1: number;
  evidence: string[];
  risk_of_false_positive: string[];
  recommended_action: "alert" | "log_only";
}

/** Incident log line (extended) */
export interface IncidentLogEntry {
  ts: string;
  camera_id: string;
  location: string;
  track_id: string;
  suspicion_score: number;
  frame_paths: string[];
  judge_used: "local" | "minimax";
  judge_result: JudgeResult;
  voice_used: "local" | "minimax";
  audio_path?: string;
  status: "alerted" | "suppressed" | "logged_only" | "fallback_used";
  suppressed_reason?: string;
}
