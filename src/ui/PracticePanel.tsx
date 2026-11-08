import type { HTMLAttributes } from 'react'

/**
 * The practice screens' panel (docs/DESIGN-PRACTICE.md §7.1): fill, border, radius and padding in one place.
 * - (none): the default, white with a line border
 * - problem: the Math problem panel, its content spread top to bottom
 * - warm: the number pad panel
 * - soft: the Reading companion, filled `--l-chip`, no border, no padding of its own
 * A screen adds its own class for what is specific to it. check-conventions fails on a hand-written
 * `practice-panel` elsewhere.
 */
type Props = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'aside' | 'div'
  variant?: 'problem' | 'warm' | 'soft'
}

export function PracticePanel({ as: Tag = 'section', variant, className, ...rest }: Props) {
  const classes = ['practice-panel', variant && `practice-panel-${variant}`, className]
    .filter(Boolean)
    .join(' ')
  return <Tag className={classes} {...rest} />
}
