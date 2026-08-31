import { useState } from 'react'
import { PenLine, Sparkles, X } from 'lucide-react'
import type { HeadPoint } from './HeadMap3D'
import { OrganizerReview } from './OrganizerReview'
import type { Locale } from '../lib/i18n'
import type { ParsedNote } from '../lib/analytics'

export type EpisodeTime = { startAt: string; endAt: string }

type Props = {
  locale: Locale
  theme: 'light' | 'dark'
  mode: 'now' | 'earlier'
  saving?: boolean
  organizeText: (text: string) => Promise<{ parsed: ParsedNote; source: { provider: string; model: string }; failed: boolean }>
  onCreate: (final: ParsedNote, marks: HeadPoint[], time: EpisodeTime | null) => void | Promise<void>
  onClose: () => void
}

const EMPTY: ParsedNote = { onsetKind: 'unknown', intensity: null, characters: [], interventions: [], region: null, note: '', followups: [] }

function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const localNow = () => localInput(new Date())
const localPlusHour = () => localInput(new Date(Date.now() + 3_600_000))

export function EpisodeComposer({ locale, theme, mode, saving = false, organizeText, onCreate, onClose }: Props) {
  const ar = locale === 'ar'
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedNote | null>(null)
  const [source, setSource] = useState<{ provider: string; model: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [start, setStart] = useState(localNow())
  const [end, setEnd] = useState(localPlusHour())

  const timesInvalid = mode === 'earlier' && (!start || !end || end < start)

  async function organize() {
    if (!text.trim()) return
    setBusy(true)
    try {
      const result = await organizeText(text)
      setParsed(result.parsed)
      setSource(result.source)
    } finally {
      setBusy(false)
    }
  }

  function fillManually() {
    setParsed({ ...EMPTY, note: text })
    setSource(null)
  }

  function handleApply(final: ParsedNote, marks: HeadPoint[]) {
    const time: EpisodeTime | null = mode === 'earlier' ? { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() } : null
    void onCreate(final, marks, time)
  }

  const timeSlot = mode === 'earlier' ? (
    <div className="composer-time">
      <label>{ar ? 'وقت البداية' : 'Start time'}<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label>{ar ? 'وقت النهاية' : 'End time'}<input type="datetime-local" min={start} value={end} onChange={(event) => setEnd(event.target.value)} /></label>
    </div>
  ) : null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card checkin-sheet composer-sheet" role="dialog" aria-modal="true" aria-labelledby="composer-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="checkin-head">
          <div><p className="eyebrow">{mode === 'earlier' ? (ar ? 'نوبة سابقة' : 'EARLIER EPISODE') : (ar ? 'نوبة جديدة' : 'NEW EPISODE')}</p><h2 id="composer-title">{mode === 'earlier' ? (ar ? 'سجّل نوبة سابقة بالتفصيل' : 'Log an earlier episode') : (ar ? 'احكي شو عم يصير' : 'Describe what is happening')}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'}><X size={18} /></button>
        </div>

        {!parsed ? <>
          {timeSlot}
          <label className="checkin-note-label">{ar ? 'اكتب بطريقتك، والذكاء الاصطناعي بيرتّبها' : 'Write it your way — the AI will organize it'}
            <textarea rows={5} value={text} onChange={(event) => setText(event.target.value)} placeholder={ar ? 'مثلاً: صحيت على وجع قدام عاليمين، صار نبض ووصل 8 من 10، أخدت بنادول حبتين…' : 'e.g. I woke with pain in the front right, it became pulsing and reached 8/10, I took two Panadol…'} />
          </label>
          <div className="composer-actions">
            <button className="primary-button" type="button" onClick={organize} disabled={!text.trim() || busy}><Sparkles size={17} />{busy ? (ar ? 'عم ننظّم…' : 'Organizing…') : (ar ? 'رتّب بالذكاء الاصطناعي' : 'Organize with AI')}</button>
            <button className="ghost-button" type="button" onClick={fillManually}><PenLine size={16} />{ar ? 'عبّي يدوي' : 'Fill manually'}</button>
          </div>
        </> : (
          <OrganizerReview
            locale={locale} theme={theme} parsed={parsed} source={source} requireBoth headerSlot={timeSlot} extraInvalid={timesInvalid}
            submitLabel={saving ? (ar ? 'عم نحفظ…' : 'Saving…') : mode === 'earlier' ? (ar ? 'احفظ النوبة' : 'Save episode') : (ar ? 'ابدأ النوبة' : 'Start episode')}
            cancelLabel={ar ? 'رجوع' : 'Back'}
            onApply={handleApply} onCancel={() => setParsed(null)}
          />
        )}
      </section>
    </div>
  )
}
