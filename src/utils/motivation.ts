import type { DailyProgress } from './calculations'

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
export function getMotivationMessage(progress: DailyProgress, daySeed = 0): string {
  const finalized = progress.done + progress.skipped + progress.cancelled
  if (finalized === 0) {
    return "Nothing logged yet today. Start with one thing."
  }

  const doneRate = progress.doneRateAmongFinalized
  const skipCancelRate = finalized > 0 ? ((progress.skipped + progress.cancelled) / finalized) * 100 : 0

  if (skipCancelRate >= 60) {
    return pick(HIGH_SKIP_CANCEL_ROAST, daySeed)
  }
  if (doneRate >= 80) return pick(STRONG_ENCOURAGEMENT, daySeed)
  if (doneRate >= 60) return pick(ENCOURAGEMENT_WITH_PUSH, daySeed)
  if (doneRate >= 40) return pick(LIGHT_ROAST, daySeed)
  return pick(STRONGER_ROAST, daySeed)
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
