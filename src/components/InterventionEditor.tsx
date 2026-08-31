import { useMemo, useState } from 'react'
import { Check, Coffee, Footprints, Minus, Moon, Pill, Plus, Save, SunMedium, Waves } from 'lucide-react'
import type { Locale } from '../lib/i18n'

export type InterventionTemplate = { id: string; name: string; default_unit: string | null }
export type EffectValue = 'much_better' | 'slightly_better' | 'no_change' | 'worse'
export type InterventionDraft = {
  intervention_type: 'medication' | 'coffee' | 'sleep' | 'rest' | 'head_wrap' | 'water' | 'dark_room' | 'custom'
  label: string | null
  amount: number | null
  unit: string | null
  notes: string | null
}

type SavedIntervention = {
  id: string
  intervention_type: string
  label: string | null
  amount: number | null
  unit: string | null
  notes: string | null
  effect?: string | null
}
type Option = {
  key: string
  type: InterventionDraft['intervention_type']
  en: string
  ar: string
  unit: string
  amountLabelEn: string
  amountLabelAr: string
  icon: typeof Pill
  customLabel?: string
}

const builtIns: Option[] = [
  { key: 'medication', type: 'medication', en: 'Medication', ar: 'دواء', unit: 'tablet', amountLabelEn: 'Tablets', amountLabelAr: 'عدد الحبات', icon: Pill },
  { key: 'coffee', type: 'coffee', en: 'Coffee', ar: 'قهوة', unit: 'cup', amountLabelEn: 'Cups', amountLabelAr: 'عدد الفناجين', icon: Coffee },
  { key: 'sleep', type: 'sleep', en: 'Sleep', ar: 'نوم', unit: 'hour', amountLabelEn: 'Hours', amountLabelAr: 'كم ساعة', icon: Moon },
  { key: 'rest', type: 'rest', en: 'Lie down', ar: 'تمدد', unit: 'minute', amountLabelEn: 'Minutes', amountLabelAr: 'كم دقيقة', icon: SunMedium },
  { key: 'head_wrap', type: 'head_wrap', en: 'Head wrap', ar: 'ربط الرأس', unit: 'hour', amountLabelEn: 'Hours', amountLabelAr: 'كم ساعة', icon: Waves },
  { key: 'walking', type: 'custom', en: 'Walking', ar: 'مشي', unit: 'minute', amountLabelEn: 'Minutes', amountLabelAr: 'كم دقيقة', icon: Footprints, customLabel: 'Walking' },
]

const UNIT_OPTIONS: Array<{ value: string; en: string; ar: string; step: number }> = [
  { value: 'tablet', en: 'tablet', ar: 'حبة', step: 0.5 },
  { value: 'cup', en: 'cup', ar: 'فنجان', step: 1 },
  { value: 'minute', en: 'min', ar: 'دقيقة', step: 5 },
  { value: 'hour', en: 'hour', ar: 'ساعة', step: 1 },
  { value: 'time', en: 'time', ar: 'مرة', step: 1 },
]

const EFFECTS: Array<{ value: EffectValue; en: string; ar: string }> = [
  { value: 'much_better', en: 'Much better', ar: 'تحسّن كتير' },
  { value: 'slightly_better', en: 'A bit better', ar: 'تحسّن شوي' },
  { value: 'no_change', en: 'No change', ar: 'ما تغيّر' },
  { value: 'worse', en: 'Worse', ar: 'زاد' },
]

function stepFor(unit: string) {
  return UNIT_OPTIONS.find((item) => item.value === unit)?.step ?? 1
}

type Props = {
  locale: Locale
  templates: InterventionTemplate[]
  saved: SavedIntervention[]
  onSave: (items: InterventionDraft[]) => Promise<void>
  onCreateTemplate: (name: string, unit: string | null) => Promise<void>
  onSetEffect?: (id: string, effect: EffectValue) => Promise<void>
}

