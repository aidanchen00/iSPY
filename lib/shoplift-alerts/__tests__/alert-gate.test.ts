/**
 * Unit tests: AlertGate (cooldown + threshold).
 * Run with: npx jest lib/shoplift-alerts/__tests__/alert-gate.test.ts
 * (Add jest + ts-jest if not present; or run via Next.js test runner.)
 */

import { alertGate, resetAlertGate, getAlertGateConfig } from "../alert-gate";
import { createStubShopliftingEvent } from "../types";

const CAM = "cam-test";

describe("AlertGate", () => {
  beforeEach(() => {
    resetAlertGate();
    // Disable persistence so a single event can trigger (default is 2-in-window)
    process.env.SHOPLIFT_PERSISTENCE_COUNT = "1";
    process.env.SHOPLIFT_PERSISTENCE_WINDOW_MS = "0";
  });

  it("allows event above min confidence", () => {
    const event = createStubShopliftingEvent({
      camera_id: CAM,
      confidence: 0.8,
    });
    const result = alertGate(event);
    expect(result.allowed).toBe(true);
  });

  it("rejects event below min confidence", () => {
    const event = createStubShopliftingEvent({
      camera_id: CAM,
      confidence: 0.5,
    });
    const result = alertGate(event);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("below_threshold");
  });

  it("rejects second event for same camera within cooldown", () => {
    process.env.SHOPLIFT_COOLDOWN_SECONDS = "20";
    const e1 = createStubShopliftingEvent({
      camera_id: CAM,
      confidence: 0.9,
    });
    const e2 = createStubShopliftingEvent({
      camera_id: CAM,
      confidence: 0.9,
    });
    const r1 = alertGate(e1);
    expect(r1.allowed).toBe(true);
    const r2 = alertGate(e2);
    expect(r2.allowed).toBe(false);
    expect(r2.reason).toBe("cooldown");
  });

  it("returns config with numeric values", () => {
    const config = getAlertGateConfig();
    expect(typeof config.minConfidence).toBe("number");
    expect(typeof config.cooldownSeconds).toBe("number");
    expect(config.minConfidence).toBeGreaterThanOrEqual(0);
    expect(config.minConfidence).toBeLessThanOrEqual(1);
  });
});
