import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react'
import './input.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="bm-field">
      {label ? (
        <label htmlFor={inputId} className="bm-label">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        ref={ref}
        className={`bm-input ${error ? 'bm-input-error' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="bm-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [visible, setVisible] = useState(false)
  return (
    <div className="bm-field">
      {label ? (
        <label htmlFor={inputId} className="bm-label">
          {label}
        </label>
      ) : null}
      <div className="bm-input-wrap">
        <input
          id={inputId}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={`bm-input ${error ? 'bm-input-error' : ''} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
        <button
          type="button"
          className="bm-input-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="bm-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  error?: string
  value: string
  onChange: (value: string) => void
}

/** Peso input: displays digits/decimal only, parent converts via pesoToCentavos before storage. */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { label, error, id, value, onChange, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="bm-field">
      {label ? (
        <label htmlFor={inputId} className="bm-label">
          {label}
        </label>
      ) : null}
      <div className="bm-input-wrap">
        <span className="bm-currency-prefix">₱</span>
        <input
          id={inputId}
          ref={ref}
          inputMode="decimal"
          className={`bm-input bm-input-currency ${error ? 'bm-input-error' : ''} ${className}`}
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, '')
            onChange(raw)
          }}
          placeholder="0.00"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="bm-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})
