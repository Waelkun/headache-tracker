import { lazy, Suspense, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import type { HeadPoint } from './HeadMap3D'
import type { Locale } from '../lib/i18n'

const HeadMap3D = lazy(() => import('./HeadMap3D').then((module) => ({ default: module.HeadMap3D })))

export type CheckInResult = { intensity: number | null; marks: HeadPoint[]; markMode: 'point' | 'area'; note: string }

type Props = {
  locale: Locale
  theme: 'light' | 'dark'
  title: string
  subtitle?: string
  initialIntensity?: number
  saving?: boolean
  requireBoth?: boolean
  onSave: (result: CheckInResult) => void | Promise<void>
  onClose: () => void
}

export function CheckInSheet({ locale, theme, title, subtitle, initialIntensity = 4, saving = false, requireBoth = false, onSave, onClose }: Props) {
  const ar = locale === 'ar'
  const [intensity, setIntensity] = useState(initialIntensity)
  const [includeIntensity, setIncludeIntensity] = useState(true)
  const [marks, setMarks] = useState<HeadPoint[]>([])
  const [markMode, setMarkMode] = useState<'point' | 'area'>('point')
  const [note, setNote] = useState('')
  const canSave = requireBoth ? (includeIntensity && marks.length > 0) : (includeIntensity || marks.length > 0)

  function submit() {
    if (!canSave) return
    void onSave({ intensity: includeIntensity ? intensity : null, marks, markMode, note: note.trim() })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card checkin-sheet" role="dialog" aria-modal="true" aria-labelledby="checkin-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="checkin-head">
          <div><p className="eyebrow">{ar ? 'تسجيل لحظة' : 'CHECK-IN'}</p><h2 id="checkin-title">{title}</h2>{subtitle && <p className="checkin-subtitle">{subtitle}</p>}</div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'}><X size={18} /></button>
        </div>

        <div className="checkin-section">
          <div className="checkin-section-head">
            <h3>{ar ? 'قديش الشدة؟' : 'How intense is it?'}</h3>
            {!requireBoth && <button type="button" className="checkin-skip" onClick={() => setIncludeIntensity((value) => !value)} aria-pressed={!includeIntensity}>{includeIntensity ? (ar ? 'ما بعرف' : 'Not sure') : (ar ? 'حدّد' : 'Set it')}</button>}
          </div>
          {includeIntensity ? <>
            <div className="checkin-intensity-value"><strong className={`intensity-badge intensity-${Math.ceil(intensity / 2)}`}>{intensity}/10</strong></div>
            <input className="intensity-slider" type="range" min="0" max="10" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} aria-label={ar ? 'شدة الألم من صفر لعشرة' : 'Pain intensity from zero to ten'} />
            <div className="slider-labels"><span>{ar ? 'خفيف' : 'Mild'}</span><span>{ar ? 'شديد' : 'Severe'}</span></div>
          </> : <p className="checkin-muted">{ar ? 'رح تنحفظ بدون شدة.' : 'Saved without an intensity.'}</p>}
        </div>

        <div className="checkin-section">
          <div className="checkin-section-head"><h3>{ar ? 'وين الوجع؟' : 'Where does it hurt?'}</h3>{!requireBoth && <span className="checkin-optional">{ar ? 'اختياري' : 'optional'}</span>}{requireBoth && marks.length === 0 && <span className="checkin-required">{ar ? 'لازم تعلّمه' : 'required'}</span>}</div>
          <Suspense fallback={<div className="head-map-card map-loading">{ar ? 'عم نجهّز المجسّم…' : 'Loading 3D head…'}</div>}>
            <HeadMap3D locale={locale} theme={theme} marks={marks} mode={markMode} onModeChange={setMarkMode} onMarksChange={setMarks} />
          </Suspense>
        </div>

        <div className="checkin-section">
          <label className="checkin-note-label">{ar ? 'شو تغيّر؟ (اختياري)' : 'What changed? (optional)'}
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder={ar ? 'مثلاً: بلّش يخف بعد ما نمت…' : 'e.g. Started easing after I slept…'} />
          </label>
        </div>

        {requireBoth && !canSave && <p className="checkin-required-hint">{ar ? 'لتبلّش النوبة لازم تحدد الشدة وتعلّم مكان الوجع عالمجسّم.' : 'To start the episode, set the intensity and mark the pain on the 3D head.'}</p>}
        <div className="checkin-actions">
          <button className="primary-button" type="button" onClick={submit} disabled={!canSave || saving}><MapPin size={17} />{saving ? (ar ? 'عم نحفظ…' : 'Saving…') : (ar ? 'احفظ التسجيل' : 'Save check-in')}</button>
          {!requireBoth && <button className="ghost-button" type="button" onClick={onClose}>{ar ? 'مش هلق' : 'Not now'}</button>}
        </div>
      </section>
    </div>
  )
}
