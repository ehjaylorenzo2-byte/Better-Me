// Better Me — scheduled Edge Function: 1-hour-before reminders, the 12PM PH
// daily summary, and the evening finance nudge.
//
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
// Schedule (recommended, every 5 minutes) with Supabase's native Cron
// (Dashboard -> Edge Functions -> send-reminders -> Cron) or via pg_cron +
// pg_net calling this function's URL. See README "Web Push setup".
//
// Required secrets (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-available to edge functions)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
//
// Requires migration 0011 for the finance nudge.

// @ts-nocheck -- Deno edge runtime; not part of the Vite/TS app build.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

// Every scheduling decision lives in schedule.ts, which has no Deno or npm
// imports and is loaded by tests/reminder-schedule.test.ts. What is proven
// there is this exact file, not a copy of it.
import {
  dueOneHourReminders,
  phPartsOf,
  scheduleAppliesOn,
  toMinutes,
  withinPhWindow,
} from './schedule.ts'

/**
 * How far back a run will reach for reminders it should already have sent.
 *
 * A cron that misses a tick used to lose those reminders permanently, because
 * the window was exactly the five minutes around the current time. An hour is
 * chosen deliberately: a one-hour-before reminder that arrives fifty minutes
 * late is still five minutes before the thing, which is worth having, and the
 * scheduled-time check below throws away anything that has already started.
 */
const CATCHUP_MINUTES = 60

/** The evening nudge fires in this Philippine hour, if the day has no money in it. */
const FINANCE_NUDGE_FROM = '20:00'
const FINANCE_NUDGE_UNTIL = '21:00'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err) {
      // 410/404 means the subscription is gone; clean it up.
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push send failed', userId, err)
      }
    }
  }
}

/**
 * Preferences, read once per user per run.
 *
 * The cache is created inside the handler and passed in, never held at module
 * scope. That is deliberate. Edge isolates stay warm between runs, so a
 * module-level Map would remember a user's preferences after they changed them,
 * and someone who switched reminders off would keep getting them until the
 * isolate happened to recycle. A per-run cache cannot do that.
 */
type PrefCache = Map<string, Record<string, boolean>>

async function loadPrefs(cache: PrefCache, userId: string): Promise<Record<string, boolean>> {
  const cached = cache.get(userId)
  if (cached) return cached

  const { data } = await supabase
    .from('notification_preferences')
    .select(
      'reminders_enabled, one_hour_reminder_enabled, noon_summary_enabled, gym_reminders_enabled, finance_reminders_enabled',
    )
    .eq('user_id', userId)
    .maybeSingle()

  // Missing row means the user has never touched settings, so defaults apply.
  const prefs = {
    reminders: data?.reminders_enabled ?? true,
    oneHour: data?.one_hour_reminder_enabled ?? true,
    noon: data?.noon_summary_enabled ?? true,
    gym: data?.gym_reminders_enabled ?? true,
    finance: data?.finance_reminders_enabled ?? true,
  }
  cache.set(userId, prefs)
  return prefs
}

async function canSend(
  cache: PrefCache,
  userId: string,
  kind: 'one_hour' | 'noon_summary' | 'finance_nudge',
  isGym: boolean,
): Promise<boolean> {
  const prefs = await loadPrefs(cache, userId)
  if (!prefs.reminders) return false
  if (kind === 'one_hour' && !prefs.oneHour) return false
  if (kind === 'noon_summary' && !prefs.noon) return false
  if (kind === 'finance_nudge' && !prefs.finance) return false
  if (isGym && !prefs.gym) return false
  return true
}

/**
 * Claims the right to send one reminder, and returns false if it was already
 * claimed.
 *
 * The guarantee is the unique index on reminder_deliveries, not this function:
 * inserting first means two overlapping runs cannot both win, which a
 * check-then-send would allow. It is also what makes the catch-up window safe —
 * a run may reach back an hour precisely because a reminder already sent cannot
 * be sent twice.
 *
 * For one_hour the subject is the SCHEDULE, not the habit. A habit with a
 * morning and an evening schedule used to share one key and so got one
 * reminder a day.
 */
async function claimDelivery(
  userId: string,
  kind: 'one_hour' | 'noon_summary' | 'finance_nudge',
  subjectId: string | null,
  date: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('reminder_deliveries')
    .insert({ user_id: userId, kind, subject_id: subjectId, occurrence_date: date })

  // 23505 is the unique violation: someone already sent this one. Any other
  // error also means do not send, because we could not prove it is safe to.
  if (error) return false
  return true
}

/** Occurrence status for a habit on a date, or null when nothing is recorded. */
async function statusFor(habitId: string, date: string): Promise<string | null> {
  const { data } = await supabase
    .from('habit_occurrences')
    .select('status')
    .eq('habit_id', habitId)
    .eq('occurrence_date', date)
    .maybeSingle()
  return data?.status ?? null
}

