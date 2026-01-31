/**
 * Unit tests: MiniMax TTS — hex to bytes parsing.
 * Run with: npx jest lib/shoplift-alerts/__tests__/minimax-tts.test.ts
 */

import { hexToBytes } from "../minimax-tts";

describe("hexToBytes", () => {
  it("converts hex string to buffer", () => {
    const hex = "48656c6c6f"; // "Hello" in ASCII
    const buf = hexToBytes(hex);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBe(5);
    expect(buf.toString("utf-8")).toBe("Hello");
  });

  it("handles empty string", () => {
    const buf = hexToBytes("");
    expect(buf.length).toBe(0);
  });

  it("handles single byte", () => {
    const buf = hexToBytes("ff");
    expect(buf.length).toBe(1);
    expect(buf[0]).toBe(255);
  });

  it("strips whitespace", () => {
    const hex = "48 65 6c 6c 6f";
    const buf = hexToBytes(hex);
    expect(buf.length).toBe(5);
    expect(buf.toString("utf-8")).toBe("Hello");
  });

  it("throws on invalid hex length", () => {
    expect(() => hexToBytes("f")).toThrow("Invalid hex length");
  });
});
