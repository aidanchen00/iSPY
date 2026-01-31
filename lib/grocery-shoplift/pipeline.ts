/**
 * Concealment pipeline — suspicion → capture → judge → gate → voice → log
 *
 * Runs without MiniMax: LocalFallbackJudge + LocalVoiceAlert. MiniMax optional via env.
 */

import type { TrackedPerson, ZoneConfig, SuspicionResult, JudgeResult } from "./types";
import { getConcealmentJudge } from "./judge";
import { getVoiceAlert } from "./voice";
import { alertGate } from "./gate";
import { logConcealmentAlert } from "./incident-log";
import { stubFramePaths } from "./capture";

export interface PipelineInput {
  track: TrackedPerson;
  camera_id: string;
  location: string;
  suspicion: SuspicionResult;
  frame_paths: string[]; // from capture or stub
  now_ms?: number;
}

export interface PipelineResult {
  status: "alerted" | "suppressed" | "logged_only" | "fallback_used";
  suppressed_reason?: string;
  judge_used: "local" | "minimax";
  voice_used: "local" | "minimax";
  audio_path?: string;
}

/**
 * Run concealment pipeline: judge → gate → voice → log. Never throws.
 */
export async function runConcealmentPipeline(input: PipelineInput): Promise<PipelineResult> {
  const now = input.now_ms ?? Date.now();
  const judge = getConcealmentJudge();
  const voice = getVoiceAlert();

  let judgeResult: JudgeResult;
  let judgeUsed: "local" | "minimax" = "local";

  try {
    judgeResult = await judge.judge({
      framePaths: input.frame_paths,
      location: input.location,
      cameraId: input.camera_id,
      suspicionScore: input.suspicion.suspicion_score,
      suspicionReasons: input.suspicion.reasons,
      exitWithoutCheckout: input.suspicion.exit_without_checkout,
      torsoRatioSpike: input.suspicion.torso_ratio_spike,
    });
  } catch (e) {
    judgeResult = {
      concealment_likely: false,
      confidence_0_1: 0.2,
      evidence: [],
      risk_of_false_positive: ["judge_error"],
      recommended_action: "log_only",
    };
  }

  const gateDecision = alertGate({
    camera_id: input.camera_id,
    track_id: input.track.track_id,
    judge_confidence_0_1: judgeResult.confidence_0_1,
    now_ms: now,
  });

  const ts = new Date(now).toISOString();

  if (!gateDecision.allow) {
    await logConcealmentAlert({
      ts,
      camera_id: input.camera_id,
      location: input.location,
      track_id: input.track.track_id,
      suspicion_score: input.suspicion.suspicion_score,
      frame_paths: input.frame_paths,
      judge_used: judgeUsed,
      judge_result: judgeResult,
      voice_used: "local",
      status: "suppressed",
      suppressed_reason: gateDecision.reason,
    }).catch((e) => console.error("[ConcealmentPipeline] log error:", e));
    return {
      status: "suppressed",
      suppressed_reason: gateDecision.reason,
      judge_used: judgeUsed,
      voice_used: "local",
    };
  }

  let voiceUsed: "local" | "minimax" = "local";
  let audioPath: string | undefined;

  try {
    const voiceResult = await voice.play(input.location, input.camera_id);
    voiceUsed = voiceResult.voiceUsed;
    audioPath = voiceResult.audioPath;
  } catch (e) {
    console.error("[ConcealmentPipeline] voice error:", e);
  }

  await logConcealmentAlert({
    ts,
    camera_id: input.camera_id,
    location: input.location,
    track_id: input.track.track_id,
    suspicion_score: input.suspicion.suspicion_score,
    frame_paths: input.frame_paths,
    judge_used: judgeUsed,
    judge_result: judgeResult,
    voice_used: voiceUsed,
    audio_path: audioPath,
    status: voiceUsed === "minimax" ? "alerted" : "fallback_used",
  }).catch((e) => console.error("[ConcealmentPipeline] log error:", e));

  return {
    status: voiceUsed === "minimax" ? "alerted" : "fallback_used",
    judge_used: judgeUsed,
    voice_used: voiceUsed,
    audio_path: audioPath,
  };
}

/**
 * Build frame paths for smoke test (no real frames).
 */
export function getStubFramePaths(cameraId: string, trackId: string): string[] {
  return stubFramePaths(cameraId, trackId);
}
