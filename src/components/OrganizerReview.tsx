import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Check, HelpCircle, MapPin, Minus, Plus, Trash2, X } from 'lucide-react'
import type { HeadPoint } from './HeadMap3D'
import type { Locale } from '../lib/i18n'
import type { ParsedIntervention, ParsedNote } from '../lib/analytics'

const HeadMap3D = lazy(() => import('./HeadMap3D').then((module) => ({ default: module.HeadMap3D })))

const ONSETS: Array<{ value: string; en: string; ar: string }> = [
  { value: 'sudden', en: 'Sudden', ar: 'فجأة' },
  { value: 'gradual', en: 'Gradual', ar: 'خفيف وزاد' },
  { value: 'on_waking', en: 'On waking', ar: 'وقت صحيت' },
  { value: 'unknown', en: 'Not sure', ar: 'ما بعرف' },
]
const CHARACTERS: Array<{ value: string; en: string; ar: string }> = [
  { value: 'pulsing', en: 'Pulsing', ar: 'نبض' },
  { value: 'pressure', en: 'Pressure', ar: 'ضغط' },
  { value: 'sharp', en: 'Sharp', ar: 'طعن' },
  { value: 'tight', en: 'Tight', ar: 'شد' },
]
const UNITS: Array<{ value: string; en: string; ar: string; step: number }> = [
  { value: 'tablet', en: 'tablet', ar: 'حبة', step: 0.5 },
  { value: 'cup', en: 'cup', ar: 'فنجان', step: 1 },
  { value: 'minute', en: 'min', ar: 'دقيقة', step: 5 },
  { value: 'hour', en: 'hour', ar: 'ساعة', step: 1 },
  { value: 'time', en: 'time', ar: 'مرة', step: 1 },
]
const TYPE_LABELS: Record<string, [string, string]> = {
  medication: ['دواء', 'Medication'], coffee: ['قهوة', 'Coffee'], sleep: ['نوم', 'Sleep'], rest: ['تمدد', 'Lie down'],
  head_wrap: ['ربط الرأس', 'Head wrap'], water: ['مي', 'Water'], dark_room: ['غرفة عتمة', 'Dark room'], custom: ['غيره', 'Other'],
}

type Props = {
  locale: Locale
  theme: 'light' | 'dark'
  parsed: ParsedNote
  source: { provider: string; model: string } | null
  onApply: (final: ParsedNote, marks: HeadPoint[]) => void
  onCancel: () => void
  requireBoth?: boolean
  headerSlot?: ReactNode
  submitLabel?: string
  cancelLabel?: string
  extraInvalid?: boolean
}

