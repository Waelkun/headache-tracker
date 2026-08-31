import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, ArrowLeft, BarChart3, Brain, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText,
  History as HistoryIcon, Languages, Layers3, LayoutGrid, LogOut, MapPin, Moon, NotebookPen, Plus,
  Save, Sparkles, Square, Sun,
} from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import type { HeadLayer, HeadPoint } from './components/HeadMap3D'
import { InterventionEditor, type EffectValue, type InterventionDraft, type InterventionTemplate } from './components/InterventionEditor'
import { answerDataQuestion, buildAskSummary, buildOverview, buildWeekdayRisk, countEpisodesInRange, episodeDurationHours, maxIntensity, parseHeadacheText, reconcileParsedNote, type ParsedNote } from './lib/analytics'
import { OrganizerReview } from './components/OrganizerReview'
import { copy, type Locale } from './lib/i18n'
import { supabase } from './lib/supabase'
import type { Database, Json } from './lib/database.types'

import type { CheckInResult } from './components/CheckInSheet'
import type { EpisodeTime } from './components/EpisodeComposer'

const HeadMap3D = lazy(() => import('./components/HeadMap3D').then((module) => ({ default: module.HeadMap3D })))
const ReportView = lazy(() => import('./components/ReportView').then((module) => ({ default: module.ReportView })))
const InsightsView = lazy(() => import('./components/InsightsView'))
const CheckInSheet = lazy(() => import('./components/CheckInSheet').then((module) => ({ default: module.CheckInSheet })))
const EpisodeComposer = lazy(() => import('./components/EpisodeComposer').then((module) => ({ default: module.EpisodeComposer })))

type EpisodeRow = Database['public']['Tables']['headache_episodes']['Row']
type IntensityRow = Database['public']['Tables']['intensity_segments']['Row']
type InterventionRow = Database['public']['Tables']['episode_interventions']['Row']
type PainLocationRow = Database['public']['Tables']['pain_locations']['Row']
type InterventionTemplateRow = Database['public']['Tables']['intervention_templates']['Row']
type Episode = EpisodeRow & {
  intensity_segments: IntensityRow[]
  episode_interventions: InterventionRow[]
  pain_locations: PainLocationRow[]
}
type View = 'today' | 'history' | 'insights' | 'ask' | 'report'
type Theme = 'light' | 'dark'
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
const LOCATION_COLORS = ['#d94d61', '#d9852f', '#377fbd', '#8a62bd', '#218d77', '#b14f98']

const navItems = [
  { id: 'today', icon: Activity, en: 'Today', ar: 'اليوم' },
  { id: 'history', icon: CalendarDays, en: 'History', ar: 'السجل' },
  { id: 'insights', icon: BarChart3, en: 'Insights', ar: 'التحليلات' },
  { id: 'ask', icon: Sparkles, en: 'Ask', ar: 'اسأل' },
  { id: 'report', icon: FileText, en: 'Report', ar: 'التقرير' },
] as const

function formatElapsed(start: string, locale: Locale) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (locale === 'ar') return hours ? `${hours} س ${rest} د` : `${rest} دقيقة`
  return hours ? `${hours}h ${rest}m` : `${rest} min`
}

function formatHours(value: number, locale: Locale) {
  if (!value) return '—'
  return locale === 'ar' ? `${value.toFixed(1)} س` : `${value.toFixed(1)}h`
}

function painLocationPoints(location: PainLocationRow): HeadPoint[] {
  if (!Array.isArray(location.points)) return []
  return location.points.filter((point): point is HeadPoint => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return false
    const value = point as Record<string, unknown>
    return typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number'
  })
}

function painLocationDisplayPoints(location: PainLocationRow): HeadPoint[] {
  const saved = painLocationPoints(location)
  if (saved.length) return saved
  const fallback: Record<string, HeadPoint> = {
    front_right: { x: -0.28, y: 0.38, z: 0.68 }, front_left: { x: 0.28, y: 0.38, z: 0.68 }, front_center: { x: 0, y: 0.35, z: 0.75 },
    back_right: { x: -0.28, y: 0.28, z: -0.68 }, back_left: { x: 0.28, y: 0.28, z: -0.68 }, back: { x: 0, y: 0.28, z: -0.75 },
    top_right: { x: -0.25, y: 0.88, z: 0.08 }, top_left: { x: 0.25, y: 0.88, z: 0.08 }, top: { x: 0, y: 0.98, z: 0 },
    right: { x: -0.61, y: 0.2, z: 0 }, left: { x: 0.61, y: 0.2, z: 0 }, center: { x: 0, y: 0.18, z: 0.68 },
  }
  return location.region_code && fallback[location.region_code] ? [fallback[location.region_code]] : []
}

function painLocationCameraPosition(location: PainLocationRow): [number, number, number] {
  const points = painLocationDisplayPoints(location)
  if (!points.length) return [0, 0, 3.4]
  const center = points.reduce((sum, point) => ({
    x: sum.x + point.x / points.length,
    y: sum.y + point.y / points.length,
    z: sum.z + point.z / points.length,
  }), { x: 0, y: 0, z: 0 })
  if (center.y > 0.72) return [0, 2.7, 2.2]
  if (Math.abs(center.x) > Math.abs(center.z) + 0.08) return center.x < 0 ? [-3.4, 0, 0] : [3.4, 0, 0]
  return center.z < -0.12 ? [0, 0, -3.4] : [0, 0, 3.4]
}

function inferPainRegion(points: HeadPoint[]) {
  if (!points.length) return null
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y, z: sum.z + point.z }), { x: 0, y: 0, z: 0 })
  center.x /= points.length
  center.y /= points.length
  center.z /= points.length
  const side = center.x < -0.16 ? 'right' : center.x > 0.16 ? 'left' : 'center'
  if (center.y > 0.72) return side === 'center' ? 'top' : `top_${side}`
  if (center.z > 0.12) return side === 'center' ? 'front_center' : `front_${side}`
  if (center.z < -0.12) return side === 'center' ? 'back' : `back_${side}`
  return side === 'center' ? 'center' : side
}

function painRegionLabel(region: string | null, locale: Locale) {
  if (!region) return locale === 'ar' ? 'مكان محدد على المجسّم' : 'Marked on the 3D head'
  const labels: Record<string, [string, string]> = {
    front_right: ['قدّام عاليمين', 'Front right'], front_left: ['قدّام عاليسار', 'Front left'], front_center: ['قدّام بالنص', 'Front center'],
    back_right: ['ورا عاليمين', 'Back right'], back_left: ['ورا عاليسار', 'Back left'], back: ['من ورا', 'Back'],
    top_right: ['فوق عاليمين', 'Top right'], top_left: ['فوق عاليسار', 'Top left'], top: ['من فوق', 'Top'],
    right: ['عاليمين', 'Right side'], left: ['عاليسار', 'Left side'], center: ['بالنص', 'Center'],
  }
  return labels[region]?.[locale === 'ar' ? 0 : 1] ?? region.replaceAll('_', ' ')
}

function summarizePainLocation(location: PainLocationRow) {
  const points = painLocationPoints(location)
  const region = location.region_code || inferPainRegion(points)
  const centroid = points.length ? points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length, z: sum.z + point.z / points.length }), { x: 0, y: 0, z: 0 }) : null
  return {
    recorded_at: location.created_at,
    region,
    mark_type: location.mark_type,
    intensity: location.intensity,
    point_count: points.length,
    centroid: centroid ? { x: Number(centroid.x.toFixed(3)), y: Number(centroid.y.toFixed(3)), z: Number(centroid.z.toFixed(3)) } : null,
  }
}

type CheckInRow = { time: string; intensity: number | null; region: string | null }
function buildCheckInTimeline(episode: Episode): CheckInRow[] {
  const bucket = (iso: string) => String(Math.round(new Date(iso).getTime() / 60_000))
  const map = new Map<string, CheckInRow>()
  for (const segment of episode.intensity_segments) {
    const key = bucket(segment.started_at)
    const row = map.get(key) ?? { time: segment.started_at, intensity: null, region: null }
    row.intensity = segment.intensity
    row.time = segment.started_at
    map.set(key, row)
  }
  for (const location of episode.pain_locations) {
    const key = bucket(location.created_at)
    const row = map.get(key) ?? { time: location.created_at, intensity: location.intensity ?? null, region: null }
    row.region = location.region_code || inferPainRegion(painLocationPoints(location))
    if (row.intensity == null && location.intensity != null) row.intensity = location.intensity
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => a.time.localeCompare(b.time))
}

function appendCheckInNote(existing: string | null, at: string, note: string, ar: boolean) {
  if (!note) return existing
  const time = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' }).format(new Date(at))
  const line = `[${time}] ${note}`
  return existing ? `${existing}\n${line}` : line
}

