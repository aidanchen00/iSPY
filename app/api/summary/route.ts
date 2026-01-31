import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not found in environment variables')
  }
  return new OpenAI({ apiKey })
}

export async function POST(request: Request) {
  let openai
  try {
    openai = getOpenAIClient()
  } catch (error) {
    console.error('OpenAI client initialization error:', error)
    return NextResponse.json(
      { error: 'OpenAI API key not properly configured' },
      { status: 500 }
    )
  }

  try {
    const { keyMoments } = await request.json()

    // Format the key moments into a readable string
    const momentsText = keyMoments.map((moment: any) => 
      `Video: ${moment.videoName}\nTimestamp: ${moment.timestamp}\nDescription: ${moment.description}\nDangerous: ${moment.isDangerous ? 'Yes' : 'No'}\n`
    ).join('\n')

    const prompt = `You are an expert at analyzing video safety data. Provide concise, insightful summaries of video analysis data, focusing on safety patterns and potential concerns.

Here are the key moments from video analysis sessions. Please provide a concise summary of the important events and any safety concerns:

${momentsText}

Please format your response in this way:
1. Overall Summary (2-3 sentences)
2. Key Safety Concerns (if any)
3. Notable Patterns (if any)`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert at analyzing video safety data. Provide concise, insightful summaries focusing on safety patterns and concerns." },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
    })

    const text = response.choices[0]?.message?.content

    if (!text || text.trim().length === 0) {
      return NextResponse.json({
        summary: 'No summary could be generated. Please try again.'
      })
    }

    return NextResponse.json({
      summary: text
    })
  } catch (error: any) {
    console.error('Error generating summary:', error)
    const errorMessage = error.message || 'Failed to generate summary'
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
