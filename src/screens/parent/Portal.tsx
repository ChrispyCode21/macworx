import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { COPY } from '../../copy'
import { chooseChild, getChildren } from '../../parent/api'
import type { Child } from '../../parent/api'
import {
  ChevronsUpDownIcon,
  CoinsIcon,
  FlameIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  PlusIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  SproutIcon,
} from '../../parent/icons'
import { TABS, tabFromPath, tabPath } from '../../parent/route'
import type { Tab } from '../../parent/route'
import { pickChild, readSelectedChild, rememberChild } from '../../parent/selection'
import { Button } from '../../ui/Button'
import { formatLongDay } from '../../ui/format'
import { ChildForm } from './ChildForm'
import type { ChildMode } from './ChildForm'
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
  const [childMode, setChildMode] = useState<ChildMode>('add')
  const [focusName, setFocusName] = useState(false)
  const [renames, setRenames] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

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
    setOpen(false)
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
    // The row that had focus is gone: focus goes back to the button that opened the list.
    trigger.current?.focus()
  }

  // Opens Overview's Children panel in a mode, with the Name box focused (the list is a way in to it).
  const showForm = (mode: ChildMode) => {
    setChildMode(mode)
    setFocusName(true)
    setOpen(false)
    if (tab !== 'overview') {
      history.pushState(null, '', tabPath('overview'))
      setTab('overview')
      window.scrollTo(0, 0)
    }
  }
  const renameRow = (child: Child) => {
    if (load.status !== 'ready') return
    chooseChild(child.id)
    rememberChild(child.id)
    setLoad({ ...load, selected: child })
    showForm('rename')
  }
  const onAdded = (child: Child) => {
    // Called after an await, so it updates from the latest state, not the render where Save was pressed.
    chooseChild(child.id)
    rememberChild(child.id)
    setLoad((l) => (l.status !== 'ready' ? l : { ...l, children: [...l.children, child], selected: child }))
    setChildMode('add')
    title.current?.focus()
  }
  const onRenamed = (child: Child) => {
    // Called after an await: a functional update keeps a child switched to meanwhile.
    setLoad((l) =>
      l.status !== 'ready'
        ? l
        : {
            ...l,
            children: l.children.map((c) => (c.id === child.id ? child : c)),
            selected: l.selected.id === child.id ? child : l.selected,
          },
    )
    // The page reads again, so the activity log shows the rename.
    setRenames((n) => n + 1)
    trigger.current?.focus()
  }

  const onSwitcherKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return
    setOpen(false)
    trigger.current?.focus()
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
          <div className="portal-switcher" onKeyDown={onSwitcherKey}>
            <Button
              ref={trigger}
              variant="bare"
              aria-expanded={open}
              aria-controls={open ? 'portal-children' : undefined}
              onClick={() => setOpen(!open)}
            >
              <Avatar child={load.selected} />
              <Who child={load.selected} />
              <ChevronsUpDownIcon size={17} />
            </Button>
            {open && (
              <ul id="portal-children" aria-label={COPY.parentSwitcherLabel}>
                {load.children.map((c) => (
                  <li key={c.id} className="portal-child-row">
                    <Button
                      variant="bare"
                      aria-current={c.id === load.selected.id ? 'true' : undefined}
                      onClick={() => choose(c)}
                    >
                      <Avatar child={c} />
                      <Who child={c} />
                    </Button>
                    <Button
                      variant="bare"
                      aria-label={COPY.parentSwitcherRenameLabel(c.name)}
                      onClick={() => renameRow(c)}
                    >
                      {COPY.parentSwitcherRename}
                    </Button>
                  </li>
                ))}
                <li className="portal-add-row">
                  <Button variant="bare" onClick={() => showForm('add')}>
                    <PlusIcon size={18} />
                    {COPY.parentSwitcherAdd}
                  </Button>
                </li>
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
          {load.status === 'ready' && (
            <ParentPage key={`${load.selected.id}-${renames}`} tab={tab} childName={load.selected.name} />
          )}
          {load.status === 'ready' && tab === 'overview' && (
            <ChildForm
              mode={childMode}
              onMode={setChildMode}
              child={load.selected}
              focusName={focusName}
              onFocused={() => setFocusName(false)}
              onAdded={onAdded}
              onRenamed={onRenamed}
            />
          )}
          {load.status === 'unavailable' && <ParentPage key="none" tab={tab} childName={null} />}
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
