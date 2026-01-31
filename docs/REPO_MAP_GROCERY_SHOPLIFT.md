# Repo Map — Grocery Concealment Shoplift (Person-Only)

## Phase 0 — Repo Map

### 1. RTSP ingest path

- **There is no RTSP ingest** in this repo.
- **Video input:** Browser webcam only via `navigator.mediaDevices.getUserMedia()` in **app/pages/realtimeStreamPage/page.tsx** (lines ~194–200). Stream is attached to `<video>` and drawn to canvas for frame capture.
- **Placeholder:** `lib/grocery/types.ts` has `streamUrl?: string` on `GroceryCamera`; not implemented.
- **Offline:** `scripts/generate_bounding_boxes.py` uses `cv2.VideoCapture(video_path)` for local MP4 files only; not used at runtime.

**Conclusion:** Live “CCTV” today is webcam only. To support RTSP later, add a bridge (e.g. ffmpeg → frames) that feeds the same pipeline (person bboxes → tracking → suspicion → judge → alert).

---

### 2. Person detection path

- **Realtime (browser):**  
  - **app/pages/realtimeStreamPage/page.tsx** captures frames from the webcam, sends base64 to **app/pages/realtimeStreamPage/actions.ts** `detectEvents()` (OpenAI GPT-4o, full-frame). No per-person bounding boxes in the live path.  
  - TensorFlow.js (Blazeface, MoveNet) is loaded for overlay/visuals; not used to produce bboxes for the alert pipeline.
- **Grocery API:** **app/api/grocery/detect/route.ts** and **lib/grocery/detection.ts** use GPT-4o on full-frame images; return `TheftEvent[]` with zone/suspicion but no person bboxes or track IDs.
- **Offline:** **scripts/generate_bounding_boxes.py** uses YOLOv8 (`yolov8s.pt`) with `classes=[0]` (person) and outputs per-frame person boxes to JSON; not wired to live ingest.

**Conclusion:** Live path does **not** currently produce person bounding boxes or track IDs. Person-only concealment requires adding a **person detection + tracking** layer (e.g. IOU tracking on bboxes from a detector or from the existing YOLO script if run on a stream).

---

### 3. Tracking path

- **lib/grocery/types.ts** defines `PersonTrack` (id, firstSeen, lastSeen, trajectory, zonesVisited, dwellTimes, suspicionAccumulator).
- **lib/grocery/scoring.ts** has `updatePersonTrack()` and `calculateAccumulatedSuspicion()` but they are **not** used by the live ingest or API; grocery detect returns events without track IDs.
- **No IOU-based bbox tracking** in the app. No `track_id` or bbox history in the realtime or grocery detect flow.

**Conclusion:** Tracking is **missing** in the live pipeline. Phase 1 must add minimal IOU tracking (match by IOU > 0.3, track_id, bbox history, last_seen).

---

### 4. Event / alert path

