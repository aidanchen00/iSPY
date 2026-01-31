/**
 * Shoplifting Alert Playback — Non-blocking server-side or URL for dashboard
 *
 * Option A: spawn ffplay (ffmpeg) or afplay (macOS) when available; don't block.
 * Option B: return path so API/dashboard can serve and play in browser.
 * We do Option A when possible, and always write file for Option B.
 */

import { spawn } from "child_process";
import path from "path";

let isPlaying = false;
const playQueue: string[] = [];

function getPlayCommand(): string | null {
  if (process.platform === "darwin") {
    return "afplay";
  }
  return "ffplay";
}

function getPlayArgs(filePath: string): string[] {
  const cmd = getPlayCommand();
  if (cmd === "afplay") {
    return [filePath];
  }
  if (cmd === "ffplay") {
    return ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath];
  }
  return [];
}

/**
 * Play audio file non-blocking. Queues if already playing.
 * Logs start/end. Ignores if path missing or player not found.
 */
export async function playAudioNonBlocking(audioPath: string): Promise<void> {
  if (!audioPath) return;

  const absolutePath = path.isAbsolute(audioPath)
    ? audioPath
    : path.join(process.cwd(), audioPath);

  playQueue.push(absolutePath);
  drainPlayQueue();
}

function drainPlayQueue(): void {
  if (isPlaying || playQueue.length === 0) return;

  const next = playQueue.shift();
  if (!next) return;

  const cmd = getPlayCommand();
  const args = getPlayArgs(next);

  try {
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
    });

    isPlaying = true;
    console.log("[ShopliftPlayback] start:", next);

    child.on("error", (err) => {
      console.warn("[ShopliftPlayback] error:", err.message);
      isPlaying = false;
      drainPlayQueue();
    });

    child.on("close", (code) => {
      console.log("[ShopliftPlayback] end:", next, "code:", code ?? "unknown");
      isPlaying = false;
      drainPlayQueue();
    });

    child.unref();
  } catch (e) {
    console.warn("[ShopliftPlayback] spawn failed:", e instanceof Error ? e.message : e);
    isPlaying = false;
    drainPlayQueue();
  }
}

/**
 * Return public URL path for dashboard to play (relative to app).
 * e.g. /alerts/audio/2025-01-29T12-00-00_cam1.mp3
 */
export function getAudioUrlForDashboard(absolutePath: string): string {
  const cwd = process.cwd();
  if (absolutePath.startsWith(cwd)) {
    const relative = path.relative(cwd, absolutePath).replace(/\\/g, "/");
    return `/${relative}`;
  }
  const base = path.basename(absolutePath);
  return `/alerts/audio/${base}`;
}