function createDemoEpisodes(): Episode[] {
  const make = (daysAgo: number, index: number, intensity: number, hours: number, onset: EpisodeRow['onset_kind'], treatment: InterventionRow['intervention_type']): Episode => {
    const start = new Date(Date.now() - daysAgo * 86_400_000)
    start.setHours(9 + (index % 4), 15, 0, 0)
    const middle = new Date(start.getTime() + Math.max(30, hours * 24) * 60_000)
    const end = new Date(start.getTime() + hours * 3_600_000)
    return {
      id: `demo-episode-${index}`, user_id: DEMO_USER_ID, status: 'completed', started_at: start.toISOString(), ended_at: end.toISOString(),
      onset_kind: onset, start_precision: 'exact', pain_character: index % 2 ? ['pulsing'] : ['pressure'], notes: null, ai_source_text: null,
      created_at: start.toISOString(), updated_at: end.toISOString(),
      intensity_segments: [
        { id: `demo-intensity-${index}-1`, user_id: DEMO_USER_ID, episode_id: `demo-episode-${index}`, started_at: start.toISOString(), ended_at: middle.toISOString(), intensity: Math.max(2, intensity - 3), is_approximate: false, source: 'manual', created_at: start.toISOString() },
        { id: `demo-intensity-${index}-2`, user_id: DEMO_USER_ID, episode_id: `demo-episode-${index}`, started_at: middle.toISOString(), ended_at: end.toISOString(), intensity, is_approximate: false, source: 'manual', created_at: middle.toISOString() },
      ],
      episode_interventions: [{ id: `demo-treatment-${index}`, user_id: DEMO_USER_ID, episode_id: `demo-episode-${index}`, intervention_type: treatment, label: treatment === 'medication' ? 'Panadol' : null, amount: treatment === 'medication' ? 1 : null, unit: treatment === 'medication' ? 'tablet' : null, performed_at: middle.toISOString(), intensity_before: intensity, intensity_after: Math.max(1, intensity - 3), effect: 'slightly_better', effect_delay_minutes: 45, notes: null, created_at: middle.toISOString() }],
      pain_locations: [{ id: `demo-location-${index}`, user_id: DEMO_USER_ID, episode_id: `demo-episode-${index}`, mark_type: 'point', region_code: index % 2 ? 'front_right' : 'front_center', points: [], intensity, created_at: start.toISOString() }],
    }
  }
  return [
    make(2, 1, 7, 3.2, 'gradual', 'coffee'), make(6, 2, 8, 4.1, 'on_waking', 'medication'),
    make(10, 3, 5, 1.8, 'sudden', 'rest'), make(13, 4, 9, 5.4, 'gradual', 'medication'),
    make(20, 5, 7, 3.6, 'on_waking', 'head_wrap'), make(27, 6, 6, 2.5, 'gradual', 'coffee'),
  ]
}

