/**
 * Shoplifting Incident Log — Append to ./alerts/incidents.jsonl
 *
 * Each line: JSON with event, alert_text, audio_file_path, status, etc.
 * Suppressed events logged with status="suppressed" and reason.
 */

import { appendFile, mkdir } from "fs/promises";
import path from "path";
import type { ShopliftingEvent } from "./types";

const INCIDENTS_FILE = path.join(process.cwd(), "alerts", "incidents.jsonl");

export interface IncidentLogEntry {
  event: ShopliftingEvent;
  alert_text?: string;
  audio_file_path?: string;
  minimax_request_id?: string;
  triggered_at: string;
  status: "triggered" | "suppressed";
  reason?: string;
}

export async function ensureAlertsDir(): Promise<void> {
  await mkdir(path.dirname(INCIDENTS_FILE), { recursive: true });
}

export async function logIncident(entry: IncidentLogEntry): Promise<void> {
  await ensureAlertsDir();
  const line = JSON.stringify(entry) + "\n";
  await appendFile(INCIDENTS_FILE, line);
}

export async function logTriggered(
  event: ShopliftingEvent,
  alertText: string,
  audioFilePath: string | undefined,
  traceId: string | undefined
): Promise<void> {
  await logIncident({
    event,
    alert_text: alertText,
    audio_file_path: audioFilePath,
    minimax_request_id: traceId,
    triggered_at: new Date().toISOString(),
    status: "triggered",
  });
}

export async function logSuppressed(
  event: ShopliftingEvent,
  reason: string
): Promise<void> {
  await logIncident({
    event,
    triggered_at: new Date().toISOString(),
    status: "suppressed",
    reason,
  });
}
