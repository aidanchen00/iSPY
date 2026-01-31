/**
 * Grocery Store Theft Detection - VLM Prompts
 * 
 * This module contains all prompts for the Vision Language Model (GPT-4o)
 * specifically designed for retail theft detection in grocery stores.
 */

import type { Zone, TheftBehaviorType } from './types'

// ============================================
// SYSTEM PROMPTS
// ============================================

/**
 * System prompt for retail theft detection
 */
export const RETAIL_THEFT_SYSTEM_PROMPT = `You are an AI security analyst specialized in retail loss prevention for grocery stores. Your role is to analyze security camera footage and detect potential theft or suspicious behavior.

IMPORTANT GUIDELINES:
1. Focus on BEHAVIOR patterns, not individual characteristics
2. Consider context - legitimate shoppers may exhibit some similar behaviors
3. Rate suspicion objectively from 0-100 based on evidence
4. Provide clear, actionable reasoning for any flags
5. Minimize false positives - only flag genuinely suspicious behavior
6. ALWAYS respond with valid JSON in the exact format specified

You must be CONSERVATIVE in flagging - it's better to miss a minor incident than falsely accuse innocent shoppers. Only flag behavior that would concern a trained loss prevention professional.`

// ============================================
// RETAIL THEFT BEHAVIORS
// ============================================

/**
 * Detailed descriptions of theft behaviors for the VLM
 */
export const THEFT_BEHAVIOR_DESCRIPTIONS: Record<TheftBehaviorType, string> = {
  concealment: `CONCEALMENT: Person is hiding merchandise in clothing, bags, strollers, or other personal items. Look for:
    - Placing items in pockets, under shirts, in waistbands
    - Stuffing items into bags/purses/backpacks
    - Blocking camera view while handling items
    - Quick, furtive movements when putting items away
    - Multiple items being held then disappearing`,

  grab_and_run: `GRAB AND RUN: Person takes items and rushes toward exit. Look for:
    - Running or fast walking toward doors
    - Grabbing high-value items and immediately heading to exit
    - No shopping pattern, direct path to target and exit
    - Looking around nervously while moving quickly
    - Often occurs near high-theft areas close to exits`,

  ticket_switching: `TICKET SWITCHING: Swapping price tags or barcodes between items. Look for:
    - Handling multiple similar items with price tags
    - Peeling or attaching stickers/tags
    - Comparing items closely then manipulating tags
    - Placing one item down after extended handling
    - Often in clothing or produce areas`,

  cart_walkout: `CART WALKOUT: Walking out with unpaid merchandise in cart. Look for:
    - Full cart heading directly to exit, bypassing checkout
    - Casual demeanor suggesting normalcy
    - Often during busy times when staff is distracted
    - May have some items on top that look purchased
    - Sometimes uses fake receipts`,

  checkout_bypass: `CHECKOUT BYPASS: Intentionally avoiding the checkout area. Look for:
    - Walking past registers toward exit
    - Using emergency exits or employee doors
    - Leaving through entrance instead of exit
    - Hiding in store until closing time
    - Following customers out the door closely`,

  receipt_fraud: `RECEIPT FRAUD: Using fake or old receipts for returns/stealing. Look for:
    - Picking up items matching receipt descriptions
    - Taking items to customer service area
    - Handling paper/phone near items
    - Selecting specific items carefully without shopping pattern`,

  employee_theft: `EMPLOYEE THEFT: Staff stealing merchandise or cash. Look for:
    - Employee handling merchandise unusually
    - Placing items in personal bags/lockers
    - Unusual access to stock rooms
    - Voiding transactions or register manipulation
    - Passing items to accomplices`,

  suspicious_loitering: `SUSPICIOUS LOITERING: Extended time in high-theft areas without shopping. Look for:
    - Staying in one section for unusually long time
    - Repeatedly picking up and putting back same items
    - Watching staff movements and camera positions
    - Little to no actual shopping activity
    - Multiple trips to same area`,

  tag_removal: `TAG REMOVAL: Removing security tags or sensors. Look for:
    - Struggling with items in unnatural ways
    - Using tools or magnets on packaging
    - Handling security-tagged items extensively
    - Small objects (magnets, tools) in hands
    - Discarded security tags on floor/shelves`,

  distraction_theft: `DISTRACTION THEFT: Working with accomplices. Look for:
    - One person engaging staff while another handles merchandise
    - Coordinated movements between multiple people
    - Signal exchanges (phone calls, gestures)
    - One person creating disturbance/scene
    - Items being passed between people`,

  fitting_room_theft: `FITTING ROOM THEFT: Concealing items in fitting rooms. Look for:
    - Bringing many items into fitting room
    - Leaving with fewer items than entered
    - Wearing bulkier clothing when exiting
    - Leaving tags/hangers behind
    - Unusual time spent in fitting room`,

  self_checkout_fraud: `SELF-CHECKOUT FRAUD: Not scanning items or manipulation. Look for:
    - Passing items around scanner without scanning
    - Scanning cheaper items for expensive ones
    - Covering barcodes while scanning
    - Placing items directly in bags without scanning
    - Unusual behavior at self-checkout terminals`,

  unknown: `UNKNOWN SUSPICIOUS BEHAVIOR: General suspicious activity that doesn't fit other categories. Look for:
    - Unusual or nervous behavior
    - Watching security cameras or staff
    - Multiple shopping bags from other stores
    - Cutting security cables or packaging
    - Any other behavior that seems intentional to evade detection`,
}

