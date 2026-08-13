import { useEffect, useRef, useState } from 'react'
import './gym-log.css'

/**
 * Rest between sets.
 *
 * Counts down from a wall-clock deadline rather than by decrementing a number
 * every second. A phone that sleeps, or a browser that throttles background
 * timers, would otherwise come back showing a timer that had barely moved.
 * Comparing against a fixed end time means it is always right when you look.
 *
 * It sits above the bottom bar and never covers what you are logging, because
 * a timer you have to dismiss to keep working is worse than no timer.
 */
export function RestTimer({
  seconds,
  onDone,
  onDismiss,
}: {
  /** Null closes the timer. A new number restarts it. */
  seconds: number | null
  onDone?: () => void
  onDismiss: () => void
}) {
  const [remaining, setRemaining] = useState(seconds ?? 0)
  const deadline = useRef<number | null>(null)
  const finished = useRef(false)

  useEffect(() => {
    if (seconds === null) {
      deadline.current = null
      return
    }
    deadline.current = Date.now() + seconds * 1000
    finished.current = false
    setRemaining(seconds)

    const tick = () => {
      if (deadline.current === null) return
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !finished.current) {
        finished.current = true
        onDone?.()
      }
    }

    const id = window.setInterval(tick, 250)
    tick()
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  if (seconds === null) return null

  const add = (extra: number) => {
    if (deadline.current === null) return
    deadline.current += extra * 1000
    finished.current = false
    setRemaining(Math.max(0, Math.round((deadline.current - Date.now()) / 1000)))
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const done = remaining === 0

  return (
    <div className={`bm-rest ${done ? 'is-done' : ''}`} role="status" aria-live="polite">
      <div className="bm-rest-left">
        <span className="bm-rest-label">{done ? 'Rest over' : 'Rest'}</span>
        <span className="bm-rest-clock num">
          {mins}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div className="bm-rest-actions">
        <button type="button" className="bm-rest-btn" onClick={() => add(30)}>
          +30s
        </button>
        <button type="button" className="bm-rest-btn is-primary" onClick={onDismiss}>
          {done ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
