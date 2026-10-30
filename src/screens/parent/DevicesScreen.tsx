import type { ReactNode } from 'react'
import { COPY } from '../../copy'
import type { Device } from '../../parent/api'
import {
  TabletIcon,
  PencilIcon,
  UnlinkIcon,
  PlusIcon,
  ScanLineIcon,
  ShieldCheckIcon,
} from '../../parent/icons'
import { deviceBrowserLine, deviceStatus } from '../../parent/placeholders'
import { Button } from '../../ui/Button'
import { formatClock, formatCode, formatDay, isSameLocalDay } from '../../ui/format'
import { TextField } from '../../ui/TextField'

interface Props {
  /** Every device of the chosen child, unpaired ones too; null before they arrive. */
  devices: Device[] | null
  /** What shows in place of the list when it could not be loaded. */
  unavailable: ReactNode
  onUnpair: (device: Device) => void
  name: string
  maxName: number
  onName: (name: string) => void
  making: boolean
  onMakeCode: () => void
  code: { code: string } | null
  /** Whole minutes left on the code. */
  left: number
  /** The chosen child's name; null when the children could not be loaded. */
  childName: string | null
  /** Her numbers from the summary; null until it arrives. */
  balance: number | null
  streak: number | null
}

/** A device's last sync: today's time, another day's date, or none yet. */
function syncedLine(iso: string | null, now: Date): string {
  if (iso === null) return COPY.parentNoResultsYet
  return isSameLocalDay(iso, now)
    ? COPY.parentSyncedToday(formatClock(iso))
    : COPY.parentSyncedOn(formatDay(iso))
}

/** The Devices tab (SPEC §5.3): a card per connected device, then Pair a device and the notes. */
export function DevicesScreen({
  devices,
  unavailable,
  onUnpair,
  name,
  maxName,
  onName,
  making,
  onMakeCode,
  code,
  left,
  childName,
  balance,
  streak,
}: Props) {
  const connected = devices?.filter((d) => d.revokedAt === null) ?? []
  const now = new Date()
  return (
    <div className="devices">
      <div className="devices-left">
        {devices === null && unavailable}
        {devices && (
          <div className="device-count">
            <span className="device-chip device-chip-soft">
              {COPY.parentConnectedCount(connected.length)}
            </span>
            <p className="device-meta">{COPY.parentSyncsAcross}</p>
          </div>
        )}
        {devices && connected.length === 0 && <p>{COPY.parentNoDevices}</p>}
        <ul className="device-list">
          {connected.map((d) => (
            <li key={d.id} className="parent-section device-card">
              <div className="device-identity">
                <span className="device-tile">
                  <TabletIcon size={25} />
                </span>
                <div className="device-detail">
                  <p className="device-name">{d.label}</p>
                  <p className="device-meta">{COPY.parentAddedOn(formatDay(d.createdAt))}</p>
                  <p className="device-meta">
                    {deviceBrowserLine(d)} <span className="device-sample">{COPY.parentSample}</span>
                  </p>
                </div>
                <Button variant="bare" disabled aria-label={COPY.parentRenameDevice(d.label)}>
                  <PencilIcon size={17} />
                </Button>
              </div>
              <div className="device-connection">
                <span>
                  <span
                    className={
                      deviceStatus(d) === 'online'
                        ? 'device-chip device-chip-soft'
                        : 'device-chip device-chip-warn'
                    }
                  >
                    {deviceStatus(d) === 'online' ? COPY.parentStatusOnline : COPY.parentStatusOffline}
                  </span>{' '}
                  <span className="device-sample">{COPY.parentSample}</span>
                </span>
                <p className="device-meta">{syncedLine(d.lastResultAt, now)}</p>
              </div>
              <hr className="shop-divider" />
              <div className="device-actions">
                <Button variant="soft" disabled>
                  {COPY.parentViewDetails}
                </Button>
                <Button
                  variant="danger"
                  aria-label={COPY.parentUnpairDevice(d.label)}
                  onClick={() => onUnpair(d)}
                >
                  <UnlinkIcon size={18} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="devices-right">
        <h2 className="devices-heading">{COPY.parentPairSection}</h2>
        <section className="parent-section pair-panel">
          <div className="pair-intro">
            <span className="pair-intro-icon">
              <ScanLineIcon size={24} />
            </span>
            <div className="pair-intro-text">
              <p className="pair-title">{COPY.parentPairTitle}</p>
              <p className="pair-body">{COPY.parentPairBody(childName)}</p>
            </div>
          </div>
          <TextField
            label={COPY.parentNameLabel}
            hint={COPY.parentNameHint}
            value={name}
            maxLength={maxName}
            onChange={(e) => onName(e.target.value)}
          />
          <Button onClick={onMakeCode} disabled={making}>
            <PlusIcon size={18} />
            {COPY.parentMakeCode}
          </Button>
          {code && (
            <div className="parent-code" aria-live="polite">
              {left > 0 ? (
                <>
                  <p className="parent-code-digits">{formatCode(code.code)}</p>
                  <p>{COPY.parentCodeExpires(left)}</p>
                </>
              ) : (
                <p>{COPY.parentCodeRanOut}</p>
              )}
            </div>
          )}
          <p className="pair-footnote">{COPY.parentCodeFootnote}</p>
        </section>

        <h2 className="devices-heading">{COPY.parentDisconnectHeading}</h2>
        {childName !== null && balance !== null && streak !== null && (
          <p className="safeguard safeguard-info">
            <ShieldCheckIcon size={17} />
            <span>{COPY.parentDisconnectSafe(childName, balance, streak)}</span>
          </p>
        )}
        <p className="pair-footnote pair-note">{COPY.parentDisconnectNote}</p>

        <div className="access-card">
          <ShieldCheckIcon size={20} />
          <div className="access-text">
            <p className="access-title">{COPY.parentAccessTitle}</p>
            <p className="access-body">{COPY.parentAccessBody}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
