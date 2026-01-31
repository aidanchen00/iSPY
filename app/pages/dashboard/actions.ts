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

        // Build prompt without template literals to avoid regex conflicts
        let promptText = "You are an advanced retail theft detection AI. Analyze this frame and report EVERYTHING you see happening.\n\n";
        promptText += "**YOUR JOB:**\n";
        promptText += "1. **ALWAYS describe what the person is doing** - don't return empty events unless the frame is completely empty\n";
        promptText += "2. **Be VERY SPECIFIC** about items - name them (oranges, Oreos, chips, candy, bottles, etc.)\n";
        promptText += "3. **Watch for these THEFT BEHAVIORS** and flag as isDangerous: true:\n";
        promptText += "   - Reaching for/picking up an item from a shelf or surface\n";
        promptText += "   - Holding an item in their hand\n";
        promptText += "   - Looking around suspiciously while holding items\n";
        promptText += "   - Placing ANY item into a bag, pocket, purse, backpack, or under clothing\n";
        promptText += "   - Concealing items in any way\n";
        promptText += "   - Moving items from one hand to another near a bag\n";
        promptText += "   - Touching or handling items without a shopping basket/cart\n";
        promptText += "   - Any furtive or suspicious movements with products\n\n";
        promptText += "4. **Be AGGRESSIVE** - if you see someone interacting with products in ANY suspicious way, flag it as isDangerous: true\n\n";
        promptText += "**WHAT TO REPORT:**\n";
        promptText += "- \"Person reaching for [specific item] on shelf\" → isDangerous: true\n";
        promptText += "- \"Person holding [specific item] in hand\" → isDangerous: true\n";
        promptText += "- \"Person placing [specific item] into bag\" → isDangerous: true\n";
        promptText += "- \"Person concealing [specific item] in pocket\" → isDangerous: true\n";
        promptText += "- \"Person holding [specific item] and looking around\" → isDangerous: true\n";
        promptText += "- \"Suspicious behavior with [specific item]\" → isDangerous: true\n\n";
        promptText += "**EXAMPLES:**\n";
        promptText += "- If you see oranges: \"Person picking up oranges from display\" or \"Person placing oranges into bag\"\n";
        promptText += "- If you see Oreos: \"Person holding Oreo package\" or \"Person concealing Oreos in backpack\"\n";
        promptText += "- If you see ANY product being handled: \"Person handling [product name]\" or \"Person taking [product name]\"\n\n";
        promptText += "**IMPORTANT:**\n";
        promptText += "- ALWAYS name the specific item if you can see it (oranges, chips, candy, etc.)\n";
        promptText += "- ALWAYS create an event if you see any person-product interaction\n";
        promptText += "- Be SENSITIVE to theft - flag anything that looks like concealment or unauthorized taking\n";
        promptText += "- If someone is on camera and doing ANYTHING with products, report it\n\n";

        if (transcript) {
            promptText += 'Audio transcript: "' + transcript + '"\n\n';
        }

        promptText += "Return ONLY valid JSON:\n\n";
        promptText += '{\n';
        promptText += '    "events": [\n';
        promptText += '        {\n';
        promptText += '            "timestamp": "00:00",\n';
        promptText += '            "description": "Detailed description of what person is doing with specific item names",\n';
        promptText += '            "isDangerous": true\n';
        promptText += '        }\n';
        promptText += '    ]\n';
        promptText += '}\n\n';
        promptText += 'If you see NOTHING happening (empty room, no people, no activity), return {"events": []}.\n';
        promptText += 'If you see a person, ALWAYS report what they\'re doing, even if just "Person visible in frame".';

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an aggressive retail theft detection AI. You MUST respond ONLY with valid JSON. Your job is to detect and report ALL suspicious behavior involving products. Be VERY sensitive to theft - flag any interaction with items. Always name specific products when visible. Never return empty events if a person is visible."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: promptText },
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

            // Try to parse JSON directly since we're using response_format: json_object
            try {
                const parsed = JSON.parse(text);
                return {
                    events: Array.isArray(parsed.events) ? parsed.events : [],
                    rawResponse: text
                };
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                console.error('Failed JSON string:', text);
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
