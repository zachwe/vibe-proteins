import { Hono } from "hono";
import OpenAI from "openai";
import { auth } from "../auth";

const app = new Hono();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ScoreData {
  ipsae?: number;
  pdockq?: number;
  iptm?: number;
  plddt?: number;
  lis?: number;
  n_interface_contacts?: number;
  interface_area?: number;
}

interface SuggestionRequest {
  jobType: string;
  scores: ScoreData;
  hasHotspots: boolean;
  challengeName?: string;
  challengeTaskType?: string;
}

// POST /api/suggestions - Get LLM-powered next best action suggestions
app.post("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!process.env.OPENAI_API_KEY) {
    return c.json({ error: "OpenAI API key not configured" }, 500);
  }

  const body = await c.req.json() as SuggestionRequest;
  const { jobType, scores, hasHotspots, challengeName, challengeTaskType } = body;

  // Build context for the LLM
  const scoresSummary = Object.entries(scores)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(3) : v}`)
    .join(", ");

  const prompt = `You are an expert protein design advisor helping a beginner user on a protein design platform. The user just ran a ${jobType} job for the "${challengeName || "unknown"}" challenge (task type: ${challengeTaskType || "binder"}).

Their results:
${scoresSummary || "No scores available yet"}
${hasHotspots ? "They selected specific hotspot residues for targeting." : "They did not select specific hotspots (used automatic mode)."}

Based on these results, provide 2-3 short, actionable suggestions for what the user should do next. Consider:

Score interpretation guidelines:
- ipSAE: Lower is better (< -0.7 is good, > -0.4 is poor)
- pDockQ: Higher is better (> 0.5 is good, < 0.23 is poor)
- ipTM: Higher is better (> 0.7 is good, < 0.5 is poor)
- pLDDT: Higher is better (> 90 is excellent, < 70 is poor)
- LIS: Higher is better (> 0.7 is good)
- Interface contacts: More is generally better (> 100 is good)

Possible suggestions:
- If scores are poor: suggest trying different hotspots, or running with different parameters
- If scores are moderate: suggest running Boltz-2 to verify the structure prediction
- If scores are good: encourage submitting for official scoring
- If no hotspots were used: suggest trying the recommended hotspots for more targeted binding
- Consider suggesting they learn more about the target protein

Format your response as a JSON array of suggestion objects with "text" and "type" fields.
Type can be: "improve" (for suggestions to improve the design), "verify" (for validation steps), "success" (for positive feedback), or "learn" (for educational suggestions).

Example format:
[
  {"text": "Your pDockQ score of 0.62 indicates strong predicted binding. Consider submitting this design for official scoring!", "type": "success"},
  {"text": "Try running Boltz-2 to verify how the complex actually folds together.", "type": "verify"}
]

Respond ONLY with the JSON array, no other text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || "[]";

    // Parse the JSON response
    let suggestions: Array<{ text: string; type: string }>;
    try {
      suggestions = JSON.parse(responseText);
    } catch {
      // If parsing fails, return a generic suggestion
      suggestions = [
        {
          text: "Review your scores and consider adjusting your design parameters for better results.",
          type: "improve",
        },
      ];
    }

    return c.json({ suggestions });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return c.json({ error: "Failed to generate suggestions" }, 500);
  }
});

export default app;
