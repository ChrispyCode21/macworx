import type { ReactNode } from 'react'
import { COPY } from '../copy'
import {
  ArrowRightIcon,
  BookOpenIcon,
  CoinsIcon,
  FlameIcon,
  LockKeyholeIcon,
  PlusIcon,
  ShoppingBagIcon,
  SproutIcon,
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
  /** Start found no seeds and no connection (SPEC §6.8). */
  noSeeds?: boolean
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
export function Home({ onStart, onOpen, onPair, noSeeds, numbers }: Props) {
  return (
    <div className="home">
      <header className="home-bar">
        <div className="home-brand">
          <SproutIcon />
          <span>{COPY.title}</span>
        </div>
        <nav className="home-nav" aria-label={COPY.homeNavLabel}>
          <span className="home-nav-item home-nav-current" aria-current="page">
            {COPY.homeNavHome}
          </span>
          {/* The shop screen (SPEC §5.2) doesn't exist yet: shown, and does nothing. */}
          <Button variant="home-nav" aria-disabled="true">
            {COPY.homeNavShop}
          </Button>
          {/* A plain link, so it is a full page load and Cloudflare Access can ask for a sign-in (SPEC §5.3). */}
          <a className="home-nav-item" href="/parent/overview">
            <LockKeyholeIcon />
            {COPY.parentsLink}
          </a>
        </nav>
      </header>
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
                line={noSeeds ? COPY.connectForProblems : COPY.startHint}
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
                line={COPY.homeReadingLine}
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
          <aside className="home-side" aria-labelledby="home-progress-heading">
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
                  <span className="home-balance-number">{formatNumber(numbers.balance)}</span>
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
              <h3 className="home-shop-title">
                <ShoppingBagIcon />
                {COPY.homeShopTitle}
              </h3>
              <p className="home-shop-line">{COPY.homeShopLine}</p>
              {/* Inert until the shop screen exists (SPEC §5.1 step 1). */}
              <Button variant="home-link" aria-disabled="true">
                {COPY.homeShopLink}
                <ArrowRightIcon />
              </Button>
            </div>
          </aside>
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
