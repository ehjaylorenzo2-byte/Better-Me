import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  createHabit,
  editScheduleThisAndFuture,
  getHabit,
  listSchedulesForHabit,
  updateHabitDetails,
} from '@/services/habits'
import { getPhilippineToday, weekdayLabel } from '@/utils/timezone'
import type { Recurrence, HabitSchedule } from '@/types/models'
import './habits.css'

const RECURRENCE_OPTIONS: Array<{ value: Recurrence; label: string }> = [
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export function AddEditHabitPage() {
  const { userId } = useAuth()
  const { habitId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const isEdit = Boolean(habitId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [time, setTime] = useState('')
  const [startDate, setStartDate] = useState(searchParams.get('date') || getPhilippineToday())
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [currentSchedule, setCurrentSchedule] = useState<HabitSchedule | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!habitId) return
    setLoading(true)
    Promise.all([getHabit(habitId), listSchedulesForHabit(habitId)])
      .then(([habit, schedules]) => {
        if (habit) {
          setName(habit.name)
          setDescription(habit.description ?? '')
        }
        const active = schedules[schedules.length - 1] ?? null
        if (active) {
          setCurrentSchedule(active)
          setRecurrence(active.recurrence)
          setWeekdays(active.weekdays ?? [])
          setTime(active.time ?? '')
          setStartDate(active.startDate)
          setReminderEnabled(active.reminderEnabled)
        }
      })
      .finally(() => setLoading(false))
  }, [habitId])

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Habit name is required.'
    if ((recurrence === 'weekly' || recurrence === 'custom') && weekdays.length === 0) {
      next.weekdays = 'Choose at least one day.'
    }
    if (!startDate) next.startDate = 'Start date is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !validate()) return
    setSaving(true)
    try {
      if (isEdit && habitId) {
        await updateHabitDetails(habitId, { name: name.trim(), description: description.trim() || null })
        if (currentSchedule) {
          const scheduleChanged =
            currentSchedule.recurrence !== recurrence ||
            currentSchedule.time !== (time || null) ||
            JSON.stringify(currentSchedule.weekdays ?? []) !== JSON.stringify(weekdays)
          if (scheduleChanged) {
            await editScheduleThisAndFuture({
              habitId,
              userId,
              currentSchedule,
              recurrence,
              weekdays: recurrence === 'weekly' ? weekdays : null,
              time: time || null,
              reminderEnabled,
              scope: 'this_and_future',
              effectiveDate: getPhilippineToday(),
            })
          }
        }
        show('Habit updated.', 'success')
      } else {
        await createHabit({
          userId,
          name,
          description: description.trim() || null,
          recurrence,
          weekdays: recurrence === 'weekly' ? weekdays : null,
          time: time || null,
          startDate,
          reminderEnabled,
        })
        show('Habit created.', 'success')
      }
      navigate('/habits')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save habit.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Habit' : 'Add Habit'} />
      <form className="bm-form" onSubmit={onSubmit}>
        <Input label="Habit name" placeholder="e.g. Gym, Read, Drink Water" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input
          label="Description (optional)"
          placeholder="Add a note"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="bm-field">
          <span className="bm-label">Recurrence</span>
          <div className="bm-recurrence-options">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={`bm-recurrence-opt ${recurrence === opt.value ? 'active' : ''}`}
                onClick={() => setRecurrence(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {recurrence === 'weekly' ? (
          <div className="bm-field">
            <span className="bm-label">Repeat on</span>
            <div className="bm-weekday-picker">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <button
                  type="button"
                  key={day}
                  className={`bm-weekday-opt ${weekdays.includes(day) ? 'active' : ''}`}
                  onClick={() => toggleWeekday(day)}
                >
                  {weekdayLabel(day)}
                </button>
              ))}
            </div>
            {errors.weekdays ? <p className="bm-field-error">{errors.weekdays}</p> : null}
          </div>
        ) : null}

        <Input label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />

        {!isEdit ? (
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            error={errors.startDate}
          />
        ) : null}

        <label className="bm-checkbox-row">
          <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
          <span>Remind me 1 hour before</span>
        </label>

        <Button type="submit" fullWidth loading={saving}>
          {isEdit ? 'Save Changes' : 'Create Habit'}
        </Button>
      </form>
    </div>
  )
}
