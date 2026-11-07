import type { ReactNode } from 'react'
import { InfoIcon, ShieldCheckIcon } from '../parent/icons'

/**
 * The parent portal's notice row (docs/DESIGN.md §7, "Safeguard"). check-conventions fails on a hand-written
 * `.safeguard` element outside src/ui/.
 * - info: reassurance or a saved result; shield-check unless the caller names an icon
 * - warn: something to look at; the info icon
 * `role` is "status" for a result and "alert" for a problem; a plain notice has none.
 */
type Props = {
  tone: 'info' | 'warn'
  icon?: ReactNode
  role?: 'status' | 'alert'
  children: ReactNode
}

export function Safeguard({ tone, icon, role, children }: Props) {
  const mark = icon ?? (tone === 'warn' ? <InfoIcon size={17} /> : <ShieldCheckIcon size={17} />)
  return (
    <p className={`safeguard safeguard-${tone}`} role={role}>
      {mark}
      <span>{children}</span>
    </p>
  )
}
