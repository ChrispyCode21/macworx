import type { ReactNode } from 'react'
import { COPY } from '../../copy'
import { describe } from '../../parent/activity'
import type { ActivityKind } from '../../parent/activity'
import { LIST_LIMIT, MAX_NOTE } from '../../parent/api'
import type { Device, LogEntry, Summary } from '../../parent/api'
import {
  ArrowRightIcon,
  CheckIcon,
  CoinsIcon,
  FlameIcon,
  HistoryIcon,
  InfoIcon,
  ScanLineIcon,
  ShieldCheckIcon,
  UnlinkIcon,
} from '../../parent/icons'
import { Button } from '../../ui/Button'
import { formatMoment, formatNumber } from '../../ui/format'
import { Segmented } from '../../ui/Segmented'
import { TextField } from '../../ui/TextField'
import type { AdjustState } from './useAdjust'

interface Props {
  /** Her numbers; null until they arrive. */
  summary: Summary | null
  /** The chosen child's admin log, newest first; null until it arrives. */
  log: LogEntry[] | null
  devices: Device[] | null
  adjust: AdjustState
  /** What shows in place of the list when it could not be loaded. */
  unavailable: ReactNode
  /** What shows in place of a number that has not arrived. */
  pending: ReactNode
}

const ICONS: Record<ActivityKind, (props: { size?: number }) => ReactNode> = {
  balance: CoinsIcon,
  streak: FlameIcon,
  pairing_code: ScanLineIcon,
  unpair: UnlinkIcon,
  correction: CheckIcon,
  child: HistoryIcon,
  other: HistoryIcon,
}

/** The Macaronis tab (SPEC §5.3, docs/DESIGN.md §10): her balance, Adjust balance, and Recent activity. */
export function PointsScreen({ summary, log, devices, adjust, unavailable, pending }: Props) {
  const a = adjust
  const reviewing = a.step === 'review'
  const check = a.check
  return (
    <div className="points">
      <section className="points-hero">
        <p className="points-hero-label">{COPY.parentHeroLabel}</p>
        <p className="points-hero-row">
          <span className="points-hero-number">{summary ? formatNumber(summary.balance) : pending}</span>
          <span className="points-hero-unit">{COPY.parentHeroUnit}</span>
        </p>
        {summary && summary.earnedToday > 0 && (
          <p className="points-hero-line">{COPY.parentEarnedToday(summary.earnedToday)}</p>
        )}
      </section>

      <div className="points-adjust">
        <h2 className="points-heading">{COPY.parentAdjustHeading}</h2>
        <section className="parent-section">
          <Segmented
            label={COPY.parentAdjustModeLabel}
            options={[
              { value: 'add', label: COPY.parentAddOption },
              { value: 'remove', label: COPY.parentRemoveOption },
            ]}
            value={a.removing ? 'remove' : 'add'}
            onChange={(value) => a.setRemoving(value === 'remove')}
            disabled={reviewing}
          />
          <TextField
            label={a.removing ? COPY.parentAmountRemoveLabel : COPY.parentAmountAddLabel}
            unit={COPY.parentHeroUnit}
            inputMode="numeric"
            value={a.amountText}
            maxLength={6}
            disabled={reviewing}
            onChange={(e) => a.setAmountText(e.target.value)}
          />
          <TextField
            label={COPY.parentReasonLabel}
            multiline
            value={a.note}
            maxLength={MAX_NOTE}
            disabled={reviewing}
            onChange={(e) => a.setNote(e.target.value)}
          />
          <div className="points-preview">
            <span className="points-preview-label">{COPY.parentPreviewLabel}</span>
            <span className={a.below ? 'points-preview-value points-preview-below' : 'points-preview-value'}>
              {a.below
                ? COPY.parentBelowZero
                : summary
                  ? COPY.parentPreviewValue(a.after ?? summary.balance)
                  : COPY.parentNoValue}
            </span>
          </div>
          {a.below && summary && (
            <p className="safeguard safeguard-warn">
              <InfoIcon size={17} />
              <span>{COPY.parentOverdraw(summary.balance)}</span>
            </p>
          )}
          <p className="safeguard safeguard-info">
            <ShieldCheckIcon size={17} />
            <span>{COPY.parentAdjustNotice}</span>
          </p>
          {reviewing && check?.ok && summary ? (
            <div className="points-confirm">
              <p>
                {COPY.parentReviewLine(
                  a.removing,
                  Math.abs(check.amount),
                  summary.balance,
                  check.after,
                  check.note,
                )}
              </p>
              <Button onClick={a.confirm} disabled={a.saving}>
                {COPY.parentConfirm}
              </Button>
              <Button variant="soft" onClick={a.back} disabled={a.saving}>
                {COPY.parentBack}
              </Button>
            </div>
          ) : (
            <Button onClick={a.review} disabled={!check?.ok}>
              {a.amount !== null ? COPY.parentReview(a.amount) : COPY.parentReviewPlain}
              <ArrowRightIcon size={18} />
            </Button>
          )}
          {a.notice && (
            <p className="safeguard safeguard-info" role="status">
              <ShieldCheckIcon size={17} />
              <span>{a.notice}</span>
            </p>
          )}
          {a.problem && (
            <p className="safeguard safeguard-warn" role="alert">
              <InfoIcon size={17} />
              <span>{a.problem}</span>
            </p>
          )}
          <p className="points-footnote">{COPY.parentAdjustFootnote}</p>
        </section>
      </div>

      <div className="points-activity">
        <h2 className="points-heading">{COPY.parentActivityHeading}</h2>
        <section className="parent-section">
          {log === null && unavailable}
          {log?.length === 0 && <p>{COPY.parentNoLog}</p>}
          {log && log.length > 0 && (
            <ul className="activity-list">
              {log.map((entry) => {
                const what = describe(entry, devices ?? [])
                const Icon = ICONS[what.kind]
                return (
                  <li key={entry.id} className="activity-row">
                    <span className="activity-icon">
                      <Icon size={18} />
                    </span>
                    <div className="activity-event">
                      <p className="activity-title">{what.title}</p>
                      <p className="activity-meta">
                        {COPY.parentActivityMeta(formatMoment(entry.at), entry.email)}
                      </p>
                    </div>
                    {what.amount !== undefined && (
                      <span className="activity-amount">{COPY.parentActivityAmount(what.amount)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {log?.length === LIST_LIMIT && <p className="activity-meta">{COPY.parentLatest(LIST_LIMIT)}</p>}
        </section>
      </div>
    </div>
  )
}
