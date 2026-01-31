/**
 * MiniMax TTS Client — Voice alerts (no accusations)
 *
 * Env: MINIMAX_API_KEY, MINIMAX_TTS_URL, MINIMAX_TTS_MODEL, MINIMAX_VOICE_ID,
 *      MINIMAX_AUDIO_FORMAT, SHOPLIFT_ALERT_TEMPLATE, DRY_RUN.
 * Never logs API key. On failure or dry-run: fallback to local beep.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";

const DEFAULT_TTS_URL = "https://api-uw.minimax.io/v1/t2a_v2";
const DEFAULT_MODEL = "speech-2.8-turbo";
const DEFAULT_VOICE_ID = "English_expressive_narrator";
const DEFAULT_AUDIO_FORMAT = "mp3";
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

const TEMPLATES = [
  "Security alert. Possible shoplifting detected at {location}.",
  "Attention. Security assistance needed at {location}.",
];

function getApiKey(): string | undefined {
  return process.env.MINIMAX_API_KEY;
}

function getTtsUrl(): string {
  const v = process.env.MINIMAX_TTS_URL;
  return v && v.length > 0 ? v : DEFAULT_TTS_URL;
}

function getModel(): string {
  const v = process.env.MINIMAX_TTS_MODEL;
  return v && v.length > 0 ? v : DEFAULT_MODEL;
}

function getVoiceId(): string {
  const v = process.env.MINIMAX_VOICE_ID;
  return v && v.length > 0 ? v : DEFAULT_VOICE_ID;
}

function getAudioFormat(): string {
  const v = process.env.MINIMAX_AUDIO_FORMAT;
  return v && v.length > 0 ? v : DEFAULT_AUDIO_FORMAT;
}

function getAlertText(location: string): string {
  const template = process.env.SHOPLIFT_ALERT_TEMPLATE;
  if (template && template.length > 0) {
    return template.replace(/\{location\}/g, location);
  }
  return TEMPLATES[0].replace("{location}", location);
}

function isDryRun(): boolean {
  return process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
}

export interface TTSResult {
  success: boolean;
  audioPath?: string;
  fallbackUsed: boolean;
  traceId?: string;
  error?: string;
}

/**
 * Hex string -> Buffer (for MiniMax hex audio response).
 */
