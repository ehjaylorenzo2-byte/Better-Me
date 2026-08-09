import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusSelector } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getOccurrencesInRange, setOccurrenceStatus } from '@/services/habits'
import { formatIsoDateLong, formatIsoTime12h } from '@/utils/timezone'
import type { Habit, HabitOccurrence, HabitSchedule, HabitStatus } from '@/types/models'
import './calendar.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

export function CalendarDayPage() {
  const { date } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId || !date) return
    setLoading(true)
    setError(null)
    try {
      const data = await getOccurrencesInRange(userId, date, date)
      setRows(data)
    } catch {
      setError('Could not load this day.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date])

  const onStatusChange = async (row: Row, status: HabitStatus) => {
    try {
      await setOccurrenceStatus(row.habitId, row.scheduleId, row.occurrenceDate, row.scheduledTime, status)
      show('Updated.', 'success')
      load()
    } catch {
      show('Could not update status.', 'error')
    }
  }

  if (!date) return null

  return (
    <div>
      <PageHeader title={formatIsoDateLong(date)} />

      <button className="bm-btn bm-btn-secondary bm-btn-full" onClick={() => navigate(`/habits/new?date=${date}`)} style={{ marginBottom: 16 }}>
        + Add Schedule
      </button>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState message="Nothing scheduled on this day." />
      ) : (
        <ul className="bm-day-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <div className="bm-habit-item-top">
                  <span className="bm-habit-item-name">{row.habit.name}</span>
                  {row.scheduledTime ? <span className="bm-habit-item-time">{formatIsoTime12h(row.scheduledTime)}</span> : null}
                </div>
                <div style={{ marginTop: 10 }}>
                  <StatusSelector value={row.status} onChange={(s) => onStatusChange(row, s)} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
