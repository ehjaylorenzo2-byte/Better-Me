import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { BottomSheet } from '@/components/ui/Sheet'
import { SectionRow } from '@/components/ui/SectionRow'
import { getOccurrencesInRange } from '@/services/habits'
import { getUserPreferences } from '@/services/preferences'
import {
  addDaysToIsoDate,
  formatIsoTime12h,
  getPhilippineToday,
  isoDateWeekday,
  leadingCellsForMonth,
  orderWeekdays,
  philippineMonthNameOnly,
  relativeDayLabel,
  shiftMonth,
  type IsoDate,
} from '@/utils/timezone'
import { colorForLabel } from '@/theme/categoryStyles'
import type { Habit, HabitOccurrence, HabitSchedule } from '@/types/models'
import './calendar.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

/** Sunday first, matching JavaScript's day numbering. Rotated when the week starts on Monday. */
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type CalView = 'week' | 'month' | 'year'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "Aug 24 – 30" inside one month, "Aug 30 – Sep 5" across two.
 *
 * Dropping the second month is only unambiguous while the week does not
 * straddle one, and roughly one week in four does.
 */
export function weekRangeLabel(start: IsoDate): string {
  const end = addDaysToIsoDate(start, 6)
  const startMonth = MONTH_SHORT[Number(start.slice(5, 7)) - 1]
  const endMonth = MONTH_SHORT[Number(end.slice(5, 7)) - 1]
  const startDay = Number(start.slice(8))
  const endDay = Number(end.slice(8))
  return startMonth === endMonth
    ? `${startMonth} ${startDay} – ${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`
}

