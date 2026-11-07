import type { MouseEventHandler, ReactNode } from 'react'

/**
 * A parent screen's section heading (docs/DESIGN.md §7 and §4, "section-title"). With an `action` it is a row:
 * the title, then the action (a `HeadingAction`, or a chip). Alone it is just the title.
 */
type Props = {
  id?: string
  action?: ReactNode
  children: ReactNode
}

export function SectionHeading({ id, action, children }: Props) {
  const title = (
    <h2 id={id} className="parent-heading">
      {children}
    </h2>
  )
  if (!action) return title
  return (
    <div className="parent-heading-row">
      {title}
      {action}
    </div>
  )
}

/** The small text at the end of a heading row: a link or count in the accent colour, or `muted` plain text. */
type ActionProps = { muted?: boolean; children: ReactNode } & (
  { href: string; onClick?: MouseEventHandler<HTMLAnchorElement> } | { href?: undefined; onClick?: undefined }
)

export function HeadingAction({ muted, href, onClick, children }: ActionProps) {
  const className = muted ? 'parent-heading-action parent-heading-muted' : 'parent-heading-action'
  if (href)
    return (
      <a className={className} href={href} onClick={onClick}>
        {children}
      </a>
    )
  return <span className={className}>{children}</span>
}
