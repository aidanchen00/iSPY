# Getting Started with iSPY

This guide covers the complete setup for iSPY's theft detection system, including all three detection pipelines.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Setup](#quick-setup)
3. [Detection Pipelines](#detection-pipelines)
4. [Environment Configuration](#environment-configuration)
5. [Testing Without Cameras](#testing-without-cameras)
6. [Configuring Zones](#configuring-zones)
7. [Voice Alerts](#voice-alerts)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+
- MiniMax API key (optional - system works without it using local fallbacks)
- Modern web browser with webcam access (for live detection)

## Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd iSPY
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Minimum configuration (no API keys needed for basic testing):

```env
# No API keys required for basic testing!
# The system uses local fallbacks when MiniMax is not configured.
```

Full configuration (for production):

```env
# MiniMax (optional but recommended)
MINIMAX_API_KEY=your_minimax_api_key
ENABLE_MINIMAX_TTS=1
ENABLE_MINIMAX_VLM=1

# Supabase (for auth)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Detection Pipelines

iSPY has three detection subsystems that can be used independently or together:

### 1. Zone-Based Detection (`lib/theft-detection/zones/`)

Visual analysis of predefined store zones. Detects behaviors like concealment, checkout bypass, and zone violations.

- Uses MiniMax M2.1 for vision-language reasoning (falls back to rule-based detection)
- Configurable zones with risk multipliers
- Scoring system with thresholds for different alert levels

### 2. Person Tracking (`lib/theft-detection/tracking/`)

Tracks individuals across frames and detects suspicious patterns:

- IOU-based person tracking
- Suspicion scoring based on: exit without checkout, dwell time in high-theft zones, body posture changes
- Local concealment judge (no API required)

### 3. Alert System (`lib/theft-detection/alerts/`)

Voice alerts and incident logging:

- MiniMax TTS or local system TTS fallback
- Alert gating (cooldown, debouncing)
- Incident logging to `./alerts/incidents.jsonl`

---

## Environment Configuration

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIMAX_API_KEY` | No | — | MiniMax API key. If missing, uses local fallbacks |
| `ENABLE_MINIMAX_TTS` | No | — | Set to `1` to enable MiniMax TTS |
| `ENABLE_MINIMAX_VLM` | No | — | Set to `1` to enable MiniMax vision reasoning |

### Detection Thresholds

| Variable | Default | Description |
|----------|---------|-------------|
| `SHOPLIFT_ESCALATE_SCORE` | `70` | Suspicion score to trigger judge |
| `SHOPLIFT_DWELL_SECONDS` | `12` | Time in high-theft zone before +25 score |
| `SHOPLIFT_CHECKOUT_MEMORY_SECONDS` | `60` | Window for "visited checkout" memory |
| `SHOPLIFT_CAMERA_COOLDOWN_SECONDS` | `20` | Per-camera alert cooldown |
| `SHOPLIFT_TRACK_COOLDOWN_SECONDS` | `30` | Per-person alert cooldown |
| `SHOPLIFT_MIN_CONFIDENCE` | `0.75` | Min confidence (0-1) to trigger alert |

### Voice Alert Template

```bash
SHOPLIFT_ALERT_TEMPLATE="Security alert. Possible shoplifting detected at {location}."
```

**Important:** Always use non-accusatory language ("possible", "assistance needed").

---

## Testing Without Cameras

### Smoke Test (No API Keys Required)

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Run the smoke test:
   ```bash
   python3 scripts/smoke_test_alerts.py
   ```

3. Check outputs:
   - `./alerts/incidents.jsonl` - incident logs
   - `./alerts/audio/` - generated audio files

### Test the Alert API

```bash
curl -X POST http://localhost:3000/api/shoplift-alert \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "shoplifting_detected",
    "camera_id": "cam-test-1",
    "location": "Aisle 6",
    "confidence": 0.85,
    "timestamp": "2025-01-29T12:00:00.000Z"
  }'
```

### Test Zone Detection

```bash
curl -X POST http://localhost:3000/api/grocery/detect \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "data:image/jpeg;base64,...",
    "cameraId": "cam-test",
    "storeId": "store-test"
  }'
```

---

## Configuring Zones

Zones define areas with different risk levels. Coordinates are normalized (0-1).

### Zone Types

| Type | Description | Risk Multiplier |
|------|-------------|-----------------|
| `entrance` | Store entry points | 1.3x |
| `exit` | Store exit points | 1.5x |
| `checkout` | Register areas | 1.2x |
| `high_theft` | High-value areas | 1.8x |
| `staff_only` | Employee-only | 2.5x |
| `general` | Shopping floor | 1.0x |

### Example Zone Configuration

```json
{
  "id": "entrance-zone",
  "name": "Main Entrance",
  "type": "entrance",
  "polygon": [
    { "x": 0.0, "y": 0.0 },
    { "x": 0.5, "y": 0.0 },
    { "x": 0.5, "y": 0.5 },
    { "x": 0.0, "y": 0.5 }
  ],
  "color": "#3B82F6",
  "riskMultiplier": 1.3,
  "enabled": true
}
```

### Recommended Layout

```
+------------------+------------------+------------------+
|    ENTRANCE      |    CHECKOUT      |      EXIT        |
|    Risk: 1.3x    |    Risk: 1.2x    |    Risk: 1.5x    |
+------------------+------------------+------------------+
|                                                        |
|              MAIN SHOPPING FLOOR (1.0x)                |
|                                                        |
+------------------+------------------+------------------+
|   COSMETICS      |    ALCOHOL       |  ELECTRONICS     |
|    Risk: 1.8x    |    Risk: 1.7x    |    Risk: 2.0x    |
+------------------+------------------+------------------+
```

---

## Voice Alerts

### Local Fallback (No API Required)

When MiniMax is not configured, voice alerts use:

- **macOS:** Built-in `say` command
- **Linux:** `espeak` (install with `apt install espeak`)
- **Fallback:** WAV beep file

### MiniMax TTS (Production)

Enable with:

```env
MINIMAX_API_KEY=your_key
ENABLE_MINIMAX_TTS=1
```

Additional MiniMax options:

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIMAX_TTS_URL` | `https://api-uw.minimax.io/v1/t2a_v2` | TTS endpoint |
| `MINIMAX_TTS_MODEL` | `speech-2.8-turbo` | Model name |
| `MINIMAX_VOICE_ID` | `English_expressive_narrator` | Voice ID |

---

## Troubleshooting

### No Audio Playback

- **macOS:** `afplay` is built-in
- **Linux:** Install ffmpeg: `apt install ffmpeg`
- Check `./alerts/audio/` for generated files

### incidents.jsonl Not Created

- Ensure dev server is running
- Run smoke test to generate sample incidents
- Check server logs for errors

### Alert Suppressed

Expected behavior! Alerts have cooldowns:
- Same camera: 20 seconds
- Same person: 30 seconds

Check `./alerts/incidents.jsonl` for `status: "suppressed"` entries.

### MiniMax Errors

- **401:** Invalid API key - use local fallbacks for testing
- **429:** Rate limited - pipeline auto-falls back to local

### High False Positive Rate

1. Lower sensitivity in config
2. Add ignore patterns for employees
3. Use operator feedback to track and improve

---

## Next Steps

1. **Test locally** - Run smoke tests without cameras
2. **Configure zones** - Set up your store's zone layout
3. **Add cameras** - Connect RTSP streams (see architecture docs)
4. **Monitor** - Use the dashboard to review incidents
5. **Calibrate** - Use operator feedback to improve accuracy

For architecture details, see [architecture.md](./architecture.md).
