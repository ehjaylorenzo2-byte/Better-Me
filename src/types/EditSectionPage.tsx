import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { SectionRow } from '@/components/ui/SectionRow'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { AccountSheet } from '@/components/finance/AccountSheet'
import { CategorySheet } from './CategorySheet'
import {
  createCategory,
  listCategories,
  setCategoryArchived,
  updateCategory,
  type CategoryKind,
  type FinanceCategory,
} from '@/services/categories'
import {
  ACCOUNT_FLOW_LABEL,
  archiveAccount,
  createAccount,
  ensureDefaultAccounts,
  listAccounts,
  restoreAccount,
  updateAccount,
  type AccountDraft,
} from '@/services/accounts'
import { listSavingsCategories } from '@/services/savings'
import { listDebts } from '@/services/debt'
import { formatCurrency } from '@/utils/money'
import type { Debt, FinanceAccount, SavingsCategory } from '@/types/models'
import './finance.css'

type Section = 'income' | 'expenses' | 'savings' | 'transfers' | 'debts'

const SECTIONS: Record<
  Section,
  { title: string; categoryKind: CategoryKind | null; backTo: string }
> = {
  income: { title: 'Edit Income', categoryKind: 'income', backTo: '/finance/income' },
  expenses: { title: 'Edit Expenses', categoryKind: 'expense', backTo: '/finance/expenses' },
  savings: { title: 'Edit Savings', categoryKind: null, backTo: '/savings' },
  transfers: { title: 'Edit Transfers', categoryKind: null, backTo: '/finance/transfers' },
  debts: { title: 'Edit Debts', categoryKind: null, backTo: '/debt' },
}

function isSection(value: string | undefined): value is Section {
  return value === 'income' || value === 'expenses' || value === 'savings' || value === 'transfers' || value === 'debts'
}

/**
 * One edit screen, reached from the Edit button inside each of the five
 * sections.
 *
 * This is the fix for the thing that made categories hard to find. They used to
 * live on a shared screen two taps away from any section that used them, with
 * nothing indicating the path. Now the categories you can edit are the ones
 * belonging to the section you came from, and banks sit underneath because they
 * apply everywhere.
 *
 * Savings goals and debts are already first-class records with their own detail
 * screens, so this page lists them and links out rather than growing a second,
 * parallel editor that could drift from the real one.
 */
