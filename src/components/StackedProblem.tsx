import type { CSSProperties } from 'react'
import type { Problem } from '../engine'
import { formatNumber, operatorSymbol } from '../ui/format'

interface Props {
  problem: Problem
  /** Number of answer boxes, one per column. */
  boxes: number
  /** The digits the answer boxes show, left to right (her answer, or the worked answer). */
  shown: string
  /** The box her next digit goes in, highlighted; null when there's none. */
  next: number | null
  /** After Check: whether her answer was right, which tints her boxes (SPEC §5.1). */
  outcome?: 'right' | 'notRight' | null
}

const OUTCOME_CLASS = { right: ' answer-box-right', notRight: ' answer-box-not-right' } as const

/** Right-aligns digits into `columns` cells, one digit each; empty cells are ''. */
function inColumns(digits: string, columns: number): string[] {
  const offset = columns - digits.length
  return Array.from({ length: columns }, (_, i) => digits[i - offset] ?? '')
}

/**
 * A problem stacked like on paper (SPEC §5.1): one digit per column, lined up by place value, with one
 * answer box per column. No thousands separators here, so the columns stay lined up.
 */
export function StackedProblem({ problem, boxes, shown, next, outcome = null }: Props) {
  const op = operatorSymbol(problem.operation)
  const row = (digits: string, key: string) =>
    inColumns(digits, boxes).map((digit, i) => (
      <span key={`${key}${i}`} className="stacked-digit">
        {digit}
      </span>
    ))

  return (
    <div
      className="stacked"
      style={{ '--columns': boxes } as CSSProperties}
      data-a={problem.a}
      data-b={problem.b}
      data-operation={problem.operation}
      data-shown={shown}
      data-outcome={outcome ?? undefined}
      role="img"
      aria-label={`${formatNumber(problem.a)} ${op} ${formatNumber(problem.b)} = ${shown}`}
    >
      <span />
      {row(String(problem.a), 'a')}
      <span className="stacked-op">{op}</span>
      {row(String(problem.b), 'b')}
      <span className="stacked-rule" />
      <span />
      {inColumns(shown, boxes).map((digit, i) => (
        <span
          key={`box${i}`}
          className={`answer-box${i === next ? ' answer-box-next' : ''}${outcome ? OUTCOME_CLASS[outcome] : ''}`}
        >
          {digit}
        </span>
      ))}
    </div>
  )
}
