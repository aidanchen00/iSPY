/**
 * Shoplifting Alert Gate — Debounce + Confidence + Optional Persistence
 *
 * Prevents spam: confidence threshold, per-camera cooldown, optional
 * persistence (N triggers in window or "confirmed"). All thresholds from env.
 */

import type { ShopliftingEvent } from "./types";

const DEFAULT_MIN_CONFIDENCE = 0.75;
const DEFAULT_COOLDOWN_SECONDS = 20;
const DEFAULT_PERSISTENCE_COUNT = 2;
const DEFAULT_PERSISTENCE_WINDOW_MS = 1000;

function getMinConfidence(): number {
  const v = process.env.SHOPLIFT_MIN_CONFIDENCE;
  if (v === undefined || v === "") return DEFAULT_MIN_CONFIDENCE;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_MIN_CONFIDENCE;
}

function getCooldownSeconds(): number {
  const v = process.env.SHOPLIFT_COOLDOWN_SECONDS;
  if (v === undefined || v === "") return DEFAULT_COOLDOWN_SECONDS;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COOLDOWN_SECONDS;
}

function getPersistenceCount(): number {
  const v = process.env.SHOPLIFT_PERSISTENCE_COUNT;
  if (v === undefined || v === "") return DEFAULT_PERSISTENCE_COUNT;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_PERSISTENCE_COUNT;
}

function getPersistenceWindowMs(): number {
  const v = process.env.SHOPLIFT_PERSISTENCE_WINDOW_MS;
  if (v === undefined || v === "") return DEFAULT_PERSISTENCE_WINDOW_MS;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PERSISTENCE_WINDOW_MS;
}

/** Last time (ms) we triggered an alert per camera_id */
const lastTriggerByCamera = new Map<string, number>();

/** Recent events per camera for persistence check: list of timestamps (ms) */
const recentEventsByCamera = new Map<string, number[]>();

export type GateResult =
  | { allowed: true; event: ShopliftingEvent }
  | { allowed: false; reason: "below_threshold" | "cooldown" | "persistence_not_met"; event: ShopliftingEvent };

/**
 * Check whether this event should trigger an alert. Updates internal state.
 * Call this once per incoming ShopliftingEvent; if allowed, proceed to TTS + playback + log.
 */
export function alertGate(event: ShopliftingEvent): GateResult {
  const minConf = getMinConfidence();
  if (event.confidence < minConf) {
    return { allowed: false, reason: "below_threshold", event };
  }

  const cooldownSec = getCooldownSeconds();
  const nowMs = Date.now();
  const last = lastTriggerByCamera.get(event.camera_id);
  if (last !== undefined && nowMs - last < cooldownSec * 1000) {
    return { allowed: false, reason: "cooldown", event };
  }

  const persistenceCount = getPersistenceCount();
  const persistenceWindowMs = getPersistenceWindowMs();

  if (persistenceCount > 1 && persistenceWindowMs > 0) {
    const recent = recentEventsByCamera.get(event.camera_id) ?? [];
    const windowStart = nowMs - persistenceWindowMs;
    const inWindow = recent.filter((t) => t >= windowStart);
    inWindow.push(nowMs);
    recentEventsByCamera.set(event.camera_id, inWindow.slice(-10));

    if (inWindow.length < persistenceCount) {
      return { allowed: false, reason: "persistence_not_met", event };
    }
  }

  lastTriggerByCamera.set(event.camera_id, nowMs);
  return { allowed: true, event };
}

/**
 * For tests: reset gate state (cooldowns and persistence buffers).
 */
export function resetAlertGate(): void {
  lastTriggerByCamera.clear();
  recentEventsByCamera.clear();
}

/**
 * Get current config (for logging/docs). Never logs API keys.
 */
export function getAlertGateConfig(): {
  minConfidence: number;
  cooldownSeconds: number;
  persistenceCount: number;
  persistenceWindowMs: number;
} {
  return {
    minConfidence: getMinConfidence(),
    cooldownSeconds: getCooldownSeconds(),
    persistenceCount: getPersistenceCount(),
    persistenceWindowMs: getPersistenceWindowMs(),
  };
}
