import { forwardRef, type ComponentProps } from 'react'
import { SPELLING } from '../engine'

type Props = Omit<ComponentProps<'input'>, 'className' | 'type' | 'maxLength'> & {
  /** After Check: the box turns soft green when the word matched, soft coral when it didn't (docs/DESIGN-PRACTICE.md §7.3). */
  result?: 'right' | 'not-right'
}

/**
 * The box she types a spelling word in (SPEC §5.7 step 2): autocorrect, automatic capitals, spell check and
 * suggestions are off, so what she types is what is checked. Her screens' only text box; the parent pages use TextField.
 */
export const WordBox = forwardRef<HTMLInputElement, Props>(function WordBox({ result, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      className="word-box"
      maxLength={SPELLING.typedLength}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="done"
      data-result={result}
      {...rest}
    />
  )
})
