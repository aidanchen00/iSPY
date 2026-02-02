# Scripts

Utility scripts for iSPY development and testing.

## Directory Structure

```
scripts/
├── setup/              # Setup and seeding scripts
│   ├── seed-agent-conversations.ts   # Populate demo conversations
│   └── run-store-optimizer.ts        # Run store analysis
│
├── testing/            # Test and smoke test scripts
│   ├── smoke_test_alerts.py          # End-to-end alert pipeline test
│   └── test_shoplift_alert.py        # Test alert API
│
├── detection/          # Video/detection processing
│   ├── generate_bounding_boxes.py    # Generate YOLO bounding boxes
│   ├── generate_video_data.py        # Process video data
│   └── requirements.txt              # Python dependencies
│
└── requirements.txt    # Shared Python dependencies
```

## Usage

### Setup Scripts

```bash
# Seed demo agent conversations
npx ts-node scripts/setup/seed-agent-conversations.ts

# Run store optimizer analysis
npx ts-node scripts/setup/run-store-optimizer.ts
```

### Testing Scripts

```bash
# Run smoke test (no cameras required)
python3 scripts/testing/smoke_test_alerts.py

# Test alert API
python3 scripts/testing/test_shoplift_alert.py
```

### Detection Scripts

```bash
# Install Python dependencies
pip install -r scripts/detection/requirements.txt

# Generate bounding boxes from video
python3 scripts/detection/generate_bounding_boxes.py

# Process video data
python3 scripts/detection/generate_video_data.py
```

## Python Dependencies

Install shared dependencies:

```bash
pip install -r scripts/requirements.txt
```

Detection-specific dependencies (includes YOLO):

```bash
pip install -r scripts/detection/requirements.txt
```
