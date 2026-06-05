/**
 * Agent 1: Item Analysis Agent
 *
 * Uses Groq LLM to analyze a user's item description and extract
 * structured metadata: category, color, brand, keywords, location.
 *
 * This enriched data is used downstream by the Matching Agent.
 */
import { groqChat } from '../lib/groq';

const SYSTEM_PROMPT = `You are an AI assistant specialized in analyzing lost and found item descriptions.
Your job is to extract structured information from item descriptions.
Always respond with valid JSON only. No markdown, no explanation, just the raw JSON object.`;

const buildUserPrompt = (title, description) => `
Analyze the following lost/found item and extract structured metadata.

Title: "${title}"
Description: "${description}"

Return a JSON object with exactly these fields:
{
  "category": "one of: Electronics, Accessories, Personal, Clothing, Books, Sports, Other",
  "color": "primary color of the item, or null if unknown",
  "brand": "brand/manufacturer if mentioned, or null",
  "keywords": ["array", "of", "3-6", "key", "search", "terms"],
  "location": "location if mentioned in description, or null"
}

Only return the JSON. No explanation.`;

export const runItemAnalysisAgent = async (title, description) => {
  try {
    console.log('[ItemAnalysisAgent] Analyzing item:', title);

    const content = await groqChat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(title, description) },
    ], 'llama3-8b-8192', 0.1);

    // Strip any accidental markdown code fences
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    console.log('[ItemAnalysisAgent] Result:', parsed);
    return { success: true, data: parsed };
  } catch (error) {
    console.error('[ItemAnalysisAgent] Error:', error.message);
    return { success: false, data: null, error: error.message };
  }
};
