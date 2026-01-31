/**
 * Grocery Store Theft Detection - Feedback API
 * 
 * POST /api/grocery/feedback - Submit feedback for an event
 * GET /api/grocery/feedback - Get feedback statistics
 * GET /api/grocery/feedback?eventId=xxx - Get feedback for specific event
 */

import { NextRequest, NextResponse } from 'next/server'

// Since feedback is stored client-side (localStorage), 
// this API primarily handles the server-side statistics and suggestions

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, label, notes, operatorId, eventData } = body

    // Validate required fields
    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      )
    }

    if (!['true_positive', 'false_positive', 'uncertain'].includes(label)) {
      return NextResponse.json(
        { error: 'label must be true_positive, false_positive, or uncertain' },
        { status: 400 }
      )
    }

    // In production, this would store to a database
    // For MVP, we acknowledge the submission and let client handle storage
    const feedbackRecord = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      eventId,
      label,
      notes,
      operatorId,
      submittedAt: new Date().toISOString(),
      eventData: eventData ? {
        behaviorType: eventData.behaviorType,
        suspicionScore: eventData.suspicionScore,
        severity: eventData.severity,
        zoneId: eventData.zoneId,
        description: eventData.description,
      } : undefined,
    }

    // Log feedback for analysis (in production, store to DB)
    console.log('[Feedback] Received:', {
      eventId,
      label,
      behaviorType: eventData?.behaviorType,
      score: eventData?.suspicionScore,
    })

    return NextResponse.json({
      success: true,
      feedback: feedbackRecord,
      message: 'Feedback recorded successfully',
    })

  } catch (error: any) {
    console.error('[Feedback] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')

  if (eventId) {
    // Return info about how to get feedback for a specific event
    // Actual storage is client-side
    return NextResponse.json({
      message: 'Feedback is stored client-side. Use getFeedbackForEvent() from lib/grocery/feedback',
      eventId,
    })
  }

  // Return API info and calibration suggestions template
  return NextResponse.json({
    name: 'Grocery Store Theft Detection - Feedback API',
    version: '1.0.0',
    endpoints: {
      'POST /api/grocery/feedback': {
        description: 'Submit operator feedback for an event',
        body: {
          eventId: 'Event ID (required)',
          label: 'true_positive | false_positive | uncertain (required)',
          notes: 'Optional operator notes',
          operatorId: 'Optional operator identifier',
          eventData: 'Optional event metadata for analysis',
        },
      },
      'GET /api/grocery/feedback': {
        description: 'Get API information',
      },
    },
    clientSideFunctions: {
      'submitFeedback': 'Submit and store feedback locally',
      'getAllFeedback': 'Get all stored feedback',
      'calculateFeedbackStatistics': 'Calculate FP rates and stats',
      'generateCalibrationSuggestions': 'Get suggestions based on feedback',
    },
    labelsExplained: {
      true_positive: 'The alert was correct - actual suspicious/theft activity',
      false_positive: 'The alert was incorrect - normal behavior incorrectly flagged',
      uncertain: 'Unable to determine if the alert was correct',
    },
  })
}
