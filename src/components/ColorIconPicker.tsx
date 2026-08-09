import { CategoryIcon, ICON_GROUPS } from './CategoryIcon'
import { CATEGORY_COLORS, getCategoryColor } from '@/theme/categoryStyles'
import '@/pages/finance/categories.css'

/**
 * Shared colour + icon chooser with a live preview, used by finance
 * categories, savings categories and debts so personalization looks and
 * behaves identically across the whole finance section.
 */
export function ColorIconPicker({
  color,
  icon,
  onColorChange,
  onIconChange,
  previewName,
  previewSubtitle,
}: {
  color: string
  icon: string
  onColorChange: (color: string) => void
  onIconChange: (icon: string) => void
  previewName: string
  previewSubtitle?: string
}) {
  const swatch = getCategoryColor(color)

  return (
    <>
      <div className="bm-cat-preview">
        <span
          className="bm-cat-chip bm-cat-chip-lg"
          style={{ background: swatch.tint, color: swatch.accent, boxShadow: `0 0 24px ${swatch.tint}` }}
        >
          <CategoryIcon name={icon} size={24} />
        </span>
        <div>
          <p className="bm-cat-preview-name">{previewName}</p>
          {previewSubtitle ? <p className="bm-cat-preview-kind">{previewSubtitle}</p> : null}
        </div>
      </div>

      <div className="bm-field">
        <span className="bm-label">Colour</span>
        <div className="bm-color-row">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`bm-color-dot ${color === c.id ? 'active' : ''}`}
              style={{ background: c.accent }}
              onClick={() => onColorChange(c.id)}
              aria-label={c.label}
              aria-pressed={color === c.id}
            >
              {color === c.id ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04231B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="bm-field">
        <span className="bm-label">Icon</span>
        <div className="bm-icon-scroll">
          {ICON_GROUPS.map((group) => (
            <div key={group.label} className="bm-icon-group">
              <p className="bm-icon-group-label">{group.label}</p>
              <div className="bm-icon-grid">
                {group.icons.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`bm-icon-cell ${icon === id ? 'active' : ''}`}
                    style={icon === id ? { color: swatch.accent, borderColor: swatch.accent, background: swatch.tint } : undefined}
                    onClick={() => onIconChange(id)}
                    aria-label={id}
                    aria-pressed={icon === id}
                  >
                    <CategoryIcon name={id} size={20} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
