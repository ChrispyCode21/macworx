import type { ReactNode } from 'react'
import { COPY } from '../../copy'
import { describe } from '../../parent/activity'
import type { ActivityKind } from '../../parent/activity'
import { LIST_LIMIT, MAX_NOTE } from '../../parent/api'
import type { Device, LogEntry, Summary } from '../../parent/api'
import { CheckIcon, CoinsIcon, FlameIcon, HistoryIcon, ScanLineIcon, UnlinkIcon } from '../../parent/icons'
import { HeroLine, HeroNumber, HeroPanel, HeroRow, HeroUnit } from '../../ui/HeroPanel'
import { ReviewStep } from '../../ui/ReviewStep'
import { Safeguard } from '../../ui/Safeguard'
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
      <HeroPanel variant="points" label={COPY.parentHeroLabel}>
        <HeroRow>
          <HeroNumber>{summary ? formatNumber(summary.balance) : pending}</HeroNumber>
          <HeroUnit>{COPY.parentHeroUnit}</HeroUnit>
        </HeroRow>
        {summary && summary.earnedToday > 0 && (
          <HeroLine>{COPY.parentEarnedToday(summary.earnedToday)}</HeroLine>
        )}
      </HeroPanel>

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
                  : pending}
            </span>
          </div>
          {a.below && summary && !a.problem && (
            <Safeguard tone="warn">{COPY.parentOverdraw(summary.balance)}</Safeguard>
          )}
          <Safeguard tone="info">{COPY.parentAdjustNotice}</Safeguard>
          <ReviewStep
            reviewing={reviewing && !!check?.ok && !!summary}
            review={{
              label: a.amount !== null ? COPY.parentReview(a.amount) : COPY.parentReviewPlain,
              onClick: a.review,
              disabled: !check?.ok,
            }}
            confirm={{ onConfirm: a.confirm, onBack: a.back, saving: a.saving }}
          >
            {check?.ok && summary && (
              <p>
                {COPY.parentReviewLine(
                  a.removing,
                  Math.abs(check.amount),
                  summary.balance,
                  check.after,
                  check.note,
                )}
              </p>
            )}
          </ReviewStep>
          {a.notice && (
            <Safeguard tone="info" role="status">
              {a.notice}
            </Safeguard>
          )}
          {a.problem && (
            <Safeguard tone="warn" role="alert">
              {a.problem}
            </Safeguard>
          )}
          <p className="parent-note">{COPY.parentAdjustFootnote}</p>
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
                      <p className="parent-note">
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
          {log?.length === LIST_LIMIT && <p className="parent-note">{COPY.parentLatest(LIST_LIMIT)}</p>}
        </section>
      </div>
    </div>
  )
}
