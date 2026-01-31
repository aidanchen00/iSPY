/**
 * Incident logging — ./alerts/incidents.jsonl (extended schema)
 */

import { appendFile, mkdir } from "fs/promises";
import path from "path";
import type { IncidentLogEntry, JudgeResult } from "./types";

const INCIDENTS_FILE = path.join(process.cwd(), "alerts", "incidents.jsonl");

export async function ensureAlertsDir(): Promise<void> {
  await mkdir(path.dirname(INCIDENTS_FILE), { recursive: true });
}

export async function logIncident(entry: IncidentLogEntry): Promise<void> {
  await ensureAlertsDir();
  const line = JSON.stringify(entry) + "\n";
  await appendFile(INCIDENTS_FILE, line);
}

export async function logConcealmentAlert(params: {
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
}): Promise<void> {
  const entry: IncidentLogEntry = {
    ts: params.ts,
    camera_id: params.camera_id,
    location: params.location,
    track_id: params.track_id,
    suspicion_score: params.suspicion_score,
    frame_paths: params.frame_paths,
    judge_used: params.judge_used,
    judge_result: params.judge_result,
    voice_used: params.voice_used,
    audio_path: params.audio_path,
    status: params.status,
    suppressed_reason: params.suppressed_reason,
  };
  await logIncident(entry);
}
