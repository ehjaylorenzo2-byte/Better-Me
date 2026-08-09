import { PageHeader } from '@/components/ui/PageHeader'
import { useTheme } from '@/theme/ThemeContext'
import type { ThemePreference } from '@/types/models'
import './profile.css'

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light Mode' },
  { value: 'dark', label: 'Dark Mode' },
  { value: 'system', label: 'System Default' },
]

export function AppearanceSettingsPage() {
  const { preference, setPreference } = useTheme()
  return (
    <div>
      <PageHeader title="Appearance" />
      <div className="bm-theme-options">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`bm-theme-option ${preference === opt.value ? 'active' : ''}`}
            onClick={() => setPreference(opt.value)}
          >
            {opt.label}
            {preference === opt.value ? <span aria-hidden="true">✓</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
