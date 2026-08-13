import type { IsoDate, IsoTime } from '@/utils/timezone'
import type { Centavos } from '@/utils/money'

export type HabitStatus = 'done' | 'skipped' | 'cancelled'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
export type ThemePreference = 'light' | 'dark' | 'system'

/** How blunt the daily message is allowed to get. */
export type MotivationTone = 'encourage' | 'balanced' | 'roast' | 'brutal'

export type TextSize = 'small' | 'medium' | 'large'

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
  /** Free text label. Only 'gym' has behaviour: it links to the workout tracker. */
  category: string
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
  measure: ExerciseMeasure
  notes: string | null
  orderIndex: number
}

export interface Workout {
  id: string
  userId: string
  occurrenceId: string | null
  /** The gym habit this belongs to, decided when the workout is created. */
  habitId: string | null
  /** The routine it came from, if it was started from one. */
  routineId: string | null
  startedAt: string | null
  endedAt: string | null
  workoutDate: IsoDate
  durationMinutes: number | null
  notes: string | null
  completed: boolean
  exercises: WorkoutExercise[]
}

/** How an exercise is measured. Weight x reps is meaningless for a plank. */
export type ExerciseMeasure = 'weight_reps' | 'reps' | 'duration' | 'distance'

export interface Program {
  id: string
  userId: string
  name: string
  notes: string | null
  archived: boolean
  sortOrder: number
}

export interface Routine {
  id: string
  userId: string
  programId: string | null
  name: string
  /** Sticks to the routine and reappears every time it is trained. */
  routineNote: string | null
  archived: boolean
  sortOrder: number
}

export interface RoutineExercise {
  id: string
  userId: string
  routineId: string
  name: string
  measure: ExerciseMeasure
  /** A hint for the day, not a limit. */
  targetSets: number | null
  notes: string | null
  sortOrder: number
}

export interface WorkoutSet {
  id: string
  workoutExerciseId: string
  setNumber: number
  /** Grams, integer, for the same reason money is centavos. */
  weightGrams: number | null
  reps: number | null
  durationSeconds: number | null
  distanceMetres: number | null
  completed: boolean
}

export interface PreviousSet {
  workoutDate: IsoDate
  setNumber: number
  weightGrams: number | null
  reps: number | null
  durationSeconds: number | null
  distanceMetres: number | null
}

export interface ExerciseTotals {
  workoutExerciseId: string
  name: string
  measure: ExerciseMeasure
  setCount: number
  totalReps: number
  /** Zero for anything not measured in weight x reps, by design. */
  volumeGrams: number
  totalSeconds: number
  totalMetres: number
  bestWeightGrams: number | null
  bestReps: number | null
}

export interface WorkoutTotals {
  workoutId: string
  exerciseCount: number
  setCount: number
  totalReps: number
  volumeGrams: number
  totalSeconds: number
  totalMetres: number
  durationMinutes: number | null
}

export interface IncomeEntry {
  id: string
  userId: string
  amount: Centavos
  source: string
  entryDate: IsoDate
  note: string | null
  /** Which bank or wallet the money landed in. Optional by design. */
  accountId: string | null
}

export interface ExpenseEntry {
  id: string
  userId: string
  amount: Centavos
  category: string
  entryDate: IsoDate
  description: string | null
  /** Which bank or wallet it was paid from. Optional by design. */
  accountId: string | null
}

/**
 * How a bank or wallet is used.
 *
 * The split matters because the two numbers mean opposite things and must never
 * be added together: an outgoing account reports what you spent from it, a
 * savings account reports what went into it.
 */
export type AccountFlow = 'outgoing' | 'savings' | 'both'

export interface FinanceAccount {
  id: string
  userId: string
  name: string
  flow: AccountFlow
  color: string
  icon: string
  isBuiltin: boolean
  archived: boolean
  sortOrder: number
  /** What the account held before anything was logged. Zero for everyone today. */
  startingBalance: Centavos
}

/** An account with its current balance, as computed by the database. */
export interface AccountWithBalance extends FinanceAccount {
  balance: Centavos
}

/**
 * One row in the Recent list.
 *
 * Five different tables feed this, so it is flattened to a common shape rather
 * than making the list component understand all five.
 */
export type MovementKind = 'income' | 'expense' | 'transfer' | 'savings' | 'debt'

export interface Movement {
  id: string
  kind: MovementKind
  /** What the row is called: a category, a bank pair, a goal, a debt. */
  title: string
  subtitle: string | null
  amount: Centavos
  /** in raises Total Balance, out lowers it, moved leaves it alone. */
  direction: 'in' | 'out' | 'moved'
  entryDate: IsoDate
  /** Sorts rows logged on the same day in the order they were entered. */
  createdAt: string
  color: string | null
  icon: string
}

/**
 * Money moved between two of your own accounts.
 *
 * Deliberately not an expense plus an income: logged that way it would inflate
 * both monthly totals and put a phantom entry in the spending breakdown.
 */
export interface Transfer {
  id: string
  userId: string
  fromAccountId: string | null
  toAccountId: string | null
  amount: Centavos
  entryDate: IsoDate
  note: string | null
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
  /** The bank this goal is held in. Null only for goals created before wallets. */
  accountId: string | null
  /** Out of the active list, but still yours and still holding its balance. */
  archived: boolean
  createdAt: string
}

export interface SavingsTransaction {
  id: string
  categoryId: string
  userId: string
  type: 'deposit' | 'withdrawal'
  amount: Centavos
  note: string | null
  /** The bank on the far side: funded a deposit, or received a withdrawal. */
  counterAccountId: string | null
  /** The Manila date this belongs to, like every other entry in Finance. */
  entryDate: IsoDate
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
  /** The bank the payment came out of. */
  accountId: string | null
  entryDate: IsoDate
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