Deno.serve(async () => {
  // Fresh per run. See the note on PrefCache above.
  const prefCache: PrefCache = new Map()

  const { date: today, time: nowTime } = phPartsOf(new Date())
  const nowMinute = toMinutes(nowTime)

  let oneHourSent = 0
  let noonSent = 0
  let financeSent = 0

  // ---------------------------------------------------------------------
  // 1-hour-before reminders.
  //
  // Both today and tomorrow are considered, because the reminder for a habit
  // scheduled just after midnight falls on the previous evening. Reaching
  // forward one day is what lets a 00:30 habit be reminded at 23:30 tonight.
  // ---------------------------------------------------------------------
  const { data: schedules } = await supabase
    .from('habit_schedules')
    .select('*, habits!inner(id, user_id, name, archived, category)')
    .eq('reminder_enabled', true)
    .not('time', 'is', null)

  for (const schedule of schedules ?? []) {
    if (schedule.habits.archived) continue

    for (const { occurrenceDate, lateBy } of dueOneHourReminders(
      schedule,
      today,
      nowMinute,
      CATCHUP_MINUTES,
    )) {
      if (await statusFor(schedule.habits.id, occurrenceDate)) continue // already Done/Skipped/Cancelled.

      const isGym = schedule.habits.category === 'gym'
      if (!(await canSend(prefCache, schedule.habits.user_id, 'one_hour', isGym))) continue
      // Keyed on the schedule so two schedules on one habit both get through.
      if (!(await claimDelivery(schedule.habits.user_id, 'one_hour', schedule.id, occurrenceDate))) continue

      // A catch-up says how long it has left rather than lying about the hour.
      const minutesLeft = 60 - lateBy
      await sendPushToUser(schedule.habits.user_id, {
        title:
          lateBy >= 5
            ? `${schedule.habits.name} in ${minutesLeft} minutes`
            : `${schedule.habits.name} in 1 hour`,
        body: 'You scheduled it. Show up.',
        tag: `reminder-${schedule.id}-${occurrenceDate}`,
        url: schedule.habits.category === 'gym' ? '/gym' : '/habits',
      })
      oneHourSent += 1
    }
  }

  // ---------------------------------------------------------------------
  // Midday summary of everything still unmarked.
  //
  // The window is a full hour rather than five minutes: a single missed tick
  // used to mean no summary at all that day, and the delivery ledger already
  // makes a wider window safe.
  // ---------------------------------------------------------------------
  if (withinPhWindow(nowTime, '12:00', '13:00')) {
    const { data: allSchedules } = await supabase
      .from('habit_schedules')
      .select('*, habits!inner(id, user_id, name, archived, category)')
      .eq('reminder_enabled', true)

    const outstandingByUser = new Map<string, Set<string>>()

    for (const schedule of allSchedules ?? []) {
      if (schedule.habits.archived) continue
      if (!scheduleAppliesOn(schedule, today)) continue

      // The gym switch is honoured here too. It used to be hardcoded off, so
      // turning gym reminders off silenced nothing in the summary. A gym habit
      // is now dropped from the list rather than the whole summary being
      // suppressed, so the other habits still get their nudge.
      const prefs = await loadPrefs(prefCache, schedule.habits.user_id)
      if (schedule.habits.category === 'gym' && !prefs.gym) continue

      if (await statusFor(schedule.habits.id, today)) continue

      // A Set, because a habit with two schedules is still one thing to do.
      const names = outstandingByUser.get(schedule.habits.user_id) ?? new Set<string>()
      names.add(schedule.habits.name)
      outstandingByUser.set(schedule.habits.user_id, names)
    }

    for (const [userId, nameSet] of outstandingByUser) {
      const names = [...nameSet]
      if (names.length === 0) continue // nothing outstanding -> no unnecessary reminder.
      if (!(await canSend(prefCache, userId, 'noon_summary', false))) continue
      if (!(await claimDelivery(userId, 'noon_summary', null, today))) continue

      const body = `You still have ${names.length} thing${names.length > 1 ? 's' : ''} left today:\n${names.join('\n')}\n\nYou've got time. Get moving.`
      await sendPushToUser(userId, { title: 'Better Me', body, tag: `noon-${today}`, url: '/' })
      noonSent += 1
    }
  }

  // ---------------------------------------------------------------------
  // Evening finance nudge.
  //
  // finance_reminders_enabled has been in the settings screen since 0006 with
  // nothing behind it — the switch did nothing at all. This is the sender.
  // It only fires when the day genuinely has no money recorded, so it cannot
  // become the kind of daily noise people turn off within a week.
  // ---------------------------------------------------------------------
  if (withinPhWindow(nowTime, FINANCE_NUDGE_FROM, FINANCE_NUDGE_UNTIL)) {
    const { data: candidates } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('reminders_enabled', true)
      .eq('finance_reminders_enabled', true)

    for (const row of candidates ?? []) {
      const userId = row.user_id

      // Counted, not fetched: the question is only "was anything recorded".
      const [expenses, income] = await Promise.all([
        supabase
          .from('expense_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('entry_date', today),
        supabase
          .from('income_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('entry_date', today),
      ])
      if ((expenses.count ?? 0) > 0 || (income.count ?? 0) > 0) continue

      if (!(await canSend(prefCache, userId, 'finance_nudge', false))) continue
      if (!(await claimDelivery(userId, 'finance_nudge', null, today))) continue

      await sendPushToUser(userId, {
        title: 'Nothing recorded today',
        body: 'Add what you spent while you still remember it. It takes a few seconds.',
        tag: `finance-${today}`,
        url: '/finance',
      })
      financeSent += 1
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      ranAt: `${today} ${nowTime}`,
      sent: { oneHour: oneHourSent, noon: noonSent, finance: financeSent },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