// ============================================
// DETECTION PROMPTS
// ============================================

/**
 * Generate the main detection prompt
 */
export function generateRetailTheftPrompt(
  zones: Zone[] = [],
  previousContext?: string
): string {
  const zoneDescriptions = zones.length > 0
    ? `\nZONES IN VIEW:
${zones.map(z => `- ${z.name} (${z.type}): ${z.description || 'No description'}`).join('\n')}`
    : ''

  const contextSection = previousContext
    ? `\nPREVIOUS CONTEXT:
${previousContext}`
    : ''

  return `Analyze this grocery store security camera frame for potential theft or suspicious behavior.

${zoneDescriptions}
${contextSection}

BEHAVIORS TO DETECT:

${Object.values(THEFT_BEHAVIOR_DESCRIPTIONS).join('\n\n')}

INSTRUCTIONS:
1. Carefully examine the frame for ANY of the above behaviors
2. For each detected behavior, assess a suspicion score from 0-100:
   - 0-29: Normal behavior, not suspicious
   - 30-49: Mildly unusual, worth monitoring
   - 50-74: Suspicious, should be marked on dashboard
   - 75-89: Highly suspicious, alert security
   - 90-100: Critical, immediate attention required

3. Consider zone context:
   - Behaviors in high-theft zones warrant higher scores
   - Exit/entrance behaviors are more critical
   - Staff-only zone intrusions are always critical

4. Be CONSERVATIVE - only flag genuinely suspicious behavior
5. Provide brief, clear reasoning for each flag

Return a JSON object in this exact format:
{
  "frame_analysis": {
    "people_detected": number,
    "items_visible": string[],
    "zones_occupied": string[]
  },
  "events": [
    {
      "behavior_type": "concealment" | "grab_and_run" | "ticket_switching" | "cart_walkout" | "checkout_bypass" | "receipt_fraud" | "employee_theft" | "suspicious_loitering" | "tag_removal" | "distraction_theft" | "fitting_room_theft" | "self_checkout_fraud" | "unknown",
      "suspicion_score": number (0-100),
      "severity": "low" | "medium" | "high" | "critical",
      "zone": string | null,
      "description": "Brief description of what is happening",
      "reasoning": "1-2 sentences explaining why this was flagged",
      "person_location": {
        "x": number (0-1, normalized),
        "y": number (0-1, normalized)
      },
      "confidence": number (0-1)
    }
  ],
  "overall_risk": "none" | "low" | "medium" | "high",
  "recommended_action": "none" | "monitor" | "alert" | "dispatch"
}`
}

