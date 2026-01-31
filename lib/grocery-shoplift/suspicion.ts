/**
 * Suspicion triggers — zone logic + silhouette proxy (person-only)
 *
 * Env: SHOPLIFT_ESCALATE_SCORE (70), SHOPLIFT_DWELL_SECONDS (12), SHOPLIFT_CHECKOUT_MEMORY_SECONDS (60).
 */

import type { Bbox, Point, ZoneConfig, ZoneType, SuspicionInput, SuspicionResult } from "./types";
import { bboxCenter, bboxTorsoRatio } from "./tracking";

const DEFAULT_ESCALATE_SCORE = 70;
const DEFAULT_DWELL_SECONDS = 12;
const DEFAULT_CHECKOUT_MEMORY_SECONDS = 60;
const EXIT_WITHOUT_CHECKOUT_BONUS = 40;
const DWELL_HIGH_THEFT_BONUS = 25;
const TORSO_RATIO_SPIKE_BONUS = 20;
const TORSO_RATIO_WINDOW = 5; // last N bboxes
const TORSO_SPIKE_RATIO = 0.25; // change in w/h ratio to count as spike

function getEscalateScore(): number {
  const v = process.env.SHOPLIFT_ESCALATE_SCORE;
  if (v === undefined || v === "") return DEFAULT_ESCALATE_SCORE;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_ESCALATE_SCORE;
}

function getDwellSeconds(): number {
  const v = process.env.SHOPLIFT_DWELL_SECONDS;
  if (v === undefined || v === "") return DEFAULT_DWELL_SECONDS;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DWELL_SECONDS;
}

function getCheckoutMemorySeconds(): number {
  const v = process.env.SHOPLIFT_CHECKOUT_MEMORY_SECONDS;
  if (v === undefined || v === "") return DEFAULT_CHECKOUT_MEMORY_SECONDS;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CHECKOUT_MEMORY_SECONDS;
}

function isPointInPolygon(p: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function whichZone(point: Point, zones: ZoneConfig[]): ZoneConfig | null {
  for (const z of zones) {
    if (z.enabled === false) continue;
    if (isPointInPolygon(point, z.polygon)) return z;
  }
  return null;
}

/**
 * Compute suspicion score 0..100 from zone logic + torso ratio proxy.
 */
export function computeSuspicion(input: SuspicionInput, frameWidth?: number, frameHeight?: number): SuspicionResult {
  const reasons: string[] = [];
  let score = 0;
  const dwellSec = getDwellSeconds();
  const checkoutMemorySec = getCheckoutMemorySeconds();
  const now = input.now_ms;
  const center = bboxCenter(input.track.bbox, frameWidth, frameHeight);

  const currentZone = whichZone(center, input.zones);
  const exitZone = input.zones.find(z => z.type === "exit" && z.enabled !== false);
  const checkoutZones = input.zones.filter(z => z.type === "checkout" && z.enabled !== false);
  const highTheftZones = input.zones.filter(z => z.type === "high_theft" && z.enabled !== false);

  let exit_without_checkout = false;
  if (exitZone && currentZone?.id === exitZone.id) {
    const cutoff = now - checkoutMemorySec * 1000;
    const enteredCheckout = input.zone_history.some(
      h => h.zone_type === "checkout" && h.entered_ms >= cutoff
    );
    if (!enteredCheckout) {
      score += EXIT_WITHOUT_CHECKOUT_BONUS;
      reasons.push("exit_without_checkout");
      exit_without_checkout = true;
    }
  }

  let dwell_high_theft_sec = 0;
  for (const h of input.zone_history) {
    if (h.zone_type !== "high_theft") continue;
    const zone = highTheftZones.find(z => z.id === h.zone_id);
    if (!zone) continue;
    dwell_high_theft_sec += (now - h.entered_ms) / 1000;
  }
  if (dwell_high_theft_sec >= dwellSec) {
    score += DWELL_HIGH_THEFT_BONUS;
    reasons.push(`dwell_high_theft_${dwell_high_theft_sec.toFixed(0)}s`);
  }

  let torso_ratio_spike = false;
  const history = input.track.bbox_history;
  if (history.length >= TORSO_RATIO_WINDOW) {
    const recent = history.slice(-TORSO_RATIO_WINDOW);
    const ratios = recent.map(bboxTorsoRatio);
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const last = ratios[ratios.length - 1];
    if (Math.abs(last - mean) >= TORSO_SPIKE_RATIO) {
      score += TORSO_RATIO_SPIKE_BONUS;
      reasons.push("torso_ratio_spike");
      torso_ratio_spike = true;
    }
  }

  const suspicion_score = Math.min(100, score);

  return {
    suspicion_score,
    reasons,
    exit_without_checkout,
    dwell_high_theft_sec: Math.round(dwell_high_theft_sec * 10) / 10,
    torso_ratio_spike,
  };
}

/**
 * Whether to escalate to concealment judge (suspicion_score >= SHOPLIFT_ESCALATE_SCORE).
 */
export function shouldEscalate(result: SuspicionResult): boolean {
  return result.suspicion_score >= getEscalateScore();
}

export function getSuspicionConfig(): { escalateScore: number; dwellSeconds: number; checkoutMemorySeconds: number } {
  return {
    escalateScore: getEscalateScore(),
    dwellSeconds: getDwellSeconds(),
    checkoutMemorySeconds: getCheckoutMemorySeconds(),
  };
}
