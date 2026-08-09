import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getCategoryColor } from '@/theme/categoryStyles'
import {
  createCategory,
  ensureDefaultCategories,
  listCategories,
  setCategoryArchived,
  updateCategory,
  type CategoryKind,
  type FinanceCategory,
} from '@/services/categories'
import { CategorySheet } from './CategorySheet'
import './categories.css'

export function CategoriesPage() {
  const { userId } = useAuth()
  const { show } = useToast()

  const [kind, setKind] = useState<CategoryKind>('expense')
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceCategory | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<FinanceCategory | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await ensureDefaultCategories()
      setCategories(await listCategories(userId, { includeArchived: true }))
    } catch {
      setError('Could not load your categories.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => categories.filter((c) => c.kind === kind && c.archived === showArchived),
    [categories, kind, showArchived],
  )
  const archivedCount = useMemo(
    () => categories.filter((c) => c.kind === kind && c.archived).length,
    [categories, kind],
  )

  const onSave = async (input: { name: string; kind: CategoryKind; color: string; icon: string }) => {
    if (!userId) return
    if (editing) {
      await updateCategory(editing.id, { name: input.name, color: input.color, icon: input.icon })
      show('Category updated.', 'success')
    } else {
      await createCategory(userId, input)
      show('Category added.', 'success')
    }
    await load()
  }

  const onToggleArchive = async (category: FinanceCategory) => {
    await setCategoryArchived(category.id, !category.archived)
    show(category.archived ? `${category.name} restored.` : `${category.name} archived.`, 'success')
    setArchiveTarget(null)
    await load()
  }

  return (
    <div className="bm-cat-page">
      <PageHeader
        title="Categories"
        action={
          <button
            className="bm-cat-add"
            onClick={() => {
              setEditing(null)
              setSheetOpen(true)
            }}
            aria-label="Add category"
          >
            +
          </button>
        }
      />

      <div className="bm-seg bm-seg-full">
        <button
          className={`bm-seg-btn ${kind === 'expense' ? 'active' : ''}`}
          onClick={() => {
            setKind('expense')
            setShowArchived(false)
          }}
        >
          Expense
        </button>
        <button
          className={`bm-seg-btn ${kind === 'income' ? 'active' : ''}`}
          onClick={() => {
            setKind('income')
            setShowArchived(false)
          }}
        >
          Income
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState
          message={showArchived ? 'Nothing archived here.' : 'No categories yet. Add your first one.'}
        />
      ) : (
        <ul className="bm-cat-list">
          {visible.map((category, index) => {
            const swatch = getCategoryColor(category.color)
            return (
              <li
                key={category.id}
                className="bm-cat-row"
                style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
              >
                <button
                  className="bm-cat-main"
                  onClick={() => {
                    setEditing(category)
                    setSheetOpen(true)
                  }}
                >
                  <span
                    className="bm-cat-chip"
                    style={{ background: swatch.tint, color: swatch.accent }}
                  >
                    <CategoryIcon name={category.icon} size={20} />
                  </span>
                  <span className="bm-cat-text">
                    <span className="bm-cat-name">{category.name}</span>
                    {category.isBuiltin ? <span className="bm-cat-sub">Built-in</span> : null}
                  </span>
                </button>
                <button
                  className="bm-cat-archive"
                  onClick={() => (category.archived ? onToggleArchive(category) : setArchiveTarget(category))}
                  aria-label={category.archived ? `Restore ${category.name}` : `Archive ${category.name}`}
                >
                  {category.archived ? <RestoreIcon /> : <ArchiveIcon />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {archivedCount > 0 || showArchived ? (
        <button className="bm-cat-toggle-archived" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Back to active' : `Show archived (${archivedCount})`}
        </button>
      ) : null}

      <p className="bm-cat-footnote">
        Categories are archived, never deleted, so past transactions keep their labels.
      </p>

      <CategorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={onSave}
        editing={editing}
        defaultKind={kind}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title={`Archive ${archiveTarget?.name ?? ''}?`}
        message="It disappears from the picker when adding new entries, but every past transaction keeps its label and totals stay correct. You can restore it any time."
        confirmLabel="Archive"
        onConfirm={() => archiveTarget && onToggleArchive(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}

function ArchiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="4" rx="1.5" />
      <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
      <path d="M10 12h4" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h9a5 5 0 010 10H8" />
      <path d="M8 6l-4 4 4 4" />
    </svg>
  )
}
