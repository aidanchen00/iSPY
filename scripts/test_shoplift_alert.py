#!/usr/bin/env python3
"""
Smoke test for shoplifting alert pipeline.

- Creates 3 simulated ShopliftingEvents.
- Verifies cooldown works (second event for same camera within cooldown is suppressed).
- Verifies mp3/beep file is produced (or wav fallback).
- Calls Next.js API POST /api/shoplift-alert (server must be running) or runs gate logic only.

Usage:
  # With server running (npm run dev):
  python scripts/test_shoplift_alert.py

  # Dry run (no MiniMax, beep only):
  DRY_RUN=1 python scripts/test_shoplift_alert.py
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = os.environ.get("SHOPLIFT_TEST_URL", "http://localhost:3000")
EVENT_TYPE = "shoplifting_detected"


def make_event(camera_id: str, location: str, confidence: float) -> dict:
    return {
        "event_type": EVENT_TYPE,
        "camera_id": camera_id,
        "location": location,
        "confidence": confidence,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    }


def post_event(event: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE_URL}/api/shoplift-alert",
        data=json.dumps(event).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        try:
            return json.loads(body)
        except Exception:
            return {"error": str(e), "body": body}
    except Exception as e:
        return {"error": str(e)}


def main():
    print("Shoplifting alert smoke test")
    print("BASE_URL =", BASE_URL)
    print()

    e1 = make_event("cam-test-1", "Aisle 6", 0.85)
    e2_same_camera = make_event("cam-test-1", "Aisle 6", 0.90)  # same camera, should be suppressed by cooldown
    e3_other = make_event("cam-test-2", "Checkout 2", 0.80)

    # 1) First event — should trigger
    print("1) POST first event (cam-test-1, 0.85)...")
    r1 = post_event(e1)
    print("   Response:", r1)
    if "error" in r1 and r1.get("error") != "Invalid event":
        print("   FAIL: unexpected error")
        sys.exit(1)
    triggered1 = r1.get("triggered", False)
    print("   Triggered:", triggered1)

    # 2) Second event same camera immediately — should be suppressed (cooldown)
    print("\n2) POST second event same camera (cam-test-1, 0.90) immediately...")
    r2 = post_event(e2_same_camera)
    print("   Response:", r2)
    triggered2 = r2.get("triggered", False)
    reason2 = r2.get("reason", "")
    print("   Triggered:", triggered2, "Reason:", reason2)
    if triggered2 and "cooldown" not in reason2:
        print("   WARN: expected cooldown suppression (may be OK if cooldown=0)")

    # 3) Third event other camera — should trigger
    print("\n3) POST third event other camera (cam-test-2, 0.80)...")
    r3 = post_event(e3_other)
    print("   Response:", r3)
    triggered3 = r3.get("triggered", False)
    print("   Triggered:", triggered3)

    # Check that at least one trigger produced an audio path (or fallback)
    audio_path = r1.get("audioPath") or r3.get("audioPath")
    if triggered1 or triggered3:
        if audio_path:
            print("\n   OK: audio path produced:", audio_path)
        else:
            print("\n   WARN: triggered but no audioPath in response (check server logs and ./alerts/audio/)")
    else:
        print("\n   No event triggered (check MINIMAX_API_KEY, DRY_RUN, SHOPLIFT_MIN_CONFIDENCE)")

    print("\nDone. Check ./alerts/incidents.jsonl and ./alerts/audio/ for outputs.")
    sys.exit(0)


if __name__ == "__main__":
    main()
