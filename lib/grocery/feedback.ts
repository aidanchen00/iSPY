/**
 * Grocery Store Theft Detection - Operator Feedback Loop
 * 
 * This module handles:
 * - Storing operator feedback on events (true/false positive)
 * - Calculating false positive rates
 * - Providing feedback statistics for calibration
 */

import type { TheftEvent, FeedbackSubmission } from './types'

// ============================================
// FEEDBACK STORAGE (LocalStorage MVP)
// ============================================

const FEEDBACK_STORAGE_KEY = 'grocery_theft_feedback'
const EVENTS_STORAGE_KEY = 'grocery_theft_events'

/**
 * Stored feedback record
 */
export interface FeedbackRecord {
  id: string
  eventId: string
  label: 'true_positive' | 'false_positive' | 'uncertain'
  notes?: string
  operatorId?: string
  submittedAt: string  // ISO string
  eventData?: {
    behaviorType: string
    suspicionScore: number
    severity: string
    zoneId?: string
    description: string
  }
}

/**
 * Submit feedback for an event
 */
export function submitFeedback(
  eventId: string,
  label: 'true_positive' | 'false_positive' | 'uncertain',
  notes?: string,
  operatorId?: string,
  eventData?: TheftEvent
): FeedbackRecord {
  const record: FeedbackRecord = {
    id: `feedback-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    eventId,
    label,
    notes,
    operatorId,
    submittedAt: new Date().toISOString(),
  }

  if (eventData) {
    record.eventData = {
      behaviorType: eventData.behaviorType,
      suspicionScore: eventData.suspicionScore,
      severity: eventData.severity,
      zoneId: eventData.zoneId,
      description: eventData.description,
    }
  }

  // Store in localStorage
  saveFeedback(record)

  return record
}

/**
 * Save feedback to storage
 */
function saveFeedback(record: FeedbackRecord): void {
  if (typeof window === 'undefined') return

  try {
    const existing = getAllFeedback()
    existing.push(record)
    
    // Keep only last 500 feedback records
    const trimmed = existing.slice(-500)
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Error saving feedback:', error)
  }
}

/**
 * Get all feedback records
 */
export function getAllFeedback(): FeedbackRecord[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Get feedback for a specific event
 */
export function getFeedbackForEvent(eventId: string): FeedbackRecord | null {
  const all = getAllFeedback()
  return all.find(f => f.eventId === eventId) || null
}

/**
 * Update existing feedback
 */
export function updateFeedback(
  eventId: string,
  updates: Partial<Pick<FeedbackRecord, 'label' | 'notes'>>
): FeedbackRecord | null {
  if (typeof window === 'undefined') return null

  const all = getAllFeedback()
  const index = all.findIndex(f => f.eventId === eventId)
  
  if (index === -1) return null

  all[index] = {
    ...all[index],
    ...updates,
    submittedAt: new Date().toISOString(),
  }

  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(all))
  return all[index]
}

/**
 * Delete feedback for an event
 */
export function deleteFeedback(eventId: string): boolean {
  if (typeof window === 'undefined') return false

  const all = getAllFeedback()
  const filtered = all.filter(f => f.eventId !== eventId)
  
  if (filtered.length === all.length) return false
  
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(filtered))
  return true
}

// ============================================
// STATISTICS
// ============================================

export interface FeedbackStatistics {
  totalFeedback: number
  truePositives: number
  falsePositives: number
  uncertain: number
  falsePositiveRate: number  // 0-1
  byBehaviorType: Record<string, {
    total: number
    truePositives: number
    falsePositives: number
    fpRate: number
  }>
  byZone: Record<string, {
    total: number
    falsePositives: number
    fpRate: number
  }>
  bySeverity: Record<string, {
    total: number
    falsePositives: number
    fpRate: number
  }>
  recentTrend: 'improving' | 'stable' | 'degrading'
}

/**
 * Calculate feedback statistics
 */
export function calculateFeedbackStatistics(
  feedbackRecords?: FeedbackRecord[]
): FeedbackStatistics {
  const feedback = feedbackRecords || getAllFeedback()
  
  const stats: FeedbackStatistics = {
    totalFeedback: feedback.length,
    truePositives: 0,
    falsePositives: 0,
    uncertain: 0,
    falsePositiveRate: 0,
    byBehaviorType: {},
    byZone: {},
    bySeverity: {},
    recentTrend: 'stable',
  }

  if (feedback.length === 0) return stats

  // Count by label
  for (const record of feedback) {
    switch (record.label) {
      case 'true_positive':
        stats.truePositives++
        break
      case 'false_positive':
        stats.falsePositives++
        break
      case 'uncertain':
        stats.uncertain++
        break
    }

    // By behavior type
    if (record.eventData?.behaviorType) {
      const bt = record.eventData.behaviorType
      if (!stats.byBehaviorType[bt]) {
        stats.byBehaviorType[bt] = { total: 0, truePositives: 0, falsePositives: 0, fpRate: 0 }
      }
      stats.byBehaviorType[bt].total++
      if (record.label === 'true_positive') stats.byBehaviorType[bt].truePositives++
      if (record.label === 'false_positive') stats.byBehaviorType[bt].falsePositives++
    }

    // By zone
    if (record.eventData?.zoneId) {
      const zone = record.eventData.zoneId
      if (!stats.byZone[zone]) {
        stats.byZone[zone] = { total: 0, falsePositives: 0, fpRate: 0 }
      }
      stats.byZone[zone].total++
      if (record.label === 'false_positive') stats.byZone[zone].falsePositives++
    }

    // By severity
    if (record.eventData?.severity) {
      const sev = record.eventData.severity
      if (!stats.bySeverity[sev]) {
        stats.bySeverity[sev] = { total: 0, falsePositives: 0, fpRate: 0 }
      }
      stats.bySeverity[sev].total++
      if (record.label === 'false_positive') stats.bySeverity[sev].falsePositives++
    }
  }

  // Calculate rates
  const labeled = stats.truePositives + stats.falsePositives
  if (labeled > 0) {
    stats.falsePositiveRate = stats.falsePositives / labeled
  }

  // Calculate rates for breakdowns
  for (const bt of Object.keys(stats.byBehaviorType)) {
    const data = stats.byBehaviorType[bt]
    const labeledBT = data.truePositives + data.falsePositives
    if (labeledBT > 0) {
      data.fpRate = data.falsePositives / labeledBT
    }
  }

  for (const zone of Object.keys(stats.byZone)) {
    const data = stats.byZone[zone]
    if (data.total > 0) {
      data.fpRate = data.falsePositives / data.total
    }
  }

  for (const sev of Object.keys(stats.bySeverity)) {
    const data = stats.bySeverity[sev]
    if (data.total > 0) {
      data.fpRate = data.falsePositives / data.total
    }
  }

  // Calculate trend (compare last 7 days vs previous 7 days)
  stats.recentTrend = calculateTrend(feedback)

  return stats
}

/**
 * Calculate trend in false positive rate
 */
function calculateTrend(
  feedback: FeedbackRecord[]
): 'improving' | 'stable' | 'degrading' {
  if (feedback.length < 20) return 'stable'

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000

  const thisWeek = feedback.filter(f => {
    const time = new Date(f.submittedAt).getTime()
    return time >= weekAgo
  })

  const lastWeek = feedback.filter(f => {
    const time = new Date(f.submittedAt).getTime()
    return time >= twoWeeksAgo && time < weekAgo
  })

  const fpRateThisWeek = calculateFPRate(thisWeek)
  const fpRateLastWeek = calculateFPRate(lastWeek)

  if (fpRateThisWeek < 0 || fpRateLastWeek < 0) return 'stable'

  const diff = fpRateThisWeek - fpRateLastWeek
  if (diff < -0.05) return 'improving'  // FP rate decreased by 5%+
  if (diff > 0.05) return 'degrading'   // FP rate increased by 5%+
  return 'stable'
}

function calculateFPRate(records: FeedbackRecord[]): number {
  let tp = 0
  let fp = 0
  for (const r of records) {
    if (r.label === 'true_positive') tp++
    if (r.label === 'false_positive') fp++
  }
  const total = tp + fp
  return total > 0 ? fp / total : -1
}

// ============================================
// CALIBRATION SUGGESTIONS
// ============================================

export interface CalibrationSuggestion {
  type: 'zone_sensitivity' | 'behavior_weight' | 'threshold' | 'ignore_pattern'
  priority: 'high' | 'medium' | 'low'
  description: string
  currentValue?: number | string
  suggestedValue?: number | string
  reason: string
}

/**
 * Generate calibration suggestions based on feedback
 */
export function generateCalibrationSuggestions(
  stats: FeedbackStatistics
): CalibrationSuggestion[] {
  const suggestions: CalibrationSuggestion[] = []

  // High false positive rate overall
  if (stats.falsePositiveRate > 0.3 && stats.totalFeedback >= 20) {
    suggestions.push({
      type: 'threshold',
      priority: 'high',
      description: 'Increase alert threshold',
      reason: `Overall false positive rate is ${(stats.falsePositiveRate * 100).toFixed(0)}%. Consider raising the alert threshold.`,
    })
  }

  // Check behavior types with high FP rates
  for (const [behaviorType, data] of Object.entries(stats.byBehaviorType)) {
    if (data.total >= 5 && data.fpRate > 0.4) {
      suggestions.push({
        type: 'behavior_weight',
        priority: 'medium',
        description: `Reduce weight for "${behaviorType.replace(/_/g, ' ')}"`,
        reason: `${(data.fpRate * 100).toFixed(0)}% false positive rate for this behavior type.`,
      })
    }
  }

  // Check zones with high FP rates
  for (const [zoneId, data] of Object.entries(stats.byZone)) {
    if (data.total >= 5 && data.fpRate > 0.4) {
      suggestions.push({
        type: 'zone_sensitivity',
        priority: 'medium',
        description: `Reduce sensitivity for zone "${zoneId}"`,
        reason: `${(data.fpRate * 100).toFixed(0)}% false positive rate in this zone.`,
      })
    }
  }

  // Check for suspicious loitering being too sensitive
  const loitering = stats.byBehaviorType['suspicious_loitering']
  if (loitering && loitering.total >= 10 && loitering.fpRate > 0.6) {
    suggestions.push({
      type: 'behavior_weight',
      priority: 'high',
      description: 'Reduce "suspicious loitering" sensitivity',
      reason: 'This behavior type has very high false positive rate. Consider adding employee/regular customer patterns to ignore list.',
    })
  }

  // Degrading trend
  if (stats.recentTrend === 'degrading') {
    suggestions.push({
      type: 'threshold',
      priority: 'high',
      description: 'Review recent false positives',
      reason: 'False positive rate has increased recently. Review recent cases to identify patterns.',
    })
  }

  return suggestions
}

// ============================================
// EXPORT/IMPORT
// ============================================

/**
 * Export all feedback as JSON
 */
export function exportFeedback(): string {
  const feedback = getAllFeedback()
  return JSON.stringify(feedback, null, 2)
}

/**
 * Import feedback from JSON
 */
export function importFeedback(jsonString: string): number {
  if (typeof window === 'undefined') return 0

  try {
    const imported = JSON.parse(jsonString) as FeedbackRecord[]
    if (!Array.isArray(imported)) return 0

    const existing = getAllFeedback()
    const existingIds = new Set(existing.map(f => f.eventId))
    
    // Only add new feedback (avoid duplicates)
    const newRecords = imported.filter(f => !existingIds.has(f.eventId))
    const combined = [...existing, ...newRecords].slice(-500)
    
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(combined))
    return newRecords.length
  } catch {
    return 0
  }
}

/**
 * Clear all feedback data
 */
export function clearAllFeedback(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(FEEDBACK_STORAGE_KEY)
}
