export type EpisodeLike = {
  id: string
  started_at: string
  ended_at: string | null
  onset_kind: string
  status: string
  intensity_segments?: Array<{ intensity: number; started_at: string; ended_at: string | null }> | null
  episode_interventions?: Array<{ intervention_type: string; effect: string | null; label: string | null }> | null
}

const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_NAMES_AR = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7

export function episodeDurationHours(episode: EpisodeLike) {
  if (!episode.ended_at) return 0
  return Math.max(0, (new Date(episode.ended_at).getTime() - new Date(episode.started_at).getTime()) / 3_600_000)
}

export function maxIntensity(episode: EpisodeLike) {
  return Math.max(0, ...(episode.intensity_segments ?? []).map((entry) => entry.intensity))
}

export function buildOverview(episodes: EpisodeLike[]) {
  const completed = episodes.filter((episode) => episode.status === 'completed')
  const headacheDays = new Set(episodes.map((episode) => episode.started_at.slice(0, 10))).size
  const intensities = completed.flatMap((episode) => episode.intensity_segments ?? []).map((item) => item.intensity)
  const durations = completed.map(episodeDurationHours).filter(Boolean)
  return {
    headacheDays,
    averageIntensity: intensities.length ? intensities.reduce((sum, value) => sum + value, 0) / intensities.length : 0,
    averageDuration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0,
    totalHours: durations.reduce((sum, value) => sum + value, 0),
    strongest: Math.max(0, ...completed.map(maxIntensity)),
  }
}

export function buildWeekdayRisk(episodes: EpisodeLike[], locale: 'en' | 'ar') {
  const counts = Array.from({ length: 7 }, () => 0)
  const uniqueDays = new Set<string>()
  for (const episode of episodes) {
    const key = episode.started_at.slice(0, 10)
    if (uniqueDays.has(key)) continue
    uniqueDays.add(key)
    counts[mondayIndex(new Date(episode.started_at))] += 1
  }
  const today = mondayIndex(new Date())
  const max = Math.max(1, ...counts)
  const ratio = counts[today] / max
  const level = ratio >= 0.75 && counts[today] >= 2 ? 'high' : ratio >= 0.4 && counts[today] >= 1 ? 'medium' : 'low'
  const confidence = episodes.length >= 20 ? 'high' : episodes.length >= 8 ? 'medium' : 'limited'
  const names = locale === 'ar' ? DAY_NAMES_AR : DAY_NAMES_EN
  const topIndex = counts.indexOf(Math.max(...counts))
  return { counts, todayCount: counts[today], level, confidence, topDay: names[topIndex], sample: episodes.length }
}

export function countEpisodesInRange(episodes: EpisodeLike[], days: number) {
  const cutoff = Date.now() - days * 86_400_000
  return episodes.filter((episode) => new Date(episode.started_at).getTime() >= cutoff).length
}

// Local midnight of the Monday that begins the week containing `date`.
export function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  day.setDate(day.getDate() - mondayIndex(day))
  return day
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Counts episodes per weekday (Mon=0 … Sun=6) within the single week [weekStart, weekStart+7d).
export function buildWeekView(episodes: EpisodeLike[], weekStart: Date) {
  const start = weekStart.getTime()
  const end = start + 7 * 86_400_000
  const counts = Array.from({ length: 7 }, () => 0)
  for (const episode of episodes) {
    const time = new Date(episode.started_at).getTime()
    if (time < start || time >= end) continue
    counts[mondayIndex(new Date(episode.started_at))] += 1
  }
  return { counts, total: counts.reduce((sum, value) => sum + value, 0) }
}

// Monday of the earliest episode's week, or null when there are no episodes.
export function earliestWeekStart(episodes: EpisodeLike[]): Date | null {
  let earliest = Infinity
  for (const episode of episodes) {
    const time = new Date(episode.started_at).getTime()
    if (time < earliest) earliest = time
  }
  return Number.isFinite(earliest) ? startOfWeek(new Date(earliest)) : null
}

