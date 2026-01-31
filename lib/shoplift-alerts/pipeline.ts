/**
 * Shoplifting Alert Pipeline — Gate → Voice → Playback → Log
 *
 * Voice: LOCAL by default (beep or OS TTS). MiniMax only when ENABLE_MINIMAX_TTS=1 and MINIMAX_API_KEY set.
 * No unhandled exceptions; safe defaults.
 */

import type { ShopliftingEvent } from "./types";
import { alertGate } from "./alert-gate";
import { buildAlertText } from "./minimax-tts";
import { logTriggered, logSuppressed } from "./incident-log";

export interface PipelineResult {
  triggered: boolean;
  reason?: string;
  audioPath?: string;
  fallbackUsed?: boolean;
}

function useMiniMaxTTS(): boolean {
  const key = process.env.MINIMAX_API_KEY;
  const enabled = process.env.ENABLE_MINIMAX_TTS === "1" || process.env.ENABLE_MINIMAX_TTS === "true";
  return !!(key && enabled);
}

/**
 * Process one ShopliftingEvent: gate → voice (local or MiniMax) → playback → log.
 * Default: local voice (beep or say/espeak). MiniMax only when explicitly enabled.
 */
export async function runShopliftAlertPipeline(
  event: ShopliftingEvent
): Promise<PipelineResult> {
  try {
    const gateResult = alertGate(event);

    if (!gateResult.allowed) {
      await logSuppressed(event, gateResult.reason).catch((e) =>
        console.error("[ShopliftPipeline] logSuppressed error:", e)
      );
      return {
        triggered: false,
        reason: gateResult.reason,
      };
    }

    const alertText = buildAlertText(event.location);
    let audioPath: string | undefined;
    let fallbackUsed = true;

    if (useMiniMaxTTS()) {
      try {
        const { generateAlertAudio } = await import("./minimax-tts");
        const ttsResult = await generateAlertAudio(event.location, event.camera_id);
        if (ttsResult.audioPath) {
          audioPath = ttsResult.audioPath;
          fallbackUsed = ttsResult.fallbackUsed ?? false;
        }
      } catch (_e) {
        // fall through to local
      }
    }

    if (!audioPath) {
      const { getVoiceAlert } = await import("@/lib/grocery-shoplift/voice");
      const voice = getVoiceAlert();
      const result = await voice.play(event.location, event.camera_id);
      audioPath = result.audioPath;
      fallbackUsed = result.voiceUsed === "local";
    }

    if (!audioPath) {
      await logSuppressed(event, "voice_failed").catch((e) =>
        console.error("[ShopliftPipeline] logSuppressed error:", e)
      );
      return {
        triggered: false,
        reason: "voice_failed",
      };
    }

    await logTriggered(
      event,
      alertText,
      audioPath,
      undefined
    ).catch((e) => console.error("[ShopliftPipeline] logTriggered error:", e));

    const { playAudioNonBlocking } = await import("./playback");
    playAudioNonBlocking(audioPath).catch((e) =>
      console.error("[ShopliftPipeline] playback error:", e)
    );

    return {
      triggered: true,
      audioPath,
      fallbackUsed,
    };
  } catch (e) {
    console.error("[ShopliftPipeline] unexpected error:", e);
    await logSuppressed(
      event,
      e instanceof Error ? e.message : "pipeline_error"
    ).catch(() => {});
    return {
      triggered: false,
      reason: "pipeline_error",
    };
  }
}
