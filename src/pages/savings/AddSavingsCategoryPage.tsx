import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ColorIconPicker } from '@/components/ColorIconPicker'
import { useToast } from '@/components/ui/Toast'
import { createSavingsCategory } from '@/services/savings'
import { AccountPicker } from '@/components/finance/AccountPicker'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import type { FinanceAccount } from '@/types/models'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'

export function AddSavingsCategoryPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [color, setColor] = useState('mint')
  const [icon, setIcon] = useState('piggy-bank')
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      await ensureDefaultAccounts()
      const list = await listAccounts(userId)
      if (!active) return
      setAccounts(list)
      setAccountId((current) => current ?? list[0]?.id ?? null)
    })().catch(() => {
      if (active) setError('Could not load your banks.')
    })
    return () => {
      active = false
    }
  }, [userId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!name.trim()) {
      setError('Give the goal a name.')
      return
    }
    if (goal && (!isValidMoneyInput(goal) || pesoToCentavos(goal) <= 0)) {
      setError('Goal amount must be greater than zero.')
      return
    }
    if (!accountId) {
      setError('Pick the bank this goal is held in.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createSavingsCategory(userId, name, goal ? pesoToCentavos(goal) : null, color, icon, accountId)
      show('Savings goal created.', 'success')
      navigate('/savings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the goal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="New Savings Goal" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}

        <ColorIconPicker
          color={color}
          icon={icon}
          onColorChange={setColor}
          onIconChange={setIcon}
          previewName={name.trim() || 'New savings goal'}
          previewSubtitle={goal ? `Target ${goal}` : 'No target yet'}
        />

        <Input
          label="Name"
          placeholder="e.g. Emergency Fund, Travel, New Phone"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <CurrencyInput label="Target amount (optional)" value={goal} onChange={setGoal} />

        <AccountPicker
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          label="Held in"
          allowNone={false}
          emptyHint="Add a bank first, under Edit on the Finance screen."
        />
        <p className="bm-form-footnote">
          Money you save moves into this bank. Keeping each goal in its own bank is what lets the
          app tell you what is actually sitting there.
        </p>

        <Button type="submit" fullWidth loading={saving}>
          Create Goal
        </Button>
      </form>
    </div>
  )
}
