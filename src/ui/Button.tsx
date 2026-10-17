import type { ComponentProps } from 'react'

/**
 * The one button (check-conventions fails on a raw <button> outside src/ui/).
 * - primary: the main action on a screen (Start, Next, Do another one)
 * - secondary: a quieter action (Done for now, Home)
 * - key: a number pad key
 * - check: the number pad's Check key
 */
export type ButtonVariant = 'primary' | 'secondary' | 'key' | 'check'

interface Props extends Omit<ComponentProps<'button'>, 'type' | 'className'> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', ...props }: Props) {
  return <button type="button" className={`button button-${variant}`} {...props} />
}
