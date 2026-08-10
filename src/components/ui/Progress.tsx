import './progress.css'

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'danger' | 'warning' }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="bm-progress-track" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`bm-progress-fill bm-progress-${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 10,
  label,
  /** Set false when the surrounding UI already states the number, to avoid repeating it. */
  showValue = true,
  centre,
}: {
  value: number
  size?: number
  strokeWidth?: number
  label?: string
  showValue?: boolean
  centre?: React.ReactNode
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="bm-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#bm-ring-grad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="bm-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-emerald)" />
            <stop offset="1" stopColor="var(--brand-mint)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="bm-ring-label">
        {showValue ? <strong>{Math.round(clamped)}%</strong> : null}
        {centre}
        {label ? <span>{label}</span> : null}
      </div>
    </div>
  )
}
