/** The portal's five tabs and their addresses (SPEC §5.3). Pure, so it is tested without a browser. */
export type Tab = 'overview' | 'points' | 'streak' | 'devices' | 'shop'

/** In navigation order. */
export const TABS: readonly Tab[] = ['overview', 'points', 'streak', 'devices', 'shop']

export const tabPath = (tab: Tab): string => `/parent/${tab}`

/** The tab an address shows: `/parent/<tab>` exactly, and Overview for anything else. */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return TABS.find((tab) => tabPath(tab) === path) ?? 'overview'
}
