import type { ReactNode } from 'react'
import { COPY } from '../../copy'
import type { Summary } from '../../parent/api'
import { CalendarCheckIcon, CheckIcon, FlameIcon } from '../../parent/icons'
import { personalBestStreak } from '../../parent/placeholders'
import { formatRange, monthName, previewText, streakRange, weekStrip } from '../../parent/streakDays'
import { streakFields } from '../../parent/streakForm'
import { HeroLine, HeroNumber, HeroPanel, HeroRow, HeroUnit } from '../../ui/HeroPanel'
import { ReviewStep } from '../../ui/ReviewStep'
import { Safeguard } from '../../ui/Safeguard'
import { formatCalendarDay, formatNumber } from '../../ui/format'
import { TextField } from '../../ui/TextField'
import { HeadingAction, SectionHeading } from '../../ui/SectionHeading'
import { Panel } from '../../ui/Panel'
import type { StreakFormState } from './useStreakForm'

interface Props {
  /** Her numbers; null until they arrive. */
  summary: Summary | null
  /** The days of the last seven with a finished result; null until they arrive. */
  days: string[] | null
  /** True once a read has failed. */
  problem: boolean
  /** The parent's calendar day, YYYY-MM-DD. */
  today: string
  form: StreakFormState
  /** What shows in place of a number that has not arrived. */
  pending: ReactNode
}

/** The Streak tab (SPEC §5.3, docs/DESIGN.md §11): her streak, the last 7 days, and the correction form. */
export function StreakScreen({ summary, days, problem, today, form, pending }: Props) {
  const reviewing = form.step === 'review'
  const fields = streakFields(form.streakText, form.dayText)
  const heroRange = summary ? streakRange(summary.streak, summary.lastDay, 7) : null
  const preview = summary ? previewText(summary.streak, form.streakText, form.dayText) : null

  return (
    <div className="streak">
      <HeroPanel variant="streak" label={COPY.parentStreakHeroLabel} icon={<FlameIcon size={21} />}>
        <HeroRow>
          <HeroNumber>{summary ? formatNumber(summary.streak) : pending}</HeroNumber>
          {summary && <HeroUnit>{COPY.parentStreakHeroUnit(summary.streak)}</HeroUnit>}
        </HeroRow>
        {heroRange && <HeroLine>{formatRange(heroRange.start, heroRange.end)}</HeroLine>}
        <div className="streak-hero-details">
          <span className="streak-hero-best">
            {COPY.parentStreakBest(personalBestStreak)}{' '}
            <span className="device-sample">{COPY.parentSample}</span>
          </span>
          {summary?.lastDay === today && <span className="streak-hero-today">{COPY.parentStreakToday}</span>}
        </div>
      </HeroPanel>

      <div className="streak-week">
        <SectionHeading action={<HeadingAction muted>{monthName(today)}</HeadingAction>}>
          {COPY.parentStreakWeekHeading}
        </SectionHeading>
        <Panel>
          {days === null ? (
            <p>{problem ? COPY.parentUnavailable : COPY.parentLoading}</p>
          ) : (
            <ol className="streak-days">
              {weekStrip(today, days).map((tile) => (
                <li key={tile.day} className="streak-day">
                  <span className="streak-weekday">{tile.weekday}</span>
                  <span className={`streak-tile streak-tile-${tile.state}`}>{tile.date}</span>
                  <span className="streak-check">
                    {tile.check && (
                      <>
                        <CheckIcon size={12} />
                        <span className="visually-hidden">{COPY.parentStreakCounted}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="parent-note">{COPY.parentStreakWeekFoot}</p>
        </Panel>
      </div>

      <div className="streak-correct">
        <SectionHeading>{COPY.parentStreakCorrectHeading}</SectionHeading>
        <Panel>
          <TextField
            label={COPY.parentStreakLengthLabel}
            hint={COPY.parentStreakHint}
            unit={COPY.parentStreakUnit}
            inputMode="numeric"
            value={form.streakText}
            disabled={reviewing || !summary}
            onChange={(e) => form.setStreakText(e.target.value)}
          />
          <TextField
            label={COPY.parentLastDayLabel}
            hint={COPY.parentLastDayHint}
            type="date"
            value={form.dayText}
            disabled={reviewing || !summary}
            onChange={(e) => form.setDayText(e.target.value)}
          />
          {preview && (
            <p className="streak-preview">
              <CalendarCheckIcon size={18} />
              <span>{preview}</span>
            </p>
          )}
          <Safeguard tone="warn">{COPY.parentStreakWarn}</Safeguard>
          <ReviewStep
            reviewing={reviewing && !!summary && !!fields}
            review={{ label: COPY.parentStreakReview, onClick: form.review, disabled: !summary }}
            confirm={{ onConfirm: form.confirm, onBack: form.back, saving: form.saving }}
            heading={COPY.parentStreakReviewHeading}
          >
            {summary && fields && (
              <>
                <p>{COPY.parentStreakChangeLength(summary.streak, fields.streak)}</p>
                <p>
                  {COPY.parentStreakChangeDay(
                    summary.lastDay ? formatCalendarDay(summary.lastDay) : COPY.parentNoLastDay,
                    fields.lastDay ? formatCalendarDay(fields.lastDay) : COPY.parentNoLastDay,
                  )}
                </p>
              </>
            )}
          </ReviewStep>
          {form.saved && (
            <Safeguard tone="info" icon={<CheckIcon size={17} />} role="status">
              {COPY.parentStreakSaved}
            </Safeguard>
          )}
          {form.problem && (
            <Safeguard tone="warn" role="alert">
              {form.problem}
            </Safeguard>
          )}
          <p className="parent-note">{COPY.parentStreakFoot}</p>
        </Panel>
      </div>
    </div>
  )
}
