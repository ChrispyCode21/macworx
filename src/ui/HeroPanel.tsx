import type { ReactNode } from 'react'

/**
 * The parent portal's hero panel (docs/DESIGN.md §7): a label row with an optional icon, then what the caller
 * puts in it: a number row (`HeroRow` with `HeroNumber` and `HeroUnit`) and an optional `HeroLine`.
 * `variant` picks the screen's sizes (docs/DESIGN.md §4) and names the label's heading id.
 */
type Props = {
  variant: 'overview' | 'points' | 'streak'
  label: string
  icon?: ReactNode
  children: ReactNode
}

export function HeroPanel({ variant, label, icon, children }: Props) {
  const id = `${variant}-hero-heading`
  return (
    <section className={`parent-hero ${variant}-hero`} aria-labelledby={id}>
      <div className="parent-hero-top">
        <h2 id={id} className="parent-hero-label">
          {label}
        </h2>
        {icon}
      </div>
      {children}
    </section>
  )
}

export const HeroRow = ({ children }: { children: ReactNode }) => (
  <p className="parent-hero-row">{children}</p>
)
export const HeroNumber = ({ children }: { children: ReactNode }) => (
  <span className="parent-hero-number">{children}</span>
)
export const HeroUnit = ({ children }: { children: ReactNode }) => (
  <span className="parent-hero-unit">{children}</span>
)
export const HeroLine = ({ children }: { children: ReactNode }) => (
  <p className="parent-hero-line">{children}</p>
)
