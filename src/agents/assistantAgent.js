import { groqChat } from '../lib/groq';

const SYSTEM_PROMPT = `You are a helpful and intelligent AI assistant for a university campus Lost & Found application.
Your goal is to understand the user's intent from their message and guide them appropriately.

You MUST always return a valid JSON object matching this schema:
{
  "intent": "report_lost" | "report_found" | "search" | "general" | "help",
  "reply": "A friendly, concise reply to the user (max 2 sentences)",
  "suggested_action": {
    "label": "Button Text",
    "link": "URL path to navigate to (e.g., /report-lost, /report-found, /search)"
  },
  "prefill_data": {
    "category": "Extracted category (e.g., Electronics, Keys, Wallet) or null",
    "color": "Extracted color or null",
    "location": "Extracted location or null"
  }
}

Example:
User: "I lost my blue wallet at the library"
Output:
{
  "intent": "report_lost",
  "reply": "I'm sorry to hear that! I can help you report your lost wallet right now.",
  "suggested_action": {
    "label": "Report Lost Item",
    "link": "/report-lost"
  },
  "prefill_data": {
    "category": "Wallet",
    "color": "blue",
    "location": "library"
  }
}

Only return the JSON. No markdown ticks, no extra text.`;

export const analyzeUserMessage = async (message) => {
  try {
    const content = await groqChat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ], 'llama3-8b-8192', 0.1);
    
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('AI Assistant Error:', err);
    return {
      intent: 'general',
      reply: 'I seem to be having trouble connecting. Please try navigating using the menu on the left.',
      suggested_action: null,
      prefill_data: {}
    };
  }
};
