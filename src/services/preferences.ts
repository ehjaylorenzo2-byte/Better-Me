import { supabase } from '@/lib/supabase'
import type { MotivationTone, TextSize, ThemePreference } from '@/types/models'

export interface CombinedPreferences {
  theme: ThemePreference
  timezone: string
  /** How blunt the daily message is allowed to be. */
  motivationTone: MotivationTone
  textSize: TextSize
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1
  /** Optional home cards the user has switched off. */
  hiddenHomeCards: string[]
  remindersEnabled: boolean
  oneHourReminderEnabled: boolean
  noonSummaryEnabled: boolean
  gymRemindersEnabled: boolean
  financeRemindersEnabled: boolean
}

export const DEFAULT_PREFERENCES: CombinedPreferences = {
  theme: 'system',
  timezone: 'Asia/Manila',
  motivationTone: 'balanced',
  textSize: 'medium',
  weekStartsOn: 0,
  hiddenHomeCards: [],
  remindersEnabled: true,
  oneHourReminderEnabled: true,
  noonSummaryEnabled: true,
  gymRemindersEnabled: true,
  financeRemindersEnabled: true,
}

/**
 * Always returns a complete object.
 *
 * This used to return null when a user had no rows yet, which meant every
 * caller invented its own defaults, and they did not all invent the same ones.
 */
export async function getUserPreferences(userId: string): Promise<CombinedPreferences> {
  const [{ data: prefs }, { data: notif }] = await Promise.all([
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
  ])

  const p = prefs as Record<string, unknown> | null
  const n = notif as Record<string, unknown> | null

  return {
    theme: (p?.theme as ThemePreference) ?? DEFAULT_PREFERENCES.theme,
    timezone: (p?.timezone as string) ?? DEFAULT_PREFERENCES.timezone,
    motivationTone: (p?.motivation_tone as MotivationTone) ?? DEFAULT_PREFERENCES.motivationTone,
    textSize: (p?.text_size as TextSize) ?? DEFAULT_PREFERENCES.textSize,
    weekStartsOn: ((p?.week_starts_on as 0 | 1) ?? DEFAULT_PREFERENCES.weekStartsOn),
    hiddenHomeCards: (p?.hidden_home_cards as string[]) ?? DEFAULT_PREFERENCES.hiddenHomeCards,
    remindersEnabled: (n?.reminders_enabled as boolean) ?? DEFAULT_PREFERENCES.remindersEnabled,
    oneHourReminderEnabled:
      (n?.one_hour_reminder_enabled as boolean) ?? DEFAULT_PREFERENCES.oneHourReminderEnabled,
    noonSummaryEnabled: (n?.noon_summary_enabled as boolean) ?? DEFAULT_PREFERENCES.noonSummaryEnabled,
    gymRemindersEnabled: (n?.gym_reminders_enabled as boolean) ?? DEFAULT_PREFERENCES.gymRemindersEnabled,
    financeRemindersEnabled:
      (n?.finance_reminders_enabled as boolean) ?? DEFAULT_PREFERENCES.financeRemindersEnabled,
  }
}

export async function updateThemePreference(userId: string, theme: ThemePreference): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, theme }, { onConflict: 'user_id' })
  if (error) throw error
}

type AppPrefUpdates = Partial<
  Pick<CombinedPreferences, 'motivationTone' | 'textSize' | 'weekStartsOn' | 'hiddenHomeCards'>
>

export async function updateAppPreferences(userId: string, updates: AppPrefUpdates): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      ...(updates.motivationTone !== undefined ? { motivation_tone: updates.motivationTone } : {}),
      ...(updates.textSize !== undefined ? { text_size: updates.textSize } : {}),
      ...(updates.weekStartsOn !== undefined ? { week_starts_on: updates.weekStartsOn } : {}),
      ...(updates.hiddenHomeCards !== undefined ? { hidden_home_cards: updates.hiddenHomeCards } : {}),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

type NotifUpdates = Partial<
  Pick<
    CombinedPreferences,
    | 'remindersEnabled'
    | 'oneHourReminderEnabled'
    | 'noonSummaryEnabled'
    | 'gymRemindersEnabled'
    | 'financeRemindersEnabled'
  >
>

export async function updateNotificationPreferences(userId: string, updates: NotifUpdates): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: userId,
      ...(updates.remindersEnabled !== undefined ? { reminders_enabled: updates.remindersEnabled } : {}),
      ...(updates.oneHourReminderEnabled !== undefined
        ? { one_hour_reminder_enabled: updates.oneHourReminderEnabled }
        : {}),
      ...(updates.noonSummaryEnabled !== undefined ? { noon_summary_enabled: updates.noonSummaryEnabled } : {}),
      ...(updates.gymRemindersEnabled !== undefined ? { gym_reminders_enabled: updates.gymRemindersEnabled } : {}),
      ...(updates.financeRemindersEnabled !== undefined
        ? { finance_reminders_enabled: updates.financeRemindersEnabled }
        : {}),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
