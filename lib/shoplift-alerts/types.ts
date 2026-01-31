/**
 * Shoplifting Alert System — Strict Event Schema
 *
 * Single canonical event type for the voice-alert pipeline.
 * All components (AlertGate, TTS, playback, logging) accept only this shape.
 */

export const SHOPLIFTING_EVENT_TYPE = "shoplifting_detected" as const;

export interface ShopliftingEventEvidence {
  /** Path to keyframe image on disk (if saved) */
  keyframe_path?: string;
  /** Small base64 JPEG (minimal; optional) */
  keyframe_base64?: string;
  /** Path to short clip (if saved) */
  clip_path?: string;
}

/**
 * Canonical shoplifting event emitted by the detector (or stub).
 * Used end-to-end: detector → AlertGate → TTS → playback → incident log.
 */
export interface ShopliftingEvent {
  event_type: typeof SHOPLIFTING_EVENT_TYPE;
  camera_id: string;
  location: string;
  confidence: number;
  timestamp: string;
  evidence?: ShopliftingEventEvidence;
}

export function isShopliftingEvent(
  ev: unknown
): ev is ShopliftingEvent {
  if (!ev || typeof ev !== "object") return false;
  const o = ev as Record<string, unknown>;
  return (
    o.event_type === SHOPLIFTING_EVENT_TYPE &&
    typeof o.camera_id === "string" &&
    typeof o.location === "string" &&
    typeof o.confidence === "number" &&
    o.confidence >= 0 &&
    o.confidence <= 1 &&
    typeof o.timestamp === "string"
  );
}

/**
 * Build ShopliftingEvent from grocery TheftEvent (suspicion 0–100 → confidence 0–1).
 */
export function fromTheftEvent(
  theft: {
    id: string;
    cameraId: string;
    zoneId?: string | null;
    suspicionScore: number;
    timestamp: Date;
    description?: string;
    keyframes?: string[];
  },
  locationLabel?: string
): ShopliftingEvent {
  const location = locationLabel ?? theft.zoneId ?? "Unknown area";
  const confidence = Math.min(1, Math.max(0, theft.suspicionScore / 100));
  const evidence: ShopliftingEventEvidence | undefined =
    theft.keyframes?.length && theft.keyframes[0]
      ? { keyframe_base64: theft.keyframes[0] }
      : undefined;

  return {
    event_type: SHOPLIFTING_EVENT_TYPE,
    camera_id: theft.cameraId,
    location,
    confidence,
    timestamp: theft.timestamp.toISOString(),
    evidence,
  };
}

/**
 * Create a stub event for testing (no detector).
 */
export function createStubShopliftingEvent(overrides?: Partial<ShopliftingEvent>): ShopliftingEvent {
  return {
    event_type: SHOPLIFTING_EVENT_TYPE,
    camera_id: overrides?.camera_id ?? "cam-test-1",
    location: overrides?.location ?? "Aisle 6",
    confidence: overrides?.confidence ?? 0.85,
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
    evidence: overrides?.evidence,
  };
}
