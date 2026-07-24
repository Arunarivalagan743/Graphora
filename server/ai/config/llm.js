import { GROQ_API_KEY, GROQ_MODEL } from '../../config.js';

/**
 * Calls Groq API using Llama 3.3 70B Versatile or specified Llama models.
 */
export async function callGroqLlama({ systemPrompt, userPrompt, temperature = 0.1, model = GROQ_MODEL }) {
  const apiKey = GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in server/.env.');
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const bodyPayload = {
    model: model || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    max_tokens: 2048,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || `Groq Llama API returned error status ${response.status}`);
  }

  const text = result.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Empty response received from Groq Llama API.');
  }

  return text.trim();
}

/**
 * Calls Google Gemini LLM API
 */
export async function callGeminiLLM({ systemPrompt, userPrompt, temperature = 0.1, jsonMode = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured on the server.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
    }
  ];

  const generationConfig = {
    temperature,
    maxOutputTokens: 2048,
  };

  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || 'Gemini LLM API returned an error.');
  }

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response received from Gemini LLM API.');
  }

  return text.trim();
}

/**
 * Unified LLM Dispatcher
 * Prefers Groq Llama 3.3 70B if GROQ_API_KEY is available for ultra-fast inference,
 * with fallback to Gemini API.
 */
export async function callLLM({ systemPrompt, userPrompt, temperature = 0.1, jsonMode = false }) {
  const hasGroqKey = Boolean(GROQ_API_KEY || process.env.GROQ_API_KEY);
  if (hasGroqKey) {
    try {
      return await callGroqLlama({ systemPrompt, userPrompt, temperature });
    } catch (err) {
      console.warn('[LLM Dispatcher] Groq Llama call failed, falling back to Gemini:', err.message);
    }
  }

  return await callGeminiLLM({ systemPrompt, userPrompt, temperature, jsonMode });
}
