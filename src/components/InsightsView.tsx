import { useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays, buildOverview, buildWeekView, countEpisodesInRange, earliestWeekStart, episodeDurationHours, maxIntensity, startOfWeek, type EpisodeLike } from '../lib/analytics'
import type { Locale } from '../lib/i18n'

export default function InsightsView({ episodes, locale, theme }: { episodes: EpisodeLike[]; locale: Locale; theme: 'light' | 'dark' }) {
  const ar = locale === 'ar'
  const overview = buildOverview(episodes)
  const weekCount = countEpisodesInRange(episodes, 7)
  const monthCount = countEpisodesInRange(episodes, 30)
  const breakdown = [...episodes].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 12)
  const dateFmt = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })
  const durationLabel = (episode: EpisodeLike) => episode.status === 'active' ? (ar ? 'مستمرة' : 'Active') : `${episodeDurationHours(episode).toFixed(1)}${ar ? ' س' : 'h'}`
  const timeline = [...episodes].filter((episode) => episode.status === 'completed').reverse().slice(-20).map((episode, index) => ({
    index,
    date: new Intl.DateTimeFormat(ar ? 'ar' : 'en', { month: 'short', day: 'numeric' }).format(new Date(episode.started_at)),
    intensity: maxIntensity(episode), duration: Number(episodeDurationHours(episode).toFixed(1)),
  }))
  const timelineLabel = (value: number) => timeline[value]?.date ?? ''
  // Week-scoped weekday chart: offset 0 = current week, negative = past weeks.
  const [weekOffset, setWeekOffset] = useState(0)
  const currentWeekStart = useMemo(() => startOfWeek(new Date()), [])
  const selectedWeekStart = useMemo(() => addDays(currentWeekStart, weekOffset * 7), [currentWeekStart, weekOffset])
  const weekView = buildWeekView(episodes, selectedWeekStart)
  const earliest = earliestWeekStart(episodes)
  const canGoBack = !earliest || selectedWeekStart.getTime() > earliest.getTime()
  const canGoForward = weekOffset < 0
  const weekdayFmt = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { weekday: 'short' })
  const rangeFmt = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { month: 'short', day: 'numeric' })
  const weekRange = `${rangeFmt.format(selectedWeekStart)} – ${rangeFmt.format(addDays(selectedWeekStart, 6))}`
  const weekRelative = weekOffset === 0 ? (ar ? 'هذا الأسبوع' : 'This week') : weekOffset === -1 ? (ar ? 'الأسبوع الماضي' : 'Last week') : (ar ? `قبل ${-weekOffset} أسابيع` : `${-weekOffset} weeks ago`)
  const weekdayBase = weekView.counts.map((count, day) => ({
    day: weekdayFmt.format(addDays(selectedWeekStart, day)), count,
  }))
  const weekday = ar ? [...weekdayBase].reverse() : weekdayBase
  const gridColor = theme === 'dark' ? '#31443f' : '#dbe6e1'
  const tickColor = theme === 'dark' ? '#a9bbb5' : '#63736d'
  const tooltipStyle = theme === 'dark' ? { background: '#182522', border: '1px solid #31443f', borderRadius: 12, color: '#edf7f3' } : { borderRadius: 12 }

  return <section className="page-stack">
    <div className="page-title-row"><div><p className="eyebrow">{ar ? 'الأنماط' : 'PATTERNS'}</p><h2>{ar ? 'شو بتحكي بياناتك؟' : 'What does your data show?'}</h2><p>{ar ? 'هاي ملاحظات إحصائية، مش تشخيص طبي.' : 'These are statistical observations, not a diagnosis.'}</p></div><BarChart3 size={28} /></div>
    <div className="insights-metrics"><article className="stat-card"><span>{ar ? 'هالأسبوع' : 'This week'}</span><strong>{weekCount}</strong><small>{ar ? 'نوبات' : 'episodes'}</small></article><article className="stat-card"><span>{ar ? 'هالشهر' : 'This month'}</span><strong>{monthCount}</strong><small>{ar ? 'نوبات' : 'episodes'}</small></article><article className="stat-card"><span>{ar ? 'متوسط الشدة' : 'Avg intensity'}</span><strong>{overview.averageIntensity ? overview.averageIntensity.toFixed(1) : '—'}</strong><small>{ar ? 'من 10' : 'of 10'}</small></article><article className="stat-card"><span>{ar ? 'متوسط المدة' : 'Avg duration'}</span><strong>{overview.averageDuration ? `${overview.averageDuration.toFixed(1)}${ar ? ' س' : 'h'}` : '—'}</strong><small>{ar ? 'لكل نوبة' : 'per episode'}</small></article><article className="stat-card"><span>{ar ? 'أعلى شدة' : 'Highest'}</span><strong>{overview.strongest || '—'}</strong><small>{ar ? 'من 10' : 'of 10'}</small></article><article className="stat-card"><span>{ar ? 'مجموع الساعات' : 'Total hours'}</span><strong>{overview.totalHours ? overview.totalHours.toFixed(0) : '—'}</strong><small>{ar ? 'ساعة' : 'hours'}</small></article></div>
    <div className="insights-charts">
    <section className="card chart-card"><div className="card-heading-row"><div><p className="eyebrow">{ar ? 'مع الوقت' : 'OVER TIME'}</p><h3>{ar ? 'الشدة ومدة النوبة' : 'Intensity and duration'}</h3></div></div>{timeline.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={timeline}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} /><XAxis dataKey="index" type="category" tickFormatter={timelineLabel} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: tickColor }} /><YAxis yAxisId="left" domain={[0, 10]} allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: tickColor }} width={28} /><YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: tickColor }} width={28} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => timelineLabel(Number(label))} /><Legend wrapperStyle={{ fontSize: 12, color: tickColor }} /><Line yAxisId="left" type="monotone" dataKey="intensity" name={ar ? 'الشدة (من 10)' : 'Intensity (of 10)'} stroke={theme === 'dark' ? '#67c9b5' : '#0b6b62'} strokeWidth={3} dot={{ r: 3 }} /><Line yAxisId="right" type="monotone" dataKey="duration" name={ar ? 'المدة (ساعة)' : 'Duration (h)'} stroke="#d9a251" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <Empty locale={locale} />}</section>
    <section className="card chart-card"><div className="card-heading-row"><div><p className="eyebrow">{ar ? 'أسبوعياً' : 'BY WEEK'}</p><h3>{ar ? 'نوبات الأسبوع حسب اليوم' : 'This week’s episodes by day'}</h3></div><span className="risk-pill">{ar ? `${weekView.total} نوبة` : `${weekView.total} ${weekView.total === 1 ? 'episode' : 'episodes'}`}</span></div>{episodes.length ? <>
      <div className="week-nav">
        <button type="button" onClick={() => setWeekOffset((value) => value - 1)} disabled={!canGoBack} aria-label={ar ? 'الأسبوع السابق' : 'Previous week'}>{ar ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
        <div className="week-nav-label"><strong>{weekRelative}</strong><span>{weekRange}</span></div>
        <button type="button" onClick={() => setWeekOffset((value) => Math.min(0, value + 1))} disabled={!canGoForward} aria-label={ar ? 'الأسبوع التالي' : 'Next week'}>{ar ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>
      </div>
      <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekday}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} /><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: tickColor }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: tickColor }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill={theme === 'dark' ? '#67c9b5' : '#62a99a'} radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <p className="chart-note">{weekView.total ? (ar ? 'كل عمود هو عدد النوبات بذاك اليوم من الأسبوع المختار.' : 'Each bar is the number of episodes on that day of the selected week.') : (ar ? 'ما في نوبات مسجّلة بهذا الأسبوع.' : 'No episodes recorded this week.')}</p>
    </> : <Empty locale={locale} />}</section>
    </div>
    <section className="card breakdown-card"><div className="card-heading-row"><div><p className="eyebrow">{ar ? 'نوبة نوبة' : 'EPISODE BY EPISODE'}</p><h3>{ar ? 'كل نوبة ومدتها' : 'Each episode and its duration'}</h3></div></div>{breakdown.length ? <div className="breakdown-list">{breakdown.map((episode) => <div className="breakdown-row" key={episode.id}><div className={`episode-severity severity-${Math.ceil(maxIntensity(episode) / 2)}`}>{maxIntensity(episode) || '—'}</div><div><time>{dateFmt.format(new Date(episode.started_at))}</time><small>{ar ? `${episode.onset_kind.replace('_', ' ')}` : episode.onset_kind.replace('_', ' ')}</small></div><strong>{durationLabel(episode)}</strong></div>)}</div> : <Empty locale={locale} />}</section>
    <div className="accessible-data"><h3>{ar ? 'البيانات المستخدمة بالرسم' : 'Chart data'}</h3><table><thead><tr><th>{ar ? 'اليوم' : 'Day'}</th><th>{ar ? 'العدد' : 'Count'}</th></tr></thead><tbody>{weekday.map((item) => <tr key={item.day}><td>{item.day}</td><td>{item.count}</td></tr>)}</tbody></table></div>
  </section>
}

function Empty({ locale }: { locale: Locale }) {
  return <div className="empty-chart">{locale === 'ar' ? 'الرسم بيظهر بعد ما تسجل نوبات مكتملة.' : 'The chart appears after you log completed episodes.'}</div>
}
