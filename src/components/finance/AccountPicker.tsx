import { CategoryIcon } from '@/components/CategoryIcon'
import { chipVars } from '@/theme/categoryStyles'
import type { FinanceAccount } from '@/types/models'
import './account.css'

/**
 * Horizontal bank chooser for the add screens.
 *
 * Includes a "Not set" chip and defaults to it. Tagging a bank is optional on
 * purpose: nobody should have to answer a second question to log a 60 peso
 * jeepney fare, and an untagged entry still counts in every total. It simply
 * sits outside the per-bank breakdown.
 */
export function AccountPicker({
  accounts,
  value,
  onChange,
  label = 'Bank or wallet',
  allowNone = true,
  excludeId,
  showOptional = true,
  emptyHint = 'Add one in Edit to track spending per bank.',
}: {
  accounts: FinanceAccount[]
  value: string | null
  onChange: (id: string | null) => void
  label?: string
  allowNone?: boolean
  excludeId?: string | null
  /** Transfers need at least one side, so they hide the word "optional". */
  showOptional?: boolean
  emptyHint?: string
}) {
  const options = accounts.filter((a) => a.id !== excludeId)

  return (
    <div className="bm-field">
      <span className="bm-label">
        {label} {allowNone && showOptional ? <span className="bm-optional">optional</span> : null}
      </span>

      {options.length === 0 ? (
        <p className="bm-account-empty">{emptyHint}</p>
      ) : (
        <div className="bm-account-scroll">
          {allowNone ? (
            <button
              type="button"
              className={`bm-account-chip ${value === null ? 'active' : ''}`}
              onClick={() => onChange(null)}
              aria-pressed={value === null}
            >
              <span className="bm-account-chip-name">Not set</span>
            </button>
          ) : null}

          {options.map((account) => (
            <button
              key={account.id}
              type="button"
              className={`bm-account-chip ${value === account.id ? 'active' : ''}`}
              style={chipVars(account.color)}
              onClick={() => onChange(account.id)}
              aria-pressed={value === account.id}
            >
              <CategoryIcon name={account.icon} size={16} />
              <span className="bm-account-chip-name">{account.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