- **Realtime page:** On each `detectEvents()` result, for every `event.isDangerous` it calls `fetch("/api/send-email")` and `triggerSecurityCall()` (Vapi). No central event bus.
- **Grocery detect:** **app/api/grocery/detect/route.ts** builds `TheftEvent[]`; for each event with `suspicionScore >= 75` it creates a `ShopliftingEvent` and calls `runShopliftAlertPipeline()` (gate → TTS → playback → log).
- **Shoplift pipeline:** **lib/shoplift-alerts/** — `alert-gate.ts`, `minimax-tts.ts`, `playback.ts`, `pipeline.ts`, `incident-log.ts`. TTS currently uses MiniMax when key is set, with a beep fallback when key is missing or DRY_RUN.

**Conclusion:** Event path for “shoplifting” is: detector → `ShopliftingEvent` → **AlertGate** → **TTS** (MiniMax or beep) → playback → **incidents.jsonl**. There is no internal event emitter; the hook-in point is “whenever a ShopliftingEvent is produced” (today: grocery detect API). For person-only concealment, the hook will be: **after suspicion scoring** when `suspicion_score >= SHOPLIFT_ESCALATE_SCORE` → capture crops → ConcealmentJudge → ShopliftingEvent → same AlertGate → VoiceAlert → log. Voice must default to **local** (beep or OS TTS); MiniMax optional behind flags.

---

### 5. Dashboard path

- **app/pages/dashboard/page.tsx** — main dashboard (cameras, activity).
- **app/pages/retail-theft/page.tsx** — Retail Theft tab (incidents, feedback).
- **app/pages/realtimeStreamPage/page.tsx** — live stream + detection UI.
- **app/layout.tsx**, **components/dashboard-layout.tsx**, **components/dashboard-sidebar.tsx** — layout and nav.
- No WebSocket/SSE; no “play_audio” push. Audio playback today is server-side (afplay/ffplay) or future dashboard pull.

---

### 6. How to run locally

```bash
npm install
npm run dev
# Open http://localhost:3000
# Live stream: /pages/realtimeStreamPage
# Retail theft: /pages/retail-theft
# Dashboard: /pages/dashboard
```

No RTSP or camera config required for webcam. No MiniMax keys required if using local fallbacks.

---

### 7. Where to hook “shoplifting_detected” (person-only)

- **Current:** `ShopliftingEvent` is produced in **app/api/grocery/detect/route.ts** from `TheftEvent[]` when `suspicionScore >= 75` (VLM-based, full-frame).
- **Desired (person-only):**  
  1. Ingest produces **person bboxes** (from a detector; if none, stub for smoke test).  
  2. **IOU tracker** outputs per-frame `[{ track_id, bbox, confidence }]`.  
  3. **Suspicion** module computes `suspicion_score` from zones (exit_without_checkout, dwell in high_theft) and silhouette proxy; escalate when `suspicion_score >= SHOPLIFT_ESCALATE_SCORE` (e.g. 70).  
  4. **Capture** 3 person crops → save to `./alerts/frames/`.  
  5. **ConcealmentJudge** (default: LocalFallbackJudge; optional: MiniMax VLM) returns `concealment_likely` + confidence.  
  6. If judge says likely and confidence >= gate threshold → build **ShopliftingEvent** (camera_id, location, confidence, track_id, frame_paths) → **AlertGate** (per-camera + per-track cooldown) → **VoiceAlert** (default: local beep/OS TTS; optional: MiniMax) → **incident log**.

No event bus exists; the “event” is the **ShopliftingEvent** object passed into the existing **lib/shoplift-alerts** pipeline, extended so that VoiceAlert and Judge have **local-first** implementations and MiniMax is optional.

---

## Implementation Plan (Checklist)

| Phase | Item | Status |
|-------|------|--------|
| 0 | Repo Map + Plan | ✅ |
| 1 | IOU person tracking (track_id, bbox history, last_seen) | ✅ lib/grocery-shoplift/tracking.ts |
| 2 | Suspicion: zone (exit_no_checkout +40, dwell high_theft +25), silhouette proxy +20; escalate >= 70 | ✅ lib/grocery-shoplift/suspicion.ts |
| 3 | Person crop capture: 3 frames, 15% margin, save to ./alerts/frames/ | ✅ lib/grocery-shoplift/capture.ts |
| 4 | ConcealmentJudge: LocalFallbackJudge (default), MiniMaxVLMJudge (optional, behind ENABLE_MINIMAX_VLM) | ✅ lib/grocery-shoplift/judge.ts |
| 5 | VoiceAlert: LocalVoiceAlert (beep/say/espeak default), MiniMaxVoiceAlert (optional, behind ENABLE_MINIMAX_TTS) | ✅ lib/grocery-shoplift/voice.ts |
| 6 | AlertGate: per-camera 20s, per-track 30s, judge confidence >= 0.7 | ✅ lib/grocery-shoplift/gate.ts |
| 7 | Incident log: ts, camera_id, location, track_id, suspicion_score, frame_paths, judge_used, judge_result, voice_used, audio_path, status, suppressed_reason | ✅ lib/grocery-shoplift/incident-log.ts |
| 8 | Smoke test: 5 simulated tracks, exit_without_checkout, no API keys | ✅ scripts/smoke_test_alerts.py + POST /api/concealment-smoke |
| 9 | QUICKSTART_GROCERY_SHOPLIFT.md | ✅ |