export default function App() {
  const initialLocale = (localStorage.getItem('headache-locale') as Locale | null) ?? 'ar'
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [theme, setTheme] = useState<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const [session, setSession] = useState<Session | null>(null)
  const [demoMode, setDemoMode] = useState(localStorage.getItem('headache-demo') === 'true')
  const [authReady, setAuthReady] = useState(false)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [interventionTemplates, setInterventionTemplates] = useState<InterventionTemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('today')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [showEarlier, setShowEarlier] = useState(false)
  const [intensity, setIntensity] = useState(4)
  const [marks, setMarks] = useState<HeadPoint[]>([])
  const [markMode, setMarkMode] = useState<'point' | 'area'>('point')
  const [note, setNote] = useState('')
  const [parsedNote, setParsedNote] = useState<ReturnType<typeof parseHeadacheText> | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerSource, setAnswerSource] = useState<{ provider: string; model: string } | null>(null)
  const [askBusy, setAskBusy] = useState(false)
  const [organizerBusy, setOrganizerBusy] = useState(false)
  const [organizerSource, setOrganizerSource] = useState<{ provider: string; model: string } | null>(null)
  const [checkInContext, setCheckInContext] = useState<'start' | 'active' | 'treatment' | null>(null)
  const [checkInSaving, setCheckInSaving] = useState(false)
  const [composer, setComposer] = useState<'now' | 'earlier' | null>(null)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const [, setTick] = useState(0)
  const ar = locale === 'ar'
  const t = copy[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = ar ? 'rtl' : 'ltr'
    localStorage.setItem('headache-locale', locale)
  }, [ar, locale])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('headache-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1614' : '#0b6b62')
  }, [theme])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        localStorage.removeItem('headache-demo')
        setDemoMode(false)
      }
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange(async (event, next) => {
      if (next) {
        if (event === 'SIGNED_IN' && localStorage.getItem('headache-demo-episodes')) {
          await migrateLocalToAccount(next.user.id)
        }
        localStorage.removeItem('headache-demo')
        setDemoMode(false)
      }
      setSession(next)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (demoMode) {
      const saved = localStorage.getItem('headache-demo-episodes')
      setEpisodes(saved ? JSON.parse(saved) as Episode[] : [])
      const savedTemplates = localStorage.getItem('headache-demo-intervention-templates')
      setInterventionTemplates(savedTemplates ? JSON.parse(savedTemplates) as InterventionTemplateRow[] : [])
      setLoading(false)
    } else if (session) void loadEpisodes()
    else setEpisodes([])
  }, [demoMode, session])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  async function loadEpisodes() {
    if (demoMode) return
    setLoading(true)
    setError('')
    const [episodeResult, templateResult] = await Promise.all([
      supabase.from('headache_episodes').select('*, intensity_segments(*), episode_interventions(*), pain_locations(*)').order('started_at', { ascending: false }),
      supabase.from('intervention_templates').select('*').order('created_at', { ascending: true }),
    ])
    if (episodeResult.error) setError(episodeResult.error.message)
    else setEpisodes((episodeResult.data ?? []) as Episode[])
    if (templateResult.error) setError(templateResult.error.message)
    else setInterventionTemplates(templateResult.data ?? [])
    setLoading(false)
  }

  function updateDemoEpisodes(updater: (current: Episode[]) => Episode[]) {
    setEpisodes((current) => {
      const next = updater(current)
      localStorage.setItem('headache-demo-episodes', JSON.stringify(next))
      return next
    })
  }

  function enterDemo() {
    localStorage.setItem('headache-demo', 'true')
    setDemoMode(true)
  }

  function goToSignIn() {
    // Keep local episodes so they migrate after sign-in; just leave guest mode to show the auth screen.
    localStorage.removeItem('headache-demo')
    setDemoMode(false)
  }

  async function migrateLocalToAccount(userId: string) {
    const raw = localStorage.getItem('headache-demo-episodes')
    const templatesRaw = localStorage.getItem('headache-demo-intervention-templates')
    const localEpisodes: Episode[] = raw ? JSON.parse(raw) as Episode[] : []
    const localTemplates: InterventionTemplateRow[] = templatesRaw ? JSON.parse(templatesRaw) as InterventionTemplateRow[] : []
    try {
      for (const episode of localEpisodes) {
        const { data, error: episodeError } = await supabase.from('headache_episodes').insert({
          user_id: userId, started_at: episode.started_at, ended_at: episode.ended_at, status: episode.status,
          onset_kind: episode.onset_kind, start_precision: episode.start_precision, pain_character: episode.pain_character,
          notes: episode.notes, ai_source_text: episode.ai_source_text,
        }).select('id').single()
        if (episodeError || !data) continue
        const episodeId = data.id
        if (episode.intensity_segments.length) await supabase.from('intensity_segments').insert(episode.intensity_segments.map((segment) => ({ user_id: userId, episode_id: episodeId, started_at: segment.started_at, ended_at: segment.ended_at, intensity: segment.intensity, is_approximate: segment.is_approximate, source: segment.source })))
        if (episode.pain_locations.length) await supabase.from('pain_locations').insert(episode.pain_locations.map((location) => ({ user_id: userId, episode_id: episodeId, mark_type: location.mark_type, region_code: location.region_code, points: location.points, intensity: location.intensity })))
        if (episode.episode_interventions.length) await supabase.from('episode_interventions').insert(episode.episode_interventions.map((item) => ({ user_id: userId, episode_id: episodeId, intervention_type: item.intervention_type, label: item.label, amount: item.amount, unit: item.unit, performed_at: item.performed_at, intensity_before: item.intensity_before, intensity_after: item.intensity_after, effect: item.effect, effect_delay_minutes: item.effect_delay_minutes, notes: item.notes })))
      }
      if (localTemplates.length) await supabase.from('intervention_templates').insert(localTemplates.map((template) => ({ user_id: userId, name: template.name, default_unit: template.default_unit })))
    } catch {
      return // keep local data if something failed, so nothing is lost
    }
    localStorage.removeItem('headache-demo-episodes')
    localStorage.removeItem('headache-demo-intervention-templates')
  }

  async function leaveAccount() {
    if (demoMode) {
      localStorage.removeItem('headache-demo')
      localStorage.removeItem('headache-demo-episodes')
      localStorage.removeItem('headache-demo-intervention-templates')
      setDemoMode(false)
      setEpisodes([])
      setInterventionTemplates([])
      return
    }
    await supabase.auth.signOut()
  }

  const activeEpisode = episodes.find((episode) => episode.status === 'active')
  const currentSegment = activeEpisode?.intensity_segments
    .filter((segment) => !segment.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  const overview = useMemo(() => buildOverview(episodes), [episodes])
  const risk = useMemo(() => buildWeekdayRisk(episodes, locale), [episodes, locale])

  async function startHeadache(startedAt = new Date().toISOString(), endedAt?: string) {
    if (demoMode) {
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      const episode: Episode = { id, user_id: DEMO_USER_ID, status: endedAt ? 'completed' : 'active', started_at: startedAt, ended_at: endedAt ?? null, onset_kind: 'unknown', start_precision: 'exact', pain_character: [], notes: null, ai_source_text: null, created_at: now, updated_at: now, intensity_segments: [], episode_interventions: [], pain_locations: [] }
      updateDemoEpisodes((current) => [episode, ...current])
      setShowEarlier(false)
      setDetailsOpen(true)
      return
    }
    if (!session) return
    setError('')
    const payload: Database['public']['Tables']['headache_episodes']['Insert'] = endedAt
      ? { user_id: session.user.id, started_at: startedAt, ended_at: endedAt, status: 'completed' }
      : { user_id: session.user.id, started_at: startedAt, status: 'active' }
    const { error: insertError } = await supabase.from('headache_episodes').insert(payload)
    if (insertError) setError(insertError.message)
    else {
      setShowEarlier(false)
      setDetailsOpen(true)
      await loadEpisodes()
    }
  }

  async function updateIntensity(value: number, at = new Date().toISOString(), approximate = false, source: 'manual' | 'ai' = 'manual') {
    if (!activeEpisode) return
    if (demoMode) {
      updateDemoEpisodes((current) => current.map((episode) => episode.id !== activeEpisode.id ? episode : {
        ...episode,
        intensity_segments: [
          ...episode.intensity_segments.map((segment) => segment.ended_at ? segment : { ...segment, ended_at: at }),
          { id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: episode.id, started_at: at, ended_at: null, intensity: value, is_approximate: approximate, source, created_at: at },
        ],
      }))
      return
    }
    if (!session) return
    if (currentSegment) {
      const end = new Date(Math.max(new Date(at).getTime(), new Date(currentSegment.started_at).getTime() + 1)).toISOString()
      const { error: closeError } = await supabase.from('intensity_segments').update({ ended_at: end }).eq('id', currentSegment.id)
      if (closeError) { setError(closeError.message); return }
    }
    const { error: insertError } = await supabase.from('intensity_segments').insert({
      user_id: session.user.id, episode_id: activeEpisode.id, started_at: at,
      intensity: value, is_approximate: approximate, source,
    })
    if (insertError) setError(insertError.message)
    else await loadEpisodes()
  }

  async function endHeadache() {
    if (!activeEpisode) return
    const end = new Date().toISOString()
    if (demoMode) {
      updateDemoEpisodes((current) => current.map((episode) => episode.id !== activeEpisode.id ? episode : { ...episode, status: 'completed', ended_at: end, updated_at: end, intensity_segments: episode.intensity_segments.map((segment) => segment.ended_at ? segment : { ...segment, ended_at: end }) }))
      setMarks([]); setNote(''); setParsedNote(null)
      return
    }
    if (currentSegment) await supabase.from('intensity_segments').update({ ended_at: end }).eq('id', currentSegment.id)
    const { error: updateError } = await supabase.from('headache_episodes').update({ ended_at: end, status: 'completed' }).eq('id', activeEpisode.id)
    if (updateError) setError(updateError.message)
    else {
      setMarks([])
      setNote('')
      setParsedNote(null)
      await loadEpisodes()
    }
  }

  async function saveMarks() {
    if (!activeEpisode || !marks.length) return
    const regionCode = inferPainRegion(marks)
    if (demoMode) {
      const location: PainLocationRow = { id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: activeEpisode.id, mark_type: markMode, points: JSON.parse(JSON.stringify(marks)) as Json, region_code: regionCode, intensity: currentSegment?.intensity ?? null, created_at: new Date().toISOString() }
      updateDemoEpisodes((current) => current.map((episode) => episode.id === activeEpisode.id ? { ...episode, pain_locations: [...episode.pain_locations, location] } : episode))
      setMarks([])
      return
    }
    if (!session) return
    const { error: insertError } = await supabase.from('pain_locations').insert({
      user_id: session.user.id,
      episode_id: activeEpisode.id,
      mark_type: markMode,
      points: JSON.parse(JSON.stringify(marks)) as Json,
      region_code: regionCode,
      intensity: currentSegment?.intensity ?? null,
    })
    if (insertError) setError(insertError.message)
    else { setMarks([]); await loadEpisodes() }
  }

  async function writeCheckInLive(userId: string, episodeId: string, result: CheckInResult, at: string, openSegment?: { id: string; started_at: string }, existingNotes?: string | null) {
    if (result.intensity != null) {
      if (openSegment) {
        const end = new Date(Math.max(new Date(at).getTime(), new Date(openSegment.started_at).getTime() + 1)).toISOString()
        await supabase.from('intensity_segments').update({ ended_at: end }).eq('id', openSegment.id)
      }
      await supabase.from('intensity_segments').insert({ user_id: userId, episode_id: episodeId, started_at: at, intensity: result.intensity, is_approximate: false, source: 'manual' })
    }
    if (result.marks.length) {
      await supabase.from('pain_locations').insert({ user_id: userId, episode_id: episodeId, mark_type: result.markMode, points: JSON.parse(JSON.stringify(result.marks)) as Json, region_code: inferPainRegion(result.marks), intensity: result.intensity ?? null })
    }
    if (result.note) {
      await supabase.from('headache_episodes').update({ notes: appendCheckInNote(existingNotes ?? null, at, result.note, ar) }).eq('id', episodeId)
    }
  }

  async function saveActiveCheckIn(result: CheckInResult) {
    if (!activeEpisode) return
    const at = new Date().toISOString()
    setCheckInSaving(true)
    setError('')
    try {
      if (demoMode) {
        updateDemoEpisodes((current) => current.map((episode) => {
          if (episode.id !== activeEpisode.id) return episode
          let next: Episode = { ...episode }
          if (result.intensity != null) {
            next = { ...next, intensity_segments: [
              ...next.intensity_segments.map((segment) => segment.ended_at ? segment : { ...segment, ended_at: at }),
              { id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: episode.id, started_at: at, ended_at: null, intensity: result.intensity, is_approximate: false, source: 'manual', created_at: at },
            ] }
          }
          if (result.marks.length) {
            next = { ...next, pain_locations: [...next.pain_locations, { id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: episode.id, mark_type: result.markMode, points: JSON.parse(JSON.stringify(result.marks)) as Json, region_code: inferPainRegion(result.marks), intensity: result.intensity ?? null, created_at: at }] }
          }
          if (result.note) next = { ...next, notes: appendCheckInNote(next.notes, at, result.note, ar) }
          return next
        }))
        return
      }
      if (!session) return
      await writeCheckInLive(session.user.id, activeEpisode.id, result, at, currentSegment ? { id: currentSegment.id, started_at: currentSegment.started_at } : undefined, activeEpisode.notes)
      await loadEpisodes()
    } finally {
      setCheckInSaving(false)
    }
  }

  async function startWithCheckIn(result: CheckInResult) {
    const at = new Date().toISOString()
    setCheckInSaving(true)
    setError('')
    try {
      if (demoMode) {
        const id = crypto.randomUUID()
        const episode: Episode = {
          id, user_id: DEMO_USER_ID, status: 'active', started_at: at, ended_at: null, onset_kind: 'unknown', start_precision: 'exact', pain_character: [],
          notes: result.note ? appendCheckInNote(null, at, result.note, ar) : null, ai_source_text: null, created_at: at, updated_at: at,
          intensity_segments: result.intensity != null ? [{ id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: id, started_at: at, ended_at: null, intensity: result.intensity, is_approximate: false, source: 'manual', created_at: at }] : [],
          episode_interventions: [],
          pain_locations: result.marks.length ? [{ id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: id, mark_type: result.markMode, points: JSON.parse(JSON.stringify(result.marks)) as Json, region_code: inferPainRegion(result.marks), intensity: result.intensity ?? null, created_at: at }] : [],
        }
        updateDemoEpisodes((current) => [episode, ...current])
        return
      }
      if (!session) return
      const { data, error: insertError } = await supabase.from('headache_episodes').insert({ user_id: session.user.id, started_at: at, status: 'active' }).select('id').single()
      if (insertError || !data) { setError(insertError?.message ?? 'Could not start episode'); return }
      await writeCheckInLive(session.user.id, data.id, result, at, undefined, null)
      await loadEpisodes()
    } finally {
      setCheckInSaving(false)
    }
  }

  async function handleCheckInSave(result: CheckInResult) {
    if (checkInContext === 'start') await startWithCheckIn(result)
    else await saveActiveCheckIn(result)
    setCheckInContext(null)
  }

  async function handleComposerCreate(final: ParsedNote, marks: HeadPoint[], time: EpisodeTime | null) {
    setCheckInSaving(true)
    setError('')
    const at = time ? time.startAt : new Date().toISOString()
    const endedAt = time ? time.endAt : null
    const segEnd = endedAt && new Date(endedAt).getTime() > new Date(at).getTime() + 1000 ? endedAt : null
    const region = marks.length ? inferPainRegion(marks) : null
    try {
      if (demoMode) {
        const id = crypto.randomUUID()
        const episode: Episode = {
          id, user_id: DEMO_USER_ID, status: time ? 'completed' : 'active', started_at: at, ended_at: endedAt,
          onset_kind: final.onsetKind, start_precision: 'exact', pain_character: final.characters,
          notes: final.note || null, ai_source_text: final.note || null, created_at: at, updated_at: endedAt ?? at,
          intensity_segments: final.intensity != null ? [{ id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: id, started_at: at, ended_at: segEnd, intensity: final.intensity, is_approximate: false, source: 'manual', created_at: at }] : [],
          episode_interventions: final.interventions.map((item) => ({ id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: id, intervention_type: item.type as InterventionRow['intervention_type'], label: item.name, amount: item.amount, unit: item.unit, performed_at: at, intensity_before: final.intensity ?? null, intensity_after: null, effect: null, effect_delay_minutes: null, notes: null, created_at: at })),
          pain_locations: marks.length ? [{ id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: id, mark_type: 'point', points: JSON.parse(JSON.stringify(marks)) as Json, region_code: region, intensity: final.intensity ?? null, created_at: at }] : [],
        }
        updateDemoEpisodes((current) => [episode, ...current])
        setComposer(null); setDetailsOpen(true)
        return
      }
      if (!session) return
      const insertPayload: Database['public']['Tables']['headache_episodes']['Insert'] = time
        ? { user_id: session.user.id, started_at: at, ended_at: endedAt!, status: 'completed', onset_kind: final.onsetKind, pain_character: final.characters, notes: final.note || null, ai_source_text: final.note || null }
        : { user_id: session.user.id, started_at: at, status: 'active', onset_kind: final.onsetKind, pain_character: final.characters, notes: final.note || null, ai_source_text: final.note || null }
      const { data, error: insertError } = await supabase.from('headache_episodes').insert(insertPayload).select('id').single()
      if (insertError || !data) { setError(insertError?.message ?? 'Could not create episode'); return }
      const episodeId = data.id
      if (final.intensity != null) {
        await supabase.from('intensity_segments').insert({ user_id: session.user.id, episode_id: episodeId, started_at: at, ended_at: segEnd, intensity: final.intensity, is_approximate: false, source: 'manual' })
      }
      if (marks.length) {
        await supabase.from('pain_locations').insert({ user_id: session.user.id, episode_id: episodeId, mark_type: 'point', points: JSON.parse(JSON.stringify(marks)) as Json, region_code: region, intensity: final.intensity ?? null })
      }
      if (final.interventions.length) {
        await supabase.from('episode_interventions').insert(final.interventions.map((item) => ({ user_id: session.user.id, episode_id: episodeId, intervention_type: item.type as InterventionRow['intervention_type'], label: item.name, amount: item.amount, unit: item.unit, performed_at: at, intensity_before: final.intensity ?? null })))
      }
      if (final.note.trim()) {
        await supabase.from('ai_intakes').insert({ user_id: session.user.id, episode_id: episodeId, raw_text: final.note, parsed_payload: JSON.parse(JSON.stringify(final)) as Json, status: 'applied' })
      }
      setComposer(null); setDetailsOpen(true)
      await loadEpisodes()
    } finally {
      setCheckInSaving(false)
    }
  }

  async function saveInterventions(drafts: InterventionDraft[]) {
    if (!activeEpisode || !drafts.length) return
    const time = new Date().toISOString()
    if (demoMode) {
      const items: InterventionRow[] = drafts.map((draft) => ({
        id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: activeEpisode.id,
        intervention_type: draft.intervention_type, label: draft.label, amount: draft.amount, unit: draft.unit,
        notes: draft.notes, performed_at: time, intensity_before: currentSegment?.intensity ?? null,
        intensity_after: null, effect: null, effect_delay_minutes: null, created_at: time,
      }))
      updateDemoEpisodes((current) => current.map((episode) => episode.id === activeEpisode.id ? { ...episode, episode_interventions: [...episode.episode_interventions, ...items] } : episode))
      setCheckInContext('treatment')
      return
    }
    if (!session) return
    const { error: insertError } = await supabase.from('episode_interventions').insert(drafts.map((draft) => ({
      user_id: session.user.id, episode_id: activeEpisode.id, intervention_type: draft.intervention_type,
      label: draft.label, amount: draft.amount, unit: draft.unit, notes: draft.notes,
      performed_at: time, intensity_before: currentSegment?.intensity ?? null,
    })))
    if (insertError) { setError(insertError.message); throw insertError }
    await loadEpisodes()
    setCheckInContext('treatment')
  }

  async function updateInterventionEffect(id: string, effect: EffectValue) {
    if (!activeEpisode) return
    const intervention = activeEpisode.episode_interventions.find((item) => item.id === id)
    const delay = intervention ? Math.max(0, Math.round((Date.now() - new Date(intervention.performed_at).getTime()) / 60_000)) : null
    const intensityAfter = currentSegment?.intensity ?? null
    if (demoMode) {
      updateDemoEpisodes((current) => current.map((episode) => episode.id !== activeEpisode.id ? episode : {
        ...episode,
        episode_interventions: episode.episode_interventions.map((item) => item.id === id ? { ...item, effect, intensity_after: intensityAfter, effect_delay_minutes: delay } : item),
      }))
      return
    }
    if (!session) return
    const { error: updateError } = await supabase.from('episode_interventions').update({ effect, intensity_after: intensityAfter, effect_delay_minutes: delay }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await loadEpisodes()
  }

  async function createInterventionTemplate(name: string, defaultUnit: string | null) {
    const now = new Date().toISOString()
    if (demoMode) {
      const template: InterventionTemplateRow = { id: crypto.randomUUID(), user_id: DEMO_USER_ID, name, default_unit: defaultUnit, created_at: now, updated_at: now }
      setInterventionTemplates((current) => {
        const next = [...current, template]
        localStorage.setItem('headache-demo-intervention-templates', JSON.stringify(next))
        return next
      })
      return
    }
    if (!session) return
    const { error: insertError } = await supabase.from('intervention_templates').insert({ user_id: session.user.id, name, default_unit: defaultUnit })
    if (insertError) { setError(insertError.message); throw insertError }
    await loadEpisodes()
  }

  async function organizeText(text: string): Promise<{ parsed: ParsedNote; source: { provider: string; model: string }; failed: boolean }> {
    try {
      const { data, error: functionError } = await supabase.functions.invoke('parse-headache', { body: { text, locale } })
      if (!functionError && data?.parsed) {
        return { parsed: reconcileParsedNote(data.parsed as Partial<ParsedNote>, text, locale), source: { provider: data.provider || 'ai', model: data.model || 'Unknown model' }, failed: false }
      }
    } catch {
      // fall through to local parser
    }
    return { parsed: parseHeadacheText(text, locale), source: { provider: 'local', model: 'Rule-based parser' }, failed: true }
  }

  async function organizeNote() {
    if (!note.trim()) return
    setOrganizerBusy(true)
    setError('')
    try {
      const { parsed, source, failed } = await organizeText(note)
      setParsedNote(parsed)
      setOrganizerSource(source)
      if (failed) setError(ar ? 'تعذّر الاتصال بالذكاء الاصطناعي؛ احتفظنا بنتيجتك عبر التحليل المحلي. جرّب مرة ثانية بعد قليل.' : 'AI could not be reached; your result was preserved with local analysis. Try again shortly.')
    } finally {
      setOrganizerBusy(false)
    }
  }

  async function askQuestion(text: string) {
    if (!text.trim()) return
    setQuestion(text)
    setAskBusy(true)
    setError('')
    try {
      const safeEpisodes = episodes.slice(0, 200).map((episode) => ({
        started_at: episode.started_at, ended_at: episode.ended_at, status: episode.status,
        onset_kind: episode.onset_kind, pain_character: episode.pain_character,
        intensities: episode.intensity_segments.map((segment) => ({ intensity: segment.intensity, started_at: segment.started_at, ended_at: segment.ended_at })),
        interventions: episode.episode_interventions.map((item) => ({ type: item.intervention_type, label: item.label, amount: item.amount, unit: item.unit, effect: item.effect })),
        locations: [...episode.pain_locations].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(summarizePainLocation),
      }))
      const summary = buildAskSummary(episodes, locale)
      const { data, error: functionError } = await supabase.functions.invoke('ask-headache-data', { body: { question: text, locale, summary, episodes: safeEpisodes } })
      if (!functionError && data?.answer) {
        setAnswer(data.answer)
        setAnswerSource({ provider: data.provider || 'ai', model: data.model || 'Unknown model' })
        return
      }
      setError(ar ? 'تعذّر الوصول للذكاء الاصطناعي؛ عرضنا جواباً محلياً مؤقتاً من بياناتك.' : 'AI could not be reached; a temporary local answer is shown from your data.')
      setAnswer(answerDataQuestion(text, episodes, locale))
      setAnswerSource({ provider: 'local', model: 'Data rules' })
    } finally {
      setAskBusy(false)
    }
  }

  async function applyOrganizedNote(final: ParsedNote, marks: HeadPoint[]) {
    if (!activeEpisode) return
    const time = new Date().toISOString()
    const region = marks.length ? inferPainRegion(marks) : null
    const clearOrganizer = () => { setParsedNote(null); setOrganizerSource(null); setNote('') }
    if (demoMode) {
      updateDemoEpisodes((current) => current.map((episode) => episode.id !== activeEpisode.id ? episode : {
        ...episode, ai_source_text: final.note, notes: final.note, onset_kind: final.onsetKind, pain_character: final.characters,
        episode_interventions: [...episode.episode_interventions, ...final.interventions.map((item) => ({ id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: episode.id, intervention_type: item.type as InterventionRow['intervention_type'], label: item.name, amount: item.amount, unit: item.unit, performed_at: time, intensity_before: currentSegment?.intensity ?? null, intensity_after: null, effect: null, effect_delay_minutes: null, notes: null, created_at: time }))],
        pain_locations: marks.length ? [...episode.pain_locations, { id: crypto.randomUUID(), user_id: DEMO_USER_ID, episode_id: episode.id, mark_type: 'point', region_code: region, points: JSON.parse(JSON.stringify(marks)) as Json, intensity: final.intensity ?? currentSegment?.intensity ?? null, created_at: time }] : episode.pain_locations,
      }))
      if (final.intensity != null) await updateIntensity(final.intensity, time, true, 'ai')
      clearOrganizer()
      return
    }
    if (!session) return
    const { error: episodeError } = await supabase.from('headache_episodes').update({
      ai_source_text: final.note, notes: final.note, onset_kind: final.onsetKind, pain_character: final.characters,
    }).eq('id', activeEpisode.id)
    if (episodeError) { setError(episodeError.message); return }
    await supabase.from('ai_intakes').insert({
      user_id: session.user.id, episode_id: activeEpisode.id, raw_text: final.note,
      parsed_payload: JSON.parse(JSON.stringify(final)) as Json, status: 'applied',
    })
    if (marks.length) {
      await supabase.from('pain_locations').insert({ user_id: session.user.id, episode_id: activeEpisode.id, mark_type: 'point', region_code: region, points: JSON.parse(JSON.stringify(marks)) as Json, intensity: final.intensity ?? currentSegment?.intensity ?? null })
    }
    const interventionRows = final.interventions.map((item) => ({
      user_id: session.user.id, episode_id: activeEpisode.id, intervention_type: item.type as InterventionRow['intervention_type'],
      label: item.name, amount: item.amount, unit: item.unit, performed_at: time, intensity_before: currentSegment?.intensity ?? null,
    }))
    if (interventionRows.length) await supabase.from('episode_interventions').insert(interventionRows)
    if (final.intensity != null) await updateIntensity(final.intensity, time, true, 'ai')
    clearOrganizer()
    await loadEpisodes()
  }

  if (!authReady) return <div className="splash"><div className="brand-mark"><Brain /></div><span>{t.loading}</span></div>
  if (!session && !demoMode) return <AuthScreen locale={locale} theme={theme} onLocaleChange={setLocale} onThemeChange={setTheme} onDemo={enterDemo} />

  const displayName = demoMode ? (ar ? 'ضيف' : 'Guest') : session!.user.user_metadata.full_name?.split(' ')[0] || session!.user.email?.split('@')[0] || (ar ? 'أهلاً' : 'there')
  const dateLabel = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><Brain size={21} /></div>
        <div><p className="eyebrow">{dateLabel}</p><h1>{ar ? `أهلاً، ${displayName}` : `Hi, ${displayName}`}</h1></div>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={() => setLocale(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل للعربية'}><Languages size={19} /></button>
          <button className="icon-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? (ar ? 'استخدم الوضع الفاتح' : 'Use light mode') : (ar ? 'استخدم الوضع الداكن' : 'Use dark mode')} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
          <button className="icon-button" type="button" onClick={() => void leaveAccount()} aria-label={demoMode ? (ar ? 'اخرج من التجربة' : 'Exit demo') : t.signOut}><LogOut size={18} /></button>
        </div>
      </header>

      {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div>}

      {demoMode && !noticeDismissed && (
        <div className="local-notice" role="status">
          <MapPin size={18} />
          <div><strong>{ar ? 'محفوظ على هالجهاز بس' : 'Saved on this device only'}</strong><p>{ar ? 'بياناتك مخزّنة محلياً بهالمتصفّح. سجّل دخول حتى ما تضيع لو مسحت المتصفّح أو غيّرت جهاز — رح ننقل كل اللي سجّلته لحسابك.' : 'Your data is stored locally in this browser. Sign in so it is not lost if you clear the browser or switch devices — everything you logged will move to your account.'}</p></div>
          <div className="local-notice-actions"><button className="primary-button" type="button" onClick={goToSignIn}>{ar ? 'سجّل دخول' : 'Sign in'}</button><button className="icon-button local-notice-dismiss" type="button" onClick={() => setNoticeDismissed(true)} aria-label={ar ? 'إخفاء' : 'Dismiss'}>×</button></div>
        </div>
      )}

      <main className="app-main">
        {view === 'today' && (
          <TodayView
            locale={locale} theme={theme} active={activeEpisode} currentSegment={currentSegment} episodes={episodes}
            overview={overview} risk={risk} loading={loading} note={note} parsedNote={parsedNote}
            interventionTemplates={interventionTemplates} organizerSource={organizerSource} organizerBusy={organizerBusy}
            onStart={() => setCheckInContext('start')} onEarlier={() => setComposer('earlier')} onDescribeAI={() => setComposer('now')} onEnd={() => void endHeadache()}
            onNewCheckIn={() => setCheckInContext('active')}
            onSaveInterventions={saveInterventions} onCreateInterventionTemplate={createInterventionTemplate} onSetInterventionEffect={updateInterventionEffect}
            onNote={setNote} onOrganize={() => void organizeNote()} onApplyNote={(final, marks) => void applyOrganizedNote(final, marks)} onDiscardParse={() => { setParsedNote(null); setOrganizerSource(null) }}
            onInsights={() => setView('insights')} onAsk={() => setView('ask')} onSelectEpisode={(id) => { setSelectedEpisodeId(id); setView('history') }}
          />
        )}
        {view === 'history' && (selectedEpisodeId
          ? <EpisodeDetailView episode={episodes.find((episode) => episode.id === selectedEpisodeId)} locale={locale} theme={theme} onBack={() => setSelectedEpisodeId(null)} />
          : <HistoryView episodes={episodes} locale={locale} loading={loading} onSelect={setSelectedEpisodeId} />)}
        {view === 'insights' && <Suspense fallback={<ViewLoading locale={locale} />}><InsightsView episodes={episodes} locale={locale} theme={theme} /></Suspense>}
        {view === 'ask' && <AskView locale={locale} episodes={episodes} question={question} answer={answer} source={answerSource} busy={askBusy} onQuestion={setQuestion} onAsk={(text) => void askQuestion(text)} />}
        {view === 'report' && <Suspense fallback={<ViewLoading locale={locale} />}><ReportView episodes={episodes} locale={locale} /></Suspense>}
      </main>

      <nav className="bottom-nav" aria-label={ar ? 'التنقل الرئيسي' : 'Primary navigation'}>
        {navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} type="button" onClick={() => { setView(item.id); if (item.id !== 'history') setSelectedEpisodeId(null) }} aria-current={view === item.id ? 'page' : undefined}><item.icon size={20} /><span>{ar ? item.ar : item.en}</span></button>)}
      </nav>

      {composer && (
        <Suspense fallback={<div className="modal-backdrop" role="presentation"><div className="modal-card checkin-sheet map-loading">{ar ? 'عم نجهّز…' : 'Loading…'}</div></div>}>
          <EpisodeComposer locale={locale} theme={theme} mode={composer} saving={checkInSaving} organizeText={organizeText} onCreate={handleComposerCreate} onClose={() => setComposer(null)} />
        </Suspense>
      )}

      {checkInContext && (
        <Suspense fallback={<div className="modal-backdrop" role="presentation"><div className="modal-card checkin-sheet map-loading">{ar ? 'عم نجهّز…' : 'Loading…'}</div></div>}>
          <CheckInSheet
            locale={locale} theme={theme} saving={checkInSaving} requireBoth={checkInContext === 'start'}
            title={checkInContext === 'start' ? (ar ? 'سجّل أول لحظة' : 'First check-in') : checkInContext === 'treatment' ? (ar ? 'كيف صار الوجع؟' : 'How is it now?') : (ar ? 'تسجيل جديد' : 'New check-in')}
            subtitle={checkInContext === 'start' ? (ar ? 'حدّد الشدة وعلّم مكان الوجع لتبلّش النوبة.' : 'Set the intensity and mark where it hurts to begin.') : checkInContext === 'treatment' ? (ar ? 'سجّل الشدة والمكان بعد اللي جرّبته حتى نشوف الفرق.' : 'Record intensity and location after what you tried, to see the difference.') : (ar ? 'حدّث الشدة والمكان حتى نتابع كيف عم يتغيّر.' : 'Update intensity and location to track how it changes.')}
            initialIntensity={currentSegment?.intensity ?? 4}
            onSave={handleCheckInSave}
            onClose={() => setCheckInContext(null)}
          />
        </Suspense>
      )}
    </div>
  )
}

