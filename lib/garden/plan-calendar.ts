/**
 * Plan calendar computations: harvest readiness, days-to-frost, shopping list.
 *
 * All three derive from data the app already records (planting sow dates, crop
 * maturity days, site frost dates, stored material estimates) — no new write
 * paths. Every function treats missing data as missing and reports it, per the
 * repo rule: report what was recorded, derive what can be derived.
 */

export interface ReadinessInput {
  plantingId: string
  /** Planting name for display (variety, or bed name when variety is null). */
  label: string
  /** YYYY-MM-DD the planting went in, or null when not recorded. */
  sowDate: string | null
  /** Days from sowing to harvest, from the crop database. */
  daysToMaturity: number | null
}

export type ReadinessState =
  | 'not-recorded' // no sow date
  | 'unknown-crop' // no maturity data for this crop
  | 'growing' // harvest window in the future
  | 'ready' // within the harvest window
  | 'overdue' // window passed — likely already harvested but never recorded

export interface ReadinessRow {
  plantingId: string
  label: string
  sowDate: string | null
  /** YYYY-MM-DD the harvest window opens; null when not computable. */
  readyFrom: string | null
  state: ReadinessState
  /** Days until the window opens (negative = days overdue). */
  daysUntilReady: number | null
  note: string
}

function parseUtc(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatUtc(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10)
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** Build a date only when the parts are real, so 2026-02-30 is rejected. */
function isoFromParts(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const millis = Date.UTC(year, month - 1, day)
  const date = new Date(millis)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return formatUtc(millis)
}

/**
 * Normalise every frost-date shape this app has stored into YYYY-MM-DD.
 *
 * Three shapes exist: a full ISO date (what a `type="date"` input sends), an
 * `MM-DD` month-day (the wizard's averages), and `'April 15'` (what
 * SiteIntelligenceService estimates from latitude). The estimate used to be
 * written straight into a `type="date"` input, where the browser silently
 * renders it as an empty field, and into a DATE column that has to parse it.
 *
 * Returns null for anything unparseable, so callers leave the column empty
 * rather than storing a string the database cannot read.
 */
export function toIsoDate(value: unknown, reference: Date = new Date()): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(text)
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const monthDay = /^(\d{1,2})[-/](\d{1,2})$/.exec(text)
  if (monthDay) {
    const year = reference.getUTCFullYear()
    return isoFromParts(year, Number(monthDay[1]), Number(monthDay[2]))
  }

  const named = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/.exec(text)
  if (named) {
    const lowered = named[1].toLowerCase()
    // 'Oct' and 'October' both resolve; anything shorter than three letters is
    // ambiguous (Jun/Jul), so the regex already refuses it.
    const month = MONTH_NAMES.findIndex(
      (name) => name === lowered || (lowered.length >= 3 && name.startsWith(lowered))
    )
    if (month < 0) return null
    const year = named[3] ? Number(named[3]) : reference.getUTCFullYear()
    return isoFromParts(year, month + 1, Number(named[2]))
  }

  return null
}

function daysBetween(fromMillis: number, toMillis: number): number {
  return Math.round((toMillis - fromMillis) / 86_400_000)
}

/**
 * Harvest readiness per planting: the harvest window opens `daysToMaturity`
 * after the sow date. A window left open for 30 days after maturing counts as
 * still harvestable (most vegetables hold on the plant); after that the row is
 * overdue — either harvested without being recorded, or a lost crop worth
 * flagging.
 */
export function harvestReadiness(
  rows: ReadinessInput[],
  today: string = new Date().toISOString().slice(0, 10)
): ReadinessRow[] {
  const todayMs = parseUtc(today)
  if (todayMs === null) return []

  const HOLD_DAYS = 30

  return rows.map((row) => {
    const base = { plantingId: row.plantingId, label: row.label, sowDate: row.sowDate }

    if (!row.sowDate || parseUtc(row.sowDate) === null) {
      return {
        ...base,
        readyFrom: null,
        state: 'not-recorded' as const,
        daysUntilReady: null,
        note: 'Sow date not recorded.',
      }
    }
    if (row.daysToMaturity === null || !Number.isFinite(row.daysToMaturity) || row.daysToMaturity <= 0) {
      return {
        ...base,
        readyFrom: null,
        state: 'unknown-crop' as const,
        daysUntilReady: null,
        note: 'Crop is not in the database, so no maturity estimate.',
      }
    }

    const sowMs = parseUtc(row.sowDate) as number
    const readyMs = sowMs + row.daysToMaturity * 86_400_000
    const daysUntilReady = daysBetween(todayMs, readyMs)

    if (daysUntilReady > 0) {
      return {
        ...base,
        readyFrom: formatUtc(readyMs),
        state: 'growing' as const,
        daysUntilReady,
        note: `Ready in about ${daysUntilReady} day${daysUntilReady === 1 ? '' : 's'} (${formatUtc(readyMs)}).`,
      }
    }

    const daysOverdue = -daysUntilReady
    if (daysOverdue > HOLD_DAYS) {
      return {
        ...base,
        readyFrom: formatUtc(readyMs),
        state: 'overdue' as const,
        daysUntilReady,
        note: `Was ready around ${formatUtc(readyMs)} — ${daysOverdue} days ago. Record a harvest or remove the planting.`,
      }
    }

    return {
      ...base,
      readyFrom: formatUtc(readyMs),
      state: 'ready' as const,
      daysUntilReady,
      note: daysOverdue === 0 ? 'Ready now.' : `Ready since ${formatUtc(readyMs)}.`,
    }
  })
}

