import { Link } from 'react-router-dom'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getCategoryColor } from '@/theme/categoryStyles'
import type { FinanceCategory } from '@/services/categories'
import './categories.css'

/**
 * Horizontal pill picker fed by the user's own categories, with a shortcut to
 * the manage screen so a missing category is never a dead end mid-entry.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  label,
}: {
  categories: FinanceCategory[]
  value: string
  onChange: (name: string) => void
  label: string
}) {
  return (
    <div className="bm-field">
      <span className="bm-label">{label}</span>
      <div className="bm-category-select">
        {categories.map((category) => {
          const swatch = getCategoryColor(category.color)
          const selected = value === category.name
          return (
            <button
              type="button"
              key={category.id}
              className="bm-cat-pill"
              style={
                selected
                  ? {
                      background: swatch.tint,
                      borderColor: swatch.accent,
                      color: swatch.accent,
                    }
                  : undefined
              }
              onClick={() => onChange(category.name)}
              aria-pressed={selected}
            >
              <CategoryIcon name={category.icon} size={16} />
              {category.name}
            </button>
          )
        })}
        <Link to="/finance/categories" className="bm-cat-pill bm-cat-pill-manage">
          + Manage
        </Link>
      </div>
    </div>
  )
}