export function InterventionEditor({ locale, templates, saved, onSave, onCreateTemplate, onSetEffect }: Props) {
  const ar = locale === 'ar'
  const options = useMemo<Option[]>(() => [
    ...builtIns,
    ...templates.map((template) => ({ key: `template-${template.id}`, type: 'custom' as const, en: template.name, ar: template.name, unit: template.default_unit || 'minute', amountLabelEn: 'Amount or duration', amountLabelAr: 'الكمية أو المدة', icon: Plus, customLabel: template.name })),
  ], [templates])
  const [selected, setSelected] = useState<string[]>([])
  const [details, setDetails] = useState<Record<string, { label: string; amount: string; unit: string; notes: string; noteOpen: boolean }>>({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('minute')
  const [saving, setSaving] = useState(false)
  const [effectPending, setEffectPending] = useState<string | null>(null)

  function defaultLabel(option: Option) {
    // No hardcoded brand name; medication + custom start blank so the user types their own.
    return option.type === 'custom' ? (option.customLabel ?? '') : ''
  }

  function toggle(option: Option) {
    setSelected((current) => current.includes(option.key) ? current.filter((key) => key !== option.key) : [...current, option.key])
    setDetails((current) => current[option.key] ? current : {
      ...current,
      [option.key]: { label: defaultLabel(option), amount: option.unit === 'minute' ? '10' : '1', unit: option.unit, notes: '', noteOpen: false },
    })
  }

  function update(key: string, field: 'label' | 'amount' | 'unit' | 'notes', value: string) {
    setDetails((current) => ({ ...current, [key]: { ...current[key], [field]: value } }))
  }

  function bumpAmount(key: string, direction: 1 | -1) {
    setDetails((current) => {
      const detail = current[key]
      if (!detail) return current
      const step = stepFor(detail.unit)
      const next = Math.max(0, Math.round(((Number(detail.amount) || 0) + direction * step) / step) * step)
      return { ...current, [key]: { ...detail, amount: String(Number(next.toFixed(2))) } }
    })
  }

  function toggleNote(key: string) {
    setDetails((current) => ({ ...current, [key]: { ...current[key], noteOpen: !current[key]?.noteOpen } }))
  }

  async function saveAll() {
    const drafts = selected.flatMap((key) => {
      const option = options.find((item) => item.key === key)
      const detail = details[key]
      if (!option || !detail) return []
      return [{
        intervention_type: option.type,
        label: option.type === 'medication' || option.type === 'custom' ? (detail.label.trim() || option.customLabel || (ar ? option.ar : option.en)) : null,
        amount: detail.amount ? Number(detail.amount) : null,
        unit: detail.unit || null,
        notes: detail.notes.trim() || null,
      } satisfies InterventionDraft]
    })
    if (!drafts.length) return
    setSaving(true)
    try {
      await onSave(drafts)
      setSelected([])
      setDetails({})
    } finally {
      setSaving(false)
    }
  }

  async function createOption() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await onCreateTemplate(newName.trim(), newUnit || null)
      setNewName('')
      setNewUnit('minute')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  async function chooseEffect(id: string, effect: EffectValue) {
    if (!onSetEffect) return
    setEffectPending(id)
    try {
      await onSetEffect(id, effect)
    } finally {
      setEffectPending(null)
    }
  }

  return <section className="card intervention-card">
    <div className="card-heading-row"><div><p className="eyebrow">{ar ? 'العلاج' : 'RELIEF'}</p><h3>{ar ? 'شو جرّبت حتى يخف؟' : 'What did you try?'}</h3><p className="card-helper">{ar ? 'اكبس الخيار، عدّل الكمية إذا بدك، وبعدين احفظ.' : 'Tap what you tried, tweak the amount if you like, then save.'}</p></div></div>

    <div className="intervention-grid">
      {options.map((option) => <button className={selected.includes(option.key) ? 'selected' : ''} aria-pressed={selected.includes(option.key)} type="button" key={option.key} onClick={() => toggle(option)}>
        {selected.includes(option.key) && <span className="intervention-check" aria-hidden="true"><Check size={12} /></span>}
        <option.icon size={20} /><span>{ar ? option.ar : option.en}</span>
      </button>)}
      <button className="add-option-button" type="button" onClick={() => setAdding(!adding)} aria-expanded={adding}><Plus size={20} /><span>{ar ? 'إضافة خيار' : 'Add option'}</span></button>
    </div>

    {!!selected.length && <div className="selected-treatment-list">{selected.map((key) => {
      const option = options.find((item) => item.key === key)!
      const detail = details[key]
      return <fieldset key={key}>
        <legend><option.icon size={15} />{ar ? option.ar : option.en}</legend>
        {(option.type === 'medication' || option.type === 'custom') && <label className="treatment-name-label">{option.type === 'medication' ? (ar ? 'اسم الدواء' : 'Medication name') : (ar ? 'الاسم' : 'Name')}<input value={detail.label} onChange={(event) => update(key, 'label', event.target.value)} placeholder={option.type === 'medication' ? (ar ? 'مثلاً: بنادول' : 'e.g. Panadol') : (ar ? 'مثلاً: مشي برا' : 'e.g. Outdoor walk')} /></label>}
        <div className="treatment-controls">
          <div className="amount-stepper" role="group" aria-label={ar ? option.amountLabelAr : option.amountLabelEn}>
            <button type="button" onClick={() => bumpAmount(key, -1)} aria-label={ar ? 'أنقص' : 'Decrease'}><Minus size={16} /></button>
            <input type="number" inputMode="decimal" min="0" step={stepFor(detail.unit)} value={detail.amount} onChange={(event) => update(key, 'amount', event.target.value)} aria-label={ar ? option.amountLabelAr : option.amountLabelEn} />
            <button type="button" onClick={() => bumpAmount(key, 1)} aria-label={ar ? 'زد' : 'Increase'}><Plus size={16} /></button>
          </div>
          <div className="unit-pills" role="group" aria-label={ar ? 'الوحدة' : 'Unit'}>
            {UNIT_OPTIONS.map((unit) => <button type="button" key={unit.value} className={detail.unit === unit.value ? 'selected' : ''} aria-pressed={detail.unit === unit.value} onClick={() => update(key, 'unit', unit.value)}>{ar ? unit.ar : unit.en}</button>)}
          </div>
        </div>
        {detail.noteOpen
          ? <label className="treatment-note-label">{ar ? 'ملاحظة' : 'Note'}<textarea rows={2} value={detail.notes} onChange={(event) => update(key, 'notes', event.target.value)} placeholder={ar ? 'مثلاً: ربطت راسي ونمت…' : 'e.g. I wrapped my head and slept…'} autoFocus /></label>
          : <button type="button" className="add-note-toggle" onClick={() => toggleNote(key)}><Plus size={14} />{ar ? 'ضيف ملاحظة' : 'Add a note'}</button>}
      </fieldset>
    })}<button className="primary-button save-treatments" type="button" onClick={saveAll} disabled={saving}><Save size={17} />{saving ? (ar ? 'عم نحفظ…' : 'Saving…') : (ar ? `احفظ ${selected.length}` : `Save ${selected.length}`)}</button></div>}

    {adding && <div className="new-option-form"><h4>{ar ? 'خيار جديد ودائم' : 'New reusable option'}</h4><label>{ar ? 'اسم الخيار' : 'Option name'}<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={ar ? 'مثلاً: مشيت برا' : 'For example: Outdoor walk'} /></label><label>{ar ? 'الوحدة الافتراضية' : 'Default unit'}<div className="unit-pills" role="group" aria-label={ar ? 'الوحدة الافتراضية' : 'Default unit'}>{UNIT_OPTIONS.map((unit) => <button type="button" key={unit.value} className={newUnit === unit.value ? 'selected' : ''} aria-pressed={newUnit === unit.value} onClick={() => setNewUnit(unit.value)}>{ar ? unit.ar : unit.en}</button>)}<button type="button" className={newUnit === '' ? 'selected' : ''} aria-pressed={newUnit === ''} onClick={() => setNewUnit('')}>{ar ? 'بدون' : 'none'}</button></div></label><div className="button-row"><button className="primary-button" type="button" onClick={createOption} disabled={saving || !newName.trim()}>{ar ? 'احفظ الخيار' : 'Save option'}</button><button className="ghost-button" type="button" onClick={() => setAdding(false)}>{ar ? 'إلغاء' : 'Cancel'}</button></div></div>}

    {!!saved.length && <div className="saved-treatment-list"><h4>{ar ? 'المحفوظ بهاي النوبة' : 'Saved in this episode'}</h4>{saved.map((item) => {
      const name = item.label || (ar ? builtIns.find((option) => option.type === item.intervention_type)?.ar : builtIns.find((option) => option.type === item.intervention_type)?.en) || item.intervention_type
      return <div className="saved-treatment-item" key={item.id}>
        <div className="saved-treatment-head"><span>{name}</span>{item.amount != null && <strong>{item.amount} {translateUnit(item.unit, ar)}</strong>}</div>
        {item.notes && <small>{item.notes}</small>}
        {onSetEffect && (item.effect
          ? <p className="effect-recorded"><Check size={13} />{ar ? 'النتيجة: ' : 'Result: '}{effectLabel(item.effect, ar)}</p>
          : <div className="effect-picker"><span>{ar ? 'ساعد؟' : 'Did it help?'}</span><div className="effect-options" role="group" aria-label={ar ? 'نتيجة العلاج' : 'Treatment result'}>{EFFECTS.map((effect) => <button type="button" key={effect.value} disabled={effectPending === item.id} onClick={() => void chooseEffect(item.id, effect.value)}>{ar ? effect.ar : effect.en}</button>)}</div></div>)}
      </div>
    })}</div>}
  </section>
}

function translateUnit(unit: string | null, ar: boolean) {
  if (!ar || !unit) return unit || ''
  return ({ tablet: 'حبة', cup: 'فنجان', minute: 'دقيقة', hour: 'ساعة', time: 'مرة' } as Record<string, string>)[unit] || unit
}

function effectLabel(effect: string, ar: boolean) {
  return EFFECTS.find((item) => item.value === effect)?.[ar ? 'ar' : 'en'] ?? effect
}
