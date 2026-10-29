import { Fragment } from 'react'
import { COPY } from '../../copy'
import { RewardIcon } from '../../components/RewardIcon'
import { REWARDS } from '../../engine'
import { CoinsIcon, PencilIcon, PlusIcon, ShieldCheckIcon, TicketCheckIcon } from '../../parent/icons'
import { reachOf } from '../../parent/shop'
import { Button } from '../../ui/Button'
import { formatNumber } from '../../ui/format'
import { TextField } from '../../ui/TextField'

interface Props {
  /** The chosen child's name, or null when no child is known. */
  name: string | null
  /** Her balance, or null before it arrives. */
  balance: number | null
  /** A call has failed: the balance shows a dash instead of "Loading…". */
  problem: boolean
}

/**
 * The Shop screen (SPEC §5.3), read-only: the rewards of §6.7, an edit panel with every control disabled,
 * and an empty "Last redeemed". It stores nothing; there is no rewards or purchases table.
 */
export function Shop({ name, balance, problem }: Props) {
  const { rewards, withinCount } = reachOf(balance)
  const first = REWARDS[0]
  const heading = name ? COPY.parentShopHeading(name) : COPY.parentShopHeadingPlain

  return (
    <div className="shop">
      {name && (
        <div className="shop-summary">
          <CoinsIcon size={20} />
          <div className="shop-summary-text">
            <p className="shop-summary-title">
              {balance === null
                ? problem
                  ? COPY.parentNoValue
                  : COPY.parentLoading
                : COPY.parentShopSummary(name, balance)}
            </p>
            {withinCount !== null && <p className="shop-summary-meta">{COPY.parentShopReach(withinCount)}</p>}
          </div>
        </div>
      )}

      <div className="shop-block shop-block-rewards">
        <div className="shop-heading">
          <h2>{heading}</h2>
          <span className="shop-action">{COPY.parentShopActive(REWARDS.length)}</span>
        </div>
        <section className="parent-section shop-rewards" aria-label={heading}>
          {rewards.map(({ reward, within, short }, i) => (
            <Fragment key={reward.id}>
              {i > 0 && <hr className="shop-divider" />}
              <div className="shop-row">
                <span className="shop-tile">
                  <RewardIcon id={reward.id} size={24} />
                </span>
                <div className="shop-detail">
                  <p className="shop-name">{reward.name}</p>
                  <p className={within ? 'shop-price shop-price-within' : 'shop-price'}>
                    {balance === null
                      ? COPY.parentShopPrice(reward.price)
                      : COPY.parentShopPriceLine(
                          COPY.parentShopPrice(reward.price),
                          within ? COPY.parentShopWithin : COPY.parentShopMore(short),
                        )}
                  </p>
                </div>
                <Button variant="bare" disabled aria-label={COPY.parentShopEdit(reward.name)}>
                  <PencilIcon size={17} />
                </Button>
              </div>
            </Fragment>
          ))}
          <Button variant="secondary" disabled>
            <PlusIcon size={18} />
            {COPY.parentShopAdd}
          </Button>
        </section>
      </div>

      <div className="shop-block shop-block-editor">
        <div className="shop-heading">
          <h2>{COPY.parentShopEditorHeading}</h2>
          <span className="shop-chip-warn">{COPY.parentShopReadOnly}</span>
        </div>
        <section className="parent-section shop-editor" aria-label={COPY.parentShopEditorHeading}>
          <TextField label={COPY.parentShopNameLabel} defaultValue={first.name} disabled />
          <TextField label={COPY.parentShopDescriptionLabel} defaultValue="" disabled />
          <TextField
            label={COPY.parentShopPriceLabel}
            defaultValue={formatNumber(first.price)}
            unit={COPY.parentShopUnit}
            inputMode="numeric"
            disabled
          />
          <p className="shop-notice">
            <ShieldCheckIcon size={17} />
            <span>{COPY.parentShopComingSoon}</span>
          </p>
          <Button variant="primary" disabled>
            {COPY.parentShopSave}
          </Button>
          <div className="shop-actions">
            <Button variant="secondary" disabled>
              {COPY.parentShopDiscard}
            </Button>
            <Button variant="danger" disabled>
              {COPY.parentShopRemove}
            </Button>
          </div>
          <p className="shop-footnote">{COPY.parentShopFootnote}</p>
        </section>
      </div>

      <section className="shop-redeemed" aria-label={COPY.parentShopRedeemedLabel}>
        <TicketCheckIcon size={19} />
        <p className="shop-redeemed-title">{COPY.parentShopNoRedeemed}</p>
      </section>
    </div>
  )
}