type TodayProps = {
  locale: Locale; theme: Theme; active?: Episode; currentSegment?: IntensityRow; episodes: Episode[]
  overview: ReturnType<typeof buildOverview>; risk: ReturnType<typeof buildWeekdayRisk>; loading: boolean
  note: string; parsedNote: ParsedNote | null; interventionTemplates: InterventionTemplate[]
  organizerSource: { provider: string; model: string } | null; organizerBusy: boolean
  onStart: () => void; onEarlier: () => void; onDescribeAI: () => void; onEnd: () => void; onNewCheckIn: () => void
  onSaveInterventions: (items: InterventionDraft[]) => Promise<void>
  onCreateInterventionTemplate: (name: string, unit: string | null) => Promise<void>
  onSetInterventionEffect: (id: string, effect: EffectValue) => Promise<void>
  onNote: (value: string) => void; onOrganize: () => void; onApplyNote: (final: ParsedNote, marks: HeadPoint[]) => void; onDiscardParse: () => void
  onInsights: () => void; onAsk: () => void; onSelectEpisode: (id: string) => void
}

function TodayView(props: TodayProps) {
  const { locale, theme, active, currentSegment, risk, episodes } = props
  const ar = locale === 'ar'
  const confidence = risk.confidence === 'high' ? (ar ? 'ثقة مرتفعة' : 'High confidence') : risk.confidence === 'medium' ? (ar ? 'ثقة متوسطة' : 'Medium confidence') : (ar ? 'ثقة محدودة' : 'Limited confidence')
  const timeline = active ? buildCheckInTimeline(active) : []
  const recent = episodes.slice(0, 5)
  const weekCount = countEpisodesInRange(episodes, 7)
  const timeFmt = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' })
  const rowFmt = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return <div className="page-stack">
    {active ? (
      <section className="active-card">
        <div className="active-status"><span className="pulse-dot" /><span>{ar ? 'وجع الرأس مستمر' : 'Headache in progress'}</span><small><Save size={13} />{ar ? 'محفوظ' : 'Saved'}</small></div>
        <div className="active-metrics"><div><span>{ar ? 'المدة' : 'Elapsed'}</span><strong>{formatElapsed(active.started_at, locale)}</strong></div><div><span>{ar ? 'الشدة الحالية' : 'Current intensity'}</span><strong>{currentSegment ? `${currentSegment.intensity}/10` : '—'}</strong></div></div>
        <div className="active-actions"><button className="primary-button" type="button" onClick={props.onNewCheckIn}><MapPin size={18} />{ar ? 'سجّل الشدة والمكان' : 'New check-in'}</button><button className="end-button" type="button" onClick={props.onEnd}><Square size={16} />{ar ? 'انتهى الوجع' : 'End headache'}</button></div>
      </section>
    ) : (
      <section className="start-card" aria-labelledby="start-title">
        <div className="start-card-copy"><span className="quiet-status"><span className="status-dot" />{ar ? 'ما في وجع رأس نشط' : 'No active headache'}</span><h2 id="start-title">{ar ? 'كيف حاسس هلق؟' : 'How are you feeling right now?'}</h2><p>{ar ? 'سجّل الشدة ومكان الوجع بأول لحظة، وتابع كيف بيتغيّروا.' : 'Record the intensity and where it hurts from the first moment, then track how they change.'}</p></div>
        <button className="start-button" type="button" onClick={props.onStart}><Plus size={24} />{ar ? 'بلّش وجع الرأس' : 'Start headache'}</button>
        <div className="start-secondary-row">
          <button className="secondary-action" type="button" onClick={props.onDescribeAI}><Sparkles size={18} />{ar ? 'احكيها بالذكاء' : 'Describe with AI'}</button>
          <button className="secondary-action" type="button" onClick={props.onEarlier}><Clock3 size={18} />{ar ? 'نوبة سابقة' : 'Earlier episode'}</button>
        </div>
      </section>
    )}

    {active && <div className="detail-grid">
      <section className="card progress-card">
        <div className="card-heading-row"><div><p className="eyebrow">{ar ? 'مسار النوبة' : 'PROGRESS'}</p><h3>{ar ? 'كيف عم يتغيّر؟' : 'How it is changing'}</h3></div><button className="secondary-button compact-checkin" type="button" onClick={props.onNewCheckIn}><Plus size={16} />{ar ? 'تسجيل' : 'Check in'}</button></div>
        {timeline.length ? <div className="progress-list">{timeline.map((row, index) => <div key={index} className="progress-row">
          <span className="timeline-dot" style={{ '--level': `${(row.intensity ?? 0) * 10}%` } as React.CSSProperties} />
          <time>{timeFmt.format(new Date(row.time))}</time>
          <strong>{row.intensity != null ? `${row.intensity}/10` : '—'}</strong>
          <small>{row.region ? painRegionLabel(row.region, locale) : (ar ? 'بدون مكان' : 'no location')}</small>
        </div>)}</div> : <p className="detail-empty">{ar ? 'ما في تسجيلات بعد. اكبس «تسجيل» حتى تحدد الشدة والمكان.' : 'No check-ins yet. Tap “Check in” to record intensity and location.'}</p>}
      </section>

      <InterventionEditor locale={locale} templates={props.interventionTemplates} saved={active.episode_interventions} onSave={props.onSaveInterventions} onCreateTemplate={props.onCreateInterventionTemplate} onSetEffect={props.onSetInterventionEffect} />

      <section className="card smart-note-card">
        <div className="card-heading-row"><div><p className="eyebrow smart-label"><Sparkles size={13} />{ar ? 'تنظيم ذكي' : 'SMART ORGANIZER'}</p><h3>{ar ? 'احكي شو صار بطريقتك' : 'Describe it in your own words'}</h3></div></div>
        <textarea rows={4} value={props.note} onChange={(e) => props.onNote(e.target.value)} placeholder={ar ? 'مثلاً: صحيت على وجع خفيف قدام عاليمين، وبعدين صار نبض ووصل 8 من 10…' : 'For example: I woke with mild pain in the front right, then it became pulsing and reached 8 out of 10…'} />
        <button className="secondary-button" type="button" onClick={props.onOrganize} disabled={!props.note.trim() || props.organizerBusy}><Sparkles size={17} />{props.organizerBusy ? (ar ? 'عم ننظّم بالذكاء الاصطناعي…' : 'Organizing with AI…') : (ar ? 'رتّب ملاحظتي' : 'Organize my note')}</button>
        {props.parsedNote && <OrganizerReview locale={locale} theme={theme} parsed={props.parsedNote} source={props.organizerSource} onApply={props.onApplyNote} onCancel={props.onDiscardParse} />}
      </section>
    </div>}

    {!active && <div className="home-insights-grid">
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">{ar ? `هالأسبوع · ${weekCount}` : `THIS WEEK · ${weekCount}`}</p><h2>{ar ? 'آخر النوبات' : 'Recent episodes'}</h2></div><button className="text-button" type="button" onClick={props.onInsights}>{ar ? 'التحليلات' : 'Insights'}</button></div>{recent.length ? <div className="episode-list">{recent.map((episode) => <button className="episode-row" type="button" key={episode.id} onClick={() => props.onSelectEpisode(episode.id)}><div className={`episode-severity severity-${Math.ceil(maxIntensity(episode) / 2)}`}>{maxIntensity(episode) || '—'}</div><div><time>{rowFmt.format(new Date(episode.started_at))}</time><p>{episode.status === 'active' ? (ar ? 'مستمرة الآن' : 'Active now') : formatHours(episodeDurationHours(episode), locale)}</p></div></button>)}</div> : <EmptyState locale={locale} />}</section>
      <section className="risk-card"><div className="risk-icon"><BarChart3 size={20} /></div><div><p className="eyebrow">{ar ? 'توقع مبني على النمط' : 'PATTERN-BASED FORECAST'}</p><h2>{episodesLabel(risk.level, ar)}</h2><p>{risk.sample ? (ar ? `يوم ${risk.topDay} تكرر أكثر ببياناتك. ${confidence}.` : `${risk.topDay} appears most often in your data. ${confidence}.`) : (ar ? 'سجّل عدة نوبات حتى نقدر نكشف نمط.' : 'Log a few episodes before a pattern can be estimated.')}</p></div><span className={`risk-pill ${risk.level}`}>{riskLevel(risk.level, ar)}</span></section>
      <section className="ask-card"><Sparkles size={21} /><div><h2>{ar ? 'اسأل بياناتك' : 'Ask your data'}</h2><p>{ar ? 'مثلاً: بأي يوم بيتكرر وجع راسي أكتر؟' : 'For example: Which day happens most often?'}</p></div><button type="button" onClick={props.onAsk}>{ar ? 'افتح' : 'Open'}</button></section>
    </div>}
  </div>
}

