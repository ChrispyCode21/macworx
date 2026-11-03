import type { ReactNode } from 'react'
import { COPY } from '../../copy'
import { ArrowLeftIcon, CoinsIcon, FlameIcon, SproutIcon } from '../../practice/icons'
import type { HomeNumbers } from '../../sync/projection'
import { Button } from '../../ui/Button'

interface Props {
  /** The numbers Home showed when the screen opened; none, none shown (docs/DESIGN-PRACTICE.md §6.1). */
  numbers?: HomeNumbers
  subject: string
  title: string
  progress: { label: string; done: number; total: number }
  onBack: () => void
  /** What the back control does; its accessible name is the visible crumb text, then this (WCAG 2.5.3). */
  backLabel: string
  note?: string
  /** The activity row: the problem and the pad. */
  children: ReactNode
  /** The actions row's buttons. */
  actions: ReactNode
}

/**
 * The frame the practice screens share (docs/DESIGN-PRACTICE.md §3, §6): the top bar, the heading block, the
 * activity row and the actions row. The avatar, the meta line and the Shop button wait for their data and screens.
 */
export function PracticeFrame({
  numbers,
  subject,
  title,
  progress,
  onBack,
  backLabel,
  note,
  children,
  actions,
}: Props) {
  const percent = Math.round((progress.done / progress.total) * 100)
  return (
    <div className="practice">
      <header className="practice-bar">
        <div className="practice-brand">
          <SproutIcon />
          <span>{COPY.title}</span>
        </div>
        <div className="practice-tools">
          {numbers && (
            <span className="practice-chip">
              <CoinsIcon />
              {COPY.macaronis(numbers.balance)}
            </span>
          )}
          {numbers && numbers.streak !== null && (
            <span className="practice-chip">
              <FlameIcon />
              {COPY.streakChip(numbers.streak)}
            </span>
          )}
        </div>
      </header>
      <main className="practice-work">
        <div className="practice-heading">
          <div className="practice-context">
            <Button
              variant="crumb"
              aria-label={`${COPY.practiceCrumb(subject)}, ${backLabel}`}
              onClick={onBack}
            >
              <ArrowLeftIcon />
              {COPY.practiceCrumb(subject)}
            </Button>
          </div>
          <div className="practice-task">
            <h1 className="practice-title">{title}</h1>
            <div
              className="practice-progress"
              role="progressbar"
              aria-label={progress.label}
              aria-valuemin={0}
              aria-valuenow={progress.done}
              aria-valuemax={progress.total}
            >
              <span className="practice-progress-label">{progress.label}</span>
              <span className="practice-progress-track">
                <span className="practice-progress-fill" style={{ width: `${percent}%` }} />
              </span>
            </div>
          </div>
        </div>
        <div className="practice-activity">{children}</div>
        <div className="practice-actions">
          {note && <p className="practice-note">{note}</p>}
          <div className="practice-buttons">{actions}</div>
        </div>
      </main>
    </div>
  )
}
