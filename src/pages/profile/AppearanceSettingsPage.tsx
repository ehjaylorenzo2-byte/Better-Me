import { PageHeader } from '@/components/ui/PageHeader'
import { useTheme } from '@/theme/ThemeContext'
import type { TextSize, ThemePreference } from '@/types/models'
import './profile.css'

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light Mode' },
  { value: 'dark', label: 'Dark Mode' },
  { value: 'system', label: 'System Default' },
]

const SIZES: Array<{ value: TextSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

export function AppearanceSettingsPage() {
  const { preference, setPreference, textSize, setTextSize } = useTheme()

  return (
    <div>
      <PageHeader title="Appearance" />

      <h2 className="bm-section-title" style={{ marginBottom: 12 }}>
        Theme
      </h2>
      <div className="bm-theme-options">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`bm-theme-option ${preference === opt.value ? 'active' : ''}`}
            onClick={() => setPreference(opt.value)}
            aria-pressed={preference === opt.value}
          >
            {opt.label}
            {preference === opt.value ? <span aria-hidden="true">✓</span> : null}
          </button>
        ))}
      </div>

      <h2 className="bm-section-title" style={{ margin: '32px 0 12px' }}>
        Text size
      </h2>
      <p className="bm-settings-note" style={{ marginBottom: 16 }}>
        Changes every screen at once, not just this one. Pick whichever you can read without leaning
        in.
      </p>

      <div className="bm-size-options" role="group" aria-label="Text size">
        {SIZES.map((size) => (
          <button
            key={size.value}
            className={`bm-size-option is-${size.value} ${textSize === size.value ? 'active' : ''}`}
            onClick={() => setTextSize(size.value)}
            aria-pressed={textSize === size.value}
          >
            <span className="bm-size-sample" aria-hidden="true">
              Aa
            </span>
            <span className="bm-size-label">{size.label}</span>
            {textSize === size.value ? <span className="bm-size-tick" aria-hidden="true">✓</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