function episodesLabel(level: string, ar: boolean) {
  if (level === 'high') return ar ? 'احتمال اليوم أعلى من المعتاد' : 'Today looks higher than usual'
  if (level === 'medium') return ar ? 'احتمال اليوم متوسط' : 'Today shows a moderate pattern'
  return ar ? 'ما في إشارة قوية لليوم' : 'No strong signal for today'
}
function riskLevel(level: string, ar: boolean) {
  if (level === 'high') return ar ? 'مرتفع' : 'High'
  if (level === 'medium') return ar ? 'متوسط' : 'Medium'
  return ar ? 'منخفض' : 'Low'
}
function effectText(effect: string | null, ar: boolean) {
  if (!effect) return null
  const map: Record<string, [string, string]> = {
    much_better: ['تحسّن كتير', 'Much better'], slightly_better: ['تحسّن شوي', 'A bit better'],
    no_change: ['ما تغيّر', 'No change'], worse: ['زاد', 'Worse'], unknown: ['غير معروف', 'Unknown'],
  }
  return map[effect]?.[ar ? 0 : 1] ?? null
}

function HistoryView({ episodes, locale, loading, onSelect }: { episodes: Episode[]; locale: Locale; loading: boolean; onSelect: (id: string) => void }) {
  const ar = locale === 'ar'
  const dtf = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return <section className="page-stack"><div className="page-title-row"><div><p className="eyebrow">{ar ? 'كل النوبات' : 'ALL EPISODES'}</p><h2>{ar ? 'سجل وجع الرأس' : 'Headache history'}</h2><p>{ar ? 'اكبس على أي نوبة لتشوف كل تفاصيلها.' : 'Tap any episode to see every recorded detail.'}</p></div><HistoryIcon size={28} /></div>{loading ? <p>{ar ? 'عم نحمّل…' : 'Loading…'}</p> : !episodes.length ? <EmptyState locale={locale} /> : <div className="episode-list">{episodes.map((episode) => <button className="episode-row" type="button" key={episode.id} onClick={() => onSelect(episode.id)}><div className={`episode-severity severity-${Math.ceil(maxIntensity(episode) / 2)}`}>{maxIntensity(episode) || '—'}</div><div><time>{dtf.format(new Date(episode.started_at))}</time><p>{episode.status === 'active' ? (ar ? 'مستمرة الآن' : 'Active now') : `${formatHours(episodeDurationHours(episode), locale)} · ${episode.onset_kind.replace('_', ' ')}`}</p><div className="mini-chips">{episode.pain_character.map((item) => <span key={item}>{item}</span>)}{episode.pain_locations.length > 0 && <span>{ar ? `${episode.pain_locations.length} مواقع محفوظة` : `${episode.pain_locations.length} saved locations`}</span>}{episode.episode_interventions.slice(0, 2).map((item) => <span key={item.id}>{item.label || item.intervention_type}</span>)}</div></div></button>)}</div>}</section>
}

