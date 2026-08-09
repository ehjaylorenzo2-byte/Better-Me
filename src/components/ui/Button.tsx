import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './button.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`bm-btn bm-btn-${variant} ${fullWidth ? 'bm-btn-full' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className="bm-btn-spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  )
}
