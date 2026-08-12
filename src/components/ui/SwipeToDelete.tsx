import { useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './Sheet'
import './swipe-to-delete.css'

/**
 * One delete gesture for the whole app.
 *
 * On a phone you drag the row to the left and a red Delete panel appears behind
 * it. On a desktop there is no swipe, so the same row gets a small menu button
 * instead. Both routes end at the same confirmation dialog, because a delete
 * that happens on the first gesture is a delete that eventually happens by
 * accident.
 *
 * The row is only ever moved with transform, so dragging never triggers layout
 * and stays smooth on an older phone. Reduced-motion users get the same
 * behaviour without the settle animation, handled in the stylesheet.
 */

/** How far left the row rests when open. Wide enough to read the word Delete. */
const PANEL_WIDTH = 88
/** Past this, letting go opens rather than snapping shut. */
const OPEN_THRESHOLD = 44
/** Below this a movement is a tap or a vertical scroll, not a swipe. */
const SLOP = 8

export function SwipeToDelete({
  children,
  onDelete,
  confirmTitle = 'Delete this?',
  confirmMessage = 'This cannot be undone.',
  deleteLabel = 'Delete',
  disabled = false,
}: {
  children: ReactNode
  onDelete: () => void | Promise<void>
  confirmTitle?: string
  confirmMessage?: string
  deleteLabel?: string
  disabled?: boolean
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const start = useRef<{ x: number; y: number } | null>(null)
  // Once a gesture commits to an axis it keeps it, so a diagonal thumb does not
  // fight the page scroll halfway through.
  const axis = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided')

  const open = offset <= -OPEN_THRESHOLD

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || busy) return
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    axis.current = 'undecided'
    setDragging(true)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return
    const t = e.touches[0]
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y

    if (axis.current === 'undecided') {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
    }
    if (axis.current === 'vertical') return

    // Rightward drag past closed does nothing; the row has no right-hand action.
    const base = open ? -PANEL_WIDTH : 0
    const next = Math.min(0, Math.max(-PANEL_WIDTH - 16, base + dx))
    setOffset(next)
  }

  const onTouchEnd = () => {
    setDragging(false)
    start.current = null
    if (axis.current !== 'horizontal') return
    setOffset(offset <= -OPEN_THRESHOLD ? -PANEL_WIDTH : 0)
  }

  const close = () => setOffset(0)

  const confirmDelete = async () => {
    setConfirming(false)
    setBusy(true)
    try {
      await onDelete()
      // Leave the row closed; the list will drop it on the next render.
      setOffset(0)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`bm-swipe ${open ? 'is-open' : ''} ${busy ? 'is-busy' : ''}`}>
      <button
        type="button"
        className="bm-swipe-action"
        onClick={() => setConfirming(true)}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        disabled={disabled || busy}
      >
        <TrashIcon />
        <span>{deleteLabel}</span>
      </button>

      <div
        className={`bm-swipe-row ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        // A tap anywhere on an open row closes it rather than activating what
        // is underneath, which is what every native list does.
        onClickCapture={(e) => {
          if (open) {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
      >
        {children}

        {/* Desktop has no swipe, so it gets an explicit control. Hidden from
            touch devices via the stylesheet rather than by guessing at the
            user agent. */}
        <button
          type="button"
          className="bm-swipe-menu"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConfirming(true)
          }}
          disabled={disabled || busy}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <DotsIcon />
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={deleteLabel}
        danger
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirming(false)
          close()
        }}
      />
    </div>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}
