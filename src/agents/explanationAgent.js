/**
 * Agent 4: Explanation Agent
 *
 * Uses Groq's LLM to generate a human-readable explanation of why two items
 * were matched together. Called on-demand when a user clicks "Explain" in the
 * Match Center.
 *
 * Model: llama-3.1-8b-instant (fast, good quality for short explanations)
 */
import { groqChat } from '../lib/groq';

const SYSTEM_PROMPT = `You are a helpful AI assistant for a campus Lost & Found system.
Your job is to explain in a friendly, concise way why two items (one lost, one found) 
were flagged as a potential match. Be specific about which fields matched.
Keep your explanation to 2-3 sentences maximum. Be conversational and helpful.`;

const buildExplanationPrompt = (lostItem, foundItem, confidenceScore) => `
A lost item and a found item have been matched with ${confidenceScore}% confidence.

LOST ITEM:
- Title: ${lostItem.title}
- Category: ${lostItem.category || 'Unknown'}
- Color: ${lostItem.color || 'Unknown'}
- Location: ${lostItem.location || 'Unknown'}
- Description: ${lostItem.description || 'No description'}

FOUND ITEM:
- Title: ${foundItem.title}
- Category: ${foundItem.category || 'Unknown'}
- Color: ${foundItem.color || 'Unknown'}
- Location: ${foundItem.location || 'Unknown'}
- Description: ${foundItem.description || 'No description'}

In 2-3 sentences, explain why these items were matched. Be specific about which 
details (category, color, location, description) were similar and led to this match.`;

export const runExplanationAgent = async (lostItem, foundItem, confidenceScore) => {
  try {
    console.log('[ExplanationAgent] Generating explanation for match...');

    const explanation = await groqChat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildExplanationPrompt(lostItem, foundItem, confidenceScore) },
    ], 'llama3-8b-8192', 0.5);

    console.log('[ExplanationAgent] Explanation generated.');
    return { success: true, explanation: explanation.trim() };
  } catch (error) {
    console.error('[ExplanationAgent] Error:', error.message);
    return {
      success: false,
      explanation: 'Could not generate explanation at this time.',
      error: error.message,
    };
  }
};
