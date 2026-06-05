const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const groqChat = async (messages, model = 'llama3-8b-8192', temperature = 0.3) => {
  if (!GROQ_API_KEY) throw new Error('Groq API key is not configured');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Groq API request failed');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
};
