import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { parseJson, runAi } from '../_shared/ai-providers.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: { answer: { type: 'string', minLength: 1, maxLength: 1200 } },
  required: ['answer'],
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
  try {
    const { question, locale = 'ar', episodes, summary } = await request.json()
    if (typeof question !== 'string' || !question.trim() || question.length > 1000 || !Array.isArray(episodes) || episodes.length > 200) {
      return Response.json({ error: 'Invalid question or episode data' }, { status: 400, headers: cors })
    }
    const lang = locale === 'ar' ? 'Arabic (use the same colloquial tone the user writes in)' : 'English'
    const result = await runAi({
      system: [
        `You are a careful data analyst for one person's self-recorded headache diary. Answer ONLY from the supplied data, in ${lang}.`,
        `Two inputs are provided: (1) "summary" — pre-computed aggregates you should trust and quote directly (counts, averages, weekday_counts indexed Sunday=0..Saturday=6, onset_counts, and per-intervention effect tallies where rated = how many uses were rated, helped = much/slightly better, worse, no_change); (2) "episodes" — the raw records for detail and for questions the summary does not cover.`,
        `Rules: Prefer the summary for totals and "what helped" questions — base effectiveness only on rated uses and always state the fraction (e.g. "3 of 5 rated uses"). A location record is a timestamped snapshot of where pain was marked; compare ordered location records to describe how pain moved. Region is the human-readable location; centroid is supporting 3D data.`,
        `Be concise (1–3 sentences). Always ground claims in numbers and mention the sample size or limited confidence when the data is thin. Never diagnose, never predict with certainty, never recommend starting/stopping/changing medication. If the data cannot answer, say so plainly and suggest what to log next.`,
      ].join('\n'),
      prompt: `Question: ${question}\n\nSummary: ${JSON.stringify(summary ?? {})}\n\nEpisodes: ${JSON.stringify(episodes)}`,
      schema,
      fallbackTextKey: 'answer',
    })
    return Response.json({ ...parseJson(result.text), provider: result.provider, model: result.model }, { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('AI provider cascade failed:', error instanceof Error ? error.message : 'Unknown error')
    return Response.json({ error: 'AI providers are unavailable' }, { status: 503, headers: cors })
  }
})
