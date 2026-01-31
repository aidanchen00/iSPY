# Quickstart: Grocery Concealment Shoplift (Person-Only)

Detect **possible shoplifting** from **person-only** logic (no item detection). Voice alert defaults to **local beep or OS TTS**; **no MiniMax keys required**. MiniMax TTS/VLM is optional and disabled by default.

---

## Run smoke test (no CCTV, zero API keys)

1. Start the app:
   ```bash
   npm run dev
   ```

2. Run the smoke test:
   ```bash
   python3 scripts/smoke_test_alerts.py
   ```

   This will:
   - POST to `/api/concealment-smoke` (5 stub tracks with exit_without_checkout)
   - POST to `/api/shoplift-alert` (3 ShopliftingEvents)
   - Check `./alerts/incidents.jsonl` and `./alerts/audio/`

3. Verify:
   - `./alerts/incidents.jsonl` has new lines (status: `alerted`, `suppressed`, `fallback_used`)
   - Cooldown: second event for same camera/track should be `suppressed` with `camera_cooldown` or `track_cooldown`
   - `./alerts/audio/` has `.wav` or `.mp3` files (local beep or `say`/`espeak`)

No `MINIMAX_API_KEY` or any other API key is required.

---

## Run live (webcam today; RTSP later)

- **Current:** Live input is **browser webcam** only (`/pages/realtimeStreamPage`). There is no RTSP ingest yet.
- **Person-only pipeline:** When you add a video ingest that produces **person bboxes** (e.g. YOLO or another detector), wire them into:
  1. **IOU tracking** — `lib/grocery-shoplift/tracking.ts` (`updateTracks`)
  2. **Suspicion** — `lib/grocery-shoplift/suspicion.ts` (`computeSuspicion`, `shouldEscalate`) with zone config
  3. **Capture** — `lib/grocery-shoplift/capture.ts` (save person crops to `./alerts/frames/`)
  4. **Judge** — `getConcealmentJudge()` (default: LocalFallbackJudge)
  5. **Gate** — `lib/grocery-shoplift/gate.ts` (`alertGate`)
  6. **Voice** — `getVoiceAlert()` (default: LocalVoiceAlert)
  7. **Log** — `lib/grocery-shoplift/incident-log.ts`

- **RTSP:** To use RTSP cameras, add a bridge (e.g. ffmpeg → frames, run person detector → bboxes) and feed the same pipeline. Config and zones stay the same.

---

## Configure zones

Zones are used for suspicion (exit without checkout, dwell in high-theft). Define polygons (normalized 0–1) for:

- `high_theft` — dwell time > `SHOPLIFT_DWELL_SECONDS` adds +25
- `checkout` — if track never entered checkout in last `SHOPLIFT_CHECKOUT_MEMORY_SECONDS`, exiting counts as exit_without_checkout (+40)
- `exit` — current zone type for “exit” behavior

Example zone config (see `lib/grocery-shoplift/types.ts` and `lib/grocery/zones.ts`):

- `ZoneConfig`: `id`, `name`, `type` (`high_theft` | `checkout` | `exit` | …), `polygon` (array of `{x, y}`), `enabled`

Pass zones into `computeSuspicion` and maintain `zone_history` per track (zone id + type + `entered_ms`).

---

## Env vars (no MiniMax required)

| Variable | Default | Description |
|----------|---------|-------------|
| `SHOPLIFT_ESCALATE_SCORE` | `70` | Escalate to judge when suspicion_score >= this |
| `SHOPLIFT_DWELL_SECONDS` | `12` | Dwell in high_theft zone (sec) to add +25 |
| `SHOPLIFT_CHECKOUT_MEMORY_SECONDS` | `60` | “Has visited checkout” window (sec) for exit_without_checkout |
| `SHOPLIFT_CAMERA_COOLDOWN_SECONDS` | `20` | Per-camera alert cooldown |
| `SHOPLIFT_TRACK_COOLDOWN_SECONDS` | `30` | Per-track alert cooldown |
| `SHOPLIFT_JUDGE_MIN_CONFIDENCE` | `0.7` | Judge confidence >= this to allow alert |
| `SHOPLIFT_ALERT_TEMPLATE` | `"Security alert. Possible shoplifting detected at {location}."` | Voice message (do not accuse) |

Optional (MiniMax, disabled by default):

| Variable | Description |
|----------|-------------|
| `MINIMAX_API_KEY` | Set only if you want MiniMax TTS or VLM |
| `ENABLE_MINIMAX_TTS` | `1` to use MiniMax for voice (otherwise local beep/TTS) |
| `ENABLE_MINIMAX_VLM` | `1` to use MiniMax VLM for concealment judge (otherwise LocalFallbackJudge) |

---

## Enable MiniMax later (optional)

1. Get an API key from MiniMax.
2. In `.env`:
   ```bash
   MINIMAX_API_KEY=your_key_here
   ENABLE_MINIMAX_TTS=1
   # ENABLE_MINIMAX_VLM=1   # optional, for VLM judge
   ```
3. Restart the app. Voice alerts will use MiniMax TTS when enabled; on failure the pipeline falls back to local beep/TTS.

---

## Troubleshooting

### Audio playback (local)

- **macOS:** `say` is used for TTS; beep is a WAV. `afplay` is used for playback (built-in).
- **Linux:** `espeak` is used for TTS if available; otherwise beep. `ffplay` (ffmpeg) is used for playback — install with `apt install ffmpeg` (or equivalent).
- **No sound:** Check that `./alerts/audio/` is created and that `afplay`/`ffplay` runs (check server logs for playback errors).

### incidents.jsonl not created

- Run the smoke test with the dev server running (`npm run dev` then `python3 scripts/smoke_test_alerts.py`).
- Or POST to `POST /api/concealment-smoke` once; it runs the pipeline with stub data and writes to `./alerts/incidents.jsonl`.

### Cooldown / suppressed

- First event for a camera/track triggers; next event for same camera within 20s or same track within 30s is suppressed with `camera_cooldown` or `track_cooldown`. This is intended to avoid spam.

### MiniMax 401 / 429

- **401:** Invalid or missing API key. Leave `ENABLE_MINIMAX_TTS` and `ENABLE_MINIMAX_VLM` unset to use local-only.
- **429:** Rate limit. Pipeline falls back to local judge/voice; no crash.

---

## Where files go

| Path | Content |
|------|---------|
| `./alerts/incidents.jsonl` | One JSON per line: ts, camera_id, location, track_id, suspicion_score, frame_paths, judge_used, judge_result, voice_used, audio_path, status, suppressed_reason |
| `./alerts/audio/` | Generated WAV/MP3 (local beep, `say`/`espeak`, or MiniMax) |
| `./alerts/frames/` | Person crop keyframes when pipeline runs with real frames |

---

## Voice messaging safety

Default alert text is:

**"Security alert. Possible shoplifting detected at {location}."**

Override with `SHOPLIFT_ALERT_TEMPLATE`; always use non-accusatory wording (e.g. “Possible shoplifting” / “Security assistance needed”), never “Robber detected” or similar.
