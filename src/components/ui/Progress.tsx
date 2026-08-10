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
          className="bm-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        {/* Stroke colours live in CSS so a ring drawn on the lime hero can
            switch to ink without this component knowing where it sits. */}
        <circle
          className="bm-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="bm-ring-label">
        {showValue ? <strong>{Math.round(clamped)}%</strong> : null}
        {centre}
        {label ? <span>{label}</span> : null}
      </div>
    </div>
  )
}