function EpisodeDetailView({ episode, locale, theme, onBack }: { episode?: Episode; locale: Locale; theme: Theme; onBack: () => void }) {
  const ar = locale === 'ar'
  const locations = useMemo(() => episode ? [...episode.pain_locations].sort((a, b) => a.created_at.localeCompare(b.created_at)) : [], [episode])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')
  const [locationView, setLocationView] = useState<'combined' | 'compare'>('combined')
  const [comparePage, setComparePage] = useState(0)
  useEffect(() => { setSelectedLocationId('all'); setLocationView('combined'); setComparePage(0) }, [episode?.id])
  useEffect(() => { setComparePage((page) => Math.min(page, Math.max(0, Math.ceil(locations.length / 2) - 1))) }, [locations.length])
  if (!episode) return <section className="page-stack"><button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} />{ar ? 'رجوع للسجل' : 'Back to history'}</button><EmptyState locale={locale} /></section>
  const selectedLocation = selectedLocationId === 'all' ? null : locations.find((item) => item.id === selectedLocationId) ?? null
  const started = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(episode.started_at))
  const time = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  const locationRegion = selectedLocation ? selectedLocation.region_code || inferPainRegion(painLocationPoints(selectedLocation)) : null
  const locationLayers: HeadLayer[] = locations.map((location, index) => ({
    id: location.id,
    marks: painLocationDisplayPoints(location),
    mode: (location.mark_type === 'area' ? 'area' : 'point') as HeadLayer['mode'],
    color: LOCATION_COLORS[index % LOCATION_COLORS.length],
    label: String(index + 1),
  })).filter((layer) => layer.marks.length > 0)
  const visibleLayers = selectedLocation ? locationLayers.filter((layer) => layer.id === selectedLocation.id) : locationLayers
  const comparePageCount = Math.max(1, Math.ceil(locations.length / 2))
  const comparisonLocations = locations.slice(comparePage * 2, comparePage * 2 + 2)

  return <section className="page-stack episode-detail-page">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} />{ar ? 'رجوع للسجل' : 'Back to history'}</button>
    <header className="episode-detail-header">
      <div><p className="eyebrow">{episode.status === 'active' ? (ar ? 'نوبة مستمرة' : 'ACTIVE EPISODE') : (ar ? 'تفاصيل النوبة' : 'EPISODE DETAILS')}</p><h2>{started}</h2></div>
      <span className={`episode-status-pill ${episode.status}`}>{episode.status === 'active' ? (ar ? 'مستمرة' : 'Active') : (ar ? 'منتهية' : 'Completed')}</span>
    </header>
    <div className="episode-summary-grid">
      <article><span>{ar ? 'أعلى شدة' : 'Peak intensity'}</span><strong>{maxIntensity(episode) || '—'}<small>/10</small></strong></article>
      <article><span>{ar ? 'المدة' : 'Duration'}</span><strong>{episode.status === 'active' ? formatElapsed(episode.started_at, locale) : formatHours(episodeDurationHours(episode), locale)}</strong></article>
      <article><span>{ar ? 'تغيّر المكان' : 'Location records'}</span><strong>{locations.length}</strong></article>
    </div>

    <section className="card location-history-card">
      <div className="card-heading-row"><div><p className="eyebrow">{ar ? 'مع الوقت' : 'OVER TIME'}</p><h3>{ar ? 'أماكن الوجع المحفوظة' : 'Saved pain locations'}</h3></div><MapPin size={22} /></div>
      {!locations.length ? <div className="detail-empty"><p>{ar ? 'ما انحفظ مكان ألم بهالنوبة.' : 'No pain location was saved for this episode.'}</p></div> : <>
        <div className="location-view-controls" role="group" aria-label={ar ? 'اختيار عرض أماكن الألم' : 'Choose pain-location view'}>
          <button type="button" className={locationView === 'combined' ? 'selected' : ''} onClick={() => { setLocationView('combined'); setSelectedLocationId('all') }} aria-pressed={locationView === 'combined'}><Layers3 size={17} />{ar ? 'على رأس واحد' : 'On one head'}<span>{locations.length}</span></button>
          <button type="button" className={locationView === 'compare' ? 'selected' : ''} onClick={() => { setLocationView('compare'); setSelectedLocationId('all') }} aria-pressed={locationView === 'compare'} disabled={locations.length < 2}><LayoutGrid size={17} />{ar ? 'مقارنة جنب بعض' : 'Side-by-side comparison'}</button>
        </div>
        {locationView === 'combined' ? <>
          <Suspense fallback={<div className="head-map-card map-loading">{ar ? 'عم نجهّز المجسّم…' : 'Loading 3D head…'}</div>}><HeadMap3D locale={locale} theme={theme} marks={[]} mode="point" onModeChange={() => undefined} onMarksChange={() => undefined} readOnly layers={visibleLayers} /></Suspense>
          {selectedLocation ? <div className="selected-location-meta"><strong>{painRegionLabel(locationRegion, locale)}</strong><span>{time.format(new Date(selectedLocation.created_at))}</span>{selectedLocation.intensity !== null && <span>{ar ? `الشدة وقتها ${selectedLocation.intensity}/10` : `Intensity then ${selectedLocation.intensity}/10`}</span>}</div> : <div className="selected-location-meta combined"><strong>{ar ? 'تطوّر مكان الألم كاملاً' : 'Complete pain-location progression'}</strong><span>{ar ? 'كل رقم هو علامة الألم نفسها، ومرتب حسب الوقت' : 'Each number is the pain marker itself, ordered by time'}</span></div>}
        </> : <div className="location-comparison-view">
          <div className="location-comparison-grid">{comparisonLocations.map((location, pageIndex) => {
            const index = comparePage * 2 + pageIndex
            const region = location.region_code || inferPainRegion(painLocationPoints(location))
            const layer = locationLayers.find((item) => item.id === location.id)
            const color = LOCATION_COLORS[index % LOCATION_COLORS.length]
            return <article className="location-comparison-card" key={location.id} style={{ '--snapshot-color': color } as React.CSSProperties}>
              <header><span className="snapshot-index">{index + 1}</span><div><strong>{painRegionLabel(region, locale)}</strong><time>{time.format(new Date(location.created_at))}</time></div>{location.intensity !== null && <b>{location.intensity}/10</b>}</header>
              <Suspense fallback={<div className="head-map-card compact map-loading">{ar ? 'عم نجهّز…' : 'Loading…'}</div>}><HeadMap3D locale={locale} theme={theme} marks={[]} mode="point" onModeChange={() => undefined} onMarksChange={() => undefined} readOnly compact cameraPosition={painLocationCameraPosition(location)} layers={layer ? [{ ...layer, label: undefined }] : []} /></Suspense>
              <small>{painLocationPoints(location).length ? (ar ? 'المكان المحفوظ بدقة' : 'Exact saved location') : (ar ? 'مكان تقريبي من الوصف' : 'Approximate location from description')}</small>
            </article>
          })}</div>
          {comparePageCount > 1 && <div className="comparison-pager"><button type="button" disabled={comparePage === 0} onClick={() => setComparePage((page) => Math.max(0, page - 1))}>{ar ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}{ar ? 'السابق' : 'Previous'}</button><span aria-live="polite">{comparePage + 1} / {comparePageCount}</span><button type="button" disabled={comparePage === comparePageCount - 1} onClick={() => setComparePage((page) => Math.min(comparePageCount - 1, page + 1))}>{ar ? 'التالي' : 'Next'}{ar ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button></div>}
        </div>}
        <div className="location-snapshot-list" role="group" aria-label={ar ? 'الخط الزمني لمكان الألم' : 'Pain location timeline'}>{locations.map((location, index) => {
          const region = location.region_code || inferPainRegion(painLocationPoints(location))
          const color = LOCATION_COLORS[index % LOCATION_COLORS.length]
          const regionLabel = painRegionLabel(region, locale)
          const exact = painLocationPoints(location).length > 0
          return <button type="button" className={location.id === selectedLocation?.id && locationView === 'combined' ? 'selected' : ''} key={location.id} onClick={() => { setLocationView('combined'); setSelectedLocationId(location.id) }} aria-pressed={location.id === selectedLocation?.id && locationView === 'combined'} aria-label={ar ? `المكان ${index + 1}: ${regionLabel}، الساعة ${time.format(new Date(location.created_at))}` : `Location ${index + 1}: ${regionLabel}, ${time.format(new Date(location.created_at))}`} style={{ '--snapshot-color': color } as React.CSSProperties}><span className="snapshot-index">{index + 1}</span><span><strong>{regionLabel}</strong><small>{time.format(new Date(location.created_at))} · {location.mark_type === 'area' ? (ar ? 'مساحة' : 'Area') : (ar ? 'نقطة' : 'Point')}{!exact && ` · ${ar ? 'تقريبي من الوصف' : 'Approx. from description'}`}</small></span>{location.intensity !== null && <b>{location.intensity}/10</b>}</button>
        })}</div>
      </>}
    </section>

    <div className="episode-detail-grid">
      <section className="card detail-section"><h3>{ar ? 'تغيّر الشدة' : 'Intensity timeline'}</h3>{!episode.intensity_segments.length ? <p className="detail-empty">{ar ? 'ما في شدات محفوظة.' : 'No intensity records.'}</p> : <div className="timeline-list compact">{[...episode.intensity_segments].sort((a, b) => a.started_at.localeCompare(b.started_at)).map((segment) => <div key={segment.id}><span className="timeline-dot" style={{ '--level': `${segment.intensity * 10}%` } as React.CSSProperties} /><time>{time.format(new Date(segment.started_at))}</time><strong>{segment.intensity}/10</strong>{segment.ended_at && <small>→ {time.format(new Date(segment.ended_at))}</small>}</div>)}</div>}</section>
      <section className="card detail-section"><h3>{ar ? 'شو جرّبت' : 'What you tried'}</h3>{!episode.episode_interventions.length ? <p className="detail-empty">{ar ? 'ما في علاجات أو خطوات محفوظة.' : 'No interventions recorded.'}</p> : <div className="detail-treatment-list">{[...episode.episode_interventions].sort((a, b) => a.performed_at.localeCompare(b.performed_at)).map((item) => <div key={item.id}><strong>{item.label || item.intervention_type.replace('_', ' ')}</strong><span>{time.format(new Date(item.performed_at))}</span>{item.effect && <em className={`effect-tag effect-${item.effect}`}>{effectText(item.effect, ar)}</em>}<small>{[item.amount, item.unit, item.notes].filter(Boolean).join(' · ')}</small></div>)}</div>}</section>
    </div>
    {(episode.notes || episode.pain_character.length > 0) && <section className="card detail-section"><h3>{ar ? 'ملاحظات وصفات الألم' : 'Notes and pain character'}</h3>{episode.pain_character.length > 0 && <div className="mini-chips">{episode.pain_character.map((item) => <span key={item}>{item}</span>)}</div>}{episode.notes && <p className="episode-notes">{episode.notes}</p>}</section>}
  </section>
}

