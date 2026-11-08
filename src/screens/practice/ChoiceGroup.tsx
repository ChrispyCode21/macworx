import { useImperativeHandle, useRef, type KeyboardEvent, type Ref } from 'react'
import { CheckIcon } from '../../practice/icons'
import { LETTERS } from '../../practice/samples'
import { Button } from '../../ui/Button'

export interface ChoiceGroupHandle {
  /** Moves focus to choice `i`. */
  focus: (i: number) => void
}

interface Props {
  /** The list's own class (its gap and layout are per subject). */
  className: string
  /** The text span's class (its size is per subject). */
  textClass: string
  label: string
  choices: readonly string[]
  chosen: number | null
  onChoose: (i: number) => void
  /** Check has been tapped: the choices lock and the chosen one shows right or not right. */
  checked: boolean
  right: boolean
  handle?: Ref<ChoiceGroupHandle>
}

/**
 * One question's choices as a radio group (docs/DESIGN-PRACTICE.md §7.3): lettered, one tab stop (the chosen one,
 * else the first), arrow keys move through them and pick the one they land on, and after Check the chosen one
 * shows right or not right. Used by Spelling and Reading.
 */
export function ChoiceGroup({
  className,
  textClass,
  label,
  choices,
  chosen,
  onChoose,
  checked,
  right,
  handle,
}: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useImperativeHandle(handle, () => ({ focus: (i) => refs.current[i]?.focus() }), [])

  const onKey = (e: KeyboardEvent, from: number) => {
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0
    if (step === 0) return
    e.preventDefault()
    const to = (from + step + choices.length) % choices.length
    onChoose(to)
    refs.current[to]?.focus()
  }

  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {choices.map((text, i) => {
        const result = checked && i === chosen ? (right ? 'right' : 'not-right') : undefined
        return (
          <Button
            key={text}
            ref={(el) => {
              refs.current[i] = el
            }}
            variant="choice"
            role="radio"
            aria-checked={i === chosen}
            tabIndex={i === (chosen ?? 0) ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            disabled={checked}
            data-result={result}
            onClick={() => onChoose(i)}
          >
            <span className="choice-marker">{LETTERS[i]}</span>
            <span className={textClass}>{text}</span>
            {result === 'right' && <CheckIcon size={22} />}
          </Button>
        )
      })}
    </div>
  )
}