export interface FrostClock {
  /** Days from today until the next first frost; null when not recorded. */
  daysUntilFirstFrost: number | null
  /** Days since the most recent last frost; negative when still ahead. */
  daysSinceLastFrost: number | null
  /** Days from today until the next last frost; null when not recorded. */
  daysUntilLastFrost: number | null
  /** true when today falls between last and first frost. */
  inGrowingSeason: boolean | null
  note: string
}

/**
 * Season clock from the site's recorded frost dates. Dates are MM-DD strings
 * from the wizard's date inputs (year-agnostic averages), mapped onto the
 * current and adjacent years so the clock is always meaningful.
 */
export function seasonClock(
  firstFrost: string | null,
  lastFrost: string | null,
  today: string = new Date().toISOString().slice(0, 10)
): FrostClock {
  const notRecorded: FrostClock = {
    daysUntilFirstFrost: null,
    daysSinceLastFrost: null,
    daysUntilLastFrost: null,
    inGrowingSeason: null,
    note: 'Frost dates are not recorded, so the season length is unknown.',
  }

  const todayMs = parseUtc(today)
  if (todayMs === null) return notRecorded
  const todayParts = today.split('-')
  const year = Number(todayParts[0])

  // Frost dates arrive as 'MM-DD' (wizard averages) or 'YYYY-MM-DD' (full
  // dates). Either way, the month-day is the last two dash-separated segments.
  const toMonthDay = (value: string): string | null => {
    const segments = value.split('-')
    if (segments.length < 2) return null
    const monthDay = segments.slice(-2).join('-')
    return /^\d{2}-\d{2}$/.test(monthDay) ? monthDay : null
  }

  /** Days from today to the next occurrence of this anniversary (>= today). */
  const daysUntilNext = (monthDay: string): number => {
    for (const y of [year, year + 1]) {
      const ms = parseUtc(`${y}-${monthDay}`)
      if (ms !== null && ms >= todayMs) return daysBetween(todayMs, ms)
    }
    return 0
  }

  /** Days since the most recent occurrence of this anniversary (< today). */
  const daysSincePrev = (monthDay: string): number => {
    for (const y of [year, year - 1]) {
      const ms = parseUtc(`${y}-${monthDay}`)
      if (ms !== null && ms <= todayMs) return -daysBetween(todayMs, ms)
    }
    return 0
  }

  const firstMonthDay = firstFrost ? toMonthDay(firstFrost) : null
  const lastMonthDay = lastFrost ? toMonthDay(lastFrost) : null
  if (!firstMonthDay && !lastMonthDay) return notRecorded

  const daysUntilFirstFrost = firstMonthDay === null ? null : daysUntilNext(firstMonthDay)
  const daysUntilLastFrost = lastMonthDay === null ? null : daysUntilNext(lastMonthDay)
  const daysSinceLastFrost = lastMonthDay === null ? null : daysSincePrev(lastMonthDay)
  const daysSinceFirstFrost = firstMonthDay === null ? null : daysSincePrev(firstMonthDay)

  // In season when the most recent frost boundary is the LAST frost: past last
  // frost (it has a past occurrence) and first frost has not passed more
  // recently (i.e. we are not yet past this autumn's first frost).
  let inGrowingSeason: boolean | null = null
  if (lastMonthDay && firstMonthDay && daysSinceLastFrost !== null && daysSinceFirstFrost !== null) {
    inGrowingSeason = daysSinceLastFrost >= 0 && (daysSinceFirstFrost < 0 || daysSinceLastFrost < daysSinceFirstFrost)
  }

  const formatDays = (days: number) => `${days} day${days === 1 ? '' : 's'}`
  let note: string
  if (inGrowingSeason === true) {
    const parts: string[] = []
    if (daysSinceLastFrost !== null) parts.push(`${formatDays(daysSinceLastFrost)} since last frost`)
    if (daysUntilFirstFrost !== null) parts.push(`${formatDays(daysUntilFirstFrost)} until first frost`)
    note = `Mid-season: ${parts.join(', ')}.`
  } else if (daysUntilFirstFrost !== null && daysUntilLastFrost !== null) {
    // Off-season: whichever frost boundary comes next defines where we are.
    note =
      daysUntilFirstFrost <= daysUntilLastFrost
        ? `Off-season — first frost in ${formatDays(daysUntilFirstFrost)}.`
        : `Off-season — last frost in ${formatDays(daysUntilLastFrost)}.`
  } else if (daysUntilFirstFrost !== null) {
    note = `Off-season — first frost in ${formatDays(daysUntilFirstFrost)}.`
  } else {
    note = `Off-season — last frost in ${formatDays(daysUntilLastFrost ?? 0)}.`
  }

  return { daysUntilFirstFrost, daysSinceLastFrost, daysUntilLastFrost, inGrowingSeason, note }
}
