import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { COPY } from '../../copy'
import { chooseChild, getChildren } from '../../parent/api'
import type { Child } from '../../parent/api'
import {
  ChevronsUpDownIcon,
  CoinsIcon,
  FlameIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  SproutIcon,
} from '../../parent/icons'
import { TABS, tabFromPath, tabPath } from '../../parent/route'
import type { Tab } from '../../parent/route'
import { pickChild, readSelectedChild, rememberChild } from '../../parent/selection'
import { Button } from '../../ui/Button'
import { formatLongDay } from '../../ui/format'
import { ParentPage } from './ParentPage'

const NAV: Record<Tab, { label: string; icon: (size: number) => ReactNode }> = {
  overview: { label: COPY.parentTabOverview, icon: (size) => <LayoutDashboardIcon size={size} /> },
  points: { label: COPY.parentTabMacaronis, icon: (size) => <CoinsIcon size={size} /> },
  streak: { label: COPY.parentTabStreak, icon: (size) => <FlameIcon size={size} /> },
  devices: { label: COPY.parentTabDevices, icon: (size) => <SmartphoneIcon size={size} /> },
  shop: { label: COPY.parentTabShop, icon: (size) => <ShoppingBagIcon size={size} /> },
}

const EYEBROW: Record<Tab, string> = {
  overview: COPY.parentEyebrowOverview,
  points: COPY.parentEyebrowMacaronis,
  streak: COPY.parentEyebrowStreak,
  devices: COPY.parentEyebrowDevices,
  shop: COPY.parentEyebrowShop,
}

/** The page title and subline of a tab. With no child known yet there is no name to show: the tab's label. */
function heading(tab: Tab, child: Child | null): { title: string; sub: string | null } {
  if (!child) return { title: NAV[tab].label, sub: null }
  const name = child.name
  switch (tab) {
    case 'overview':
      return {
        title: COPY.parentTitleOverview,
        sub: COPY.parentSubOverview(formatLongDay(new Date()), name),
      }
    case 'points':
      return { title: COPY.parentTitleMacaronis, sub: COPY.parentSubMacaronis(name) }
    case 'streak':
      return { title: COPY.parentTitleStreak, sub: COPY.parentSubStreak(name) }
    case 'devices':
      return { title: COPY.parentTitleDevices(name), sub: COPY.parentSubDevices(name) }
    case 'shop':
      return { title: COPY.parentTitleShop, sub: COPY.parentSubShop(name) }
  }
}

type Load =
  | { status: 'loading' }
  // The children couldn't be listed: the screens show today's refusal themselves.
  | { status: 'unavailable' }
  | { status: 'ready'; children: Child[]; selected: Child }

function Avatar({ child }: { child: Child }) {
  return (
    <span className="portal-avatar" aria-hidden="true">
      {child.initials}
    </span>
  )
}

function Who({ child }: { child: Child }) {
  return (
    <span className="portal-who">
      <span className="portal-who-name">{child.name}</span>
      <span className="portal-who-sub">
        {child.grade ? COPY.parentSwitcherSub(child.grade) : COPY.parentChildProfile}
      </span>
    </span>
  )
}

/** The parent portal (SPEC §5.3): the shell, the five tabs, and the child every screen is for. */
export function Portal() {
  const [tab, setTab] = useState<Tab>(() => tabFromPath(location.pathname))
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [open, setOpen] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const onPop = () => setTab(tabFromPath(location.pathname))
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    let live = true
    void getChildren().then((result) => {
      if (!live) return
      // The page is reloading for Access to sign in again: show nothing, not a refusal in the meantime.
      if (!result.ok && result.error === 'reloading') return
      const picked = result.ok ? pickChild(result.body.children, readSelectedChild()) : null
      if (!result.ok || !picked) return setLoad({ status: 'unavailable' })
      // Before the screens mount, so their first reads are for this child.
      chooseChild(picked.id)
      setLoad({ status: 'ready', children: result.body.children, selected: picked })
    })
    return () => {
      live = false
    }
  }, [])

  const go = (next: Tab) => {
    if (next === tab) return
    history.pushState(null, '', tabPath(next))
    setTab(next)
    window.scrollTo(0, 0)
    title.current?.focus()
  }
  const onNav = (next: Tab) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(next)
  }

  const choose = (child: Child) => {
    if (load.status !== 'ready') return
    chooseChild(child.id)
    rememberChild(child.id)
    setLoad({ ...load, selected: child })
    setOpen(false)
  }

  const child = load.status === 'ready' ? load.selected : null
  const { title: pageTitle, sub } = heading(tab, child)

  return (
    <div className="parent portal">
      <header className="portal-header">
        <span className="portal-brand">
          <SproutIcon size={25} />
          {COPY.parentBrand}
        </span>
        <span className="portal-chip">{COPY.parentSpace}</span>
      </header>

      <div className="portal-side">
        <span className="portal-brand portal-brand-side">
          <SproutIcon size={27} />
          {COPY.parentBrand}
        </span>

        {load.status === 'ready' && (
          <div className="portal-switcher" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
            <Button
              variant="bare"
              aria-expanded={open}
              aria-controls="portal-children"
              onClick={() => setOpen(!open)}
            >
              <Avatar child={load.selected} />
              <Who child={load.selected} />
              <ChevronsUpDownIcon size={17} />
            </Button>
            {open && (
              <ul id="portal-children" aria-label={COPY.parentSwitcherLabel}>
                {load.children.map((c) => (
                  <li key={c.id}>
                    <Button
                      variant="bare"
                      aria-current={c.id === load.selected.id ? 'true' : undefined}
                      onClick={() => choose(c)}
                    >
                      <Avatar child={c} />
                      <Who child={c} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <nav className="portal-nav" aria-label={COPY.parentNavLabel}>
          {TABS.map((t) => (
            <a key={t} href={tabPath(t)} aria-current={t === tab ? 'page' : undefined} onClick={onNav(t)}>
              <span className="portal-nav-icon">{NAV[t].icon(22)}</span>
              {NAV[t].label}
            </a>
          ))}
        </nav>

        <div className="portal-assurance">
          <span className="portal-chip">{COPY.parentSpace}</span>
          <p>
            <LockKeyholeIcon size={15} />
            {COPY.parentAssurance}
          </p>
        </div>
      </div>

      <div className="portal-content">
        <div className="portal-heading">
          <p className="portal-eyebrow">{EYEBROW[tab]}</p>
          <h1 ref={title} tabIndex={-1}>
            {pageTitle}
          </h1>
          {sub && <p className="portal-sub">{sub}</p>}
        </div>
        <main className="portal-main">
          {load.status === 'ready' && <ParentPage key={load.selected.id} tab={tab} />}
          {load.status === 'unavailable' && <ParentPage key="none" tab={tab} />}
        </main>
        {tab === 'overview' && (
          <p className="portal-note">
            <LockKeyholeIcon size={13} />
            {COPY.parentAssurance}
          </p>
        )}
      </div>
    </div>
  )
}
