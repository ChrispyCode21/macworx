import { COPY } from '../copy'
import { LockKeyholeIcon, SproutIcon } from '../practice/icons'
import { Button } from '../ui/Button'

/**
 * Home's top bar (SPEC §5.1 step 1): the mark and name, then Home, Shop and Parents. The mix screen uses it too
 * (step 2), with `onHome` making its Home link a button back to Home; on Home itself Home is the current page.
 */
export function HomeBar({ onHome }: { onHome?: () => void }) {
  return (
    <header className="home-bar">
      <div className="home-brand">
        <SproutIcon size={26} />
        <span>{COPY.title}</span>
      </div>
      <nav className="home-nav" aria-label={COPY.homeNavLabel}>
        {onHome ? (
          <Button variant="home-nav" onClick={onHome}>
            {COPY.homeNavHome}
          </Button>
        ) : (
          <span className="home-nav-item home-nav-current" aria-current="page">
            {COPY.homeNavHome}
          </span>
        )}
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
  )
}
