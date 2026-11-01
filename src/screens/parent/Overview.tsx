import { useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { COPY } from '../../copy'
import { REWARDS } from '../../engine'
import { LIST_LIMIT } from '../../parent/api'
import type { Device, ResultRow, Summary } from '../../parent/api'
import {
  ChevronRightIcon,
  CheckIcon,
  CoinsIcon,
  FlameIcon,
  ShoppingBagIcon,
  SunIcon,
  TabletIcon,
} from '../../parent/icons'
import { connectedDevices, lastSyncedLine, OVERVIEW_LINKS, todaysAssignments } from '../../parent/overview'
import { tabPath } from '../../parent/route'
import type { Tab } from '../../parent/route'
import { reachOf } from '../../parent/shop'
import { Button } from '../../ui/Button'
import { formatCalendarDay, formatClock, formatNumber } from '../../ui/format'

interface Props {
  /** Her numbers; null before they arrive. */
  summary: Summary | null
  /** Her latest results, newest first; null before they arrive. */
  results: ResultRow[] | null
  /** Every device of hers, unpaired ones too; null before they arrive. */
  devices: Device[] | null
  /** The chosen child's name; null when no child is known. */
  childName: string | null
  /** The parent's calendar day, YYYY-MM-DD. */
  today: string
  /** Opens another tab, keeping the selected child. */
  onGo: (tab: Tab) => void
  /** What shows in place of a value that has not arrived. */
  pending: ReactNode
  /** What shows in place of the results when they could not be loaded. */
  unavailable: ReactNode
}

/** A real link that a plain click turns into a tab change; middle click and "open in a new tab" still work. */
function TabLink({
  tab,
  onGo,
  className,
  children,
}: {
  tab: Tab
  onGo: (tab: Tab) => void
  className?: string
  children: ReactNode
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onGo(tab)
  }
  return (
    <a className={className} href={tabPath(tab)} onClick={onClick}>
      {children}
    </a>
  )
}

/**
 * The Overview tab (SPEC §5.3): Today's homework, her two numbers, today's assignments, links to Devices and
 * Shop, and her results. The DOM is the phone order; the wide layout places it with grid areas.
 */
export function Overview({ summary, results, devices, childName, today, onGo, pending, unavailable }: Props) {
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const todays = results ? todaysAssignments(results, today) : null
  const connected = devices ? connectedDevices(devices) : null
  const { withinCount } = reachOf(summary?.balance ?? null)

  const viewAll = () => {
    resultsHeading.current?.scrollIntoView?.({ block: 'start' })
    resultsHeading.current?.focus()
  }

  return (
    <div className="overview">
      <section className="overview-hero" aria-label={COPY.parentHomeworkLabel}>
        <div className="overview-hero-top">
          <h2 className="overview-hero-label">{COPY.parentHomeworkLabel}</h2>
          <SunIcon size={21} />
        </div>
        {summary ? (
          <>
            <p className="overview-hero-row">
              <span className="overview-hero-number">{formatNumber(summary.completedToday)}</span>
              <span className="overview-hero-unit">{COPY.parentHomeworkUnit(summary.completedToday)}</span>
            </p>
            {summary.earnedToday > 0 && (
              <p className="overview-hero-line">{COPY.parentHomeworkEarned(summary.earnedToday)}</p>
            )}
          </>
        ) : (
          <p className="overview-hero-row">{pending}</p>
        )}
      </section>

      <div className="overview-stats">
        <div className="overview-stat">
          <CoinsIcon size={20} />
          <p className="overview-stat-value">{summary ? formatNumber(summary.balance) : pending}</p>
          <p className="overview-stat-label">{COPY.parentStatMacaronis}</p>
          <TabLink tab={OVERVIEW_LINKS.macaronis} onGo={onGo} className="overview-stat-link">
            {COPY.parentManageMacaronis}
          </TabLink>
        </div>
        <div className="overview-stat">
          <FlameIcon size={20} />
          <p className="overview-stat-value">{summary ? COPY.parentStreakValue(summary.streak) : pending}</p>
          <p className="overview-stat-label">{COPY.parentStatStreak}</p>
          <TabLink tab={OVERVIEW_LINKS.streak} onGo={onGo} className="overview-stat-link">
            {COPY.parentManageStreak}
          </TabLink>
        </div>
      </div>

      {summary && (
        <p className="overview-totals">
          {COPY.parentTotalsLine(
            summary.completed,
            summary.lastDay ? formatCalendarDay(summary.lastDay) : COPY.parentNoLastDay,
          )}
        </p>
      )}

      <div className="overview-block overview-assignments">
        <div className="overview-heading">
          <h2>{COPY.parentAssignmentsHeading}</h2>
          {results && results.length > 0 && (
            <Button variant="bare" onClick={viewAll}>
              {COPY.parentViewAll}
            </Button>
          )}
        </div>
        <section className="parent-section overview-list" aria-label={COPY.parentAssignmentsHeading}>
          {results === null && pending}
          {todays?.length === 0 && <p className="overview-empty">{COPY.parentNoAssignmentsToday}</p>}
          {todays?.map((r, i) => (
            <div key={r.id} className="overview-item">
              {i > 0 && <hr className="overview-divider" />}
              <div className="overview-row">
                <span className="overview-tile">
                  <CheckIcon size={17} />
                </span>
                <div className="overview-detail">
                  <p className="overview-title">{COPY.parentAssignmentTitle(r.grade)}</p>
                  <p className="overview-meta">{COPY.parentCompletedAt(formatClock(r.createdAt))}</p>
                </div>
                <span className="overview-amount">+{formatNumber(r.total)}</span>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="overview-block overview-sync">
        <div className="overview-heading">
          <h2>{COPY.parentSyncHeading}</h2>
        </div>
        <section className="parent-section overview-links" aria-label={COPY.parentSyncHeading}>
          <TabLink tab={OVERVIEW_LINKS.devices} onGo={onGo} className="overview-link-row">
            <TabletIcon size={20} />
            <span className="overview-detail">
              <span className="overview-title">
                {connected ? COPY.parentDevicesRowTitle(connected.count) : pending}
              </span>
              {connected && (
                <span className="overview-meta">{lastSyncedLine(connected.lastSyncedAt, new Date())}</span>
              )}
            </span>
            <ChevronRightIcon size={18} />
          </TabLink>
          <hr className="overview-divider" />
          <TabLink tab={OVERVIEW_LINKS.shop} onGo={onGo} className="overview-link-row">
            <ShoppingBagIcon size={20} />
            <span className="overview-detail">
              <span className="overview-title">
                {childName ? COPY.parentShopHeading(childName) : COPY.parentShopHeadingPlain}
              </span>
              <span className="overview-meta">{COPY.parentRewardsRowMeta(REWARDS.length, withinCount)}</span>
            </span>
            <ChevronRightIcon size={18} />
          </TabLink>
        </section>
      </div>

      <section className="parent-section overview-results" id="overview-results">
        <h2 ref={resultsHeading} tabIndex={-1}>
          {COPY.parentResultsHeading}
        </h2>
        {results === null && unavailable}
        {results?.length === 0 && <p>{COPY.parentNoResults}</p>}
        {results && results.length > 0 && (
          <div className="parent-table-wrap">
            <table className="parent-table">
              <thead>
                <tr>
                  <th scope="col">{COPY.parentColDate}</th>
                  <th scope="col">{COPY.parentColRight}</th>
                  <th scope="col">{COPY.parentColGrade}</th>
                  <th scope="col">{COPY.parentColEarned}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{formatCalendarDay(r.day)}</td>
                    <td>{COPY.parentRightOf(r.correct, r.answered)}</td>
                    <td>{r.finished && r.grade ? r.grade : COPY.parentLeftEarly}</td>
                    <td>{formatNumber(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {results?.length === LIST_LIMIT && <p>{COPY.parentLatest(LIST_LIMIT)}</p>}
      </section>
    </div>
  )
}
