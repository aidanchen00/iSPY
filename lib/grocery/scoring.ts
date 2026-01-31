/**
 * Grocery Store Theft Detection - Suspicion Scoring Engine
 * 
 * This module calculates and manages suspicion scores for detected events.
 * It considers:
 * - Base behavior scores
 * - Zone risk multipliers
 * - Time-of-day adjustments
 * - Store calibration settings
 * - Historical context
 */

import type {
  TheftEvent,
  TheftBehaviorType,
  SeverityLevel,
  StoreCalibration,
  ScoringThresholds,
  BehaviorWeights,
  Zone,
  PersonTrack,
} from './types'
import { DEFAULT_BEHAVIOR_WEIGHTS, DEFAULT_THRESHOLDS, DEFAULT_CALIBRATION } from './config'
import { calculateRiskMultiplier, isInZoneType } from './zones'

// ============================================
// CORE SCORING FUNCTIONS
// ============================================

/**
 * Calculate the suspicion score for an event
 */
export function calculateSuspicionScore(
  behaviorType: TheftBehaviorType,
  zoneRiskMultiplier: number = 1.0,
  calibration: StoreCalibration = DEFAULT_CALIBRATION,
  behaviorWeights: BehaviorWeights = DEFAULT_BEHAVIOR_WEIGHTS,
  additionalFactors: AdditionalFactors = {}
): number {
  // Get base score for behavior type
  const baseScore = behaviorWeights[behaviorType] || 35
  
  // Apply zone multiplier
  let score = baseScore * zoneRiskMultiplier
  
  // Apply sensitivity level (0-100 maps to 0.5-1.5x)
  const sensitivityMultiplier = 0.5 + (calibration.sensitivityLevel / 100)
  score *= sensitivityMultiplier
  
  // Apply time-of-day adjustments
  const timeMultiplier = getTimeOfDayMultiplier(calibration)
  score *= timeMultiplier
  
  // Apply additional factors
  if (additionalFactors.repeatedBehavior) {
    score *= 1.2  // 20% increase for repeated behavior
  }
  if (additionalFactors.multipleItems) {
    score *= 1.15  // 15% increase for multiple items
  }
  if (additionalFactors.nearExit) {
    score *= 1.25  // 25% increase when near exit
  }
  if (additionalFactors.afterHours) {
    score *= 1.3  // 30% increase during non-peak hours
  }
  if (additionalFactors.personHistory && additionalFactors.personHistory > 0) {
    // Increase based on previous suspicious behavior by same person
    score *= 1 + (additionalFactors.personHistory * 0.1)
  }
  
  // Clamp to 0-100 range
  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
 * Additional factors that can affect scoring
 */
export interface AdditionalFactors {
  repeatedBehavior?: boolean      // Same behavior repeated
  multipleItems?: boolean         // Multiple items involved
  nearExit?: boolean              // Person near store exit
  afterHours?: boolean            // Outside peak shopping hours
  personHistory?: number          // Previous suspicious events for this person
  modelConfidence?: number        // VLM confidence (0-1)
}

/**
 * Get time-of-day multiplier based on calibration
 */
export function getTimeOfDayMultiplier(calibration: StoreCalibration): number {
  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()
  
  // Check if within active hours
  const activeStart = parseTimeString(calibration.activeHours.start)
  const activeEnd = parseTimeString(calibration.activeHours.end)
  
  if (currentTime < activeStart || currentTime > activeEnd) {
    return 0.5  // Reduced sensitivity outside active hours (but not zero)
  }
  
  // Check peak hours
  for (const peak of calibration.peakHours) {
    const peakStart = parseTimeString(peak.start)
    const peakEnd = parseTimeString(peak.end)
    
    if (currentTime >= peakStart && currentTime <= peakEnd) {
      return peak.multiplier
    }
  }
  
  return 1.0  // Default multiplier
}

/**
 * Parse HH:MM time string to minutes since midnight
 */
function parseTimeString(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// ============================================
// SEVERITY DETERMINATION
// ============================================

/**
 * Determine severity level from suspicion score
 */
export function getSeverityFromScore(
  score: number,
  thresholds: ScoringThresholds = DEFAULT_THRESHOLDS
): SeverityLevel {
  if (score >= thresholds.critical) return 'critical'
  if (score >= thresholds.alertSecurity) return 'high'
  if (score >= thresholds.dashboardMark) return 'medium'
  return 'low'
}

/**
 * Determine what action should be taken for a score
 */
export type RecommendedAction = 'log_only' | 'mark_dashboard' | 'alert_security' | 'critical_alert'

export function getRecommendedAction(
  score: number,
  thresholds: ScoringThresholds = DEFAULT_THRESHOLDS
): RecommendedAction {
  if (score >= thresholds.critical) return 'critical_alert'
  if (score >= thresholds.alertSecurity) return 'alert_security'
  if (score >= thresholds.dashboardMark) return 'mark_dashboard'
  return 'log_only'
}

/**
 * Check if an alert should be sent
 */
export function shouldSendAlert(
  score: number,
  thresholds: ScoringThresholds = DEFAULT_THRESHOLDS
): boolean {
  return score >= thresholds.alertSecurity
}

// ============================================
// PERSON TRACKING & ACCUMULATION
// ============================================

/**
 * Calculate accumulated suspicion for a tracked person
 */
export function calculateAccumulatedSuspicion(
  track: PersonTrack,
  recentEvents: TheftEvent[],
  zones: Zone[],
  decayRate: number = 0.95  // 5% decay per minute
): number {
  let accumulated = track.suspicionAccumulator
  
  // Apply time decay
  const timeSinceLastSeen = Date.now() - track.lastSeen.getTime()
  const minutesElapsed = timeSinceLastSeen / 60000
  accumulated *= Math.pow(decayRate, minutesElapsed)
  
  // Add new events for this person
  const personEvents = recentEvents.filter(e => e.personTrackingId === track.id)
  for (const event of personEvents) {
    accumulated += event.suspicionScore * 0.5  // Contribution factor
  }
  
  // Zone-based adjustments
  for (const zoneId of track.zonesVisited) {
    const zone = zones.find(z => z.id === zoneId)
    if (zone?.type === 'high_theft') {
      const dwellTime = track.dwellTimes[zoneId] || 0
      if (dwellTime > 60) {  // More than 60 seconds
        accumulated += 5 * (dwellTime / 60)  // 5 points per minute
      }
    }
    if (zone?.type === 'staff_only') {
      accumulated += 25  // Significant boost for entering staff areas
    }
  }
  
  // Clamp
  return Math.min(100, Math.max(0, accumulated))
}

/**
 * Update person track with new observation
 */
export function updatePersonTrack(
  track: PersonTrack,
  newPosition: { x: number; y: number },
  zoneId: string | null,
  timestamp: Date
): PersonTrack {
  const updated = { ...track }
  
  // Update timing
  updated.lastSeen = timestamp
  
  // Update trajectory
  updated.trajectory = [
    ...updated.trajectory.slice(-50),  // Keep last 50 points
    newPosition,
  ]
  
  // Update zones visited
  if (zoneId && !updated.zonesVisited.includes(zoneId)) {
    updated.zonesVisited = [...updated.zonesVisited, zoneId]
  }
  
  // Update dwell time
  if (zoneId) {
    const current = updated.dwellTimes[zoneId] || 0
    const timeSinceLastSeen = timestamp.getTime() - track.lastSeen.getTime()
    updated.dwellTimes = {
      ...updated.dwellTimes,
      [zoneId]: current + (timeSinceLastSeen / 1000),
    }
  }
  
  return updated
}

// ============================================
// PATTERN DETECTION
// ============================================

/**
 * Detect loitering pattern
 */
export function detectLoitering(
  trajectory: Array<{ x: number; y: number }>,
  durationSeconds: number,
  thresholdSeconds: number = 120,
  movementThreshold: number = 0.1
): boolean {
  if (durationSeconds < thresholdSeconds) return false
  if (trajectory.length < 10) return false
  
  // Calculate total movement
  let totalMovement = 0
  for (let i = 1; i < trajectory.length; i++) {
    const dx = trajectory[i].x - trajectory[i - 1].x
    const dy = trajectory[i].y - trajectory[i - 1].y
    totalMovement += Math.sqrt(dx * dx + dy * dy)
  }
  
  // If total movement is low relative to time, it's loitering
  const avgMovementPerSecond = totalMovement / durationSeconds
  return avgMovementPerSecond < movementThreshold
}

/**
 * Detect exit approach pattern (moving toward exit zone)
 */
export function detectExitApproach(
  trajectory: Array<{ x: number; y: number }>,
  exitZones: Zone[],
  minSteps: number = 5
): boolean {
  if (trajectory.length < minSteps) return false
  
  // Get last N positions
  const recent = trajectory.slice(-minSteps)
  
  // For each exit zone, check if trajectory is moving toward it
  for (const zone of exitZones) {
    const zoneCentroid = getZoneCentroid(zone)
    
    // Check if distance to zone is decreasing
    let approachingCount = 0
    for (let i = 1; i < recent.length; i++) {
      const prevDist = distance(recent[i - 1], zoneCentroid)
      const currDist = distance(recent[i], zoneCentroid)
      if (currDist < prevDist) {
        approachingCount++
      }
    }
    
    // If mostly approaching, flag it
    if (approachingCount >= minSteps - 1) {
      return true
    }
  }
  
  return false
}

/**
 * Helper: Get zone centroid
 */
function getZoneCentroid(zone: Zone): { x: number; y: number } {
  let sumX = 0
  let sumY = 0
  for (const p of zone.polygon) {
    sumX += p.x
    sumY += p.y
  }
  return {
    x: sumX / zone.polygon.length,
    y: sumY / zone.polygon.length,
  }
}

/**
 * Helper: Calculate distance between two points
 */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ============================================
// SCORING UTILITIES
// ============================================

/**
 * Get score display color
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#DC2626'  // Red 600
  if (score >= 75) return '#EF4444'  // Red 500
  if (score >= 50) return '#F59E0B'  // Amber 500
  if (score >= 30) return '#FBBF24'  // Amber 400
  return '#22C55E'                    // Green 500
}

/**
 * Get score badge text
 */
export function getScoreBadgeText(score: number): string {
  if (score >= 90) return 'CRITICAL'
  if (score >= 75) return 'HIGH'
  if (score >= 50) return 'MEDIUM'
  if (score >= 30) return 'LOW'
  return 'NORMAL'
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return `${Math.round(score)}%`
}

/**
 * Calculate trend from recent events
 */
export function calculateTrend(
  recentEvents: TheftEvent[],
  periodMinutes: number = 60
): 'increasing' | 'decreasing' | 'stable' {
  if (recentEvents.length < 3) return 'stable'
  
  const cutoff = Date.now() - periodMinutes * 60000
  const withinPeriod = recentEvents.filter(e => e.timestamp.getTime() > cutoff)
  
  if (withinPeriod.length < 2) return 'stable'
  
  // Compare first half to second half
  const midpoint = Math.floor(withinPeriod.length / 2)
  const firstHalf = withinPeriod.slice(0, midpoint)
  const secondHalf = withinPeriod.slice(midpoint)
  
  const firstAvg = firstHalf.reduce((sum, e) => sum + e.suspicionScore, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, e) => sum + e.suspicionScore, 0) / secondHalf.length
  
  const difference = secondAvg - firstAvg
  if (difference > 10) return 'increasing'
  if (difference < -10) return 'decreasing'
  return 'stable'
}
