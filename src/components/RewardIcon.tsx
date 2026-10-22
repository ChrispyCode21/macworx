import type { CSSProperties, ReactNode } from 'react'
import type { RewardId } from '../engine'

// Flat shapes on a 64x64 grid, painted only with the colour tokens (index.css).
const line = {
  stroke: 'var(--ink)',
  strokeWidth: 3,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const
const accent: CSSProperties = { ...line, fill: 'var(--accent)' }
const soft: CSSProperties = { ...line, fill: 'var(--soft)' }
const paper: CSSProperties = { ...line, fill: 'var(--paper)' }
const ink: CSSProperties = { fill: 'var(--ink)' }
const stroke: CSSProperties = { ...line, fill: 'none' }

const ICONS: Record<RewardId, ReactNode> = {
  'ice-cream': (
    <>
      <path d="M20 30 L32 58 L44 30 Z" style={soft} />
      <path d="M26 41 L38 41 M29 49 L35 49" style={stroke} />
      <circle cx="32" cy="22" r="12" style={accent} />
      <circle cx="32" cy="9" r="3.5" style={paper} />
    </>
  ),
  'pet-store': (
    <>
      <rect x="10" y="30" width="44" height="26" style={soft} />
      <path d="M6 30 L11 12 H53 L58 30 Z" style={accent} />
      <path d="M6 30 q6 8 13 0 q6 8 13 0 q6 8 13 0 q6 8 13 0" style={accent} />
      <rect x="26" y="40" width="12" height="16" style={paper} />
      <rect x="14" y="38" width="8" height="8" style={paper} />
      <rect x="42" y="38" width="8" height="8" style={paper} />
    </>
  ),
  camping: (
    <>
      <path d="M4 56 H60" style={stroke} />
      <path d="M32 10 L56 56 H8 Z" style={accent} />
      <path d="M32 10 L32 56 M32 56 L22 56 L32 30 L42 56 Z" style={soft} />
      <path d="M32 10 L28 5 M32 10 L36 5" style={stroke} />
    </>
  ),
  puppy: (
    <>
      <path d="M14 14 Q6 16 8 36 Q10 42 18 36 Z" style={accent} />
      <path d="M50 14 Q58 16 56 36 Q54 42 46 36 Z" style={accent} />
      <circle cx="32" cy="32" r="20" style={soft} />
      <ellipse cx="32" cy="42" rx="11" ry="8" style={paper} />
      <ellipse cx="32" cy="38" rx="4" ry="3" style={ink} />
      <circle cx="23" cy="28" r="2.5" style={ink} />
      <circle cx="41" cy="28" r="2.5" style={ink} />
      <path d="M32 41 V44 M27 45 Q32 49 37 45" style={stroke} />
    </>
  ),
}

/** A reward's picture. Decorative: the shop shows the reward's name beside it. */
export function RewardIcon({ id, size = 64 }: { id: RewardId; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" data-reward={id}>
      {ICONS[id]}
    </svg>
  )
}
