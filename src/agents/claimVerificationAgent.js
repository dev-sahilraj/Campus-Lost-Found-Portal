/**
 * AI Claim Verification Agent
 *
 * Step 1: generateVerificationQuestions()
 *   → Sends item details to Groq LLM
 *   → Returns 3–5 smart, item-specific questions that only the true owner can answer
 *
 * Step 2: evaluateAnswers()
 *   → Sends questions + answers back to Groq
 *   → Returns { score, evaluation, reasoning }
 */
import { groqChat } from '../lib/groq';

/* ── Question Generator ─────────────────────────────────────────────── */
const QUESTION_SYSTEM_PROMPT = `You are a forensic verification AI for a campus Lost & Found system.
Your job is to generate smart, specific verification questions that ONLY the true owner of a lost item can answer.

Rules:
- Questions must be answerable only with personal knowledge of the item
- Avoid generic questions (e.g., "What color is it?" since this is already public)
- Focus on private details: contents, personal markings, software, settings, habits
- Generate exactly 3 questions
- Return a JSON array of strings only — no markdown, no extra text`;

export const generateVerificationQuestions = async (item) => {
  const prompt = `Generate 3 owner-verification questions for this ${item.category} item:

Title: ${item.title}
Category: ${item.category}
Color: ${item.color || 'Unknown'}
Description: ${item.description || 'No description'}
Location lost: ${item.location || 'Unknown'}

Examples of good questions by category:
- Wallet/Bag: "What cards or IDs were inside?", "Describe any receipts or notes inside"
- Laptop/Phone: "What is the desktop wallpaper?", "What apps are on the home screen?", "What is the device name in Settings?"
- Notebook/Book: "What is written on the first page?", "What subject/class is it for?"
- Keys: "How many keys are on the keychain?", "Describe any keychains or tags attached"
- Headphones: "What was the last song/podcast played?", "What is the Bluetooth device name?"

Now generate 3 questions specific to the item above. Return only a JSON array of strings.`;

  try {
    const content = await groqChat(
      [{ role: 'system', content: QUESTION_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      'llama3-8b-8192', 0.4
    );
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(cleaned);
    console.log('[ClaimVerificationAgent] Questions generated:', questions);
    return { success: true, questions };
  } catch (err) {
    console.error('[ClaimVerificationAgent] Question generation failed:', err.message);
    // Fallback questions
    return {
      success: true,
      questions: [
        `Describe a unique or personal marking on the ${item.title}.`,
        `What is the approximate purchase date or how old is the item?`,
        `Where did you last use or see this item before losing it?`,
      ]
    };
  }
};

/* ── Answer Evaluator ───────────────────────────────────────────────── */
const EVAL_SYSTEM_PROMPT = `You are an AI verification evaluator for a Lost & Found claim system.
Your job is to evaluate how well a claimant's answers match what the true owner would know.

Be strict but fair. Consider partial answers, paraphrasing, and honest uncertainty.
Return a JSON object with exactly these fields:
{
  "score": <integer 0-100>,
  "verdict": "verified" | "likely" | "uncertain" | "suspicious",
  "reasoning": "<one paragraph explaining your verdict>",
  "per_question": [
    { "question": "...", "answer": "...", "score": <0-10>, "comment": "..." }
  ]
}

Only return the JSON. No markdown.`;

export const evaluateClaimAnswers = async (item, questions, answers) => {
  const qa = questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i] || '(no answer)'}`).join('\n\n');

  const prompt = `Evaluate this ownership claim for a ${item.category} item.

Item: ${item.title}
Description: ${item.description || 'N/A'}

Questions and Answers:
${qa}

Score the answers strictly. A true owner should know specific, private details.
Vague or very generic answers should score low.`;

  try {
    const content = await groqChat(
      [{ role: 'system', content: EVAL_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      'llama3-8b-8192', 0.2
    );
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    console.log('[ClaimVerificationAgent] Evaluation:', result.score, result.verdict);
    return { success: true, ...result };
  } catch (err) {
    console.error('[ClaimVerificationAgent] Evaluation failed:', err.message);
    return { success: false, score: 0, verdict: 'uncertain', reasoning: 'Evaluation could not be completed.', per_question: [] };
  }
};
