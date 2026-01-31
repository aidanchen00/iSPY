"use server";

import OpenAI from "openai";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
}
const openai = new OpenAI({ apiKey: API_KEY });

export interface VideoEvent {
    timestamp: string;
    description: string;
    isDangerous: boolean;
}

export async function detectEvents(base64Image: string, transcript: string = ''): Promise<{ events: VideoEvent[], rawResponse: string }> {
    console.log('Starting frame analysis...');
    try {
        if (!base64Image) {
            throw new Error("No image data provided");
        }

        console.log('Sending image to OpenAI API...');
        const prompt = `Analyze this security camera frame.

**INCIDENT RULE — ONLY FLAG WHEN THERE IS PROOF:**
- Having a bag or carrying items is OK. Do NOT flag "person holding a bag" or "carrying items" by itself.
- ONLY create an incident (isDangerous: true) when you see proof of:
  1) **Placing something INTO a bag, pocket, or under clothing** — describe as "Placing [item/object] into bag" or "Placing item into pocket/clothing." Say what is being placed only if clearly visible (e.g. "Placing item into bag"); do NOT name the specific product (no "oranges" or "mandarins").
  2) **Visible concealment** — bulge under shirt/jacket, item being hidden in clothing. Describe as "Possible concealment under clothing" or "Placing item under clothing."

If the person only has a bag or is only carrying items and is NOT placing anything into the bag/clothing, do NOT add an event with isDangerous: true.

**1. Retail / placing into bag (only flag if proof of placing into bag/clothing):**
- Is the person actively placing or putting an item into a bag, pocket, or under clothing? → isDangerous: true, description: "Placing item into bag" or "Placing item into pocket" (add what is being placed only if clearly visible; use "item" or "object," not product names).
- Visible concealment under clothing? → isDangerous: true.

**2. Medical:** Unconscious, clutching chest, seizures, choking → isDangerous: true.

**3. Falls/Injuries:** Falling, on ground, bleeding → isDangerous: true.

**4. Distress:** Calling for help, fainting → isDangerous: true.

**5. Violence/Threats:** Altercation, weapons → isDangerous: true.

**6. Other:** Vandalism, trespassing → isDangerous: true.
${transcript ? `Consider this audio transcript: "${transcript}"
` : ''}
Return ONLY valid JSON in this format:

{
    "events": [
        {
            "timestamp": "mm:ss",
            "description": "e.g. Placing item into bag — only for proof of placing into bag/clothing; do not accuse for just having a bag",
            "isDangerous": true
        }
    ]
}
Remember: isDangerous true ONLY for placing into bag/clothing (with proof), concealment under clothing, medical, falls, violence, or other dangerous behavior. NOT for simply holding a bag or carrying items.`;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a security camera analysis system. You MUST respond ONLY with valid JSON in the exact format specified. Never respond with explanatory text, apologies, or refusals. If you cannot analyze the image, return an empty events array."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: base64Image,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 1000,
                response_format: { type: "json_object" },
            });

            const text = response.choices[0]?.message?.content || "";
            console.log('Raw API Response:', text);

            // Check if response is empty or null
            if (!text || text.trim().length === 0) {
                console.log('Empty response from API, returning empty events');
                return {
                    events: [],
                    rawResponse: "No content in API response"
                };
            }

            // Check if the response is a refusal or non-JSON response
            if (text.includes("I'm sorry") || text.includes("I cannot") || text.includes("I can't")) {
                console.log('API refused to process image, returning empty events');
                return {
                    events: [],
                    rawResponse: "No events detected in this frame"
                };
            }

            // Try to extract JSON from the response, handling potential code blocks
            let jsonStr = text.trim();

            // First try to extract content from code blocks if present
            const codeBlockMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1];
                console.log('Extracted JSON from code block:', jsonStr);
            } else if (!jsonStr.startsWith('{')) {
                // If no code block and doesn't start with {, try to find raw JSON
                const jsonMatch = text.match(/\{[^]*\}/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[0];
                    console.log('Extracted raw JSON:', jsonStr);
                } else {
                    // No JSON found at all
                    console.log('No JSON found in response, returning empty events');
                    return {
                        events: [],
                        rawResponse: text
                    };
                }
            }

            // Final check before parsing
            if (!jsonStr || jsonStr.trim().length === 0) {
                console.log('Empty JSON string, returning empty events');
                return {
                    events: [],
                    rawResponse: text
                };
            }

            try {
                const parsed = JSON.parse(jsonStr);
                return {
                    events: Array.isArray(parsed.events) ? parsed.events : [],
                    rawResponse: text
                };
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                console.error('Failed JSON string:', jsonStr);
                console.log('Attempting to return empty events due to parse error');
                // Return empty events instead of throwing error
                return {
                    events: [],
                    rawResponse: text || "Failed to analyze frame"
                };
            }

        } catch (error) {
            console.error('Error calling API:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in detectEvents:', error);
        throw error;
    }
}