export function EditSectionPage() {
  const params = useParams<{ section: string }>()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { show } = useToast()

  const section: Section = isSection(params.section) ? params.section : 'expenses'
  const config = SECTIONS[section]

  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [goals, setGoals] = useState<SavingsCategory[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categorySheet, setCategorySheet] = useState<{ open: boolean; editing: FinanceCategory | null }>({
    open: false,
    editing: null,
  })
  const [accountSheet, setAccountSheet] = useState<{ open: boolean; editing: FinanceAccount | null }>({
    open: false,
    editing: null,
  })
  const [pendingArchive, setPendingArchive] = useState<FinanceAccount | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await ensureDefaultAccounts()
      const [cats, accs, savingsList, debtList] = await Promise.all([
        config.categoryKind ? listCategories(userId, { includeArchived: true }) : Promise.resolve([]),
        listAccounts(userId, { includeArchived: true }),
        section === 'savings' ? listSavingsCategories(userId) : Promise.resolve([]),
        section === 'debts' ? listDebts(userId) : Promise.resolve([]),
      ])
      setCategories(cats)
      setAccounts(accs)
      setGoals(savingsList)
      setDebts(debtList)
    } catch {
      setError('Could not load this section.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, section])

  const sectionCategories = useMemo(
    () => categories.filter((c) => c.kind === config.categoryKind),
    [categories, config.categoryKind],
  )
  const liveCategories = sectionCategories.filter((c) => !c.archived)
  const archivedCategories = sectionCategories.filter((c) => c.archived)
  const liveAccounts = accounts.filter((a) => !a.archived)
  const archivedAccounts = accounts.filter((a) => a.archived)

  const saveCategory = async (input: { name: string; kind: CategoryKind; color: string; icon: string }) => {
    if (!userId) return
    if (categorySheet.editing) {
      await updateCategory(categorySheet.editing.id, input)
      show('Category updated.', 'success')
    } else {
      await createCategory(userId, input)
      show('Category added.', 'success')
    }
    await load()
  }

  const saveAccount = async (draft: AccountDraft) => {
    if (!userId) return
    if (accountSheet.editing) {
      await updateAccount(accountSheet.editing.id, draft)
      show('Bank updated.', 'success')
    } else {
      await createAccount(userId, draft)
      show('Bank added.', 'success')
    }
    await load()
  }

  const toggleCategoryArchived = async (category: FinanceCategory) => {
    await setCategoryArchived(category.id, !category.archived)
    show(category.archived ? 'Category restored.' : 'Category archived.', 'success')
    load()
  }

  const confirmArchiveAccount = async () => {
    if (!pendingArchive) return
    const account = pendingArchive
    setPendingArchive(null)
    try {
      await archiveAccount(account.id)
      show(`${account.name} archived.`, 'success')
      load()
    } catch {
      show('Could not archive that bank.', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-section-page bm-enter">
      <div className="bm-section-bar">
        <button
          type="button"
          className="bm-icon-btn"
          aria-label="Go back"
          onClick={() => navigate(config.backTo)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="bm-section-bar-title" />
        <span className="bm-section-bar-spacer" />
      </div>

      <h1 className="bm-display bm-edit-title">{config.title}</h1>

      {/* ---- Categories, for the two sections that have them ------------ */}
      {config.categoryKind ? (
        <Card>
          <div className="bm-card-head">
            <h2 className="bm-card-title">Categories</h2>
            <button
              type="button"
              className="bm-link"
              onClick={() => setCategorySheet({ open: true, editing: null })}
            >
              + New
            </button>
          </div>

          {liveCategories.length === 0 ? (
            <p className="bm-empty-line">No categories yet. Add the first one.</p>
          ) : (
            <div className="bm-row-stack">
              {liveCategories.map((category) => (
                <SectionRow
                  key={category.id}
                  onClick={() => setCategorySheet({ open: true, editing: category })}
                  icon={category.icon}
                  color={category.color}
                  title={category.name}
                  subtitle={category.isBuiltin ? 'Starter category' : undefined}
                />
              ))}
            </div>
          )}

          {archivedCategories.length > 0 ? (
            <details className="bm-archived">
              <summary>{archivedCategories.length} archived</summary>
              <div className="bm-row-stack">
                {archivedCategories.map((category) => (
                  <SectionRow
                    key={category.id}
                    onClick={() => toggleCategoryArchived(category)}
                    icon={category.icon}
                    color={category.color}
                    title={category.name}
                    subtitle="Tap to restore"
                    chevron={false}
                  />
                ))}
              </div>
              <p className="bm-archived-note">
                Archiving hides a category from the pickers. Past entries keep their label, so your
                history never changes.
              </p>
            </details>
          ) : null}
        </Card>
      ) : null}

      {/* ---- Savings goals ---------------------------------------------- */}
      {section === 'savings' ? (
        <Card>
          <div className="bm-card-head">
            <h2 className="bm-card-title">Savings goals</h2>
            <button type="button" className="bm-link" onClick={() => navigate('/savings/new')}>
              + New
            </button>
          </div>
          {goals.length === 0 ? (
            <p className="bm-empty-line">No goals yet. Add one to start putting money aside.</p>
          ) : (
            <div className="bm-row-stack">
              {goals.map((goal) => (
                <SectionRow
                  key={goal.id}
                  to={`/savings/${goal.id}`}
                  icon={goal.icon}
                  color={goal.color}
                  title={goal.name}
                  subtitle={goal.goalAmount ? `Goal ${formatCurrency(goal.goalAmount)}` : 'No target set'}
                  value={formatCurrency(goal.balance)}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {/* ---- Debts ------------------------------------------------------- */}
      {section === 'debts' ? (
        <Card>
          <div className="bm-card-head">
            <h2 className="bm-card-title">Debts</h2>
            <button type="button" className="bm-link" onClick={() => navigate('/debt/new')}>
              + New
            </button>
          </div>
          {debts.length === 0 ? (
            <p className="bm-empty-line">Nothing owed. Long may it last.</p>
          ) : (
            <div className="bm-row-stack">
              {debts.map((debt) => (
                <SectionRow
                  key={debt.id}
                  to={`/debt/${debt.id}`}
                  icon={debt.icon}
                  color={debt.color}
                  title={debt.name}
                  subtitle={debt.paidOff ? 'Paid off' : `Started at ${formatCurrency(debt.originalAmount)}`}
                  value={formatCurrency(debt.balance)}
                  valueTone={debt.paidOff ? 'muted' : 'out'}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {/* ---- Banks, shared by every section ------------------------------ */}
      <Card>
        <div className="bm-card-head">
          <h2 className="bm-card-title">Banks and wallets</h2>
          <button
            type="button"
            className="bm-link"
            onClick={() => setAccountSheet({ open: true, editing: null })}
          >
            + New
          </button>
        </div>

        <p className="bm-empty-line">
          Tag entries with a bank to see what each account actually costs you. Outgoing accounts report
          what you spent from them, savings accounts report what went in.
        </p>

        {liveAccounts.length > 0 ? (
          <div className="bm-row-stack" style={{ marginTop: 12 }}>
            {liveAccounts.map((account) => (
              <SectionRow
                key={account.id}
                onClick={() => setAccountSheet({ open: true, editing: account })}
                icon={account.icon}
                color={account.color}
                title={account.name}
                subtitle={ACCOUNT_FLOW_LABEL[account.flow]}
                trailing={
                  <button
                    type="button"
                    className="bm-row-archive"
                    aria-label={`Archive ${account.name}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setPendingArchive(account)
                    }}
                  >
                    Archive
                  </button>
                }
                chevron={false}
              />
            ))}
          </div>
        ) : null}

        {archivedAccounts.length > 0 ? (
          <details className="bm-archived">
            <summary>{archivedAccounts.length} archived</summary>
            <div className="bm-row-stack">
              {archivedAccounts.map((account) => (
                <SectionRow
                  key={account.id}
                  onClick={async () => {
                    try {
                      await restoreAccount(account.id)
                      show(`${account.name} restored.`, 'success')
                      load()
                    } catch (err) {
                      show(err instanceof Error ? err.message : 'Could not restore that bank.', 'error')
                    }
                  }}
                  icon={account.icon}
                  color={account.color}
                  title={account.name}
                  subtitle="Tap to restore"
                  chevron={false}
                />
              ))}
            </div>
            <p className="bm-archived-note">
              Archived banks disappear from the pickers, but every entry you already tagged keeps its
              bank and stays in the breakdown.
            </p>
          </details>
        ) : null}
      </Card>

      {config.categoryKind ? (
        <CategorySheet
          open={categorySheet.open}
          onClose={() => setCategorySheet({ open: false, editing: null })}
          onSave={saveCategory}
          editing={categorySheet.editing}
          defaultKind={config.categoryKind}
        />
      ) : null}

      <AccountSheet
        open={accountSheet.open}
        onClose={() => setAccountSheet({ open: false, editing: null })}
        onSave={saveAccount}
        editing={accountSheet.editing}
      />

      <ConfirmDialog
        open={pendingArchive !== null}
        title={pendingArchive ? `Archive ${pendingArchive.name}?` : ''}
        message="It disappears from the pickers. Entries you already tagged keep it and stay in the breakdown, and you can restore it any time."
        confirmLabel="Archive"
        onConfirm={confirmArchiveAccount}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  )
}
