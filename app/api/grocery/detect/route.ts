/**
 * Grocery Store Theft Detection API
 * 
 * POST /api/grocery/detect
 * 
 * Hybrid detection pipeline:
 * 1. Optional pre-filter (lightweight check if VLM analysis is needed)
 * 2. Full VLM analysis with grocery-specific prompts
 * 3. Scoring with zone multipliers
 * 4. Event creation and response
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  TheftEvent,
  TheftBehaviorType,
  Zone,
  TheftDetectionRequest,
  TheftDetectionResponse,
  SeverityLevel,
} from '@/lib/grocery/types'
import {
  RETAIL_THEFT_SYSTEM_PROMPT,
  generateRetailTheftPrompt,
  PREFILTER_PROMPT,
  getScoreSeverity,
} from '@/lib/grocery/prompts'
import {
  calculateSuspicionScore,
  getSeverityFromScore,
  getRecommendedAction,
  AdditionalFactors,
} from '@/lib/grocery/scoring'
import {
  findZonesContainingPoint,
  calculateRiskMultiplier,
  isInZoneType,
} from '@/lib/grocery/zones'
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_BEHAVIOR_WEIGHTS,
  DEFAULT_CALIBRATION,
  SAMPLE_GROCERY_ZONES,
} from '@/lib/grocery/config'

// ============================================
// OPENAI CLIENT
// ============================================

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey })
}

// ============================================
// TYPES
// ============================================

interface VLMAnalysisResult {
  frame_analysis: {
    people_detected: number
    items_visible: string[]
    zones_occupied: string[]
  }
  events: Array<{
    behavior_type: TheftBehaviorType
    suspicion_score: number
    severity: SeverityLevel
    zone: string | null
    description: string
    reasoning: string
    person_location: { x: number; y: number }
    confidence: number
  }>
  overall_risk: 'none' | 'low' | 'medium' | 'high'
  recommended_action: 'none' | 'monitor' | 'alert' | 'dispatch'
}

// ============================================
// PRE-FILTER (OPTIONAL OPTIMIZATION)
// ============================================

async function shouldAnalyze(
  imageBase64: string,
  openai: OpenAI
): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // Cheaper model for pre-filter
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PREFILTER_PROMPT },
            {
              type: 'image_url',
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
      max_tokens: 10,
    })

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase()
    return answer === 'YES' || answer?.includes('YES')
  } catch (error) {
    console.error('Pre-filter error, proceeding with analysis:', error)
    return true  // Default to analyzing if pre-filter fails
  }
}

// ============================================
// MAIN VLM ANALYSIS
// ============================================

async function analyzeFrame(
  imageBase64: string,
  zones: Zone[],
  openai: OpenAI,
  previousContext?: string
): Promise<VLMAnalysisResult | null> {
  const prompt = generateRetailTheftPrompt(zones, previousContext)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: RETAIL_THEFT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content
    if (!text) {
      console.error('Empty response from VLM')
      return null
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(text) as VLMAnalysisResult
      return parsed
    } catch (parseError) {
      console.error('Failed to parse VLM response:', parseError)
      console.log('Raw response:', text)
      
      // Try to extract JSON from potential code blocks
      const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]) as VLMAnalysisResult
        } catch {
          return null
        }
      }
      return null
    }
  } catch (error) {
    console.error('VLM analysis error:', error)
    throw error
  }
}

// ============================================
// MAIN API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse request body
    const body = await request.json()
    const {
      imageBase64,
      cameraId,
      storeId,
      timestamp,
      zones = SAMPLE_GROCERY_ZONES,
      usePreFilter = false,
      previousContext,
    } = body

    // Validate required fields
    if (!imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      )
    }

    // Initialize OpenAI client
    let openai: OpenAI
    try {
      openai = getOpenAIClient()
    } catch (error) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Optional pre-filter
    let shouldDoFullAnalysis = true
    if (usePreFilter) {
      shouldDoFullAnalysis = await shouldAnalyze(imageBase64, openai)
      if (!shouldDoFullAnalysis) {
        // Return early with empty results
        return NextResponse.json({
          events: [],
          personTracks: [],
          analysisTimeMs: Date.now() - startTime,
          modelUsed: 'gpt-4o-mini (pre-filter)',
          frameAnalyzed: false,
        } as TheftDetectionResponse)
      }
    }

    // Full VLM analysis
    const vlmResult = await analyzeFrame(
      imageBase64,
      zones,
      openai,
      previousContext
    )

    if (!vlmResult) {
      return NextResponse.json({
        events: [],
        personTracks: [],
        analysisTimeMs: Date.now() - startTime,
        modelUsed: 'gpt-4o',
        frameAnalyzed: true,
        error: 'Analysis failed to produce results',
      })
    }

    // Process VLM results into TheftEvents
    const events: TheftEvent[] = vlmResult.events.map((vlmEvent, index) => {
      // Find zones containing the detected person
      const personPosition = vlmEvent.person_location
      const containingZones = findZonesContainingPoint(personPosition, zones)
      const primaryZone = containingZones[0] || null
      
      // Calculate zone-based risk multiplier
      const riskMultiplier = calculateRiskMultiplier(personPosition, zones)
      
      // Additional scoring factors
      const additionalFactors: AdditionalFactors = {
        nearExit: isInZoneType(personPosition, zones, 'exit'),
        modelConfidence: vlmEvent.confidence,
      }
      
      // Recalculate suspicion score with our scoring engine
      const finalScore = calculateSuspicionScore(
        vlmEvent.behavior_type,
        riskMultiplier,
        DEFAULT_CALIBRATION,
        DEFAULT_BEHAVIOR_WEIGHTS,
        additionalFactors
      )
      
      // Determine final severity
      const finalSeverity = getSeverityFromScore(finalScore, DEFAULT_THRESHOLDS)
      
      // Create TheftEvent
      const event: TheftEvent = {
        id: `evt-${Date.now()}-${index}`,
        timestamp: new Date(timestamp || Date.now()),
        cameraId: cameraId || 'unknown',
        storeId: storeId || 'default-store',
        zoneId: primaryZone?.id,
        behaviorType: vlmEvent.behavior_type,
        suspicionScore: finalScore,
        severity: finalSeverity,
        description: vlmEvent.description,
        reasoning: vlmEvent.reasoning,
        keyframes: [],  // Will be populated by evidence builder
        alertSent: false,
      }
      
      return event
    })

    // Filter out low-score events if needed
    const significantEvents = events.filter(
      e => e.suspicionScore >= DEFAULT_THRESHOLDS.logOnly
    )

    // Emit shoplifting voice alerts for events above alert threshold (gate handles debounce)
    const { fromTheftEvent } = await import('@/lib/shoplift-alerts/types')
    const { runShopliftAlertPipeline } = await import('@/lib/shoplift-alerts/pipeline')
    for (const ev of significantEvents) {
      if (ev.suspicionScore >= DEFAULT_THRESHOLDS.alertSecurity) {
        const zone = zones.find(z => z.id === ev.zoneId)
        const shopliftEvent = fromTheftEvent(
          { ...ev, keyframes: ev.keyframes },
          zone?.name
        )
        runShopliftAlertPipeline(shopliftEvent).catch((err) =>
          console.error('[Grocery detect] shoplift pipeline error:', err)
        )
      }
    }

    // Prepare response
    const response: TheftDetectionResponse = {
      events: significantEvents,
      personTracks: [],  // TODO: Implement tracking in future iteration
      analysisTimeMs: Date.now() - startTime,
      modelUsed: 'gpt-4o',
      frameAnalyzed: true,
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Grocery detection error:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Detection failed',
        analysisTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET - API INFO
// ============================================

export async function GET() {
  return NextResponse.json({
    name: 'Grocery Store Theft Detection API',
    version: '1.0.0',
    endpoints: {
      'POST /api/grocery/detect': {
        description: 'Analyze a frame for theft/suspicious behavior',
        body: {
          imageBase64: 'Base64 encoded image (required)',
          cameraId: 'Camera identifier',
          storeId: 'Store identifier',
          timestamp: 'ISO timestamp',
          zones: 'Array of zone definitions (optional, uses defaults)',
          usePreFilter: 'Use cheap pre-filter to reduce costs (optional)',
          previousContext: 'Context from previous frames (optional)',
        },
        response: {
          events: 'Array of detected TheftEvents',
          personTracks: 'Array of person tracking data',
          analysisTimeMs: 'Time taken for analysis',
          modelUsed: 'VLM model used',
          frameAnalyzed: 'Whether full analysis was performed',
        },
      },
    },
    thresholds: DEFAULT_THRESHOLDS,
    behaviorTypes: [
      'concealment',
      'grab_and_run',
      'ticket_switching',
      'cart_walkout',
      'checkout_bypass',
      'receipt_fraud',
      'employee_theft',
      'suspicious_loitering',
      'tag_removal',
      'distraction_theft',
      'fitting_room_theft',
      'self_checkout_fraud',
      'unknown',
    ],
  })
}
