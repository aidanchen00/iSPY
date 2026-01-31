# Repo Map — Shoplifting Alert System

## Phase 0 — Repo Discovery Summary

### 1. Video Ingest

| Location | Technology | Notes |
|----------|------------|--------|
| **app/pages/realtimeStreamPage/page.tsx** | `navigator.mediaDevices.getUserMedia()` | Live webcam only. No RTSP, no WebRTC URL ingest, no ffmpeg/gstreamer in app. |
| **scripts/generate_bounding_boxes.py** | `cv2.VideoCapture(video_path)` | Offline only; processes local MP4 files. Not used at runtime. |
| **lib/grocery/types.ts** | `streamUrl?: string` | Placeholder for future RTSP; not implemented. |

**Conclusion:** There is **no RTSP or live CCTV stream ingest** in the repo. Video input is **browser webcam only**. For “live CCTV,” we must add minimal RTSP support later or document that current scope is webcam; the **shoplift alert pipeline** will consume a **canonical event** `{ camera_id, location, confidence, ts }` so it works with any future ingest (RTSP bridge can emit the same event shape).

---

### 2. Inference / Detection

| Location | Model / Logic | Output |
|----------|----------------|--------|
| **app/pages/realtimeStreamPage/actions.ts** | OpenAI GPT-4o | `VideoEvent[]` with `timestamp`, `description`, `isDangerous`. Prompt includes medical, falls, violence, **weapons**, shoplifting, vandalism. |
| **app/api/grocery/detect/route.ts** | OpenAI GPT-4o | `TheftEvent[]` with `behaviorType`, `suspicionScore` (0–100), `zoneId`, etc. Retail-only (no weapons/medical). |
| **lib/grocery/detection.ts** | Same as above (server action) | Same `TheftEvent[]`. |

**Conclusion:**  
- **Existing “incident” types:** `VideoEvent` (generic dangerous/not) and `TheftEvent` (grocery behaviors: concealment, grab_and_run, checkout_bypass, etc.).  
- There is **no** single `event_type: "shoplifting_detected"` yet. We will introduce a **strict canonical event** `ShopliftingEvent` with `event_type: "shoplifting_detected"` and have the pipeline consume only that.  
- **We do not add or use** gun/weapon/dangerous-person logic; we only add/use the **shoplifting path**.

---

### 3. Event Emission

| Location | Mechanism | Notes |
|----------|------------|--------|
| **app/pages/realtimeStreamPage/page.tsx** | In-process callbacks | On each `detectEvents()` result, for each `event.isDangerous` it calls `fetch("/api/send-email")` and `triggerSecurityCall()`. No queue, no WebSocket, no shared event bus. |
| **app/api/grocery/detect/route.ts** | HTTP response | Returns JSON; no server-side emission to alerts. |
| **lib/grocery/alerts.ts** | N/A | Builds payloads for email/phone/webhook; not wired to voice TTS. |

**Conclusion:** Events are **not** emitted via a central bus. We will add a **single pipeline**: when a shoplifting event is produced (from grocery detector or a stub), it goes through **AlertGate → MiniMax TTS → Playback → Log**. No need to change existing email/Vapi flow for non-shoplifting; we only add the voice-alert path for `shoplifting_detected`.

---

### 4. Frontend / Dashboard

| Location | Purpose |
|----------|--------|
| **app/pages/dashboard/page.tsx** | Main dashboard (cameras, activity). |
| **app/pages/retail-theft/page.tsx** | Retail Theft tab (incidents, feedback). |
| **app/pages/realtimeStreamPage/page.tsx** | Live stream + detection UI. |
| **app/layout.tsx**, **components/dashboard-layout.tsx** | Layout and nav. |

No WebSocket or SSE in the app today. Playback can be **Option A** (server-side ffplay/afplay when available + write MP3 to `./alerts/audio/`) and optionally **Option B** later (dashboard polls an API for “latest alert” and plays via HTMLAudio after user enables audio).

---

### 5. Config

| Location | Contents |
|----------|----------|
| **.env** | `OPENAI_API_KEY`, Resend, Vapi, Stack Auth. No MiniMax or shoplift-specific vars yet. |
| **config/grocery-store-sample.json** | Store/zones/thresholds; not used by ingest. |
| **next.config.ts** | Next.js config. |
| No **docker-compose** or **.env.example** in repo. |

We will add env vars for MiniMax, AlertGate (confidence, cooldown, persistence), and optional template; and document them in a quickstart.

---

### 6. Incident Types (Current vs Required)

- **Current:**  
  - `VideoEvent`: `{ timestamp, description, isDangerous }` — no `event_type`.  
  - `TheftEvent`: `{ behaviorType, suspicionScore, zoneId, ... }` — no top-level `event_type: "shoplifting_detected"`.  

- **Required:**  
  - Single canonical **ShopliftingEvent** with `event_type: "shoplifting_detected"`, `camera_id`, `location`, `confidence` (0..1), `timestamp` (ISO), optional `evidence`.  
  - All new code (AlertGate, TTS, playback, logging) will accept only this schema so we can later plug in RTSP or other detectors.

---

## Implementation Plan (Checklist)

1. **Event schema** — Define `ShopliftingEvent` (strict) and helpers to convert from `TheftEvent` / stub.
2. **AlertGate** — Confidence threshold, per-camera cooldown, optional persistence; env-driven; log suppressed events.
3. **MiniMax TTS client** — HTTP client, retries, timeouts, hex→bytes→mp3, save to `./alerts/audio/`; dry-run/beep fallback.
4. **Playback module** — Non-blocking: write MP3, then optional ffplay/afplay; or return path for API/dashboard.
5. **Pipeline wiring** — One place that receives “shoplifting” (from grocery detect or stub), runs AlertGate → TTS → Playback → incident log.
6. **Incident logging** — Append to `./alerts/incidents.jsonl` (and optionally suppressed to same file with `status: "suppressed"`).
7. **Smoke test** — Script that creates 3 simulated ShopliftingEvents, runs gate + TTS (or beep), checks cooldown and file output.
8. **Quickstart doc** — Env vars, how to run without cameras, where audio/logs go, troubleshooting.

---

## What We Do Not Touch

- No weapon/gun/dangerous-person detection.
- No changes to medical/fall/violence prompts except to avoid implying we “accuse”; voice message stays “Possible shoplifting detected.”
- Existing email/Vapi flows remain; we only add the **voice alert** path for shoplifting.
