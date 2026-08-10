import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { BottomSheet } from '@/components/ui/Sheet'
import { SectionRow } from '@/components/ui/SectionRow'
import { getOccurrencesInRange } from '@/services/habits'
import {
  addDaysToIsoDate,
  formatIsoTime12h,
  getPhilippineToday,
  isoDateWeekday,
  philippineMonthNameOnly,
  relativeDayLabel,
  shiftMonth,
} from '@/utils/timezone'
import { colorForLabel } from '@/theme/categoryStyles'
import type { Habit, HabitOccurrence, HabitSchedule } from '@/types/models'
import './calendar.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function CalendarPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const today = getPhilippineToday()

  const [cursor, setCursor] = useState(today.slice(0, 7))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  const touchStartX = useRef<number | null>(null)

  const [year, month] = cursor.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = isoDateWeekday(`${cursor}-01`)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const end = `${cursor}-${String(daysInMonth).padStart(2, '0')}`
      setRows(await getOccurrencesInRange(userId, `${cursor}-01`, end))
    } catch {
      setError('Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cursor])

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

  const go = (delta: number) => {
    setDirection(delta > 0 ? 'next' : 'prev')
    setCursor((current) => shiftMonth(current, delta))
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

  const selectedRows = selected ? byDate.get(selected) ?? [] : []
  const monthTotal = rows.length

  return (
    <div className="bm-cal-page bm-enter">
      <header className="bm-cal-head">
        <div>
          <h1 className="bm-display">{philippineMonthNameOnly(cursor)}</h1>
          <p className="bm-cal-year">
            {year}
            {monthTotal > 0 ? (
              <span className="bm-cal-count">
                {monthTotal} {monthTotal === 1 ? 'thing' : 'things'} scheduled
              </span>
            ) : null}
          </p>
        </div>
        <div className="bm-cal-nav">
          <button type="button" onClick={() => go(-1)} aria-label="Previous month">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next month">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </header>

      {cursor !== today.slice(0, 7) ? (
        <button type="button" className="bm-cal-today-btn bm-press" onClick={() => setCursor(today.slice(0, 7))}>
          Back to today
        </button>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="bm-cal-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="bm-cal-weekday-row">
            {WEEKDAY_INITIALS.map((d, i) => (
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
        <span>
          <span className="bm-cal-legend-swatch selected" /> Selected
        </span>
        <span>Tap a day to see what is on it</span>
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