export function hexToBytes(hex: string): Buffer {
  const clean = hex.replace(/\s/g, "");
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex length");
  }
  const buf = Buffer.alloc(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    buf[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return buf;
}

/**
 * Generate alert text for TTS (do not accuse).
 */
export function buildAlertText(location: string): string {
  return getAlertText(location);
}

/**
 * Generate TTS for custom text (e.g. "THEFT detected"). Same as generateAlertAudio but uses customText.
 */
export async function generateCustomAlertAudio(
  customText: string,
  cameraId: string
): Promise<TTSResult> {
  const text = customText.trim() || "THEFT detected";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeCamera = cameraId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 32);
  const format = getAudioFormat().toLowerCase() === "mp3" ? "mp3" : "mp3";
  const fileName = `${ts}_theft_${safeCamera}.${format}`;
  const alertsDir = path.join(process.cwd(), "alerts", "audio");
  const audioPath = path.join(alertsDir, fileName);

  const apiKey = getApiKey();
  if (!apiKey || isDryRun()) {
    const fallbackPath = await writeFallbackBeep(alertsDir, ts, `theft_${safeCamera}`);
    return {
      success: true,
      audioPath: fallbackPath,
      fallbackUsed: true,
      error: !apiKey ? "MINIMAX_API_KEY not set" : "DRY_RUN=1",
    };
  }

  try {
    await mkdir(alertsDir, { recursive: true });
  } catch (e) {
    return {
      success: false,
      fallbackUsed: false,
      error: `Failed to create alerts dir: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let lastError: string | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const res = await fetch(getTtsUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getModel(),
          text,
          stream: false,
          output_format: "hex",
          voice_setting: {
            voice_id: getVoiceId(),
            speed: 1,
            vol: 1,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));
      const traceId = data.trace_id;

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          continue;
        }
        return {
          success: false,
          fallbackUsed: false,
          traceId,
          error: lastError,
        };
      }

      const audioHex = data?.data?.audio;
      if (!audioHex || typeof audioHex !== "string") {
        lastError = "Missing data.audio in response";
        continue;
      }

      const buf = hexToBytes(audioHex);
      await writeFile(audioPath, buf);

      return {
        success: true,
        audioPath,
        fallbackUsed: false,
        traceId,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      const isRetryable =
        lastError.includes("429") ||
        lastError.includes("5") ||
        lastError.includes("timeout") ||
        lastError.includes("ETIMEDOUT");
      if (!isRetryable || attempt === MAX_RETRIES) {
        break;
      }
    }
  }

  try {
    const fallbackPath = await writeFallbackBeep(alertsDir, ts, `theft_${safeCamera}`);
    return {
      success: true,
      audioPath: fallbackPath,
      fallbackUsed: true,
      error: lastError,
    };
  } catch {
    return {
      success: false,
      fallbackUsed: false,
      error: lastError ?? "TTS failed",
    };
  }
}

/**
 * Call MiniMax TTS; save mp3 to ./alerts/audio/<timestamp>_<camera>.mp3.
 * On missing key or DRY_RUN: write a minimal "beep" wav/mp3 to same path and return it.
 */
export async function generateAlertAudio(
  location: string,
  cameraId: string
): Promise<TTSResult> {
  const text = buildAlertText(location);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeCamera = cameraId.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 32);
  const format = getAudioFormat().toLowerCase() === "mp3" ? "mp3" : "mp3";
  const fileName = `${ts}_${safeCamera}.${format}`;
  const alertsDir = path.join(process.cwd(), "alerts", "audio");
  const audioPath = path.join(alertsDir, fileName);

  const apiKey = getApiKey();
  if (!apiKey || isDryRun()) {
    const fallbackPath = await writeFallbackBeep(alertsDir, ts, safeCamera);
    return {
      success: true,
      audioPath: fallbackPath,
      fallbackUsed: true,
      error: !apiKey ? "MINIMAX_API_KEY not set" : "DRY_RUN=1",
    };
  }

  try {
    await mkdir(alertsDir, { recursive: true });
  } catch (e) {
    return {
      success: false,
      fallbackUsed: false,
      error: `Failed to create alerts dir: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let lastError: string | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const res = await fetch(getTtsUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getModel(),
          text,
          stream: false,
          output_format: "hex",
          voice_setting: {
            voice_id: getVoiceId(),
            speed: 1,
            vol: 1,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const data = await res.json().catch(() => ({}));
      const traceId = data.trace_id;

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          continue;
        }
        return {
          success: false,
          fallbackUsed: false,
          traceId,
          error: lastError,
        };
      }

      const audioHex = data?.data?.audio;
      if (!audioHex || typeof audioHex !== "string") {
        lastError = "Missing data.audio in response";
        continue;
      }

      const buf = hexToBytes(audioHex);
      await writeFile(audioPath, buf);

      return {
        success: true,
        audioPath,
        fallbackUsed: false,
        traceId,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      const isRetryable =
        lastError.includes("429") ||
        lastError.includes("5") ||
        lastError.includes("timeout") ||
        lastError.includes("ETIMEDOUT");
      if (!isRetryable || attempt === MAX_RETRIES) {
        break;
      }
    }
  }

  try {
    const fallbackPath = await writeFallbackBeep(alertsDir, ts, safeCamera);
    return {
      success: true,
      audioPath: fallbackPath,
      fallbackUsed: true,
      error: lastError,
    };
  } catch {
    return {
      success: false,
      fallbackUsed: false,
      error: lastError ?? "TTS failed",
    };
  }
}

/**
 * Write a minimal WAV "beep" so playback still works when MiniMax is unavailable.
 * Returns path to the written file.
 */
async function writeFallbackBeep(
  alertsDir: string,
  ts: string,
  safeCamera: string
): Promise<string> {
  await mkdir(alertsDir, { recursive: true });
  const wavPath = path.join(alertsDir, `${ts}_${safeCamera}_beep.wav`);
  const sampleRate = 8000;
  const durationSec = 0.3;
  const freq = 880;
  const numSamples = sampleRate * durationSec;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  let offset = 0;

  const write = (str: string) => {
    buffer.write(str, offset);
    offset += str.length;
  };
  const writeU32 = (n: number) => {
    buffer.writeUInt32LE(n, offset);
    offset += 4;
  };
  const writeU16 = (n: number) => {
    buffer.writeUInt16LE(n, offset);
    offset += 2;
  };

  write("RIFF");
  writeU32(36 + numSamples * 2);
  write("WAVE");
  write("fmt ");
  writeU32(16);
  writeU16(1);
  writeU16(1);
  writeU32(sampleRate);
  writeU32(sampleRate * 2);
  writeU16(2);
  writeU16(16);
  write("data");
  writeU32(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.floor(
      32767 * 0.3 * Math.sin(2 * Math.PI * freq * t)
    );
    buffer.writeInt16LE(sample, offset);
    offset += 2;
  }

  await writeFile(wavPath, buffer);
  return wavPath;
}
