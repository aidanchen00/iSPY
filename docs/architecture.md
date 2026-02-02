# iSPY Architecture

This document describes the technical architecture of the iSPY theft detection system.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           iSPY SURVEILLANCE PLATFORM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  VIDEO FEED  │    │  AUDIO FEED  │    │  POS DATA    │                   │
│  │  (Cameras)   │    │  (Ambient)   │    │  (Optional)  │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    INGESTION LAYER (Next.js Server)                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐        │
│  │   YOLO v8   │           │  MiniMax    │           │  MiniMax    │        │
│  │  Detection  │           │   M2.1      │           │ Speech 2.6  │        │
│  └──────┬──────┘           └──────┬──────┘           └──────┬──────┘        │
│         │                         │                         │               │
│         └─────────────────────────┼─────────────────────────┘               │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     MULTI-AGENT REASONING ENGINE                    │    │
│  │   Detective Cole (Audio) ◄───► Analyst Morgan (Vision)              │    │
│  │                           Coordinator                               │    │
│  └───────────────────────────────┼─────────────────────────────────────┘    │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Voice Alert │ Alert Gate │ Incident Log │ Store Optimizer          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Organization

### Core Modules (`lib/`)

```
lib/
├── theft-detection/        # Unified API for all detection
│   ├── index.ts           # Main exports
│   ├── zones/             # → lib/grocery (zone-based detection)
│   ├── tracking/          # → lib/grocery-shoplift (person tracking)
│   └── alerts/            # → lib/shoplift-alerts (voice alerts)
│
├── grocery/               # Zone-based theft detection
│   ├── types.ts          # Zone, Event, Camera types
│   ├── config.ts         # Detection configuration
│   ├── zones.ts          # Zone utilities
│   ├── detection.ts      # Main detection service
│   ├── scoring.ts        # Suspicion scoring
│   ├── evidence.ts       # Evidence building
│   ├── alerts.ts         # Alert dispatch
│   └── feedback.ts       # Operator feedback
│
├── grocery-shoplift/      # Person tracking pipeline
│   ├── types.ts          # Track, Suspicion, Judge types
│   ├── tracking.ts       # IOU person tracking
│   ├── suspicion.ts      # Suspicion scoring
│   ├── capture.ts        # Frame capture
│   ├── judge.ts          # Concealment judgment
│   ├── voice.ts          # Voice generation
│   ├── gate.ts           # Alert gating
│   ├── incident-log.ts   # Incident logging
│   └── pipeline.ts       # Pipeline orchestration
│
├── shoplift-alerts/       # Alert system with TTS
│   ├── types.ts          # ShopliftingEvent schema
│   ├── alert-gate.ts     # Cooldown/debouncing
│   ├── minimax-tts.ts    # MiniMax TTS client
│   ├── playback.ts       # Audio playback
│   ├── incident-log.ts   # JSONL logging
│   └── pipeline.ts       # Alert pipeline
│
├── agents/                # Multi-agent reasoning
│   ├── types.ts          # Agent types
│   ├── audio-agent.ts    # Detective Cole
│   ├── vision-agent.ts   # Analyst Morgan
│   ├── coordinator.ts    # Consensus coordinator
│   ├── conversation-db.ts # SQLite storage
│   └── prompts.ts        # Agent personalities
│
├── minimax/               # MiniMax API client
│   └── client.ts         # Unified MiniMax client
│
└── store-optimizer/       # Store recommendations
    └── analyzer.ts       # Zone analysis & suggestions
```

## Detection Pipelines

### 1. Zone-Based Detection

```
Frame → YOLO Detection → Zone Matching → VLM Analysis → Scoring → Alert
```

**Components:**
- `lib/grocery/detection.ts` - Main detection service
- `lib/grocery/scoring.ts` - Suspicion score calculation
- `lib/grocery/zones.ts` - Zone polygon matching

**Flow:**
1. Frame captured from video feed
2. YOLO detects persons, objects
3. VLM (MiniMax M2.1) analyzes behavior
4. Score calculated based on behavior + zone risk
5. Alert triggered if score exceeds threshold

