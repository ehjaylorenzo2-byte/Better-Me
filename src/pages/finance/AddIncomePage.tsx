import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { DEFAULT_INCOME_SOURCES, addIncome } from '@/services/finance'
import { getPhilippineToday } from '@/utils/timezone'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import './finance.css'

export function AddIncomePage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState(DEFAULT_INCOME_SOURCES[0])
  const [customSource, setCustomSource] = useState('')
  const [date, setDate] = useState(getPhilippineToday())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!isValidMoneyInput(amount) || pesoToCentavos(amount) <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addIncome(userId, pesoToCentavos(amount), source === 'Other' && customSource ? customSource : source, date, note || null)
      show('Income added.', 'success')
      navigate('/finance/income')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save income.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Add Income" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <CurrencyInput label="Amount" value={amount} onChange={setAmount} />
        <div className="bm-field">
          <span className="bm-label">Source</span>
          <div className="bm-category-select">
            {DEFAULT_INCOME_SOURCES.map((s) => (
              <button
                type="button"
                key={s}
                className={`bm-category-pill ${source === s ? 'active' : ''}`}
                onClick={() => setSource(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {source === 'Other' ? (
            <Input placeholder="Custom source" value={customSource} onChange={(e) => setCustomSource(e.target.value)} />
          ) : null}
        </div>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Add Income
        </Button>
      </form>
    </div>
  )
}
