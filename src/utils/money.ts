/**
 * All money in Better Me is stored and computed as integer centavos
 * (1 peso = 100 centavos) to avoid floating point rounding errors.
 * Never do arithmetic on peso `number` values directly outside of
 * display formatting.
 */

export type Centavos = number

/** Parses a user-facing peso string/number (e.g. "1,500.25" or 1500.25) into integer centavos. */
export function pesoToCentavos(pesoAmount: number | string): Centavos {
  const normalized = typeof pesoAmount === 'string' ? pesoAmount.replace(/,/g, '').trim() : pesoAmount
  const value = typeof normalized === 'string' ? Number.parseFloat(normalized) : normalized
  if (!Number.isFinite(value)) return 0
  // Round to avoid float artifacts like 1500.2499999999998
  return Math.round(value * 100)
}

export function centavosToPeso(centavos: Centavos): number {
  return centavos / 100
}

export function formatCurrency(centavos: Centavos, options: { showSign?: boolean } = {}): string {
  const peso = centavosToPeso(centavos)
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(peso))
  const sign = peso < 0 ? '-' : options.showSign && peso > 0 ? '+' : ''
  return `${sign}${formatted.replace('PHP', '₱').replace('₱', '₱')}`
}

export function isValidMoneyInput(pesoAmount: number | string): boolean {
  const normalized = typeof pesoAmount === 'string' ? pesoAmount.replace(/,/g, '').trim() : pesoAmount
  if (normalized === '') return false
  const value = typeof normalized === 'string' ? Number.parseFloat(normalized) : normalized
  if (!Number.isFinite(value)) return false
  const centavos = pesoToCentavos(pesoAmount)
  return Number.isFinite(centavos) && centavos >= 0
}

export function addCentavos(...values: Centavos[]): Centavos {
  return values.reduce((sum, v) => sum + v, 0)
}

export function clampNonNegative(centavos: Centavos): Centavos {
  return Math.max(0, centavos)
}
