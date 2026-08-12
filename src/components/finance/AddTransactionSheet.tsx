import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomSheet } from '@/components/ui/Sheet'
import { CategoryIcon } from '@/components/CategoryIcon'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { isOffline, OFFLINE_MESSAGE } from '@/hooks/useSubmitGuard'
import { addExpense, addIncome } from '@/services/finance'
import { addTransfer, validateTransfer } from '@/services/transfers'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import { ensureDefaultCategories, listCategories, type FinanceCategory } from '@/services/categories'
import { chipVars } from '@/theme/categoryStyles'
import { formatCurrency, type Centavos } from '@/utils/money'
import { getPhilippineToday, relativeDayLabel } from '@/utils/timezone'
import type { FinanceAccount } from '@/types/models'
import './add-transaction.css'

type Tab = 'expense' | 'income' | 'transfer'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
]

/**
 * One sheet for the three things you log most.
 *
 * The keypad enters centavos from the right the way a banking app does, so
 * 1 2 3 4 gives ₱12.34. That is deliberately different from a text field: on a
 * phone it means you never touch the decimal point and never mistype ₱1,234 as
 * ₱12.34, which is the expensive direction to get wrong.
 */
export function AddTransactionSheet({
  open,
  onClose,
  onSaved,
  initialTab = 'expense',
}: {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  initialTab?: Tab
}) {
  const { userId } = useAuth()
  const { show } = useToast()

  const [tab, setTab] = useState<Tab>(initialTab)
  const [digits, setDigits] = useState('')
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('')
  const [date, setDate] = useState(getPhilippineToday())
  const [showDate, setShowDate] = useState(false)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const amount: Centavos = digits === '' ? 0 : Number(digits)

  useEffect(() => {
    if (!open || !userId) return
    let active = true
    setTab(initialTab)
    setDigits('')
    setError(null)
    setNote('')
    setShowNote(false)
    setShowDate(false)
    setDate(getPhilippineToday())
    ;(async () => {
      try {
        await Promise.all([ensureDefaultAccounts(), ensureDefaultCategories()])
        const [accs, cats] = await Promise.all([listAccounts(userId), listCategories(userId)])
        if (!active) return
        setAccounts(accs)
        setCategories(cats)
        setAccountId((current) => current ?? accs[0]?.id ?? null)
      } catch {
        if (active) setError('Could not load your banks and categories.')
      }
    })()
    return () => {
      active = false
    }
  }, [open, userId, initialTab])

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.kind === (tab === 'income' ? 'income' : 'expense')),
    [categories, tab],
  )

  useEffect(() => {
    if (tab === 'transfer') return
    setCategory((current) => {
      if (visibleCategories.some((c) => c.name === current)) return current
      return visibleCategories[0]?.name ?? ''
    })
  }, [visibleCategories, tab])

  const press = (value: string) => {
    setError(null)
    setDigits((current) => {
      const next = (current + value).replace(/^0+/, '')
      // Ten digits is ₱99,999,999.99. Past that the display breaks and nobody
      // is logging that from a phone anyway.
      return next.length > 10 ? current : next
    })
  }

  const backspace = () => {
    setError(null)
    setDigits((current) => current.slice(0, -1))
  }

  const submit = async () => {
    if (!userId) return
    if (amount <= 0) {
      setError('Enter an amount first.')
      return
    }
    if (isOffline()) {
      setError(OFFLINE_MESSAGE)
      return
    }
    // A second tap while the first save is still in the air would post the
    // same expense twice. The ref closes that window; `saving` only paints it.
    if (inFlight.current) return
    inFlight.current = true

    setSaving(true)
    setError(null)
    try {
      if (tab === 'transfer') {
        const draft = {
          fromAccountId: accountId,
          toAccountId,
          amount,
          entryDate: date,
          note: note || null,
        }
        const problem = validateTransfer(draft)
        if (problem) {
          setError(problem)
          return
        }
        await addTransfer(userId, draft)
        show('Transfer saved.', 'success')
      } else if (tab === 'income') {
        if (!category) {
          setError('Pick a category.')
          return
        }
        await addIncome(userId, amount, category, date, note || null, accountId)
        show('Income added.', 'success')
      } else {
        if (!category) {
          setError('Pick a category.')
          return
        }
        await addExpense(userId, amount, category, date, note || null, accountId)
        show('Expense added.', 'success')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const accountRow = (value: string | null, onPick: (id: string) => void, exclude?: string | null) => (
    <div className="bm-addtx-chips">
      {accounts
        .filter((a) => a.id !== exclude)
        .map((account) => (
          <button
            key={account.id}
            type="button"
            className={`bm-addtx-chip ${value === account.id ? 'active' : ''}`}
            style={chipVars(account.color)}
            onClick={() => onPick(account.id)}
            aria-pressed={value === account.id}
          >
            <CategoryIcon name={account.icon} size={15} />
            {account.name}
          </button>
        ))}
    </div>
  )

  return (
    <BottomSheet open={open} onClose={onClose} title="Add transaction">
      <div className="bm-tx">
        <div className="bm-addtx-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`bm-addtx-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => {
                setTab(t.id)
                setError(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className={`bm-addtx-amount num ${amount === 0 ? 'empty' : ''}`} aria-live="polite">
          {formatCurrency(amount)}
        </p>
        <p className="bm-addtx-amount-hint">
          {tab === 'transfer' ? 'Moves money, does not change your total' : 'Tap the keypad, centavos fill from the right'}
        </p>

        {error ? <div className="bm-auth-error">{error}</div> : null}

        <div className="bm-addtx-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((key) => (
            <button key={key} type="button" className="bm-addtx-key" onClick={() => press(key)}>
              {key}
            </button>
          ))}
          <button type="button" className="bm-addtx-key" onClick={backspace} aria-label="Delete last digit">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 5H9L3 12l6 7h11a1 1 0 001-1V6a1 1 0 00-1-1z" />
              <path d="M12 10l4 4M16 10l-4 4" />
            </svg>
          </button>
        </div>

        {tab === 'transfer' ? (
          <>
            <p className="bm-addtx-label">From</p>
            {accountRow(accountId, setAccountId, toAccountId)}
            <p className="bm-addtx-label">To</p>
            {accountRow(toAccountId, setToAccountId, accountId)}
          </>
        ) : (
          <>
            <p className="bm-addtx-label">Account</p>
            {accountRow(accountId, setAccountId)}
            <p className="bm-addtx-label">Category</p>
            <div className="bm-addtx-chips">
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`bm-addtx-chip ${category === c.name ? 'active' : ''}`}
                  style={chipVars(c.color)}
                  onClick={() => setCategory(c.name)}
                  aria-pressed={category === c.name}
                >
                  <CategoryIcon name={c.icon} size={15} />
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Date and note stay out of the way until wanted. Without a date you
            could only ever log today, which fails the first time you enter
            something the next morning. */}
        <div className="bm-addtx-meta">
          {showDate ? (
            <input
              className="bm-addtx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => setShowDate(false)}
              autoFocus
            />
          ) : (
            <button type="button" className="bm-addtx-meta-btn" onClick={() => setShowDate(true)}>
              {relativeDayLabel(date)}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}

          {showNote ? (
            <input
              className="bm-addtx-note"
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={60}
              autoFocus
            />
          ) : (
            <button type="button" className="bm-addtx-meta-btn" onClick={() => setShowNote(true)}>
              {note || 'Add a note'}
            </button>
          )}
        </div>

        <button
          type="button"
          className="bm-addtx-submit bm-press"
          onClick={submit}
          disabled={saving || amount <= 0}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
          {saving ? 'Saving...' : 'Add'}
        </button>
      </div>
    </BottomSheet>
  )
}
