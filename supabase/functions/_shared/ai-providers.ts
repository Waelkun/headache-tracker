export type AiResult = { text: string; provider: 'gemini' | 'nvidia' | 'openrouter'; model: string }

type RunOptions = {
  system: string
  prompt: string
  schema: Record<string, unknown>
  fallbackTextKey?: string
}

const timeout = () => AbortSignal.timeout(20_000)

async function callGemini(options: RunOptions): Promise<AiResult> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('Gemini is not configured')
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: timeout(),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseJsonSchema: options.schema,
      },
    }),
  })
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`)
  const body = await response.json()
  const text = body.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
  if (!text) throw new Error('Gemini returned no text')
  return { text, provider: 'gemini', model }
}

async function callNvidia(options: RunOptions): Promise<AiResult> {
  const key = Deno.env.get('NVIDIA_API_KEY')
  if (!key) throw new Error('NVIDIA is not configured')
  const model = Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    signal: timeout(),
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: `${options.system}\nReturn only valid JSON matching this schema: ${JSON.stringify(options.schema)}` }, { role: 'user', content: options.prompt }],
      max_tokens: 800,
      temperature: 0.2,
      top_p: 0.95,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
  })
  if (!response.ok) throw new Error(`NVIDIA returned ${response.status}`)
  const body = await response.json()
  const text = body.choices?.[0]?.message?.content
  if (!text) throw new Error('NVIDIA returned no text')
  return { text, provider: 'nvidia', model }
}

async function callOpenRouter(options: RunOptions): Promise<AiResult> {
  const key = Deno.env.get('OPENROUTER_API_KEY')
  if (!key) throw new Error('OpenRouter is not configured')
  const model = Deno.env.get('OPENROUTER_MODEL') || 'minimax/minimax-m3:free'
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: timeout(),
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Headache Tracker' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: `${options.system}\nReturn only valid JSON matching this schema: ${JSON.stringify(options.schema)}` }, { role: 'user', content: options.prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0.1,
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`)
  const body = await response.json()
  const text = body.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenRouter returned no text')
  return { text, provider: 'openrouter', model: body.model || model }
}

export function parseJson(text: string) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Provider returned invalid JSON')
  }
}

export async function runAi(options: RunOptions): Promise<AiResult> {
  const failures: string[] = []
  for (const provider of [callGemini, callNvidia, callOpenRouter]) {
    try {
      const result = await provider(options)
      try {
        const parsed = parseJson(result.text)
        return { ...result, text: JSON.stringify(parsed) }
      } catch (error) {
        if (options.fallbackTextKey) {
          const plainText = result.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
          if (plainText) return { ...result, text: JSON.stringify({ [options.fallbackTextKey]: plainText }) }
        }
        throw error
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'Unknown provider error')
    }
  }
  throw new Error(`No AI provider available: ${failures.join('; ')}`)
}