export function buildInterventionStats(episodes: EpisodeLike[]) {
  const map = new Map<string, { type: string; label: string | null; count: number; helped: number; noChange: number; worse: number; rated: number }>()
  for (const episode of episodes) {
    for (const item of episode.episode_interventions ?? []) {
      const label = item.label?.trim() || null
      const key = `${item.intervention_type}:${(label ?? '').toLowerCase()}`
      const entry = map.get(key) ?? { type: item.intervention_type, label, count: 0, helped: 0, noChange: 0, worse: 0, rated: 0 }
      entry.count += 1
      if (item.effect) {
        entry.rated += 1
        if (item.effect === 'much_better' || item.effect === 'slightly_better') entry.helped += 1
        else if (item.effect === 'worse') entry.worse += 1
        else if (item.effect === 'no_change') entry.noChange += 1
      }
      map.set(key, entry)
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

// Compact, pre-aggregated snapshot handed to the AI so it reasons over clean numbers
// instead of re-deriving them from raw rows.
export function buildAskSummary(episodes: EpisodeLike[], locale: 'en' | 'ar') {
  const overview = buildOverview(episodes)
  const risk = buildWeekdayRisk(episodes, locale)
  const onsetCounts: Record<string, number> = {}
  for (const episode of episodes) onsetCounts[episode.onset_kind] = (onsetCounts[episode.onset_kind] ?? 0) + 1
  const interventions = buildInterventionStats(episodes).slice(0, 12).map((item) => ({
    name: item.label || item.type, type: item.type, uses: item.count,
    rated: item.rated, helped: item.helped, no_change: item.noChange, worse: item.worse,
  }))
  return {
    total_episodes: episodes.length,
    completed_episodes: episodes.filter((episode) => episode.status === 'completed').length,
    headache_days: overview.headacheDays,
    average_intensity: Number(overview.averageIntensity.toFixed(1)),
    highest_intensity: overview.strongest,
    average_duration_hours: Number(overview.averageDuration.toFixed(1)),
    total_headache_hours: Number(overview.totalHours.toFixed(1)),
    weekday_counts: risk.counts,
    most_frequent_weekday: risk.topDay,
    onset_counts: onsetCounts,
    interventions,
  }
}

export function answerDataQuestion(question: string, episodes: EpisodeLike[], locale: 'en' | 'ar') {
  if (!episodes.length) return locale === 'ar' ? 'لسا ما في نوبات كافية حتى جاوب من بياناتك.' : 'There are not enough episodes yet to answer from your data.'
  const q = question.toLowerCase()
  const overview = buildOverview(episodes)
  const risk = buildWeekdayRisk(episodes, locale)
  const prefix = locale === 'ar' ? `بناءً على ${episodes.length} نوبة: ` : `Based on ${episodes.length} episodes: `

  if (/يوم|day|when|امتى/.test(q)) {
    return prefix + (locale === 'ar' ? `أكثر يوم تكرر فيه الصداع هو ${risk.topDay}.` : `Your most frequent headache day is ${risk.topDay}.`)
  }
  if (/شدة|قوي|intens|strong/.test(q)) {
    return prefix + (locale === 'ar' ? `أعلى شدة مسجلة هي ${overview.strongest} من 10.` : `Your highest recorded intensity is ${overview.strongest} out of 10.`)
  }
  if (/مدة|طول|duration|long/.test(q)) {
    return prefix + (locale === 'ar' ? `متوسط مدة النوبة ${overview.averageDuration.toFixed(1)} ساعة.` : `Your average episode lasts ${overview.averageDuration.toFixed(1)} hours.`)
  }
  if (/صحيت|استيقاظ|waking|woke/.test(q)) {
    const count = episodes.filter((episode) => episode.onset_kind === 'on_waking').length
    return prefix + (locale === 'ar' ? `${count} نوبات كانت موجودة وقت صحيت.` : `${count} episodes were present when you woke up.`)
  }
  if (/ساعد|نفع|فاد|خفف|أفضل|help|work|better|effect|relief/.test(q)) {
    const stats = buildInterventionStats(episodes).filter((item) => item.rated > 0)
    if (!stats.length) {
      return prefix + (locale === 'ar'
        ? 'ما في تقييمات كافية بعد. بعد ما تسجل علاج، حدّد إذا ساعد حتى نقدر نقارن.'
        : 'There are no effect ratings yet. After logging a treatment, mark whether it helped so results can be compared.')
    }
    const best = [...stats].sort((a, b) => (b.helped / b.rated) - (a.helped / a.rated) || b.rated - a.rated)[0]
    const name = best.label || best.type
    return prefix + (locale === 'ar'
      ? `أكثر شي ارتبط بتحسّن هو "${name}" (${best.helped} من ${best.rated} مرات مقيّمة).`
      : `The option most often followed by improvement is "${name}" (${best.helped} of ${best.rated} rated uses).`)
  }
  if (/بنادول|دواء|medic|panadol|قهوة|coffee|علاج|treat/.test(q)) {
    const stats = buildInterventionStats(episodes)
    const interventions = episodes.flatMap((episode) => episode.episode_interventions ?? [])
    const helpful = interventions.filter((item) => item.effect === 'much_better' || item.effect === 'slightly_better').length
    const top = stats[0]
    const topText = top ? (locale === 'ar' ? ` الأكثر استخداماً "${top.label || top.type}" (${top.count} مرة).` : ` Most used: "${top.label || top.type}" (${top.count}×).`) : ''
    return prefix + (locale === 'ar' ? `سجلت ${interventions.length} تدخلات، و${helpful} منها ارتبطت بتحسن.${topText}` : `You logged ${interventions.length} interventions, and ${helpful} were followed by improvement.${topText}`)
  }
  return prefix + (locale === 'ar'
    ? `عندك ${overview.headacheDays} أيام صداع، ومتوسط الشدة ${overview.averageIntensity.toFixed(1)} من 10.`
    : `You have ${overview.headacheDays} headache days with an average intensity of ${overview.averageIntensity.toFixed(1)} out of 10.`)
}

export type ParsedIntervention = { type: string; name: string | null; amount: number | null; unit: string | null }
export type Followup = { type: 'intensity' | 'location' | 'onset' | 'medication_name' | 'amount' | 'duration'; target: string | null; question: string }
export type ParsedNote = {
  onsetKind: string
  intensity: number | null
  characters: string[]
  interventions: ParsedIntervention[]
  region: string | null
  note: string
  followups: Followup[]
}

const UNIT_BY_TYPE: Record<string, string> = { medication: 'tablet', coffee: 'cup', sleep: 'hour', rest: 'minute', head_wrap: 'hour', water: 'cup', dark_room: 'minute', custom: 'minute' }
const DURATION_TYPES = ['sleep', 'rest', 'head_wrap', 'dark_room', 'custom']

function computeFollowups(parsed: Pick<ParsedNote, 'intensity' | 'region' | 'onsetKind' | 'interventions'>, ar: boolean): Followup[] {
  const followups: Followup[] = []
  if (parsed.intensity == null) followups.push({ type: 'intensity', target: null, question: ar ? 'قديش كانت الشدة من 10؟' : 'How intense was it, out of 10?' })
  if (!parsed.region) followups.push({ type: 'location', target: null, question: ar ? 'وين بالضبط كان الوجع؟ علّمه عالمجسّم.' : 'Where exactly did it hurt? Mark it on the 3D head.' })
  for (const item of parsed.interventions) {
    if (item.type === 'medication' && !item.name) followups.push({ type: 'medication_name', target: 'medication', question: ar ? 'شو اسم الدواء؟' : 'What medicine did you take?' })
    if (item.amount == null && (item.type === 'medication' || DURATION_TYPES.includes(item.type))) {
      const isDuration = DURATION_TYPES.includes(item.type)
      followups.push({ type: isDuration ? 'duration' : 'amount', target: item.type, question: ar ? (isDuration ? 'قديش المدة؟' : 'قديش الكمية؟') : (isDuration ? 'For how long?' : 'How much did you take?') })
    }
  }
  if (parsed.onsetKind === 'unknown') followups.push({ type: 'onset', target: null, question: ar ? 'كيف بلّش الوجع؟' : 'How did it start?' })
  return followups
}

// Normalise an AI (or partial) parse into a valid ParsedNote and recompute which
// required details are still missing, so the "questions" are reliable even when the
// model under-fills its output.
export function reconcileParsedNote(parsed: Partial<ParsedNote> | null | undefined, note: string, locale: 'en' | 'ar'): ParsedNote {
  const ar = locale === 'ar'
  const local = parseHeadacheText(note, locale)
  const interventions: ParsedIntervention[] = (parsed?.interventions ?? [])
    .filter((item): item is ParsedIntervention => Boolean(item) && typeof item.type === 'string' && item.type in UNIT_BY_TYPE)
    .map((item) => ({
      type: item.type,
      name: item.name ?? null,
      amount: typeof item.amount === 'number' ? item.amount : null,
      unit: item.unit ?? UNIT_BY_TYPE[item.type] ?? null,
    }))
  // Blend in anything the rule-based parser caught that the model missed (e.g. a generic "دواء").
  const known = new Set(interventions.map((item) => item.type))
  for (const item of local.interventions) if (!known.has(item.type)) interventions.push(item)
  for (const item of interventions) {
    if (item.type === 'medication' && !item.name) {
      const localMed = local.interventions.find((candidate) => candidate.type === 'medication')
      if (localMed?.name) item.name = localMed.name
    }
  }
  const base = {
    onsetKind: parsed?.onsetKind && parsed.onsetKind !== 'unknown' ? parsed.onsetKind : local.onsetKind,
    intensity: typeof parsed?.intensity === 'number' ? parsed.intensity : local.intensity,
    characters: parsed?.characters?.length ? parsed.characters : local.characters,
    interventions,
    region: parsed?.region ?? local.region,
    note: parsed?.note?.trim() ? parsed.note : note,
  }
  return { ...base, followups: computeFollowups(base, ar) }
}

export function parseHeadacheText(text: string, locale: 'en' | 'ar' = 'ar'): ParsedNote {
  const ar = locale === 'ar'
  const normalized = text.toLowerCase()
  const intensities = Array.from(normalized.matchAll(/(?:شدة|كان|صار|وصل|intensity|pain)?\s*(10|[0-9])\s*(?:من|\/|out of)\s*10/g)).map((match) => Number(match[1]))
  const intensity = intensities.length ? intensities[intensities.length - 1] : null
  const onsetKind = /صحيت|استيقظ|woke/.test(normalized) ? 'on_waking' : /فجأة|sudden/.test(normalized) ? 'sudden' : /زاد|تدريج|gradual/.test(normalized) ? 'gradual' : 'unknown'
  const characters = ([
    /نبض|puls/.test(normalized) && 'pulsing',
    /ضغط|press/.test(normalized) && 'pressure',
    /طعن|sharp|stabb/.test(normalized) && 'sharp',
    /شد|tight/.test(normalized) && 'tight',
  ].filter(Boolean)) as string[]
  const medicationName = /بنادول|panadol/.test(normalized) ? 'Panadol'
    : /أدفيل|بروفين|ibuprofen|advil|profen/.test(normalized) ? 'Ibuprofen'
    : /أسبرين|aspirin/.test(normalized) ? 'Aspirin'
    : /باراسيتامول|بنادرين|paracetamol|acetaminophen|tylenol/.test(normalized) ? 'Paracetamol'
    : null
  const types = ([
    /بنادول|panadol|دواء|medic|حبة|حبوب|مسكن/.test(normalized) && 'medication',
    /قهوة|coffee|كافيين|caffeine/.test(normalized) && 'coffee',
    /نمت|نوم|sleep|slept/.test(normalized) && 'sleep',
    /تمدد|استلق|lie down|lay down|rest/.test(normalized) && 'rest',
    /ربط.*راس|head wrap|wrap/.test(normalized) && 'head_wrap',
    /مي|ماء|شرب.*ماء|water|hydrat/.test(normalized) && 'water',
    /عتمة|ظلام|غرفة مظلمة|dark room|dark/.test(normalized) && 'dark_room',
  ].filter(Boolean)) as string[]
  const interventions: ParsedIntervention[] = types.map((type) => ({ type, name: type === 'medication' ? medicationName : null, amount: null, unit: UNIT_BY_TYPE[type] ?? null }))
  const region = detectRegion(normalized)
  const followups = computeFollowups({ intensity, region, onsetKind, interventions }, ar)
  return { onsetKind, intensity, characters, interventions, region, note: text, followups }
}

function detectRegion(normalized: string): string | null {
  const side = /يمين|right/.test(normalized) ? 'right' : /يسار|شمال|left/.test(normalized) ? 'left' : null
  const vertical = /فوق|أعلى|قمة|top|crown/.test(normalized) ? 'top'
    : /خلف|ورا|قفا|back|occip/.test(normalized) ? 'back'
    : /قدام|أمام|جبهة|جبين|front|forehead|temple|صدغ/.test(normalized) ? 'front'
    : null
  if (vertical === 'top') return side ? `top_${side}` : 'top'
  if (vertical === 'back') return side ? `back_${side}` : 'back'
  if (vertical === 'front') return side ? `front_${side}` : 'front_center'
  if (/النص|منتصف|وسط|middle|center|centre/.test(normalized)) return 'center'
  if (side) return side
  return null
}
