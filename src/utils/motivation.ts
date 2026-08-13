import type { DailyProgress } from './calculations'
import type { MotivationTone } from '@/types/models'

/**
 * Reusable phrase library. Selection is driven entirely by real computed
 * data (done rate among finalized items + combined skip/cancel rate) --
 * never randomized independent of performance. No em dashes, per spec.
 */

const STRONG_ENCOURAGEMENT = [
  "You're doing well. Keep going.",
  "Another strong day. Don't slow down now.",
  "You're following through. Keep it up.",
  'Solid execution today. This is how progress compounds.',
]

const ENCOURAGEMENT_WITH_PUSH = [
  "Good pace. Finish what's left and make it a clean day.",
  "You're close. A few more and today counts as a win.",
  "Decent progress. Don't let the rest slide.",
]

const LIGHT_ROAST = [
  'Halfway is not the finish line. Get back to it.',
  "You made the schedule just to ignore half of it?",
  'A lot of "later" happening today. Later is now.',
]

const STRONGER_ROAST = [
  "Don't be lazy, do it or quit.",
  'At this point, your schedule is just decoration.',
  "Your plans aren't going to finish themselves.",
  'This is not the version of you that you asked for.',
]

const HIGH_SKIP_CANCEL_ROAST = [
  "You're skipping more than you're doing. That's not a plan, that's an excuse list.",
  'Cancelling this much means the schedule was never real to begin with.',
]

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length]
}

/**
 * Deterministic-per-day selection (seeded by date string) so the message
 * doesn't flicker between renders, but still varies day to day.
 */
/**
 * How hard a message is allowed to hit, per tone.
 *
 * Performance still picks the band. Tone only shifts how far that band is
 * allowed to travel, which is why Encourage Me can never produce a roast no
 * matter how bad the day was, and Brutal never softens a good day into
 * flattery: at 90 percent done it still lands in encouragement.
 */
const TONE_SHIFT: Record<MotivationTone, number> = {
  encourage: -2,
  balanced: 0,
  roast: 1,
  brutal: 2,
}

// Gentlest first. Shifting the index is what tone does.
const BANDS = [STRONG_ENCOURAGEMENT, ENCOURAGEMENT_WITH_PUSH, LIGHT_ROAST, STRONGER_ROAST]

function clampBand(index: number): number {
  return Math.min(BANDS.length - 1, Math.max(0, index))
}

/**
 * Deterministic per day, driven by real performance, then nudged by tone.
 *
 * Seeded by the date so the message does not flicker between renders while
 * still changing from one day to the next.
 */
export function getMotivationMessage(
  progress: DailyProgress,
  daySeed = 0,
  tone: MotivationTone = 'balanced',
): string {
  const finalized = progress.done + progress.skipped + progress.cancelled
  if (finalized === 0) {
    return 'Nothing logged yet today. Start with one thing.'
  }

  const doneRate = progress.doneRateAmongFinalized
  const skipCancelRate = ((progress.skipped + progress.cancelled) / finalized) * 100

  // Base band from performance alone.
  let band: number
  if (doneRate >= 80) band = 0
  else if (doneRate >= 60) band = 1
  else if (doneRate >= 40) band = 2
  else band = 3

  // Skipping almost everything is its own failure mode, worth calling out
  // separately, but only for people who asked to be pushed. Encourage never
  // reaches it; Balanced does, because Balanced is honest by definition.
  if (skipCancelRate >= 60 && TONE_SHIFT[tone] >= 0) {
    return pick(HIGH_SKIP_CANCEL_ROAST, daySeed)
  }

  return pick(BANDS[clampBand(band + TONE_SHIFT[tone])], daySeed)
}

export function getFinanceMotivationMessage(isOverBudget: boolean, overByRatio: number): string {
  if (!isOverBudget) {
    return 'You stayed under budget this month. Keep that discipline.'
  }
  if (overByRatio > 0.25) {
    return "Your spending is moving like you're rich. Your balance says otherwise."
  }
  return "You're already over budget this month. Slow down."
}

/**
 * The line at the bottom of a shared workout image.
 *
 * Deliberately its own phrase set rather than reusing the daily habit lines.
 * Those exist to needle you in private about a day you let slide; this one goes
 * on a picture other people see, so it never insults the person holding it. The
 * tone setting still moves it, but only between quiet and loud, never into a
 * roast.
 *
 * The line is earned rather than decorative: it is chosen from what actually
 * happened in the session, so a day with no record does not get a line
 * pretending otherwise.
 */
const SHARE_RECORD_LINES = [
  'A number you have never hit before.',
  'New ground. That is what progress looks like.',
  'That is a personal best. Nobody gave you that one.',
  'Heavier than you have ever gone. Remember that.',
]

const SHARE_MULTI_RECORD_LINES = [
  'More than one personal best in a single session.',
  'Several bests in one day. Rare, and earned.',
  'You did not beat one record today. You beat a few.',
]

const SHARE_SOLID_LINES = [
  'No record today. Showed up anyway, which is the part most people skip.',
  'Not every session breaks a record. They all still count.',
  'Quiet work. This is the kind that adds up.',
  'The unremarkable sessions are what make the remarkable ones possible.',
]

const SHARE_LOUD_SUFFIX: Record<MotivationTone, string> = {
  encourage: '',
  balanced: '',
  roast: ' Now do it again.',
  brutal: ' Do not get comfortable.',
}

export interface WorkoutShareContext {
  /** How many personal records were set in this session. */
  recordCount: number
}

export function getWorkoutShareLine(
  context: WorkoutShareContext,
  daySeed = 0,
  tone: MotivationTone = 'balanced',
): string {
  const base =
    context.recordCount > 1
      ? pick(SHARE_MULTI_RECORD_LINES, daySeed)
      : context.recordCount === 1
        ? pick(SHARE_RECORD_LINES, daySeed)
        : pick(SHARE_SOLID_LINES, daySeed)

  // The push only lands when there was something to push on. Telling someone to
  // "do it again" after a session with no record reads as a dig, which is
  // exactly what this phrase set is meant to avoid.
  return context.recordCount > 0 ? base + SHARE_LOUD_SUFFIX[tone] : base
}