function AskView({ locale, episodes, question, answer, source, busy, onQuestion, onAsk }: { locale: Locale; episodes: Episode[]; question: string; answer: string; source: { provider: string; model: string } | null; busy: boolean; onQuestion: (value: string) => void; onAsk: (value: string) => void }) {
  const ar = locale === 'ar'
  const suggestions = ar ? ['بأي يوم بيتكرر وجع راسي أكتر؟', 'قديش متوسط مدة النوبة؟', 'هل القهوة أو الدواء ارتبطوا بتحسن؟', 'كم نوبة بلشت وقت صحيت؟'] : ['Which day happens most often?', 'What is my average episode duration?', 'Did coffee or medication relate to improvement?', 'How many episodes started on waking?']
  return <section className="page-stack reading"><div className="page-title-row ask-title"><div><p className="eyebrow">{ar ? 'من بياناتك فقط' : 'FROM YOUR DATA ONLY'}</p><h2>{ar ? 'اسأل عن وجع راسك' : 'Ask about your headaches'}</h2><p>{ar ? `الإجابات مبنية على ${episodes.length} نوبة سجلتها إنت.` : `Answers are based on your ${episodes.length} recorded episodes.`}</p></div><Sparkles size={28} /></div><section className="ask-workspace card"><label htmlFor="data-question">{ar ? 'شو حابب تعرف؟' : 'What would you like to know?'}</label><textarea id="data-question" rows={3} value={question} onChange={(e) => onQuestion(e.target.value)} placeholder={ar ? 'اكتب سؤالك هون…' : 'Type your question here…'} /><button className="primary-button" type="button" disabled={!question.trim() || busy} onClick={() => onAsk(question)}><Sparkles size={18} />{busy ? (ar ? 'عم نحلل بياناتك…' : 'Analyzing your data…') : (ar ? 'اسأل بياناتي' : 'Ask my data')}</button>{answer && <div className="answer-card" role="status"><div><Sparkles size={18} /></div><div><p>{answer}</p>{source && <ModelBadge source={source} locale={locale} />}</div></div>}</section><section><h3 className="suggestions-title">{ar ? 'أسئلة مقترحة' : 'Suggested questions'}</h3><div className="suggestion-list">{suggestions.map((item) => <button type="button" key={item} onClick={() => onAsk(item)} disabled={busy}><span>{item}</span><ChevronRight size={17} /></button>)}</div></section><p className="medical-disclaimer">{ar ? 'ما تستخدم هاي الإجابات كتشخيص أو كبديل عن طبيب.' : 'Do not use these answers as a diagnosis or substitute for medical care.'}</p></section>
}

