import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

const OpportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["question", "memory", "generative"]),
      trigger: z.string(),
      content: z.string(),
      explanation: z.string(),
      timestamp: z.number(),
    }),
  ),
})

export async function POST(req: Request) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY

  if (!OPENAI_KEY) {
    console.warn("OpenAI API key missing – skipping opportunity analysis and returning empty list.")
    return Response.json({ opportunities: [] })
  }

  try {
    const { transcript } = await req.json()

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: OpportunitySchema,
      prompt: `
        Analyze this conversation transcript and identify opportunities for assistance. 
        Look for these specific types:
        
        1. QUESTION/UNKNOWN: When speakers express ignorance or ask questions they don't know the answer to
           - Examples: "I wonder if...", "Do you know...", "Is there a way to..."
        
        2. MEMORY RETRIEVAL: When speakers try to recall something specific but can't fully remember
           - Examples: "I saw this article...", "There was this study...", "I read somewhere..."
        
        3. GENERATIVE MOMENT: When speakers engage in "what if" scenarios or imagine something that doesn't exist
           - Examples: "What if we could...", "Imagine if...", "Picture this..."
        
        For each opportunity found:
        - Generate helpful content (search results, explanations, or creative descriptions)
        - Explain why this card appeared based on what was said
        - Make it contextually relevant and unobtrusive
        
        Transcript: "${transcript}"
        
        Only return opportunities that are clearly identifiable and would genuinely help the conversation.
        If no clear opportunities exist, return an empty array.
      `,
    })

    // Add timestamps to opportunities
    const opportunitiesWithTimestamps = result.object.opportunities.map((opp) => ({
      ...opp,
      timestamp: Date.now(),
    }))

    return Response.json({
      opportunities: opportunitiesWithTimestamps,
    })
  } catch (error) {
    console.error("Error analyzing opportunities:", error)
    return Response.json({ opportunities: [] })
  }
}
