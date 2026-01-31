import { NextResponse } from "next/server"
import { generateCustomAlertAudio } from "@/lib/shoplift-alerts/minimax-tts"
import { playAudioNonBlocking } from "@/lib/shoplift-alerts/playback"

/**
 * POST /api/theft-voice
 * When theft is detected, say "THEFT detected" using MiniMax voice (or local fallback).
 * Body: { message?: string } — default "THEFT detected"
 */
export async function POST(request: Request) {
  try {
    let message = "THEFT detected"
    try {
      const body = await request.json()
      if (body?.message && typeof body.message === "string") message = body.message.trim() || message
    } catch {
      // use default
    }

    const result = await generateCustomAlertAudio(message, "live-camera")
    if (!result.audioPath) {
      return NextResponse.json({ ok: false, error: result.error ?? "No audio path" }, { status: 500 })
    }

    await playAudioNonBlocking(result.audioPath)

    return NextResponse.json({
      ok: true,
      voiceUsed: result.fallbackUsed ? "local" : "minimax",
      message,
    })
  } catch (e) {
    console.error("[theft-voice]", e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
