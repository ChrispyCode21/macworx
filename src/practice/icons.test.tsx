import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  CoinsIcon,
  DeleteIcon,
  FlameIcon,
  PlayIcon,
  ShoppingBagIcon,
  SproutIcon,
  Volume2Icon,
} from './icons'

// docs/DESIGN-PRACTICE.md §16: name, component, viewBox, default size.
const ICONS = [
  ['Sprout', SproutIcon, 25, 25],
  ['Coins', CoinsIcon, 20, 20],
  ['Flame', FlameIcon, 20, 20],
  ['ShoppingBag', ShoppingBagIcon, 20, 20],
  ['Check', CheckIcon, 17, 20],
  ['ArrowLeft', ArrowLeftIcon, 18, 18],
  ['ArrowRight', ArrowRightIcon, 20, 20],
  ['Delete', DeleteIcon, 27, 27],
  ['Play', PlayIcon, 40, 40],
  ['Volume2', Volume2Icon, 18, 18],
  ['BookOpen', BookOpenIcon, 24, 24],
] as const

describe('the practice icons', () => {
  it.each(ICONS)('%s is a decorative stroke icon at stroke 1.8', (_name, Icon, box, size) => {
    const html = renderToStaticMarkup(<Icon />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain(`viewBox="0 0 ${box} ${box}"`)
    expect(html).toContain(`width="${size}"`)
    expect(html).toContain(`height="${size}"`)
    expect(html).toContain('stroke="currentColor"')
    expect(html).toContain('stroke-width="1.8"')
    expect(html).toContain('fill="none"')
    expect(html).toContain('<path')
  })

  it('scales by width and height, never the viewBox', () => {
    const html = renderToStaticMarkup(<CheckIcon size={22} />)
    expect(html).toContain('width="22"')
    expect(html).toContain('viewBox="0 0 17 17"')
  })
})
