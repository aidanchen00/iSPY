# Quickstart: Shoplifting Voice Alerts

Voice alerts for **possible shoplifting only** (no weapons, fights, or medical). Pipeline: detector → AlertGate → MiniMax TTS → playback → incident log.

---

## Required env vars

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIMAX_API_KEY` | Yes (for real TTS) | — | MiniMax API key. If missing or `DRY_RUN=1`, a local beep is used. |
| `SHOPLIFT_MIN_CONFIDENCE` | No | `0.75` | Min confidence (0–1) to consider an event. Below = suppressed. |
| `SHOPLIFT_COOLDOWN_SECONDS` | No | `20` | Per-camera cooldown; no new alert for same camera within this many seconds. |
| `SHOPLIFT_PERSISTENCE_COUNT` | No | `2` | Require this many triggers in window (set to 1 to disable). |
| `SHOPLIFT_PERSISTENCE_WINDOW_MS` | No | `1000` | Window in ms for persistence. |
| `SHOPLIFT_ALERT_TEMPLATE` | No | See below | Message template. Use `{location}` for place. |
| `DRY_RUN` | No | — | Set to `1` or `true` to skip MiniMax and use local beep only. |

### Optional MiniMax

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIMAX_TTS_URL` | `https://api-uw.minimax.io/v1/t2a_v2` | TTS endpoint (uw = faster time-to-first-audio). |
| `MINIMAX_TTS_MODEL` | `speech-2.8-turbo` | Model name. |
| `MINIMAX_VOICE_ID` | `English_expressive_narrator` | Voice ID. |
| `MINIMAX_AUDIO_FORMAT` | `mp3` | Output format. |

### Message template (do not accuse)

Default: `"Security alert. Possible shoplifting detected at {location}."`

Override with `SHOPLIFT_ALERT_TEMPLATE`, e.g.:

```bash
export SHOPLIFT_ALERT_TEMPLATE="Attention. Security assistance needed at {location}."
```

---

## How to run on RTSP

This repo currently has **no RTSP ingest**. Video input is **browser webcam** only (`app/pages/realtimeStreamPage`). To use “live CCTV”:

1. Add an RTSP bridge (e.g. ffmpeg → frames, run detector on frames).
2. When the detector decides “possible shoplifting,” emit a **ShopliftingEvent** and POST it to `POST /api/shoplift-alert` (see schema below).

The pipeline (gate → TTS → playback → log) is the same for webcam or RTSP.

---

## Unit tests

```bash
npm test
# or only shoplift-alerts:
npm run test:shoplift
```

- **AlertGate:** cooldown and confidence threshold (and persistence when disabled via env).
- **MiniMax TTS:** hex → bytes parsing.

---

## How to run smoke test (no cameras)

1. Start the app:
   ```bash
   npm run dev
   ```

2. Run the smoke script (no MiniMax key = beep fallback):
   ```bash
   python3 scripts/test_shoplift_alert.py
   ```

   Or with dry-run (no API key needed):
   ```bash
   DRY_RUN=1 python3 scripts/test_shoplift_alert.py
   ```

3. Check outputs:
   - **Incident log:** `./alerts/incidents.jsonl` (one JSON per line; `status: "triggered"` or `"suppressed"`).
   - **Audio:** `./alerts/audio/` — mp3 from MiniMax or `*_beep.wav` when using fallback.

4. Cooldown: the script sends two events for the same camera quickly; the second should be suppressed with `reason: "cooldown"` (if `SHOPLIFT_COOLDOWN_SECONDS` > 0).

---

## Where audio and logs go

| Path | Content |
|------|---------|
| `./alerts/audio/` | Generated mp3 (or beep wav). Filename: `<timestamp>_<camera_id>.mp3` or `*_beep.wav`. |
| `./alerts/incidents.jsonl` | One JSON object per line: `event`, `alert_text`, `audio_file_path`, `triggered_at`, `status` (`triggered` or `suppressed`), optional `reason`. |

---

## Changing cooldown / confidence / template

- **Cooldown:** `SHOPLIFT_COOLDOWN_SECONDS=30` (no new alert for same camera for 30 s).
- **Confidence:** `SHOPLIFT_MIN_CONFIDENCE=0.8` (only events with confidence ≥ 0.8 pass the gate).
- **Template:** `SHOPLIFT_ALERT_TEMPLATE="Possible shoplifting at {location}. Please check."`

Restart the app after changing env vars.

---

## Troubleshooting

### ffplay / afplay missing

- **macOS:** `afplay` is built-in; playback uses it by default.
- **Linux:** Install ffmpeg: `apt install ffmpeg` (or equivalent). The playback module uses `ffplay -nodisp -autoexit`.
- If the player is missing, the pipeline still writes the audio file and logs; you can play the file manually or serve it from the dashboard.

### Autoplay (dashboard)

- Browsers block autoplay until the user has interacted. If you add dashboard playback later, use an “Enable Audio Alerts” button that calls `audio.play()` after a click.

### MiniMax 401

- Invalid or missing API key. Set `MINIMAX_API_KEY` correctly. Never commit the key. Use `DRY_RUN=1` to test without the API.

### MiniMax 429

- Rate limited. The client retries up to 2 times with backoff. Increase cooldown to reduce alert frequency.

### No audio file / no triggered line in incidents.jsonl

- Check confidence: event must have `confidence >= SHOPLIFT_MIN_CONFIDENCE`.
- Check cooldown: same camera within `SHOPLIFT_COOLDOWN_SECONDS` is suppressed.
- Check persistence: if `SHOPLIFT_PERSISTENCE_COUNT` > 1, multiple detections in `SHOPLIFT_PERSISTENCE_WINDOW_MS` are required.
- Check server logs for `[ShopliftPipeline]` or `[ShopliftPlayback]` errors.

---

## Event schema (strict)

All components use this shape. POST it to `POST /api/shoplift-alert`:

```json
{
  "event_type": "shoplifting_detected",
  "camera_id": "cam-entrance-1",
  "location": "Aisle 6",
  "confidence": 0.85,
  "timestamp": "2025-01-29T12:00:00.000Z",
  "evidence": {
    "keyframe_path": "/path/to/frame.jpg",
    "keyframe_base64": "...",
    "clip_path": "/path/to/clip.mp4"
  }
}
```

- `event_type` must be `"shoplifting_detected"`.
- `camera_id`, `location`, `confidence` (0–1), `timestamp` (ISO) are required.
- `evidence` is optional; voice alert does not require it, but logging can store it.
