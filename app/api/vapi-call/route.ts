import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventDescription, timestamp, location } = body

    const vapiApiKey = process.env.VAPI_API_KEY
    const vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID

    if (!vapiApiKey) {
      return NextResponse.json(
        { error: "VAPI_API_KEY not configured" },
        { status: 500 }
      )
    }

    if (!vapiPhoneNumberId) {
      return NextResponse.json(
        { error: "VAPI_PHONE_NUMBER_ID not configured" },
        { status: 500 }
      )
    }

    // Target phone number
    const customerNumber = "+16693609914"

    // Create the system prompt with the event details
    const systemPrompt = `You are an AI security monitoring assistant from KIMSTORE Security. You are making an urgent security alert call.

CRITICAL ALERT DETAILS:
- Event: ${eventDescription}
- Time detected: ${timestamp || "Just now"}
- Location: ${location || "Security camera feed"}

Your task:
1. Immediately identify yourself: "This is an automated security alert from KIMSTORE Security."
2. Clearly state the emergency: Describe what was detected in a calm but urgent manner.
3. Ask if they want more details or if they're dispatching security/authorities.
4. Offer to stay on the line or provide a callback number.
5. Be concise and professional - this is an emergency call.

Keep responses brief and focused. The recipient needs actionable information quickly.`

    const firstMessage = `This is an automated security alert from KIMSTORE Security. We've detected a dangerous situation: ${eventDescription}. This was detected at ${timestamp || "just now"} on your security feed. Do you need me to provide more details or should I wait while you dispatch security?`

    const callData = {
      assistant: {
        firstMessage: firstMessage,
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt
            }
          ]
        },
        voice: {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel - professional female voice
        },
        endCallFunctionEnabled: true,
        endCallMessage: "Security alert call complete. Stay safe.",
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 120
      },
      phoneNumberId: vapiPhoneNumberId,
      customer: {
        number: customerNumber
      }
    }

    console.log("Initiating Vapi call to:", customerNumber)
    console.log("Event:", eventDescription)

    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vapiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(callData)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Vapi API error:", errorData)
      return NextResponse.json(
        { error: "Failed to initiate call", details: errorData },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log("Vapi call initiated successfully:", result)

    return NextResponse.json({
      success: true,
      message: "Security alert call initiated",
      callId: result.id
    })

  } catch (error: any) {
    console.error("Error initiating Vapi call:", error)
    return NextResponse.json(
      { error: error.message || "Failed to initiate call" },
      { status: 500 }
    )
  }
}
