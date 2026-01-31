/**
 * Grocery Store Theft Detection - Evidence Clip Builder
 * 
 * This module handles:
 * - Frame buffering (ring buffer for last N seconds)
 * - Keyframe extraction when events are detected
 * - Clip building from buffered frames
 * - Evidence storage and export
 */

import type { TheftEvent, Keyframe, BoundingBox } from './types'

// ============================================
// FRAME BUFFER
// ============================================

/**
 * Configuration for frame buffering
 */
export interface BufferConfig {
  preEventSeconds: number    // Seconds to keep before event (default: 10)
  postEventSeconds: number   // Seconds to capture after event (default: 5)
  maxBufferSeconds: number   // Maximum buffer size (default: 30)
  captureIntervalMs: number  // Time between frame captures (default: 500)
  keyframeCount: number      // Number of keyframes to extract (default: 3)
}

export const DEFAULT_BUFFER_CONFIG: BufferConfig = {
  preEventSeconds: 10,
  postEventSeconds: 5,
  maxBufferSeconds: 30,
  captureIntervalMs: 500,
  keyframeCount: 3,
}

/**
 * A single buffered frame
 */
export interface BufferedFrame {
  id: string
  timestamp: Date
  imageData: string        // Base64 encoded
  frameNumber: number
}

/**
 * Ring buffer for frame storage
 */
export class FrameBuffer {
  private frames: BufferedFrame[] = []
  private maxFrames: number
  private frameCounter: number = 0
  private config: BufferConfig

  constructor(config: Partial<BufferConfig> = {}) {
    this.config = { ...DEFAULT_BUFFER_CONFIG, ...config }
    // Calculate max frames based on buffer duration and capture interval
    this.maxFrames = Math.ceil(
      (this.config.maxBufferSeconds * 1000) / this.config.captureIntervalMs
    )
  }

  /**
   * Add a frame to the buffer
   */
  addFrame(imageData: string): BufferedFrame {
    const frame: BufferedFrame = {
      id: `frame-${Date.now()}-${this.frameCounter}`,
      timestamp: new Date(),
      imageData,
      frameNumber: this.frameCounter++,
    }

    this.frames.push(frame)

    // Remove oldest frames if buffer is full
    while (this.frames.length > this.maxFrames) {
      this.frames.shift()
    }

    return frame
  }

  /**
   * Get frames from the last N seconds
   */
  getFramesFromLastSeconds(seconds: number): BufferedFrame[] {
    const cutoff = Date.now() - seconds * 1000
    return this.frames.filter(f => f.timestamp.getTime() >= cutoff)
  }

  /**
   * Get frames around a specific timestamp
   */
  getFramesAround(
    centerTimestamp: Date,
    beforeSeconds: number,
    afterSeconds: number
  ): BufferedFrame[] {
    const beforeCutoff = centerTimestamp.getTime() - beforeSeconds * 1000
    const afterCutoff = centerTimestamp.getTime() + afterSeconds * 1000
    
    return this.frames.filter(
      f => f.timestamp.getTime() >= beforeCutoff && f.timestamp.getTime() <= afterCutoff
    )
  }

  /**
   * Get the most recent frame
   */
  getLatestFrame(): BufferedFrame | null {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1] : null
  }

  /**
   * Get all frames in buffer
   */
  getAllFrames(): BufferedFrame[] {
    return [...this.frames]
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.frames = []
  }

  /**
   * Get buffer stats
   */
  getStats(): { frameCount: number; oldestFrame: Date | null; newestFrame: Date | null } {
    return {
      frameCount: this.frames.length,
      oldestFrame: this.frames.length > 0 ? this.frames[0].timestamp : null,
      newestFrame: this.frames.length > 0 ? this.frames[this.frames.length - 1].timestamp : null,
    }
  }
}

// ============================================
// EVIDENCE BUILDER
// ============================================

/**
 * Evidence package for an incident
 */
export interface EvidencePackage {
  id: string
  eventId: string
  createdAt: Date
  
  // Frames
  keyframes: Keyframe[]
  allFrames: BufferedFrame[]
  
