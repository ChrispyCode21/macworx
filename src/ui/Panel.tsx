import type { HTMLAttributes } from 'react'

/**
 * The parent portal's panel (docs/DESIGN.md §7): fill, border, radius, padding and gap in one place. A screen
 * adds its own class for what is specific to it (a grid area, a different gap). check-conventions fails on a
 * hand-written `.parent-section` elsewhere.
 */
type Props = HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'li' }

export function Panel({ as: Tag = 'section', className, ...rest }: Props) {
  return <Tag className={className ? `parent-section ${className}` : 'parent-section'} {...rest} />
}
