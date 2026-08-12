import { useRef, useState, type ReactNode } from 'react'
import './pull-to-refresh.css'

/**
 * Pull down at the top of a list to reload it.
 *
 * Only arms when the page is already scrolled to the very top, so it can never
 * hijack a normal upward flick in the middle of a long list. There is no
 * desktop equivalent and none is needed: a mouse has no pull gesture, and every
 * screen that uses this already reloads on navigation.
 */

/** How far you must pull before letting go actually refreshes. */
const TRIGGER = 72
/** Hard stop, so the indicator cannot be dragged down the whole screen. */
const MAX = 110
/** Below this the finger is treated as a tap or a scroll. */
const SLOP = 6

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
}: {
  onRefresh: () => void | Promise<void>
  children: ReactNode
  disabled?: boolean
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const armed = useRef(false)

  const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing || !atTop()) {
      armed.current = false
      return
    }
    armed.current = true
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!armed.current || startY.current === null) return
    const dy = e.touches[0].clientY - startY.current
    if (dy < SLOP) {
      setPull(0)
      return
    }
    // Resistance: the further you pull the less it gives, which is what makes
    // the gesture feel attached to something rather than free.
    setPull(Math.min(MAX, dy * 0.5))
  }

  const onTouchEnd = async () => {
    if (!armed.current) return
    armed.current = false
    startY.current = null

    if (pull < TRIGGER) {
      setPull(0)
      return
    }

    setRefreshing(true)
    setPull(TRIGGER)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPull(0)
    }
  }

  const ready = pull >= TRIGGER

  return (
    <div
      className="bm-ptr"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className={`bm-ptr-indicator ${refreshing ? 'is-refreshing' : ''}`}
        style={{ height: pull, opacity: pull === 0 ? 0 : 1 }}
        aria-hidden={pull === 0}
      >
        <span className="bm-ptr-label" role={refreshing ? 'status' : undefined}>
          {refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>

      <div
        className={`bm-ptr-body ${pull > 0 && !refreshing ? 'is-pulling' : ''}`}
        style={{ transform: `translate3d(0, ${refreshing ? 0 : pull * 0.35}px, 0)` }}
      >
        {children}
      </div>
    </div>
  )
}