  // Metadata
  eventTimestamp: Date
  durationSeconds: number
  frameCount: number
  
  // Clip (if generated)
  clipBlob?: Blob
  clipUrl?: string
}

/**
 * Build an evidence package from an event
 */
export function buildEvidencePackage(
  event: TheftEvent,
  buffer: FrameBuffer,
  config: BufferConfig = DEFAULT_BUFFER_CONFIG
): EvidencePackage {
  // Get frames around the event
  const frames = buffer.getFramesAround(
    event.timestamp,
    config.preEventSeconds,
    config.postEventSeconds
  )

  // Extract keyframes (evenly distributed)
  const keyframes = extractKeyframes(frames, event, config.keyframeCount)

  // Calculate duration
  const durationSeconds = frames.length > 0
    ? (frames[frames.length - 1].timestamp.getTime() - frames[0].timestamp.getTime()) / 1000
    : 0

  return {
    id: `evidence-${event.id}`,
    eventId: event.id,
    createdAt: new Date(),
    keyframes,
    allFrames: frames,
    eventTimestamp: event.timestamp,
    durationSeconds,
    frameCount: frames.length,
  }
}

/**
 * Extract keyframes from a set of frames
 */
export function extractKeyframes(
  frames: BufferedFrame[],
  event: TheftEvent,
  count: number = 3
): Keyframe[] {
  if (frames.length === 0) return []
  if (frames.length <= count) {
    // Return all frames as keyframes
    return frames.map((f, i) => frameToKeyframe(f, event, i === 0))
  }

  const keyframes: Keyframe[] = []
  
  // Always include the frame closest to the event
  const eventTime = event.timestamp.getTime()
  const closestFrame = frames.reduce((closest, frame) => {
    const closestDiff = Math.abs(closest.timestamp.getTime() - eventTime)
    const frameDiff = Math.abs(frame.timestamp.getTime() - eventTime)
    return frameDiff < closestDiff ? frame : closest
  })
  keyframes.push(frameToKeyframe(closestFrame, event, true))

  // Add frames before and after
  const closestIndex = frames.indexOf(closestFrame)
  const remaining = count - 1

  // Distribute remaining keyframes before and after
  const beforeCount = Math.floor(remaining / 2)
  const afterCount = remaining - beforeCount

  // Get frames before
  for (let i = 0; i < beforeCount; i++) {
    const index = Math.max(0, closestIndex - Math.floor((closestIndex / beforeCount) * (i + 1)))
    if (index !== closestIndex && !keyframes.some(k => k.frameNumber === frames[index].frameNumber)) {
      keyframes.unshift(frameToKeyframe(frames[index], event, false))
    }
  }

  // Get frames after
  for (let i = 0; i < afterCount; i++) {
    const remainingFrames = frames.length - closestIndex - 1
    if (remainingFrames > 0) {
      const index = Math.min(
        frames.length - 1,
        closestIndex + Math.ceil((remainingFrames / afterCount) * (i + 1))
      )
      if (index !== closestIndex && !keyframes.some(k => k.frameNumber === frames[index].frameNumber)) {
        keyframes.push(frameToKeyframe(frames[index], event, false))
      }
    }
  }

  // Sort by timestamp
  return keyframes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

/**
 * Convert a BufferedFrame to a Keyframe
 */
function frameToKeyframe(
  frame: BufferedFrame,
  event: TheftEvent,
  isPrimary: boolean
): Keyframe {
  return {
    id: `keyframe-${frame.id}`,
    eventId: event.id,
    timestamp: frame.timestamp,
    frameNumber: frame.frameNumber,
    imageData: frame.imageData,
    zones: event.zoneId ? [event.zoneId] : undefined,
  }
}

// ============================================
// CLIP GENERATION (CLIENT-SIDE)
// ============================================

/**
 * Generate a video clip from frames (browser only)
 * This uses the Canvas API and MediaRecorder
 */
export async function generateClip(
  frames: BufferedFrame[],
  options: {
    width?: number
    height?: number
    frameRate?: number
    mimeType?: string
  } = {}
): Promise<Blob | null> {
  if (typeof window === 'undefined') {
    console.error('generateClip can only be called in browser context')
    return null
  }

  const {
    width = 640,
    height = 360,
    frameRate = 10,
    mimeType = 'video/webm',
  } = options

  return new Promise((resolve) => {
    try {
      // Create canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      // Create media stream from canvas
      const stream = canvas.captureStream(frameRate)
      
      // Check supported mime types
      let selectedMimeType = mimeType
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          selectedMimeType = 'video/webm;codecs=vp9'
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          selectedMimeType = 'video/webm;codecs=vp8'
        } else {
          selectedMimeType = 'video/webm'
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType })
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMimeType })
        resolve(blob)
      }

      recorder.start()

      // Draw frames to canvas
      let frameIndex = 0
      const interval = setInterval(() => {
        if (frameIndex >= frames.length) {
          clearInterval(interval)
          recorder.stop()
          return
        }

        const frame = frames[frameIndex]
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height)
        }
        img.src = frame.imageData
        frameIndex++
      }, 1000 / frameRate)

    } catch (error) {
      console.error('Error generating clip:', error)
      resolve(null)
    }
  })
}

