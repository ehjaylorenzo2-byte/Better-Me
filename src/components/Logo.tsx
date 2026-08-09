/**
 * Better Me wordmark/icon. Kept as a single isolated component so the
 * caterpillar artwork can be swapped for a final logo asset later without
 * touching any other UI (per spec section 5). To replace, either change the
 * <path> data below or swap this component to render an <img src="..." />.
 */
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" role="img" aria-label="Better Me logo">
      <defs>
        <linearGradient id="logo-grad" x1="10" y1="80" x2="90" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-emerald)" />
          <stop offset="1" stopColor="var(--brand-mint)" />
        </linearGradient>
      </defs>
      <path d="M8 78 C 30 74, 65 74, 92 62" stroke="url(#logo-grad)" strokeWidth="3.2" strokeLinecap="round" />
      <path
        d="M20 76 C 20 66, 30 66, 30 76 C 30 66, 40 66, 40 76 C 40 64, 51 64, 51 76 C 51 64, 62 64, 62 75 C 62 62, 74 61, 76 71"
        stroke="url(#logo-grad)"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="64" r="7.5" stroke="url(#logo-grad)" strokeWidth="4.2" />
      <path d="M83 58 C 86 52, 90 50, 93 46" stroke="url(#logo-grad)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="94" cy="44" r="1.8" fill="var(--brand-mint)" />
      <circle cx="82.5" cy="62.5" r="1.4" fill="var(--brand-mint)" />
      <path
        d="M14 78 C 8 74, 6 68, 10 63 C 15 68, 16 74, 14 78 Z"
        stroke="url(#logo-grad)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LogoWordmark({ size = 56 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: 'var(--font-bold)',
          fontSize: size * 0.42,
          color: 'var(--text-primary)',
        }}
      >
        Better <span style={{ color: 'var(--brand-mint)' }}>Me</span>
      </span>
    </div>
  )
}
