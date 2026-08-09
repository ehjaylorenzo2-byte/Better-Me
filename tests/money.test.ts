import { describe, it, expect } from 'vitest'
import { pesoToCentavos, centavosToPeso, formatCurrency, isValidMoneyInput } from '@/utils/money'

describe('money (integer centavos)', () => {
  it('converts pesos to centavos without float drift', () => {
    expect(pesoToCentavos(1500.25)).toBe(150025)
    expect(pesoToCentavos('1,500.25')).toBe(150025)
    expect(pesoToCentavos(0.1)).toBe(10)
    expect(pesoToCentavos(0.2)).toBe(20)
  })

  it('round-trips centavos back to pesos', () => {
    expect(centavosToPeso(150025)).toBe(1500.25)
  })

  it('formats currency with the peso sign and two decimals', () => {
    expect(formatCurrency(4250000)).toContain('42,500.00')
    expect(formatCurrency(4250000)).toContain('₱')
  })

  it('formats negative amounts with a leading minus', () => {
    expect(formatCurrency(-500000).startsWith('-')).toBe(true)
  })

  it('validates money input', () => {
    expect(isValidMoneyInput('100.50')).toBe(true)
    expect(isValidMoneyInput('-5')).toBe(false)
    expect(isValidMoneyInput('abc')).toBe(false)
  })
})
