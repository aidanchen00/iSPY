/**
 * Shoplifting Alert API — Ingest ShopliftingEvent and run pipeline
 *
 * POST /api/shoplift-alert — Body: ShopliftingEvent (strict schema).
 * Runs AlertGate → MiniMax TTS → Playback → Log. Returns { triggered, reason?, audioPath? }.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isShopliftingEvent,
  type ShopliftingEvent,
} from "@/lib/shoplift-alerts/types";
import { runShopliftAlertPipeline } from "@/lib/shoplift-alerts/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isShopliftingEvent(body)) {
      return NextResponse.json(
        {
          error: "Invalid event",
          message:
            "Body must be ShopliftingEvent: event_type, camera_id, location, confidence (0-1), timestamp (ISO)",
        },
        { status: 400 }
      );
    }

    const event = body as ShopliftingEvent;
    const result = await runShopliftAlertPipeline(event);

    return NextResponse.json({
      triggered: result.triggered,
      reason: result.reason,
      audioPath: result.audioPath,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (e) {
    console.error("[shoplift-alert] POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "Shoplifting Alert API",
    description: "POST a ShopliftingEvent to run gate → TTS → playback → log",
    schema: {
      event_type: "shoplifting_detected",
      camera_id: "string",
      location: "string",
      confidence: "number (0-1)",
      timestamp: "ISO string",
      evidence: "optional",
    },
  });
}
