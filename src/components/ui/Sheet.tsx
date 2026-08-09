import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './sheet.css'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="bm-sheet-overlay" onClick={onClose}>
      <div
        className="bm-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bm-sheet-handle" />
        {title ? <h3 className="bm-sheet-title">{title}</h3> : null}
        <div className="bm-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null
  return createPortal(
    <div className="bm-sheet-overlay" onClick={onClose}>
      <div
        className="bm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h3 className="bm-sheet-title">{title}</h3> : null}
        <div className="bm-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="bm-confirm-message">{message}</p>
      <div className="bm-confirm-actions">
        <button className="bm-btn bm-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className={`bm-btn ${danger ? 'bm-btn-danger' : 'bm-btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
