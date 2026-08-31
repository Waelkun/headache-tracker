import { describe, expect, it } from 'vitest'
import { answerDataQuestion, buildAskSummary, buildInterventionStats, buildOverview, buildWeekdayRisk, parseHeadacheText, type EpisodeLike } from './analytics'

const episodes: EpisodeLike[] = [
  {
    id: '1', started_at: '2026-08-24T10:00:00.000Z', ended_at: '2026-08-24T14:00:00.000Z', onset_kind: 'on_waking', status: 'completed',
    intensity_segments: [{ intensity: 4, started_at: '2026-08-24T10:00:00.000Z', ended_at: '2026-08-24T12:00:00.000Z' }, { intensity: 8, started_at: '2026-08-24T12:00:00.000Z', ended_at: '2026-08-24T14:00:00.000Z' }],
    episode_interventions: [{ intervention_type: 'medication', effect: 'slightly_better', label: 'Panadol' }],
  },
  {
    id: '2', started_at: '2026-08-17T09:00:00.000Z', ended_at: '2026-08-17T11:00:00.000Z', onset_kind: 'gradual', status: 'completed',
    intensity_segments: [{ intensity: 6, started_at: '2026-08-17T09:00:00.000Z', ended_at: '2026-08-17T11:00:00.000Z' }],
    episode_interventions: [],
  },
]

describe('headache analytics', () => {
  it('calculates episode summaries', () => {
    expect(buildOverview(episodes)).toMatchObject({ headacheDays: 2, averageIntensity: 6, averageDuration: 3, strongest: 8 })
  })

  it('finds the recurring weekday pattern', () => {
    expect(buildWeekdayRisk(episodes, 'en').topDay).toBe('Monday')
  })

  it('answers questions from recorded data', () => {
    expect(answerDataQuestion('What is my highest intensity?', episodes, 'en')).toContain('8 out of 10')
  })

  it('organizes a natural Arabic note', () => {
    const result = parseHeadacheText('صحيت وكان الوجع قدام على اليمين مثل نبض ووصل 8 من 10، وأخذت بنادول وشربت قهوة')
    expect(result).toMatchObject({ onsetKind: 'on_waking', region: 'front_right', intensity: 8 })
    expect(result.characters).toContain('pulsing')
    expect(result.interventions.map((item) => item.type)).toEqual(expect.arrayContaining(['medication', 'coffee']))
    expect(result.interventions.find((item) => item.type === 'medication')?.name).toBe('Panadol')
  })

  it('asks follow-up questions for missing details', () => {
    const result = parseHeadacheText('أخذت دواء وصار الوجع أخف')
    const types = result.followups.map((item) => item.type)
    expect(types).toContain('medication_name') // took "medicine" without naming it
    expect(types).toContain('amount')          // no dose given
    expect(types).toContain('location')        // no location mentioned
    expect(types).toContain('intensity')       // no intensity given
  })

  it('detects side + vertical regions', () => {
    expect(parseHeadacheText('pain at the back left of my head').region).toBe('back_left')
    expect(parseHeadacheText('على قمة الراس').region).toBe('top')
    expect(parseHeadacheText('in the center of my head').region).toBe('center')
  })

  it('aggregates intervention effectiveness', () => {
    const stats = buildInterventionStats(episodes)
    expect(stats.find((item) => item.type === 'medication')).toMatchObject({ count: 1, helped: 1, rated: 1 })
  })

  it('answers what-helped from effect ratings', () => {
    expect(answerDataQuestion('what helped my headache?', episodes, 'en')).toContain('Panadol')
  })

  it('builds a compact AI summary', () => {
    const summary = buildAskSummary(episodes, 'en')
    expect(summary).toMatchObject({ total_episodes: 2, most_frequent_weekday: 'Monday', highest_intensity: 8 })
    expect(summary.interventions[0]).toMatchObject({ name: 'Panadol', helped: 1, rated: 1 })
  })
})