// ============================================
// EVIDENCE STORAGE (LOCAL STORAGE MVP)
// ============================================

const EVIDENCE_STORAGE_KEY = 'grocery_theft_evidence'

/**
 * Save evidence package to local storage
 * Note: This is for MVP. In production, use proper backend storage.
 */
export function saveEvidence(evidence: EvidencePackage): void {
  if (typeof window === 'undefined') return

  try {
    const existing = getStoredEvidence()
    
    // Don't store full frame data in localStorage (too large)
    const stored: StoredEvidence = {
      id: evidence.id,
      eventId: evidence.eventId,
      createdAt: evidence.createdAt.toISOString(),
      eventTimestamp: evidence.eventTimestamp.toISOString(),
      durationSeconds: evidence.durationSeconds,
      frameCount: evidence.frameCount,
      keyframeIds: evidence.keyframes.map(k => k.id),
      clipUrl: evidence.clipUrl,
    }

    existing.push(stored)
    
    // Keep only last 50 evidence packages
    const trimmed = existing.slice(-50)
    localStorage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Error saving evidence:', error)
  }
}

interface StoredEvidence {
  id: string
  eventId: string
  createdAt: string
  eventTimestamp: string
  durationSeconds: number
  frameCount: number
  keyframeIds: string[]
  clipUrl?: string
}

/**
 * Get stored evidence metadata
 */
export function getStoredEvidence(): StoredEvidence[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(EVIDENCE_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Clear all stored evidence
 */
export function clearStoredEvidence(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(EVIDENCE_STORAGE_KEY)
}

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Export keyframes as a downloadable zip (requires JSZip in production)
 * For MVP, exports as individual downloads
 */
export function downloadKeyframe(keyframe: Keyframe, filename?: string): void {
  if (typeof window === 'undefined') return

  const link = document.createElement('a')
  link.href = keyframe.imageData
  link.download = filename || `keyframe-${keyframe.id}.jpg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Create a shareable evidence report
 */
export function createEvidenceReport(
  evidence: EvidencePackage,
  event: TheftEvent
): string {
  return `
INCIDENT EVIDENCE REPORT
========================

Event ID: ${event.id}
Timestamp: ${event.timestamp.toISOString()}
Location: Camera ${event.cameraId}, Zone ${event.zoneId || 'Unknown'}

DETECTION DETAILS
-----------------
Behavior Type: ${event.behaviorType.replace(/_/g, ' ').toUpperCase()}
Suspicion Score: ${event.suspicionScore}/100
Severity: ${event.severity.toUpperCase()}

Description: ${event.description}

Reasoning: ${event.reasoning}

EVIDENCE DETAILS
----------------
Duration: ${evidence.durationSeconds.toFixed(1)} seconds
Frame Count: ${evidence.frameCount}
Keyframes: ${evidence.keyframes.length}

Generated: ${evidence.createdAt.toISOString()}
`.trim()
}
