import type { ReactNode } from 'react'
import { HomeBar } from '../components/HomeBar'
import { COPY } from '../copy'
import {
  ArrowRightIcon,
  BookOpenIcon,
  CoinsIcon,
  FlameIcon,
  LockKeyholeIcon,
  PlusIcon,
  ShoppingBagIcon,
} from '../practice/icons'
import type { HomeNumbers } from '../sync/projection'
import { Button } from '../ui/Button'
import { formatNumber } from '../ui/format'

interface Props {
  onStart: () => void
  /** Spelling and Reading open their practice screens, on any iPad (SPEC §5.5). */
  onOpen: (subject: 'spelling' | 'reading') => void
  /** Set only while this installed iPad isn't paired (SPEC §5.4). */
  onPair?: () => void
  /** Reading found no connection for her next story (SPEC §5.6 step 1). */
  readingOffline?: boolean
  /** Her numbers; absent until a paired iPad has the Worker's state (SPEC §6.8). */
  numbers?: HomeNumbers
}

function SubjectCard({
  title,
  line,
  icon,
  onStart,
}: {
  title: string
  line: string
  icon: ReactNode
  onStart: () => void
}) {
  return (
    <li className="home-subject">
      <span className="home-tile" aria-hidden="true">
        {icon}
      </span>
      <div className="home-subject-text">
        <h3 className="home-subject-title">{title}</h3>
        <p className="home-subject-line">{line}</p>
      </div>
      <Button variant="home-start" aria-label={COPY.homeStartLabel(title)} onClick={onStart}>
        {COPY.homeStart}
        <ArrowRightIcon />
      </Button>
    </li>
  )
}

/** The child Home (SPEC §5.1 step 1, docs/DESIGN.md "Home"). */
export function Home({ onStart, onOpen, onPair, readingOffline, numbers }: Props) {
  return (
    <div className="home">
      <HomeBar />
      <main className="home-main">
        <div className="home-intro">
          <h1 className="home-heading">{COPY.homeHeading}</h1>
          <p className="home-subheading">{COPY.homeSubheading}</p>
        </div>
        <div className="home-columns">
          <section className="home-subjects" aria-labelledby="home-subjects-heading">
            <div className="home-section-head">
              <h2 id="home-subjects-heading">{COPY.homeSubjectsHeading}</h2>
              <span>{COPY.homeSubjectsCount}</span>
            </div>
            <ul className="home-subject-list">
              <SubjectCard
                title={COPY.subjectMath}
                line={COPY.startHint}
                icon={<PlusIcon size={32} />}
                onStart={onStart}
              />
              <SubjectCard
                title={COPY.subjectSpelling}
                line={COPY.homeSpellingLine}
                icon={<span className="home-aa">{COPY.homeSpellingIcon}</span>}
                onStart={() => onOpen('spelling')}
              />
              <SubjectCard
                title={COPY.subjectReading}
                line={readingOffline ? COPY.readingOffline : COPY.homeReadingLine}
                icon={<BookOpenIcon size={32} />}
                onStart={() => onOpen('reading')}
              />
            </ul>
            {onPair && (
              <Button variant="secondary" onClick={onPair}>
                {COPY.pairThisIpad}
              </Button>
            )}
          </section>
          <div className="home-side">
            <div className="home-section-head">
              <h2 id="home-progress-heading">{COPY.homeProgressHeading}</h2>
            </div>
            <div className="home-progress">
              <p className="home-progress-label">
                <CoinsIcon />
                {COPY.homeMacaronisLabel}
              </p>
              {numbers ? (
                <p className="home-balance">
                  <span className="home-balance-number">{formatNumber(numbers.balance)}</span>{' '}
                  {COPY.homeAvailable}
                </p>
              ) : (
                <p className="home-empty">{COPY.homeNoNumbers}</p>
              )}
              {numbers && numbers.streak !== null && (
                <div className="home-streak">
                  <span className="home-tile" aria-hidden="true">
                    <FlameIcon size={24} />
                  </span>
                  <p>
                    <span className="home-streak-days">{COPY.streakChip(numbers.streak)}</span>
                    {COPY.homeStreakLabel}
                  </p>
                </div>
              )}
            </div>
            <div className="home-shop">
              <p className="home-shop-title">
                <ShoppingBagIcon />
                {COPY.homeShopTitle}
              </p>
              <p className="home-shop-line">{COPY.homeShopLine}</p>
              {/* Inert until the shop screen exists (SPEC §5.1 step 1). */}
              <Button variant="home-link" aria-disabled="true">
                {COPY.homeShopLink}
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
        </div>
        <footer className="home-footer">
          <span>{COPY.homeFooterLeft}</span>
          <span className="home-footer-right">
            <LockKeyholeIcon />
            {COPY.homeFooterRight}
          </span>
        </footer>
      </main>
    </div>
  )
}
