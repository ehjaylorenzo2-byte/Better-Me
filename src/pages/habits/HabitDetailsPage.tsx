import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/Progress'
import { StatusSelector } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import {
  archiveHabit,
  getHabit,
  getHabitOccurrenceHistory,
  listSchedulesForHabit,
  setOccurrenceStatus,
} from '@/services/habits'
import { describeSchedule } from '@/utils/recurrence'
import { formatIsoTime12h, getPhilippineToday, weekdayLabel } from '@/utils/timezone'
import { calculateDoneRate, tallyStatuses } from '@/utils/calculations'
import type { Habit, HabitOccurrence, HabitSchedule, HabitStatus } from '@/types/models'
import './habits.css'

export function HabitDetailsPage() {
  const { habitId } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const [habit, setHabit] = useState<Habit | null>(null)
  const [schedule, setSchedule] = useState<HabitSchedule | null>(null)
  const [history, setHistory] = useState<HabitOccurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const today = getPhilippineToday()
  const todayEntry = history.find((h) => h.occurrenceDate === today) ?? null

  const load = async () => {
    if (!habitId) return
    setLoading(true)
    setError(null)
    try {
      const [h, schedules, hist] = await Promise.all([
        getHabit(habitId),
        listSchedulesForHabit(habitId),
        getHabitOccurrenceHistory(habitId, 30),
      ])
      setHabit(h)
      setSchedule(schedules[schedules.length - 1] ?? null)
      setHistory(hist)
    } catch {
      setError('Could not load this habit.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitId])

  const weekStats = useMemo(() => {
    const last7 = history.slice(0, 7)
    return tallyStatuses(last7.map((h) => h.status))
  }, [history])

  const onStatusChange = async (status: HabitStatus) => {
    if (!habit || !schedule) return
    try {
      await setOccurrenceStatus(habit.id, schedule.id, today, schedule.time, status)
      show('Status updated.', 'success')
      load()
    } catch {
      show('Could not update status.', 'error')
    }
  }

  const onArchive = async () => {
    if (!habit) return
    await archiveHabit(habit.id)
    show('Habit archived.', 'success')
    navigate('/habits')
  }

  if (loading) return <LoadingState />
  if (error || !habit) return <ErrorState message={error ?? 'Habit not found.'} onRetry={load} />

  const doneRate = calculateDoneRate(weekStats)

  return (
    <div>
      <PageHeader title="Habit Details" action={<button className="bm-link" onClick={() => navigate(`/habits/${habit.id}/edit`)}>Edit</button>} />

      <div className="bm-detail-header">
        <div className="bm-detail-icon">{habit.category === 'gym' ? '🏋️' : '✓'}</div>
        <h2>{habit.name}</h2>
        {habit.description ? <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{habit.description}</p> : null}
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="bm-detail-rows">
          <div className="bm-detail-row">
            <span>Schedule</span>
            <span>{schedule ? describeSchedule(schedule) : '—'}</span>
          </div>
          {schedule?.time ? (
            <div className="bm-detail-row">
              <span>Time</span>
              <span>{formatIsoTime12h(schedule.time)}</span>
            </div>
          ) : null}
          <div className="bm-detail-row">
            <span>Reminder</span>
            <span>{schedule?.reminderEnabled ? '1 hour before' : 'Off'}</span>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Today's status</h3>
        <StatusSelector value={todayEntry?.status ?? null} onChange={onStatusChange} />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="bm-section-title-row">
          <h3 style={{ fontSize: 14 }}>Progress This Week</h3>
          <span>
            {weekStats.done} / {weekStats.done + weekStats.skipped + weekStats.cancelled} Done ({Math.round(doneRate)}%)
          </span>
        </div>
        <ProgressBar value={doneRate} />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>History</h3>
        <div className="bm-history-strip">
          {history
            .slice()
            .reverse()
            .map((h) => (
              <div key={h.id} className="bm-history-dot">
                <div className={`bm-history-circle ${h.status ?? ''}`}>
                  {h.status === 'done' ? '✓' : h.status === 'skipped' ? '»' : h.status === 'cancelled' ? '×' : ''}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {weekdayLabel(new Date(h.occurrenceDate + 'T12:00:00Z').getUTCDay())}
                </span>
              </div>
            ))}
        </div>
      </Card>

      <div className="bm-danger-zone">
        <button className="bm-btn bm-btn-danger bm-btn-full" onClick={() => setConfirmArchive(true)}>
          Archive Habit
        </button>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive this habit?"
        message="Archived habits stop generating new schedule items, but history is kept."
        confirmLabel="Archive"
        danger
        onConfirm={onArchive}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>
  )
}