/**
 * Generate a lightweight pre-filter prompt for cost optimization
 * Only used to decide if full analysis is needed
 */
export const PREFILTER_PROMPT = `Quickly scan this grocery store camera frame. Is there ANY potentially suspicious activity that warrants detailed analysis?

Only answer "YES" if you see:
- Someone concealing items in bags/clothing
- Someone moving quickly toward exits with merchandise
- Unusual behavior near checkout or high-value areas
- Someone in staff-only areas who appears to be a customer
- Any obvious theft in progress

Respond with ONLY one word: "YES" or "NO"

If unsure, respond "YES" to be safe.`

/**
 * Generate explanation prompt for evidence documentation
 */
export function generateExplanationPrompt(
  behaviorType: TheftBehaviorType,
  initialAnalysis: string
): string {
  return `Based on the following initial analysis of potential ${behaviorType.replace(/_/g, ' ')} behavior, provide a clear, professional explanation suitable for security reports and potential evidence.

Initial Analysis:
${initialAnalysis}

Provide a response in this format:
{
  "summary": "One clear sentence describing what was observed",
  "key_indicators": [
    "List of 3-5 specific behavioral indicators observed"
  ],
  "timeline": "Brief description of the sequence of events",
  "recommended_response": "Specific action recommendation for security",
  "evidence_notes": "What evidence to preserve (frames, timestamps, etc.)"
}`
}

/**
 * Generate prompt for tracking person across frames
 */
export function generateTrackingPrompt(
  previousDescription: string,
  currentFrame: string
): string {
  return `You are tracking a person of interest across security camera frames.

PREVIOUS OBSERVATION:
${previousDescription}

Analyze the current frame and determine:
1. Is the same person still visible?
2. What is their current location in the frame?
3. Have they taken any new suspicious actions?
4. What items (if any) are they carrying now vs before?

Respond with JSON:
{
  "person_found": boolean,
  "confidence": number (0-1),
  "location": { "x": number, "y": number } | null,
  "movement_direction": "left" | "right" | "toward_camera" | "away_from_camera" | "stationary",
  "items_carried": string[],
  "new_actions": string[],
  "suspicion_change": "increased" | "decreased" | "unchanged",
  "notes": string
}`
}

// ============================================
// FALLBACK PROMPTS
// ============================================

/**
 * Simplified prompt for when detailed analysis fails
 */
export const FALLBACK_PROMPT = `Analyze this grocery store security camera image.

Is there any suspicious activity happening? Score from 0-100.

Return JSON:
{
  "is_suspicious": boolean,
  "score": number,
  "description": string,
  "recommendation": "none" | "monitor" | "alert"
}`

// ============================================
// PROMPT UTILITIES
// ============================================

/**
 * Get behavior type display name
 */
export function getBehaviorDisplayName(type: TheftBehaviorType): string {
  const names: Record<TheftBehaviorType, string> = {
    concealment: 'Item Concealment',
    grab_and_run: 'Grab and Run',
    ticket_switching: 'Ticket/Tag Switching',
    cart_walkout: 'Cart Walkout',
    checkout_bypass: 'Checkout Bypass',
    receipt_fraud: 'Receipt Fraud',
    employee_theft: 'Employee Theft',
    suspicious_loitering: 'Suspicious Loitering',
    tag_removal: 'Security Tag Removal',
    distraction_theft: 'Distraction Theft',
    fitting_room_theft: 'Fitting Room Theft',
    self_checkout_fraud: 'Self-Checkout Fraud',
    unknown: 'Unknown Suspicious Activity',
  }
  return names[type] || type.replace(/_/g, ' ')
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  const colors = {
    low: '#6B7280',      // Gray
    medium: '#F59E0B',   // Amber
    high: '#EF4444',     // Red
    critical: '#DC2626', // Dark red
  }
  return colors[severity]
}

/**
 * Get score severity level
 */
export function getScoreSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'critical'
  if (score >= 75) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}
