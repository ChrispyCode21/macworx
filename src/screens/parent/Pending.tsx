import { COPY } from '../../copy'

/** What stands in for a number or list that has not arrived: "Loading…", or once a read has failed, the plain words (SPEC §5.3). */
export function Pending({ failed }: { failed: boolean }) {
  return <span className="parent-pending">{failed ? COPY.parentUnavailable : COPY.parentLoading}</span>
}
