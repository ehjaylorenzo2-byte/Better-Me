import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/ui/Sheet'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ColorIconPicker } from '@/components/ColorIconPicker'
import { ACCOUNT_FLOW_HINT, ACCOUNT_FLOW_LABEL, type AccountDraft } from '@/services/accounts'
import type { AccountFlow, FinanceAccount } from '@/types/models'
import './account.css'

const FLOWS: AccountFlow[] = ['outgoing', 'savings', 'both']

/**
 * Add or edit a bank or wallet.
 *
 * The flow choice is the part that matters. It decides which single number the
 * bank shows on the Finance screen, and spending versus saving are opposite
 * enough that guessing would make the whole breakdown misleading.
 */
export function AccountSheet({
  open,
  onClose,
  onSave,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSave: (draft: AccountDraft) => Promise<void>
  editing?: FinanceAccount | null
}) {
  const [name, setName] = useState('')
  const [flow, setFlow] = useState<AccountFlow>('outgoing')
  const [color, setColor] = useState('sky')
  const [icon, setIcon] = useState('wallet')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setName(editing.name)
      setFlow(editing.flow)
      setColor(editing.color)
      setIcon(editing.icon)
    } else {
      setName('')
      setFlow('outgoing')
      setColor('sky')
      setIcon('wallet')
    }
  }, [open, editing])

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the bank a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name, flow, color, icon })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that bank.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Edit bank' : 'New bank or wallet'}>
      {error ? <div className="bm-auth-error">{error}</div> : null}

      <Input
        label="Name"
        placeholder="e.g. GCash, BPI, Maya, Cash"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        autoCapitalize="words"
      />

      <div className="bm-field">
        <span className="bm-label">How do you use it?</span>
        <div className="bm-flow-row">
          {FLOWS.map((option) => (
            <button
              key={option}
              type="button"
              className={`bm-flow-option ${flow === option ? 'active' : ''}`}
              onClick={() => setFlow(option)}
              aria-pressed={flow === option}
            >
              <span className="bm-flow-name">{ACCOUNT_FLOW_LABEL[option]}</span>
              <span className="bm-flow-hint">{ACCOUNT_FLOW_HINT[option]}</span>
            </button>
          ))}
        </div>
      </div>

      <ColorIconPicker
        color={color}
        icon={icon}
        onColorChange={setColor}
        onIconChange={setIcon}
        previewName={name.trim() || (editing ? editing.name : 'New bank')}
        previewSubtitle={ACCOUNT_FLOW_LABEL[flow]}
      />

      <Button fullWidth loading={saving} onClick={submit} disabled={!name.trim()}>
        {editing ? 'Save Changes' : 'Add Bank'}
      </Button>
    </BottomSheet>
  )
}
