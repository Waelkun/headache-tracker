import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { parseJson, runAi } from '../_shared/ai-providers.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const interventionTypes = ['medication', 'coffee', 'sleep', 'rest', 'head_wrap', 'water', 'dark_room', 'custom']
const regions = ['front_right', 'front_left', 'front_center', 'back_right', 'back_left', 'back', 'top_right', 'top_left', 'top', 'right', 'left', 'center', null]

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    onsetKind: { type: 'string', enum: ['sudden', 'gradual', 'on_waking', 'unknown'] },
    intensity: { type: ['integer', 'null'], minimum: 0, maximum: 10 },
    characters: { type: 'array', items: { type: 'string', enum: ['pulsing', 'pressure', 'sharp', 'tight'] } },
    interventions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: interventionTypes },
          name: { type: ['string', 'null'] },
          amount: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
        },
        required: ['type', 'name', 'amount', 'unit'],
      },
    },
    region: { type: ['string', 'null'], enum: regions },
    followups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['intensity', 'location', 'onset', 'medication_name', 'amount', 'duration'] },
          target: { type: ['string', 'null'] },
          question: { type: 'string' },
        },
        required: ['type', 'target', 'question'],
      },
    },
  },
  required: ['onsetKind', 'intensity', 'characters', 'interventions', 'region', 'followups'],
}

const examples = `Examples (note how missing required details become followups the app will ask the user):
Input (AR): "صحيت على وجع خفيف قدام عاليمين، وبعدين صار نبض ووصل 8 من 10، أخدت بنادول ونمت شوي."
Output: {"onsetKind":"on_waking","intensity":8,"characters":["pulsing"],"interventions":[{"type":"medication","name":"بنادول","amount":null,"unit":"tablet"},{"type":"sleep","name":null,"amount":null,"unit":"hour"}],"region":"front_right","followups":[{"type":"amount","target":"medication","question":"كم حبة أخدت من بنادول؟"},{"type":"duration","target":"sleep","question":"قديش نمت؟"}]}
Input (EN): "Took some medicine and it got a bit better."
Output: {"onsetKind":"unknown","intensity":null,"characters":[],"interventions":[{"type":"medication","name":null,"amount":null,"unit":"tablet"}],"region":null,"followups":[{"type":"medication_name","target":"medication","question":"Which medicine did you take?"},{"type":"amount","target":"medication","question":"How many did you take?"},{"type":"intensity","target":null,"question":"How intense was it, out of 10?"},{"type":"location","target":null,"question":"Where exactly did it hurt? Mark it on the 3D head."}]}`

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
  try {
    const { text, locale = 'ar' } = await request.json()
    if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
      return Response.json({ error: 'Text must contain 1 to 5000 characters' }, { status: 400, headers: cors })
    }
    const result = await runAi({
      system: `Extract structured fields from one headache diary entry written in Arabic (often colloquial Levantine) or English. Do not diagnose, recommend treatment, or invent facts. Use "unknown" for onsetKind and null / empty arrays when a detail is absent. "intensity" is the most recent 0–10 level or null. Each intervention is an object; set "name" only for a specifically named medicine/activity, and leave "amount" null when the dose or duration is not stated. "region" is the single best-matching location code or null — never guess a precise spot the user did not describe. Then build "followups": one short question in the user's language for EACH required-but-missing detail — a medicine with no name (medication_name), a medicine with no dose (amount), a time-based activity with no duration (duration), a missing intensity, and a missing location (tell them to mark it on the 3D head). Do not ask about details already provided. User interface locale: ${locale}.\n${examples}`,
      prompt: text,
      schema,
    })
    return Response.json({ parsed: parseJson(result.text), provider: result.provider, model: result.model }, { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('AI provider cascade failed:', error instanceof Error ? error.message : 'Unknown error')
    return Response.json({ error: 'AI providers are unavailable' }, { status: 503, headers: cors })
  }
})
