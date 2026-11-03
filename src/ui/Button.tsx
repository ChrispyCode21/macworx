import type { ComponentProps } from 'react'

/**
 * The one button (check-conventions fails on a raw <button> outside src/ui/).
 * - primary: the main action on a screen (Start, Next, Do another one)
 * - secondary: a quieter action (Done for now, Home)
 * - key: a number pad key
 * - check: the number pad's Check key
 * - bare: no look of its own, for a control the caller styles (the portal's child switcher and its rows)
 * - danger: the parent portal's destructive action
 * - soft: the parent portal's quiet filled action (View details)
 * The practice screens' variants (docs/DESIGN-PRACTICE.md §7.4):
 * - action: Check, Next and the other main actions
 * - action-secondary: the quieter action beside it
 * - crumb: the back control in the heading
 * - play: the round Play button
 * - support: a quiet text button with an icon
 * - choice: one answer in a radio group
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'key'
  | 'check'
  | 'bare'
  | 'danger'
  | 'soft'
  | 'action'
  | 'action-secondary'
  | 'crumb'
  | 'play'
  | 'support'
  | 'choice'

interface Props extends Omit<ComponentProps<'button'>, 'type' | 'className'> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', ...props }: Props) {
  return <button type="button" className={`button button-${variant}`} {...props} />
}