export function OrganizerReview({ locale, theme, parsed, source, onApply, onCancel, requireBoth = false, headerSlot, submitLabel, cancelLabel, extraInvalid = false }: Props) {
  const ar = locale === 'ar'
  const [onsetKind, setOnsetKind] = useState(parsed.onsetKind)
  const [intensity, setIntensity] = useState(parsed.intensity ?? 5)
  const [hasIntensity, setHasIntensity] = useState(requireBoth ? true : parsed.intensity != null)
  const [characters, setCharacters] = useState<string[]>(parsed.characters)
  const [interventions, setInterventions] = useState<ParsedIntervention[]>(parsed.interventions)
  const [note, setNote] = useState(parsed.note)
  const [marks, setMarks] = useState<HeadPoint[]>([])
  const [markMode, setMarkMode] = useState<'point' | 'area'>('point')
  const [showMap, setShowMap] = useState(false)

  const typeLabel = (type: string) => TYPE_LABELS[type]?.[ar ? 0 : 1] ?? type
  const stepFor = (unit: string | null) => UNITS.find((item) => item.value === unit)?.step ?? 1

  function toggleCharacter(value: string) {
    setCharacters((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }
  function updateIntervention(index: number, patch: Partial<ParsedIntervention>) {
    setInterventions((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function bumpAmount(index: number, direction: 1 | -1) {
    setInterventions((current) => current.map((item, i) => {
      if (i !== index) return item
      const step = stepFor(item.unit)
      const next = Math.max(0, Math.round(((item.amount ?? 0) + direction * step) / step) * step)
      return { ...item, amount: Number(next.toFixed(2)) }
    }))
  }

  const canApply = requireBoth ? (hasIntensity && marks.length > 0 && !extraInvalid) : !extraInvalid

  function apply() {
    if (!canApply) return
    onApply({ onsetKind, intensity: hasIntensity ? intensity : null, characters, interventions, region: parsed.region, note: note.trim(), followups: [] }, marks)
  }

  return <div className="organizer-review">
    <div className="review-head"><p>{ar ? 'راجع وعدّل قبل الحفظ' : 'Review and edit before saving'}</p>{source && <span className={`model-badge provider-${source.provider}`} title={source.model}><span className="model-dot" />{source.provider === 'local' ? (ar ? 'تحليل محلي' : 'Local') : source.provider}</span>}</div>

    {headerSlot}

    {parsed.followups.length > 0 && <div className="review-followups"><HelpCircle size={16} /><div><strong>{ar ? 'كمّل التفاصيل الناقصة:' : 'A few missing details:'}</strong><ul>{parsed.followups.map((item, index) => <li key={index}>{item.question}</li>)}</ul></div></div>}

    <div className="review-field">
      <label>{ar ? 'كيف بلّش؟' : 'How did it start?'}</label>
      <div className="review-segmented">{ONSETS.map((item) => <button type="button" key={item.value} className={onsetKind === item.value ? 'selected' : ''} aria-pressed={onsetKind === item.value} onClick={() => setOnsetKind(item.value)}>{ar ? item.ar : item.en}</button>)}</div>
    </div>

    <div className="review-field">
      <div className="review-field-head"><label>{ar ? 'الشدة' : 'Intensity'}{requireBoth && <span className="review-req"> *</span>}</label>{!requireBoth && <button type="button" className="checkin-skip" aria-pressed={!hasIntensity} onClick={() => setHasIntensity((value) => !value)}>{hasIntensity ? (ar ? 'ما بعرف' : 'Not sure') : (ar ? 'حدّد' : 'Set it')}</button>}</div>
      {hasIntensity ? <>
        <div className="checkin-intensity-value"><strong className={`intensity-badge intensity-${Math.ceil(intensity / 2)}`}>{intensity}/10</strong></div>
        <input className="intensity-slider" type="range" min="0" max="10" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} aria-label={ar ? 'الشدة' : 'Intensity'} />
      </> : <p className="checkin-muted">{ar ? 'بدون شدة.' : 'No intensity set.'}</p>}
    </div>

    <div className="review-field">
      <label>{ar ? 'نوع الوجع' : 'Pain character'}</label>
      <div className="review-chips">{CHARACTERS.map((item) => <button type="button" key={item.value} className={characters.includes(item.value) ? 'selected' : ''} aria-pressed={characters.includes(item.value)} onClick={() => toggleCharacter(item.value)}>{ar ? item.ar : item.en}</button>)}</div>
    </div>

    <div className="review-field">
      <div className="review-field-head"><label>{ar ? 'مكان الوجع' : 'Pain location'}{requireBoth && <span className="review-req"> *</span>}</label>{marks.length > 0 ? <span className="review-marked"><Check size={13} />{ar ? 'تحدّد' : 'Marked'}</span> : requireBoth && <span className="checkin-required">{ar ? 'مطلوب' : 'required'}</span>}</div>
      <button type="button" className="secondary-button review-map-toggle" onClick={() => setShowMap((value) => !value)}><MapPin size={16} />{showMap ? (ar ? 'خبّي المجسّم' : 'Hide 3D head') : marks.length ? (ar ? 'عدّل المكان' : 'Edit location') : (ar ? 'علّم مكان الوجع' : 'Mark on the 3D head')}</button>
      {showMap && <Suspense fallback={<div className="head-map-card map-loading">{ar ? 'عم نجهّز…' : 'Loading…'}</div>}><HeadMap3D locale={locale} theme={theme} marks={marks} mode={markMode} onModeChange={setMarkMode} onMarksChange={setMarks} /></Suspense>}
      {!marks.length && <p className="review-hint">{ar ? 'ما رح نحفظ مكان إلا لما تعلّمه إنت.' : 'No location is saved unless you mark it yourself.'}</p>}
    </div>

    {interventions.length > 0 && <div className="review-field">
      <label>{ar ? 'اللي جرّبته' : 'What you tried'}</label>
      <div className="review-interventions">{interventions.map((item, index) => <div className="review-intervention" key={index}>
        <div className="review-intervention-head"><strong>{typeLabel(item.type)}</strong><button type="button" className="review-remove" onClick={() => setInterventions((current) => current.filter((_, i) => i !== index))} aria-label={ar ? 'احذف' : 'Remove'}><Trash2 size={15} /></button></div>
        {(item.type === 'medication' || item.type === 'custom') && <input className="review-name" value={item.name ?? ''} onChange={(event) => updateIntervention(index, { name: event.target.value || null })} placeholder={item.type === 'medication' ? (ar ? 'اسم الدواء' : 'Medicine name') : (ar ? 'الاسم' : 'Name')} />}
        <div className="review-amount-row">
          <div className="amount-stepper">
            <button type="button" onClick={() => bumpAmount(index, -1)} aria-label={ar ? 'أنقص' : 'Decrease'}><Minus size={15} /></button>
            <input type="number" inputMode="decimal" min="0" step={stepFor(item.unit)} value={item.amount ?? ''} placeholder="—" onChange={(event) => updateIntervention(index, { amount: event.target.value === '' ? null : Number(event.target.value) })} aria-label={ar ? 'الكمية' : 'Amount'} />
            <button type="button" onClick={() => bumpAmount(index, 1)} aria-label={ar ? 'زد' : 'Increase'}><Plus size={15} /></button>
          </div>
          <div className="unit-pills">{UNITS.map((unit) => <button type="button" key={unit.value} className={item.unit === unit.value ? 'selected' : ''} aria-pressed={item.unit === unit.value} onClick={() => updateIntervention(index, { unit: unit.value })}>{ar ? unit.ar : unit.en}</button>)}</div>
        </div>
      </div>)}</div>
    </div>}

    <div className="review-field">
      <label>{ar ? 'الملاحظة' : 'Note'}</label>
      <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
    </div>

    {requireBoth && !canApply && <p className="review-hint review-gate">{ar ? 'لازم تحدد الشدة وتعلّم مكان الوجع لتكمّل.' : 'Set the intensity and mark the pain location to continue.'}</p>}
    <div className="review-actions">
      <button className="primary-button" type="button" onClick={apply} disabled={!canApply}><Check size={17} />{submitLabel ?? (ar ? 'احفظ التفاصيل' : 'Save details')}</button>
      <button className="ghost-button" type="button" onClick={onCancel}><X size={16} />{cancelLabel ?? (ar ? 'رجوع للنص' : 'Back to text')}</button>
    </div>
  </div>
}