export function CalendarPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const today = getPhilippineToday()

  const [cursor, setCursor] = useState(today.slice(0, 7))
  /*
    Week, Month and Year, as the brief asks for. They are three readings of
    the same data rather than three screens: one fetch per visible range, one
    day sheet, one set of colours.

    Week is an agenda rather than a seven-column grid. On a phone a week grid
    gives each day about fifty pixels, which is enough for dots and nothing
    else — and a week is exactly the range where you want to read the names.
  */
  const [view, setView] = useState<CalView>('month')
  /* The Sunday (or Monday) that starts the week being shown. */
  const [weekStart, setWeekStart] = useState(today)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  const touchStartX = useRef<number | null>(null)

  // 0 = Sunday, 1 = Monday. Set under Profile > Home screen.
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(0)

  const [year, month] = cursor.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = leadingCellsForMonth(cursor, weekStartsOn)

  const weekdayInitials = useMemo(() => orderWeekdays(WEEKDAY_INITIALS, weekStartsOn), [weekStartsOn])

  /*
    One range, sized to whatever is on screen. Year asks for 365 days in a
    single call rather than twelve monthly ones — the same query either way,
    and it means the year grid never renders half-filled while the rest
    arrives.
  */
  const range = useMemo(() => {
    if (view === 'week') return { start: weekStart, end: addDaysToIsoDate(weekStart, 6) }
    if (view === 'year') return { start: `${year}-01-01`, end: `${year}-12-31` }
    return { start: `${cursor}-01`, end: `${cursor}-${String(daysInMonth).padStart(2, '0')}` }
  }, [view, weekStart, year, cursor, daysInMonth])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [occurrences, prefs] = await Promise.all([
        getOccurrencesInRange(userId, range.start, range.end),
        getUserPreferences(userId),
      ])
      setRows(occurrences)
      setWeekStartsOn(prefs.weekStartsOn)
    } catch {
      setError('Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, range.start, range.end])

  /*
    The week the user is looking at has to start on the day they chose in
    Settings. Snapping here rather than at every use means the seven cells are
    always the same seven days the header names.
  */
  useEffect(() => {
    setWeekStart((current) => {
      const offset = (isoDateWeekday(current) - weekStartsOn + 7) % 7
      return offset === 0 ? current : addDaysToIsoDate(current, -offset)
    })
  }, [weekStartsOn])

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      const list = map.get(r.occurrenceDate) ?? []
      list.push(r)
      map.set(r.occurrenceDate, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
    }
    return map
  }, [rows])

  /* One arrow pair, three step sizes. Whatever is on screen is what moves. */
  const go = (delta: number) => {
    setDirection(delta > 0 ? 'next' : 'prev')
    if (view === 'week') {
      setWeekStart((current) => addDaysToIsoDate(current, delta * 7))
      return
    }
    if (view === 'year') {
      setCursor((current) => shiftMonth(current, delta * 12))
      return
    }
    setCursor((current) => shiftMonth(current, delta))
  }

  /* Switching view keeps the day you were looking at, in both directions. */
  const changeView = (next: CalView) => {
    if (next === 'week' && view !== 'week') {
      const anchor = cursor === today.slice(0, 7) ? today : `${cursor}-01`
      const offset = (isoDateWeekday(anchor) - weekStartsOn + 7) % 7
      setWeekStart(addDaysToIsoDate(anchor, -offset))
    }
    if (view === 'week' && next !== 'week') setCursor(weekStart.slice(0, 7))
    setView(next)
  }

  const atToday =
    view === 'week'
      ? weekStart <= today && today <= addDaysToIsoDate(weekStart, 6)
      : view === 'year'
        ? year === Number(today.slice(0, 4))
        : cursor === today.slice(0, 7)

  const backToToday = () => {
    setCursor(today.slice(0, 7))
    setWeekStart(addDaysToIsoDate(today, -((isoDateWeekday(today) - weekStartsOn + 7) % 7)))
  }

  /*
    Swipe to change month. 55px is deliberately generous: a smaller threshold
    fires while the page is still settling from a vertical scroll and the month
    jumps under your thumb.
  */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 55) return
    go(dx < 0 ? 1 : -1)
  }

  /*
    Leading blanks are rendered as the tail of the previous month rather than
    as empty boxes. It costs nothing and it stops the first week looking like
    the grid is broken.
  */
  const cells = useMemo(() => {
    const out: Array<{ date: string; day: number; outside: boolean }> = []
    const firstOfMonth = `${cursor}-01`
    for (let i = firstWeekday; i > 0; i--) {
      const date = addDaysToIsoDate(firstOfMonth, -i)
      out.push({ date, day: Number(date.slice(8)), outside: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: `${cursor}-${String(d).padStart(2, '0')}`, day: d, outside: false })
    }
    const lastOfMonth = `${cursor}-${String(daysInMonth).padStart(2, '0')}`
    let trailing = 1
    while (out.length % 7 !== 0) {
      const date = addDaysToIsoDate(lastOfMonth, trailing++)
      out.push({ date, day: Number(date.slice(8)), outside: true })
    }
    return out
  }, [cursor, daysInMonth, firstWeekday])

  /* The seven days on screen in Week view, empty ones included — a blank day
     is information, and skipping it would make the week look shorter. */
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(weekStart, i)),
    [weekStart],
  )

  /* Twelve counts for the year strip. Cheap, and it is the whole point of the
     view: which months you actually planned anything in. */
  const yearMonths = useMemo(() => {
    const counts = new Array(12).fill(0)
    for (const r of rows) {
      const m = Number(r.occurrenceDate.slice(5, 7)) - 1
      if (m >= 0 && m < 12) counts[m] += 1
    }
    const busiest = Math.max(1, ...counts)
    return counts.map((count, i) => ({
      index: i,
      count,
      /*
        Relative to the busiest month, so a light year still reads. Capped at
        0.28 deliberately: the label sits on top of this wash, and past about a
        third the accent drags dark text under the contrast floor. Density is a
        hint here, not the data — the count beside it is the data.
      */
      intensity: count === 0 ? 0 : 0.08 + (count / busiest) * 0.2,
    }))
  }, [rows])

  const selectedRows = selected ? byDate.get(selected) ?? [] : []
  const monthTotal = rows.length

  return (
    <div className="bm-cal-page bm-enter">
      <header className="bm-cal-head">
        <div>
          {/* A month name is one short word; a week range is up to eleven
              characters more and wraps onto a second line at phone width. */}
          <h1 className={`bm-display ${view === 'week' ? 'bm-cal-title-week' : ''}`}>
            {view === 'year'
              ? year
              : view === 'week'
                ? weekRangeLabel(weekStart)
                : philippineMonthNameOnly(cursor)}
          </h1>
          <p className="bm-cal-year">
            {view === 'year' ? 'Whole year' : view === 'week' ? weekStart.slice(0, 4) : year}
            {monthTotal > 0 ? (
              <span className="bm-cal-count">
                {monthTotal} {monthTotal === 1 ? 'thing' : 'things'} scheduled
              </span>
            ) : null}
          </p>
        </div>
        <div className="bm-cal-nav">
          <button type="button" onClick={() => go(-1)} aria-label={`Previous ${view}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" onClick={() => go(1)} aria-label={`Next ${view}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="bm-cal-views" role="tablist" aria-label="Calendar range">
        {(['week', 'month', 'year'] as CalView[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={`bm-cal-view-btn ${view === v ? 'active' : ''}`}
            onClick={() => changeView(v)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {!atToday ? (
        <button type="button" className="bm-cal-today-btn bm-press" onClick={backToToday}>
          Back to today
        </button>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : view === 'week' ? (
        /*
          An agenda, not a grid. Seven columns on a phone leaves room for dots
          and nothing else, and a week is exactly the range where you want to
          read the names.
        */
        <div className="bm-cal-week" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {weekDays.map((date) => {
            const dayRows = byDate.get(date) ?? []
            return (
              <button
                key={date}
                type="button"
                className={`bm-cal-week-day ${date === today ? 'today' : ''}`}
                onClick={() => setSelected(date)}
                aria-current={date === today ? 'date' : undefined}
              >
                <span className="bm-cal-week-date">
                  <span className="bm-cal-week-dow">
                    {WEEKDAY_INITIALS[isoDateWeekday(date)]}
                  </span>
                  <span className="bm-cal-week-num num">{Number(date.slice(8))}</span>
                </span>
                <span className="bm-cal-week-items">
                  {dayRows.length === 0 ? (
                    <span className="bm-cal-week-empty">Nothing scheduled</span>
                  ) : (
                    dayRows.slice(0, 4).map((r) => (
                      <span
                        key={r.id}
                        className="bm-cal-week-item"
                        style={{ '--chip-accent': colorForLabel(r.habit.name).accent } as React.CSSProperties}
                      >
                        <span className="bm-dot" />
                        <span className="bm-cal-week-name">{r.habit.name}</span>
                        {r.scheduledTime ? (
                          <span className="bm-cal-week-time">{formatIsoTime12h(r.scheduledTime)}</span>
                        ) : null}
                      </span>
                    ))
                  )}
                  {dayRows.length > 4 ? (
                    <span className="bm-cal-week-empty">+{dayRows.length - 4} more</span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : view === 'year' ? (
        /*
          Twelve months, shaded by how much is in each. It answers one question
          — where did the year actually get planned — and hands you the month.
        */
        <div className="bm-cal-year-grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {yearMonths.map((m) => (
            <button
              key={m.index}
              type="button"
              className={`bm-cal-year-month ${
                `${year}-${String(m.index + 1).padStart(2, '0')}` === today.slice(0, 7) ? 'today' : ''
              }`}
              onClick={() => {
                setCursor(`${year}-${String(m.index + 1).padStart(2, '0')}`)
                setView('month')
              }}
              aria-label={`${MONTH_SHORT[m.index]} ${year}, ${m.count} scheduled`}
            >
              <span
                className="bm-cal-year-fill"
                style={{ opacity: m.intensity }}
                aria-hidden="true"
              />
              <span className="bm-cal-year-label">{MONTH_SHORT[m.index]}</span>
              <span className="bm-cal-year-count num">{m.count > 0 ? m.count : '—'}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bm-cal-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="bm-cal-weekday-row">
            {weekdayInitials.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div key={cursor} className={`bm-cal-grid bm-cal-slide-${direction}`}>
            {cells.map((cell) => {
              const dayRows = cell.outside ? [] : byDate.get(cell.date) ?? []
              const isToday = cell.date === today
              const isSelected = cell.date === selected
              return (
                <button
                  key={cell.date}
                  type="button"
                  className={[
                    'bm-cal-cell',
                    cell.outside ? 'outside' : '',
                    isToday ? 'today' : '',
                    isSelected ? 'selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => (cell.outside ? setCursor(cell.date.slice(0, 7)) : setSelected(cell.date))}
                  aria-label={cell.date}
                  aria-current={isToday ? 'date' : undefined}
                >
                  <span className="bm-cal-day-num">{cell.day}</span>
                  <span className="bm-cal-dots">
                    {dayRows.slice(0, 3).map((r) => (
                      <span
                        key={r.id}
                        className="bm-dot"
                        style={{ '--chip-accent': colorForLabel(r.habit.name).accent } as React.CSSProperties}
                      />
                    ))}
                    {dayRows.length > 3 ? <span className="bm-cal-more">+{dayRows.length - 3}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="bm-cal-legend">
        <span>
          <span className="bm-cal-legend-swatch today" /> Today
        </span>
        {view === 'month' ? (
          <span>
            <span className="bm-cal-legend-swatch selected" /> Selected
          </span>
        ) : null}
        <span>
          {view === 'year' ? 'Tap a month to open it' : 'Tap a day to see what is on it'}
        </span>
      </div>

      {/*
        A sheet rather than a route change. You can check three days in a row
        without losing your place in the month, which was the main thing that
        made the old calendar tedious.
      */}
      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? relativeDayLabel(selected, today) : ''}
      >
        {selectedRows.length === 0 ? (
          <p className="bm-empty-line">Nothing scheduled on this day.</p>
        ) : (
          <div className="bm-row-stack">
            {selectedRows.map((r) => (
              <SectionRow
                key={r.id}
                onClick={() => {
                  setSelected(null)
                  navigate(`/habits/${r.habit.id}`)
                }}
                icon={r.habit.icon ?? 'circle'}
                color={colorForLabel(r.habit.name).id}
                title={r.habit.name}
                subtitle={r.scheduledTime ? formatIsoTime12h(r.scheduledTime) : 'Any time'}
                value={r.status ? STATUS_LABEL[r.status] : undefined}
                valueTone={r.status === 'done' ? 'in' : 'muted'}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="bm-add-cta bm-press"
          onClick={() => {
            const date = selected
            setSelected(null)
            if (date) navigate(`/calendar/${date}`)
          }}
        >
          <span className="bm-add-cta-plus" aria-hidden="true">
            +
          </span>
          Open this day
        </button>
      </BottomSheet>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  done: 'Done',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
}
