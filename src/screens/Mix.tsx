import { useState } from 'react'
import { HomeBar } from '../components/HomeBar'
import { COPY } from '../copy'
import { pickSizes, type Mix as MixOf, type Pick } from '../engine'
import { LEVELS, MAX_PICKS } from '../engine'
import { isPicked, OPERATIONS, SAMPLES, togglePick } from '../mix/picks'
import { ArrowLeftIcon, ArrowRightIcon, CoinsIcon, RotateCwIcon } from '../practice/icons'
import { Button } from '../ui/Button'
import { formatNumber, operatorSymbol } from '../ui/format'

interface Props {
  /** The picks she starts with: the mix she just did, when Do another one found no seeds (SPEC §6.8). */
  initial?: MixOf
  /** The mix of the last assignment she started on this iPad; none, no "Same as last time". */
  lastMix: MixOf | null
  /** "Earn up to X Macaronis" (SPEC §6.4). */
  earn: number
  /** Start found no seeds and no connection (SPEC §6.8). */
  noSeeds: boolean
  /** Her picks changed, so a Wi-Fi line from an earlier Start no longer applies. */
  onChange: () => void
  onStart: (mix: MixOf) => void
  onBack: () => void
}

/** The mix screen (SPEC §5.1 step 2, docs/DESIGN-PRACTICE.md §17): pick up to 3 problems to mix. */
export function Mix({ initial = [], lastMix, earn, noSeeds, onChange, onStart, onBack }: Props) {
  const [picks, setPicks] = useState<MixOf>(initial)
  const full = picks.length >= MAX_PICKS
  const change = (next: MixOf) => {
    setPicks(next)
    onChange()
  }
  const sizes = pickSizes(Math.max(picks.length, 1))

  return (
    <div className="home mix">
      <HomeBar onHome={onBack} />
      <main className="home-main mix-main">
        <Button variant="crumb" onClick={onBack}>
          <ArrowLeftIcon />
          {COPY.mixCrumb}
        </Button>
        <div className="home-intro">
          <h1 className="home-heading">{COPY.mixHeading}</h1>
          <p className="home-subheading">{COPY.mixLine}</p>
        </div>
        <div className="mix-tools">
          {lastMix && (
            <Button variant="secondary" onClick={() => change(lastMix)}>
              <RotateCwIcon />
              {COPY.mixSame}
            </Button>
          )}
          <p className="mix-swap" aria-live="polite">
            {full && COPY.mixSwap}
          </p>
          <p className="mix-count" aria-live="polite">
            {COPY.mixCount(picks.length)}
          </p>
        </div>
        <div className="mix-columns">
          <div className="mix-grid" role="group" aria-label={COPY.mixGrid}>
            <span />
            {LEVELS.map((level, i) => (
              <span key={level} className="mix-level">
                {COPY.levelName(level)}
                <span className="mix-dots" aria-hidden="true">
                  {'●'.repeat(i + 1)}
                </span>
              </span>
            ))}
            {OPERATIONS.map((operation) => (
              <div key={operation} className="mix-row">
                <span className="mix-operation">
                  <span aria-hidden="true">{operatorSymbol(operation)}</span>
                  {COPY.operationName(operation)}
                </span>
                {LEVELS.map((level, i) => {
                  const pick: Pick = { operation, level }
                  const picked = isPicked(picks, pick)
                  const [a, b] = SAMPLES[operation][i]
                  const problem = `${formatNumber(a)} ${operatorSymbol(operation)} ${formatNumber(b)}`
                  return (
                    <Button
                      key={level}
                      variant="mix-cell"
                      aria-pressed={picked}
                      aria-disabled={full && !picked ? 'true' : undefined}
                      aria-label={COPY.mixCell(problem, operation, level)}
                      onClick={() => change(togglePick(picks, pick))}
                    >
                      {problem}
                    </Button>
                  )
                })}
              </div>
            ))}
          </div>
          <aside className="mix-panel">
            <h2 className="mix-panel-title">{COPY.mixTitle(picks.length)}</h2>
            {picks.length === 0 ? (
              <div className="mix-empty">
                <p className="mix-empty-title">{COPY.mixEmptyTitle}</p>
                <p className="mix-muted">{COPY.mixEmptyLine}</p>
              </div>
            ) : (
              <ol className="mix-picks">
                {picks.map((pick, i) => (
                  <li key={`${pick.operation}-${pick.level}`}>
                    <span>
                      {COPY.operationName(pick.operation)}
                      <span className="mix-muted">{COPY.levelName(pick.level)}</span>
                    </span>
                    <span>{COPY.mixProblems(sizes[i])}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mix-total">
              <p className="mix-total-title">{COPY.mixTotal}</p>
              {picks.length >= 2 && <p className="mix-muted">{COPY.mixTogether}</p>}
              <p className="mix-earn">
                <CoinsIcon />
                {COPY.mixEarn(earn)}
              </p>
            </div>
          </aside>
        </div>
        <div className="mix-start">
          {noSeeds && (
            <p className="mix-muted" role="status">
              {COPY.connectForProblems}
            </p>
          )}
          <Button variant="action" disabled={picks.length === 0} onClick={() => onStart(picks)}>
            {COPY.mixStart}
            <ArrowRightIcon />
          </Button>
        </div>
      </main>
    </div>
  )
}
