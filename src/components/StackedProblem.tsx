import type { Problem } from '../engine'
import { formatNumber, operatorSymbol } from '../ui/format'

/** A problem stacked like on paper (SPEC §5.1), with her answer (or the worked answer) under the line. */
export function StackedProblem({ problem, answer }: { problem: Problem; answer: string }) {
  const shownAnswer = answer === '' ? '' : formatNumber(Number(answer))
  return (
    <div
      className="stacked"
      data-a={problem.a}
      data-b={problem.b}
      data-operation={problem.operation}
      role="img"
      aria-label={`${formatNumber(problem.a)} ${operatorSymbol(problem.operation)} ${formatNumber(problem.b)} = ${shownAnswer}`}
    >
      <span className="stacked-op" />
      <span className="stacked-num">{formatNumber(problem.a)}</span>
      <span className="stacked-op">{operatorSymbol(problem.operation)}</span>
      <span className="stacked-num">{formatNumber(problem.b)}</span>
      <span className="stacked-rule" />
      <span className="stacked-op" />
      {/* A non-breaking space keeps the answer row's height while it's empty. */}
      <span className="stacked-num stacked-answer">{shownAnswer || ' '}</span>
    </div>
  )
}
