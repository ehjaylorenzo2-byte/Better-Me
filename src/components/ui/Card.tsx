import type { HTMLAttributes, ReactNode } from 'react'
import './card.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
  children: ReactNode
}

export function Card({ elevated = false, className = '', children, ...rest }: CardProps) {
  return (
    <div className={`bm-card ${elevated ? 'bm-card-elevated' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}
