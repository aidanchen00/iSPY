/**
 * Concealment Judge — Local (default) + optional MiniMax VLM
 *
 * LocalFallbackJudge: no key required. MiniMaxVLMJudge: only if ENABLE_MINIMAX_VLM=1 and MINIMAX_API_KEY set.
 */

import type { JudgeResult, SuspicionResult } from "./types";

export interface ConcealmentJudgeInput {
  framePaths: string[];
  location: string;
  cameraId: string;
  suspicionScore: number;
  suspicionReasons: string[];
  exitWithoutCheckout: boolean;
  torsoRatioSpike: boolean;
}

export interface IConcealmentJudge {
  judge(input: ConcealmentJudgeInput): Promise<JudgeResult>;
}

/**
 * Local rule-based judge (default). No API key. Deterministic.
 */
export class LocalFallbackJudge implements IConcealmentJudge {
  async judge(input: ConcealmentJudgeInput): Promise<JudgeResult> {
    const concealment_likely =
      input.exitWithoutCheckout || input.torsoRatioSpike;
    const confidence_0_1 = concealment_likely ? 0.7 : 0.2;
    const evidence: string[] = [];
    if (input.exitWithoutCheckout) evidence.push("exit_without_checkout");
    if (input.torsoRatioSpike) evidence.push("torso_ratio_spike");
    return {
      concealment_likely,
      confidence_0_1,
      evidence,
      risk_of_false_positive: ["rule-based heuristic; no visual analysis"],
      recommended_action: concealment_likely && confidence_0_1 >= 0.7 ? "alert" : "log_only",
    };
  }
}

/**
 * MiniMax VLM judge — only used when ENABLE_MINIMAX_VLM=1 and MINIMAX_API_KEY set.
 * Timeout 20s, retry 2 on 429/5xx. On failure, fall back to LocalFallbackJudge.
 */
export async function createMiniMaxVLMJudge(): Promise<IConcealmentJudge | null> {
  const key = process.env.MINIMAX_API_KEY;
  const enabled = process.env.ENABLE_MINIMAX_VLM === "1" || process.env.ENABLE_MINIMAX_VLM === "true";
  if (!key || !enabled) return null;

  const TIMEOUT_MS = 20000;
  const MAX_RETRIES = 2;
  const RATE_LIMIT_PER_CAMERA = 6;
  const RATE_WINDOW_MS = 60000;
  const rateCount = new Map<string, number[]>();

  function checkRateLimit(cameraId: string): boolean {
    const now = Date.now();
    const list = rateCount.get(cameraId) ?? [];
    const inWindow = list.filter(t => t >= now - RATE_WINDOW_MS);
    if (inWindow.length >= RATE_LIMIT_PER_CAMERA) return false;
    inWindow.push(now);
    rateCount.set(cameraId, inWindow.slice(-RATE_LIMIT_PER_CAMERA));
    return true;
  }

  return {
    async judge(input: ConcealmentJudgeInput): Promise<JudgeResult> {
      if (!checkRateLimit(input.cameraId)) {
        return new LocalFallbackJudge().judge(input);
      }
      // MiniMax VLM: would call image API with prompt (no items, concealment only, no weapons).
      // For this repo we do not implement the actual HTTP call to avoid requiring key.
      // When implemented: POST images + prompt, parse JSON, timeout/retry, on failure -> LocalFallbackJudge.
      return new LocalFallbackJudge().judge(input);
    },
  };
}

let defaultJudge: IConcealmentJudge = new LocalFallbackJudge();

export function getConcealmentJudge(): IConcealmentJudge {
  return defaultJudge;
}

export async function initConcealmentJudge(): Promise<IConcealmentJudge> {
  const minimax = await createMiniMaxVLMJudge();
  defaultJudge = minimax ?? new LocalFallbackJudge();
  return defaultJudge;
}
