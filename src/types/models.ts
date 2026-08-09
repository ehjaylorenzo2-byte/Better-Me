import type { IsoDate, IsoTime } from '@/utils/timezone'
import type { Centavos } from '@/utils/money'

export type HabitStatus = 'done' | 'skipped' | 'cancelled'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface Profile {
  id: string
  username: string
  usernameNormalized: string
  createdAt: string
}

export interface UserPreferences {
  userId: string
  theme: ThemePreference
  timezone: string
  remindersEnabled: boolean
  oneHourReminderEnabled: boolean
  noonSummaryEnabled: boolean
}

export interface Habit {
  id: string
  userId: string
  name: string
  description: string | null
  icon: string | null
  category: 'general' | 'gym'
  archived: boolean
  createdAt: string
}

export interface HabitSchedule {
  id: string
  habitId: string
  recurrence: Recurrence
  weekdays: number[] | null // 0=Sun..6=Sat, for weekly/custom
  time: IsoTime | null
  startDate: IsoDate
  endDate: IsoDate | null
  reminderEnabled: boolean
  supersedesScheduleId: string | null
  createdAt: string
}

export interface HabitOccurrence {
  id: string
  habitId: string
  scheduleId: string
  userId: string
  occurrenceDate: IsoDate
  scheduledTime: IsoTime | null
  status: HabitStatus | null
  completedAt: string | null
  notes: string | null
}

export interface WorkoutExercise {
  id: string
  workoutId: string
  name: string
  sets: number
  reps: number
  weightKg: number
  notes: string | null
  orderIndex: number
}

export interface Workout {
  id: string
  userId: string
  occurrenceId: string | null
  workoutDate: IsoDate
  durationMinutes: number | null
  notes: string | null
  completed: boolean
  exercises: WorkoutExercise[]
}

export interface IncomeEntry {
  id: string
  userId: string
  amount: Centavos
  source: string
  entryDate: IsoDate
  note: string | null
}

export interface ExpenseEntry {
  id: string
  userId: string
  amount: Centavos
  category: string
  entryDate: IsoDate
  description: string | null
}

export interface Budget {
  id: string
  userId: string
  month: string // "YYYY-MM"
  amount: Centavos
}

export interface SavingsCategory {
  id: string
  userId: string
  name: string
  goalAmount: Centavos | null
  balance: Centavos
  color: string
  icon: string
  createdAt: string
}

export interface SavingsTransaction {
  id: string
  categoryId: string
  userId: string
  type: 'deposit' | 'withdrawal'
  amount: Centavos
  note: string | null
  createdAt: string
}

export interface Debt {
  id: string
  userId: string
  name: string
  originalAmount: Centavos
  balance: Centavos
  paidOff: boolean
  color: string
  icon: string
  createdAt: string
}

export interface DebtPayment {
  id: string
  debtId: string
  userId: string
  amount: Centavos
  note: string | null
  createdAt: string
}

export interface PushSubscriptionRecord {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  createdAt: string
  updatedAt: string
}
