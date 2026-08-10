import { formatCurrency, type Centavos } from '@/utils/money'
import './money.css'

/**
 * Money in and money out never look alike.
 *
 * Money in sits on a lime pill, money out on a soft red one. Colour carries the
 * meaning at a glance and the sign carries it for anyone who cannot use the
 * colour, so neither is doing the job alone.
 */
export function MoneyChip({
  amount,
  direction,
  size = 'md',
}: {
  amount: Centavos
  direction: 'in' | 'out'
  size?: 'sm' | 'md'
}) {
  const sign = direction === 'in' ? '+' : '-'
  return (
    <span className={`bm-money-chip bm-money-${direction} bm-money-${size} num`}>
      {sign}
      {formatCurrency(Math.abs(amount))}
    </span>
  )
}

/** Plain coloured amount, for list rows where a pill would be too loud. */
export function Amount({
  amount,
  direction,
  className = '',
}: {
  amount: Centavos
  direction?: 'in' | 'out'
  className?: string
}) {
  if (!direction) {
    return <span className={`num ${className}`}>{formatCurrency(amount)}</span>
  }
  const sign = direction === 'in' ? '+' : '-'
  return (
    <span className={`num bm-amount-${direction} ${className}`}>
      {sign}
      {formatCurrency(Math.abs(amount))}
    </span>
  )
}
