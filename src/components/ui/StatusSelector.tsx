import type { HabitStatus } from '@/types/models'
import './status-selector.css'

const OPTIONS: Array<{ value: HabitStatus; label: string; icon: string }> = [
  { value: 'done', label: 'Done', icon: '✓' },
  { value: 'skipped', label: 'Skipped', icon: '»' },
  { value: 'cancelled', label: 'Cancelled', icon: '×' },
]

export function StatusSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: HabitStatus | null
  onChange: (status: HabitStatus) => void
  disabled?: boolean
}) {
  return (
    <div className="bm-status-selector" role="group" aria-label="Habit status">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          className={`bm-status-opt bm-status-${opt.value} ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          <span className="bm-status-icon" aria-hidden="true">
            {opt.icon}
          </span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function StatusBadge({ status }: { status: HabitStatus | null }) {
  if (status === 'done') {
    return (
      <span className="bm-badge bm-badge-done">
        <span aria-hidden="true">✓</span> Done
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className="bm-badge bm-badge-skipped">
        <span aria-hidden="true">»</span> Skipped
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="bm-badge bm-badge-cancelled">
        <span aria-hidden="true">×</span> Cancelled
      </span>
    )
  }
  return (
    <span className="bm-badge bm-badge-none">
      <span aria-hidden="true">○</span> No status
    </span>
  )
}
