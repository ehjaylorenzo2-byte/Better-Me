import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/ui/Sheet'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CategoryIcon, ICON_GROUPS } from '@/components/CategoryIcon'
import { CATEGORY_COLORS, getCategoryColor } from '@/theme/categoryStyles'
import type { CategoryKind, FinanceCategory } from '@/services/categories'
import './categories.css'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (input: { name: string; kind: CategoryKind; color: string; icon: string }) => Promise<void>
  /** When present the sheet edits this category instead of creating a new one. */
  editing?: FinanceCategory | null
  defaultKind: CategoryKind
}

export function CategorySheet({ open, onClose, onSave, editing, defaultKind }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>(defaultKind)
  const [color, setColor] = useState('mint')
  const [icon, setIcon] = useState('cart')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setName(editing.name)
      setKind(editing.kind)
      setColor(editing.color)
      setIcon(editing.icon)
    } else {
      setName('')
      setKind(defaultKind)
      setColor('mint')
      setIcon('cart')
    }
  }, [open, editing, defaultKind])

  const swatch = getCategoryColor(color)

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the category a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name, kind, color, icon })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Edit category' : 'New category'}>
      {/* Live preview of exactly how the row will look in the list. */}
      <div className="bm-cat-preview">
        <span
          className="bm-cat-chip bm-cat-chip-lg"
          style={{ background: swatch.tint, color: swatch.accent, boxShadow: `0 0 24px ${swatch.tint}` }}
        >
          <CategoryIcon name={icon} size={24} />
        </span>
        <div>
          <p className="bm-cat-preview-name">{name.trim() || (editing ? editing.name : 'New category')}</p>
          <p className="bm-cat-preview-kind">{kind === 'expense' ? 'Expense' : 'Income'}</p>
        </div>
      </div>

      {error ? <div className="bm-auth-error">{error}</div> : null}

      <Input
        label="Name"
        placeholder="e.g. Sari-sari store, Load, Tuition"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
      />

      {!editing ? (
        <div className="bm-field">
          <span className="bm-label">Type</span>
          <div className="bm-seg">
            <button
              type="button"
              className={`bm-seg-btn ${kind === 'expense' ? 'active' : ''}`}
              onClick={() => setKind('expense')}
            >
              Expense
            </button>
            <button
              type="button"
              className={`bm-seg-btn ${kind === 'income' ? 'active' : ''}`}
              onClick={() => setKind('income')}
            >
              Income
            </button>
          </div>
        </div>
      ) : null}

      <div className="bm-field">
        <span className="bm-label">Colour</span>
        <div className="bm-color-row">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`bm-color-dot ${color === c.id ? 'active' : ''}`}
              style={{ background: c.accent }}
              onClick={() => setColor(c.id)}
              aria-label={c.label}
              aria-pressed={color === c.id}
            >
              {color === c.id ? <CheckMark /> : null}
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
                    onClick={() => setIcon(id)}
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

      <Button fullWidth loading={saving} onClick={submit}>
        {editing ? 'Save changes' : 'Add category'}
      </Button>
    </BottomSheet>
  )
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04231B" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
