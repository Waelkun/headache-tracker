import { useMemo, useRef, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { buildOverview, episodeDurationHours, maxIntensity, type EpisodeLike } from '../lib/analytics'
import type { Locale } from '../lib/i18n'

type Props = { episodes: EpisodeLike[]; locale: Locale }
type Range = '7' | '14' | '30' | 'custom'

const dateInput = (date: Date) => date.toISOString().slice(0, 10)

export function ReportView({ episodes, locale }: Props) {
  const [range, setRange] = useState<Range>('30')
  const [reportLocale, setReportLocale] = useState<Locale>(locale)
  const [from, setFrom] = useState(dateInput(new Date(Date.now() - 29 * 86_400_000)))
  const [to, setTo] = useState(dateInput(new Date()))
  const [working, setWorking] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const ar = locale === 'ar'
  const reportAr = reportLocale === 'ar'

  const filtered = useMemo(() => {
    const end = new Date(`${to}T23:59:59.999`).getTime()
    const days = range === 'custom' ? null : Number(range)
    const start = days ? Date.now() - (days - 1) * 86_400_000 : new Date(`${from}T00:00:00`).getTime()
    return episodes.filter((episode) => {
      const time = new Date(episode.started_at).getTime()
      return time >= start && time <= end
    })
  }, [episodes, from, range, to])
  const overview = useMemo(() => buildOverview(filtered), [filtered])

  async function downloadPdf() {
    if (!reportRef.current) return
    setWorking(true)
    try {
      reportRef.current.classList.add('pdf-exporting')
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const width = 190
      const height = canvas.height * width / canvas.width
      const image = canvas.toDataURL('image/png')
      let position = 10
      pdf.addImage(image, 'PNG', 10, position, width, height)
      let remaining = height - 277
      while (remaining > 0) {
        position -= 277
        pdf.addPage()
        pdf.addImage(image, 'PNG', 10, position, width, height)
        remaining -= 277
      }
      pdf.save(`headache-report-${dateInput(new Date())}.pdf`)
    } finally {
      reportRef.current?.classList.remove('pdf-exporting')
      setWorking(false)
    }
  }

  const dtf = new Intl.DateTimeFormat(reportLocale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="page-stack">
      <div className="page-title-row">
        <div><p className="eyebrow">PDF</p><h2>{ar ? 'تقرير الطبيب' : 'Doctor report'}</h2><p>{ar ? 'اختار الفترة واللغة، واطبع ملخص واضح.' : 'Choose a period and language, then export a clear summary.'}</p></div>
        <FileText size={28} />
      </div>

      <div className="report-controls card">
        <fieldset>
          <legend>{ar ? 'الفترة' : 'Period'}</legend>
          <div className="segmented-control four">
            {(['7', '14', '30', 'custom'] as Range[]).map((value) => (
              <button key={value} className={range === value ? 'selected' : ''} type="button" onClick={() => setRange(value)}>{value === 'custom' ? (ar ? 'مخصص' : 'Custom') : `${value} ${ar ? 'يوم' : 'days'}`}</button>
            ))}
          </div>
        </fieldset>
        {range === 'custom' && <div className="date-grid"><label>{ar ? 'من' : 'From'}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>{ar ? 'إلى' : 'To'}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>}
        <fieldset>
          <legend>{ar ? 'لغة التقرير' : 'Report language'}</legend>
          <div className="segmented-control"><button className={reportLocale === 'ar' ? 'selected' : ''} type="button" onClick={() => setReportLocale('ar')}>العربية</button><button className={reportLocale === 'en' ? 'selected' : ''} type="button" onClick={() => setReportLocale('en')}>English</button></div>
        </fieldset>
        <button className="primary-button" type="button" onClick={downloadPdf} disabled={working || !filtered.length}><Download size={18} />{working ? (ar ? 'عم نجهّز…' : 'Preparing…') : (ar ? 'نزّل PDF' : 'Download PDF')}</button>
      </div>

      <div className="report-paper" ref={reportRef} dir={reportAr ? 'rtl' : 'ltr'}>
        <header className="report-header"><div className="report-logo"><FileText size={22} /></div><div><p>{reportAr ? 'تقرير تتبّع الصداع' : 'Headache tracking report'}</p><small>{reportAr ? 'مُلخّص من بيانات المريض المسجّلة ذاتياً' : 'Summary of patient-recorded data'}</small></div></header>
        <div className="report-meta"><span>{reportAr ? 'تاريخ الإنشاء' : 'Generated'}: {new Intl.DateTimeFormat(reportAr ? 'ar' : 'en', { dateStyle: 'long' }).format(new Date())}</span><span>{reportAr ? 'عدد النوبات' : 'Episodes'}: {filtered.length}</span></div>
        <div className="report-summary">
          <div><span>{reportAr ? 'أيام الصداع' : 'Headache days'}</span><strong>{overview.headacheDays}</strong></div>
          <div><span>{reportAr ? 'متوسط الشدة' : 'Avg. intensity'}</span><strong>{overview.averageIntensity.toFixed(1)}/10</strong></div>
          <div><span>{reportAr ? 'متوسط المدة' : 'Avg. duration'}</span><strong>{overview.averageDuration.toFixed(1)}h</strong></div>
          <div><span>{reportAr ? 'أعلى شدة' : 'Highest'}</span><strong>{overview.strongest}/10</strong></div>
        </div>
        <h3>{reportAr ? 'سجل النوبات' : 'Episode log'}</h3>
        <table>
          <thead><tr><th>{reportAr ? 'البداية' : 'Started'}</th><th>{reportAr ? 'المدة' : 'Duration'}</th><th>{reportAr ? 'أعلى شدة' : 'Peak'}</th><th>{reportAr ? 'البداية' : 'Onset'}</th></tr></thead>
          <tbody>{filtered.map((episode) => <tr key={episode.id}><td>{dtf.format(new Date(episode.started_at))}</td><td>{episode.ended_at ? `${episodeDurationHours(episode).toFixed(1)}h` : (reportAr ? 'مستمرة' : 'Active')}</td><td>{maxIntensity(episode)}/10</td><td>{episode.onset_kind.replace('_', ' ')}</td></tr>)}</tbody>
        </table>
        {!filtered.length && <p className="report-empty">{reportAr ? 'ما في نوبات ضمن هاي الفترة.' : 'No episodes in this period.'}</p>}
        <footer>{reportAr ? 'هذا التقرير لا يشكّل تشخيصاً طبياً. اعرضه على مختص صحي.' : 'This report is not a medical diagnosis. Share it with a healthcare professional.'}</footer>
      </div>
    </section>
  )
}