function ModelBadge({ source, locale }: { source: { provider: string; model: string }; locale: Locale }) {
  const provider = source.provider === 'gemini' ? 'Gemini' : source.provider === 'nvidia' ? 'NVIDIA' : source.provider === 'openrouter' ? 'OpenRouter' : (locale === 'ar' ? 'تحليل محلي' : 'Local analysis')
  return <span className={`model-badge provider-${source.provider}`} title={source.model}><span className="model-dot" />{provider}<small>· {source.model}</small></span>
}

function EarlierDialog({ locale, onClose, onSave }: { locale: Locale; onClose: () => void; onSave: (start: string, end: string) => void }) {
  const ar = locale === 'ar'
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  const [start, setStart] = useState(local)
  const [end, setEnd] = useState(local)
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="earlier-title" onMouseDown={(e) => e.stopPropagation()}><p className="eyebrow">{ar ? 'إدخال يدوي' : 'MANUAL ENTRY'}</p><h2 id="earlier-title">{ar ? 'سجّل نوبة سابقة' : 'Log an earlier episode'}</h2><label>{ar ? 'وقت البداية' : 'Start time'}<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>{ar ? 'وقت النهاية' : 'End time'}<input type="datetime-local" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label><div className="button-row"><button className="primary-button" type="button" disabled={!start || !end || end < start} onClick={() => onSave(new Date(start).toISOString(), new Date(end).toISOString())}>{ar ? 'احفظ النوبة' : 'Save episode'}</button><button className="ghost-button" type="button" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</button></div></section></div>
}

function EmptyState({ locale }: { locale: Locale }) { return <div className="empty-state"><Brain size={30} /><h3>{locale === 'ar' ? 'لسا ما في نوبات' : 'No episodes yet'}</h3><p>{locale === 'ar' ? 'أول نوبة بتسجلها رح تظهر هون.' : 'Your first recorded episode will appear here.'}</p></div> }
function ViewLoading({ locale }: { locale: Locale }) { return <div className="empty-chart">{locale === 'ar' ? 'عم نجهّز الصفحة…' : 'Loading view…'}</div> }