### 2. Person Tracking Pipeline

```
Frame → Person Detection → IOU Tracking → Suspicion → Judge → Gate → Alert
```

**Components:**
- `lib/grocery-shoplift/tracking.ts` - Person tracking
- `lib/grocery-shoplift/suspicion.ts` - Suspicion scoring
- `lib/grocery-shoplift/judge.ts` - Concealment judgment
- `lib/grocery-shoplift/gate.ts` - Alert gating

**Flow:**
1. Person bounding boxes from detector
2. IOU tracking assigns persistent track IDs
3. Suspicion score based on: zone history, dwell time, exit pattern
4. Judge evaluates concealment likelihood
5. Gate applies cooldown rules
6. Voice alert generated if passed

### 3. Multi-Agent Reasoning

```
Incident → Audio Agent + Vision Agent → Debate → Consensus → Verdict
```

**Components:**
- `lib/agents/audio-agent.ts` - Detective Cole
- `lib/agents/vision-agent.ts` - Analyst Morgan
- `lib/agents/coordinator.ts` - Orchestration

**Flow:**
1. Incident input (audio + visual data)
2. Both agents analyze independently
3. If disagreement, agents debate (max 4 turns)
4. Coordinator synthesizes verdict
5. Verdict: `confirmed_threat`, `false_positive`, `inconclusive`, `needs_human_review`

## API Routes

```
app/api/
├── grocery/
│   ├── detect/route.ts    # POST - Zone detection
│   └── feedback/route.ts  # POST - Operator feedback
├── shoplift-alert/route.ts # POST - Trigger alert
├── concealment-smoke/route.ts # POST - Pipeline smoke test
├── agents/analyze/route.ts # POST - Multi-agent analysis
└── store-optimizer/route.ts # POST - Store recommendations
```

## Data Flow

### Alert Generation

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Detector   │────▶│  AlertGate   │────▶│   MiniMax    │
│  (Event)     │     │ (Cooldown)   │     │    TTS       │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                            ┌───────────────────┘
                            ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Incident    │◀────│   Playback   │◀────│ Audio File   │
│    Log       │     │   (afplay)   │     │  (.mp3/wav)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### File Storage

```
./alerts/
├── incidents.jsonl    # One JSON per incident
├── audio/            # Generated voice alerts
│   ├── 1234_cam1.mp3
│   └── 1234_cam1_beep.wav
└── frames/           # Captured keyframes
    └── 1234_track1_001.jpg
```

## Configuration

### Store Configuration (`data/store-configuration.md`)

- Zone definitions
- Scoring thresholds
- Alert destinations
- Calibration settings

### Environment Variables

See [getting-started.md](./getting-started.md#environment-configuration)

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Vision AI | MiniMax M2.1 (abab7-chat-preview) |
| Audio AI | MiniMax Speech 2.6 (speech-02-hd) |
| Voice Alerts | MiniMax TTS (speech-2.8-turbo) |
| Object Detection | TensorFlow.js (client-side) |
| Database | SQLite (better-sqlite3) |
| Auth | Supabase |

## Fallback Strategy

When MiniMax is not configured:

| Component | MiniMax | Local Fallback |
|-----------|---------|----------------|
| Vision Analysis | M2.1 VLM | Rule-based pattern matching |
| Audio Transcription | Speech 2.6 | Not available |
| Voice Alerts | TTS API | macOS `say` / Linux `espeak` |
| Concealment Judge | VLM reasoning | LocalFallbackJudge |

## Performance Considerations

- **Frame Interval:** 100ms between frames (configurable)
- **Alert Cooldown:** 20s per camera, 30s per person
- **Database:** SQLite for agent conversations
- **File Storage:** Local filesystem for incidents

## Security

- No sensitive data in git (API keys in `.env.local`)
- Incident logs contain metadata only (no raw images by default)
- Voice alerts use non-accusatory language
- Privacy settings configurable per store
