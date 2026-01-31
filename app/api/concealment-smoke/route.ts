/**
 * Smoke test endpoint — run concealment pipeline with stub data (no CCTV).
 * POST /api/concealment-smoke — simulates 5 exit_without_checkout tracks, runs pipeline.
 * Uses LocalVoiceAlert + LocalFallbackJudge; no MiniMax keys required.
 */

import { NextResponse } from "next/server";
import { runConcealmentPipeline, getStubFramePaths } from "@/lib/grocery-shoplift/pipeline";
import type { TrackedPerson, SuspicionResult } from "@/lib/grocery-shoplift/types";

function stubTrack(id: string, now: number): TrackedPerson {
  return {
    track_id: id,
    bbox: { x1: 100, y1: 100, x2: 200, y2: 400 },
    confidence: 0.9,
    bbox_history: [
      { x1: 100, y1: 100, x2: 200, y2: 400 },
      { x1: 105, y1: 98, x2: 205, y2: 398 },
      { x1: 110, y1: 96, x2: 210, y2: 396 },
    ],
    last_seen: now,
    first_seen: now - 5000,
  };
}

function stubSuspicion(exitWithoutCheckout: boolean, torsoSpike: boolean): SuspicionResult {
  let score = 0;
  const reasons: string[] = [];
  if (exitWithoutCheckout) {
    score += 40;
    reasons.push("exit_without_checkout");
  }
  if (torsoSpike) {
    score += 20;
    reasons.push("torso_ratio_spike");
  }
  return {
    suspicion_score: Math.min(100, score || 40),
    reasons,
    exit_without_checkout: exitWithoutCheckout,
    dwell_high_theft_sec: 0,
    torso_ratio_spike: torsoSpike,
  };
}

export async function POST() {
  const results: Array<{ track_id: string; status: string; suppressed_reason?: string }> = [];
  const now = Date.now();

  const runs = [
    { trackId: "t1", cameraId: "cam1", location: "Aisle 6", exitWithoutCheckout: true, torsoSpike: false },
    { trackId: "t1", cameraId: "cam1", location: "Aisle 6", exitWithoutCheckout: true, torsoSpike: false },
    { trackId: "t2", cameraId: "cam1", location: "Exit", exitWithoutCheckout: true, torsoSpike: true },
    { trackId: "t3", cameraId: "cam2", location: "Checkout 2", exitWithoutCheckout: true, torsoSpike: false },
    { trackId: "t4", cameraId: "cam2", location: "Aisle 3", exitWithoutCheckout: false, torsoSpike: true },
  ];

  for (const r of runs) {
    const track = stubTrack(r.trackId, now);
    const suspicion = stubSuspicion(r.exitWithoutCheckout, r.torsoSpike);
    const frame_paths = getStubFramePaths(r.cameraId, r.trackId);

    const result = await runConcealmentPipeline({
      track,
      camera_id: r.cameraId,
      location: r.location,
      suspicion,
      frame_paths,
      now_ms: now,
    });

    results.push({
      track_id: r.trackId,
      status: result.status,
      suppressed_reason: result.suppressed_reason,
    });
  }

  return NextResponse.json({
    message: "Smoke test completed (local judge + local voice, no MiniMax)",
    results,
  });
}

export async function GET() {
  return NextResponse.json({
    description: "POST to run concealment pipeline with 5 stub tracks (exit_without_checkout). No API keys required.",
  });
}
