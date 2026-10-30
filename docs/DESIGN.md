# Parent portal design contract

Read this whole file before building any `/parent/*` screen. It replaces SPEC §5.3's "plain, lightweight admin page" (owner decision, milestone v0.5.0, issue #76). The builder cannot see Figma; this file and the PNGs in `docs/design/` are the design.

## Contents

1. [How to use this contract](#1-how-to-use-this-contract)
2. [Build constraints](#2-build-constraints)
3. [Units, spacing and radius scale](#3-units-spacing-and-radius-scale)
4. [Type scale](#4-type-scale)
5. [Color roles and tokens](#5-color-roles-and-tokens)
6. [Shared chrome](#6-shared-chrome)
7. [Shared components](#7-shared-components)
8. [Wide layout rules](#8-wide-layout-rules)
9. [Screen: Overview](#9-screen-overview) (`/parent/overview`)
10. [Screen: Macaronis](#10-screen-macaronis) (`/parent/points`)
11. [Screen: Streak](#11-screen-streak) (`/parent/streak`)
12. [Screen: Devices](#12-screen-devices) (`/parent/devices`)
13. [Screen: Shop](#13-screen-shop) (`/parent/shop`)
14. [Copy rules](#14-copy-rules)
15. [Data mapping](#15-data-mapping)
16. [Ambiguities and open questions](#16-ambiguities-and-open-questions)
17. [Icons](#17-icons)

## 1. How to use this contract

- Ten reference frames, in `docs/design/`: phone frames are 402 px wide (native), wide frames are 1194x834 (iPad landscape).
- The source Figma file is not linked here (the repo is public). The owner keeps its link in `FIGMA_URL` in `.env.local`, which git ignores and unattended runs don't have: build from this file and the PNGs, and treat the node ids below as names only.

| Screen | Phone PNG | Wide PNG | Phone node id | Wide node id |
|---|---|---|---|---|
| Overview | `overview-phone.png` | `overview-wide.png` | 4:2621 | 11:1759 |
| Macaronis | `points-phone.png` | `points-wide.png` | 4:2737 | 11:1907 |
| Streak | `streak-phone.png` | `streak-wide.png` | 4:2849 | 11:2041 |
| Devices | `devices-phone.png` | `devices-wide.png` | 4:2974 | 11:2195 |
| Shop | `shop-phone.png` | `shop-wide.png` | 4:3084 | 11:2334 |

- The PNGs are a layout reference only. They show a sample child, a green theme, the word "steadily", "points" and PIN wording. **Where a PNG and this file disagree on color, words or data, this file wins.** Recreate fonts, shapes, scaling and relative sizes exactly; recolor with section 5.
- A phone frame is built with the same markup as its wide frame: one DOM, two layouts (section 8).
- `{name}`, `{initials}`, `{grade}` are the selected child's data. Never hard-code a child's name. Phone and wide numbers below are `phone / wide` when they differ.
- "ink-link" = the `--p-accent-ink` role (text and icons that were Figma's primary green on light surfaces).
- Status bar (time, signal, battery) and home indicator (the 4 px bar) in the PNGs are device chrome. **Do not build them.**

## 2. Build constraints

These come from the repo's checks (`scripts/check-conventions.mjs`, CLAUDE.md). A parent screen that breaks one fails CI.

- All on-screen text lives in `src/copy.ts` (no words in JSX). Strings below are the final copy; `{x}` marks a value.
- Buttons are `<Button>` from `src/ui/Button.tsx`; extend it with a `parent` size/variant set (section 7) rather than a raw `<button>`. Text inputs reuse or extend `src/ui/TextField.tsx`.
- Numbers are formatted only through `src/ui/format.ts`.
- Colors are custom properties. A hex value appears only on a `--name: #hex;` line. No hex in any other CSS rule. Parent tokens are `--p-*`, defined under `.parent` (section 5).
- Never-negative wording (CLAUDE.md): `check-conventions` rejects wrong, fail*, incorrect, bad, lose, lost, penalty, mistake(s), oops in strings. Also avoid "missed" (owner rule).
- No PIN anywhere (decision 8). Confirmation is a plain "Review, then Confirm" step; Cloudflare Access is the sign-in.
- No new dependencies. Icons are inline SVG (like `RewardIcon`). Font is `system-ui` (Figma used Inter; do not load a webfont).
- No status bar, no home indicator, no iOS chrome.
- **Existing parent CSS superseded** (in `src/index.css`): `.parent` (max-width 1200, 0.8rem font), `.parent h1/h2/h3` sizes, `.parent-summary*`, `.parent-columns`, `.parent-side` and the 900 px media query. Replace them with the shell in section 6 and 8. Parent screens must not use `--size-*`, rem or em.
- **Parent buttons are 48 px tall.** Do not reuse `.button-primary` (88 px tall, 280 px min-width, 1.6rem) or `.button-secondary`. Child-app styles stay unchanged.
- Reachable by a visible link: the child app Home gets a visible link to `/parent/overview` (owner decision 2), in addition to typing the URL.

## 3. Units, spacing and radius scale

**All values in this file are CSS px, written as `px` in CSS.** `:root` sets `font-size: 24px` and `.parent` currently sets `0.8rem` (19.2 px), so rem/em would silently scale: forbid `rem` and `em` in parent CSS. Line heights are unitless (`1.45`) or `normal`. Letter-spacing: none (0) everywhere. Text color roles are in section 5.

| Scale | Values (px) |
|---|---|
| Spacing | 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 32 (use the exact value a frame gives; do not round) |
| Radius | 9 (segment option), 11 (completion tile), 12 (controls, soft panels, chips-in-rows, nav items, tiles), 14 (reward tile), 20 (panels and cards), 100 (pills, avatars) |
| Borders | 1 px `--p-divider` on panels, cards, inputs, dividers, bottom nav top edge, sidebar right edge. Hero panel: 1 px `--p-primary` |
| Shadows | none anywhere. Do not add shadows |
| Stroke | icons 1.7 (in each icon's own viewBox units) |
| Tap targets | buttons 48 high; icon buttons 44x44 (wide) / glyph only with 44 min hit area (phone); nav items 52 high |

## 4. Type scale

Font: `system-ui`. Weights: 400 and 600 only. Case: as written unless "upper". "upper" = `text-transform: uppercase`, copy stored in sentence case.

| Token | Phone px | Wide px | Weight | Line height | Case | Color role | Used for |
|---|---|---|---|---|---|---|---|
| wordmark | 23 | 25 | 400 | normal | as is | text-strong | "macworx" |
| chip | 11 | 11 | 600 | normal | upper only for PARENT SPACE | chip-ink / warn-ink | pills |
| eyebrow | n/a | 11 | 600 | normal | upper | accent-ink | wide page heading label |
| page-title | 29 (lh 1.45) | 30 (lh 1.25) | 400 | see col. | as is | text-strong | headline |
| page-sub | 13 | 13 | 400 | 1.45 | as is | text-muted | subline |
| section-title | 17 (lh 1.45) | 18 (lh normal, min-h 28) | 400 | see col. | as is | text-strong | section headings |
| section-action | 12 | 12 | 600 | normal | as is | accent-ink | "View all", "Full history", count |
| switcher-name | 14 | 13 | 400 | 1.45 | as is | text-strong | child name |
| switcher-sub | 11 | 10 | 400 | 1.45 | as is | text-muted | "{grade} · Child profile" |
| avatar | 13 | 12 | 400 | normal | upper | text-strong | initials |
| hero-label | 13 (Overview) / 12 (Macaronis) | same | 600 | 1.45 | upper | hero-muted | hero panel label |
| hero-number | 42 Overview / 44 Macaronis / 40 Streak | 44 / 48 / 44 | 600 | normal | n/a | hero-ink | big number |
| hero-unit | 14 Overview / 15 Macaronis | 14 / 15 | 400 | normal | as is | hero-muted | unit after number (baseline-aligned) |
| hero-line | 12 | 12 | 400 | 1.45 | as is | hero-muted | line under the number |
| stat-value | 26 | 30 | 400 | 1.45 / normal | as is | text-strong | stat card number |
| stat-label | 11 | 12 | 400 | 1.45 | as is | text-muted | stat card label |
| stat-link | 11 | 13 | 600 | 1.45 | as is | accent-ink | "Manage ... →" (the arrow is the text glyph U+2192) |
| row-eyebrow | 10 | 10 | 600 | 1.45 | upper | text-muted | list row label (only if data provides one) |
| row-title | 14 | 14 | 600 | 1.45 | as is | text-strong | list row title |
| row-meta | 11 | 11 | 400 | 1.45 | as is | text-muted | list row meta |
| row-amount | 12 | 13 | 600 | normal | as is | accent-ink (earned) / text-muted | "+30" right side |
| activity-title | 13 | 13 | 600 | 1.45 | as is | text-strong | Macaronis activity |
| activity-amount | 16 | 18 | 600 | normal | as is | accent-ink | "+30", uses U+2212 for minus |
| activity-balance | 10 | 10 | 400 | normal | as is | text-muted | "Balance 240" |
| field-label | 12 | 12 | 600 | 1.45 | as is | text-muted | form labels |
| field-input | 14 | 14 | 400 | 1.45 | as is | text-strong | input value |
| field-unit | 12 | 12 | 400 | normal | as is | text-muted | "Macaronis", "days" |
| preview-value | 19 | 18 | 400 | normal | as is | accent-ink | "Balance after adjustment" value |
| preview-label | 12 | 12 | 400 | 1.45 | as is | text-muted | |
| safeguard | 12 | 12 | 400 | 1.45 | as is | accent-ink (info) / warn-ink (warn) | notice text |
| footnote | 11 | 11 | 400 | 1.45 | as is | text-muted | under a button; "Before you disconnect" paragraph is 12 |
| button | 14 | 14 | 600 | normal | as is | see Buttons | all buttons |
| segment | 13 | 13 | 600 | normal | as is | accent-ink active / text-muted | Add / Remove |
| nav-label (phone) | 10 | n/a | 400 | normal | as is | accent-ink active / text-muted | bottom nav |
| nav-label (wide) | n/a | 14 | 600 active, 400 inactive | normal | as is | accent-ink / text-muted | sidebar nav |
| streak-weekday | 10 | 11 | 400 | normal | upper single letter | text-muted | W T F S S M T |
| streak-date | 12 | 14 | 600 | normal | as is | accent-ink / primary-ink | date in tile |
| device-name | 15 | 16 | 400 | 1.45 | as is | text-strong | device card |
| pair-title / pair-body | 15 600 / 12 400 | same | | 1.45 | as is | text-strong / text-muted | pairing card |
| access-title / access-body | 13 600 / 11 400 | same | | 1.45 | as is | text-strong / text-muted | Child access card |
| code-digits | 58 (existing `.parent-code-digits` 2.4rem at the 24 px root, now in px) | | 700 | normal | | text-strong | pairing code (no Figma frame; see Devices) |

## 5. Color roles and tokens

Figma's palette (greens, beige) is replaced by macworx mustards, yellows and whites. Every Figma role keeps its own token even where two values are close.

### 5.1 Role table

| Role | Figma hex (reference only) | Token | macworx value | Notes |
|---|---|---|---|---|
| Page background | `#f6f5f0` | `--p-bg` | `#fff6dc` (= `--paper`) | also input fill, segment track |
| Surface | `#ffffff` | `--p-surface` | `#ffffff` | panels, cards, sidebar, bottom nav |
| Divider and border | `#e0e5dd` | `--p-divider` | `#efdba5` | 1 px lines, panel and input borders |
| Primary (fill) | `#275d48` | `--p-primary` | `#f2a516` (= `--accent`) | hero panel, primary button, today tile |
| Primary ink (on primary) | `#ffffff` | `--p-primary-ink` | `#3b2a05` (= `--ink`) | text and icons on primary |
| Hero muted text | `#c8dbce` | `--p-hero-muted` | `#5a3f08` | muted text on primary |
| Hero track | `#51806a` | `--p-hero-track` | `#c98a10` | progress track (not used on Overview, see 9) |
| Hero fill | `#d9e8c3` | `--p-hero-fill` | `#3b2a05` | progress fill (not used on Overview) |
| Accent ink | `#275d48` as text | `--p-accent-ink` | `#8a5a00` (= `--answer-ink`) | links, active nav, values, icons on light |
| Chip and soft fill | `#e7eee6` | `--p-chip` | `#fde9b8` (= `--soft`) | chips, active nav, soft buttons, completion tile, info safeguard, streak day, segment active |
| Warm surface | `#efe7d8` | `--p-warm` | `#f6dc9e` | child switcher, reward tile, Access card |
| Avatar | `#eac9ac` | `--p-avatar` | `#f2c46b` | initials circle |
| Warn soft | `#f5eddd` | `--p-warn-soft` | `#f6e7cf` | Offline chip, caution notice |
| Warn ink | `#916a31` | `--p-warn-ink` | `#7a4a00` | text and icon on warn soft |
| Danger soft | `#faeee9` | `--p-danger-soft` | `#ffe0d6` (= `--not-right-soft`) | unlink button, Remove reward |
| Danger ink | `#a14f42` | `--p-danger-ink` | `#8a3b22` | text and icon on danger soft |
| Text strong | `#243c32` | `--p-text` | `#3b2a05` (= `--ink`) | |
| Text muted | `#748078` | `--p-muted` | `#6b5420` | |

No greens, no reds. Danger is coral (an existing macworx token), never bright red.

### 5.2 Ready-to-paste CSS

Add to `src/index.css` next to the other tokens. All values are hex on `--name:` lines, which `check-conventions` allows.

```css
.parent {
  --p-bg: #fff6dc;
  --p-surface: #ffffff;
  --p-divider: #efdba5;
  --p-primary: #f2a516;
  --p-primary-ink: #3b2a05;
  --p-hero-muted: #5a3f08;
  --p-hero-track: #c98a10;
  --p-hero-fill: #3b2a05;
  --p-accent-ink: #8a5a00;
  --p-chip: #fde9b8;
  --p-warm: #f6dc9e;
  --p-avatar: #f2c46b;
  --p-warn-soft: #f6e7cf;
  --p-warn-ink: #7a4a00;
  --p-danger-soft: #ffe0d6;
  --p-danger-ink: #8a3b22;
  --p-text: #3b2a05;
  --p-muted: #6b5420;
}
```

### 5.3 Contrast (WCAG 2.x AA, 4.5:1 for all text, which is mostly 10 to 14 px)

Computed with the relative-luminance formula. Every text/background pair the portal uses passes AA.

| Text | On | Ratio |
|---|---|---|
| `--p-text` | `--p-bg` | 12.81 |
| `--p-text` | `--p-primary` | 6.69 |
| `--p-text` | `--p-chip` | 11.53 |
| `--p-text` | `--p-warm` | 10.30 |
| `--p-text` | `--p-avatar` | 8.85 |
| `--p-hero-muted` | `--p-primary` | 4.73 |
| `--p-accent-ink` | `--p-surface` | 5.93 |
| `--p-accent-ink` | `--p-bg` | 5.49 |
| `--p-accent-ink` | `--p-chip` | 4.95 |
| `--p-muted` | `--p-surface` | 7.21 |
| `--p-muted` | `--p-bg` | 6.68 |
| `--p-muted` | `--p-chip` | 6.01 |
| `--p-muted` | `--p-warm` | 5.37 |
| `--p-muted` | `--p-warn-soft` | 5.92 |
| `--p-text` | `--p-surface` | 13.82 |
| `--p-warn-ink` | `--p-surface` | 7.48 |
| `--p-warn-ink` | `--p-warn-soft` | 6.15 |
| `--p-danger-ink` | `--p-danger-soft` | 6.19 |
| `--p-accent-ink` | `--p-warm` | 4.42: icons only (3:1 non-text), never text on warm |
| `--p-muted` | `--p-avatar` | 4.42: not used; avatar text is `--p-text` |

The builder must re-run the ratios (a ten-line script) if any token value changes. `--p-primary` (`#f2a516`) is 2.07:1 on white: **never use it as text or a thin icon on a light surface**; use `--p-accent-ink`. The hero track vs fill is a non-text graphic; the fill (`--p-hero-fill`) carries the meaning.

## 6. Shared chrome

### 6.1 Shell

- `.parent` shell is full width, `box-sizing: border-box`, background `--p-bg`, text `--p-text`, `font-size: 14px`. No max-width on phone. Wide: the whole shell fills the viewport (see section 8 for a cap).
- Content scrolls; chrome pieces below are in this order on every screen.

### 6.2 Phone (below 768 px), top to bottom

1. **App header**: height 54, padding-inline 22, flex space-between, centered. Starts below `env(safe-area-inset-top)` (replaces the 48 px status bar).
   - Brand: sprout icon 25 + wordmark "macworx" (23 px / 400), gap 7.
   - Chip "PARENT SPACE": `chip` style, padding 4 9, radius 100, fill `--p-chip`, text `--p-accent-ink`.
2. **Content**: padding 16 22 24, flex column, gap 22.
   1. **Child switcher** (below). Height 58.
   2. **Page heading**: gap 5. page-title, then page-sub.
   3. Screen body (sections 9 to 13), each block gap 22 (blocks), 12 (section title to its panel).
   4. Overview only: **footer note** last in content: centered row, gap 7, lock-keyhole icon 13 (`--p-muted`) + "Parent-only controls. Their progress stays theirs." (11 px, muted, no wrap needed).
3. **Bottom tab nav**: fixed to the bottom of the viewport; background `--p-surface`; border-top 1 px `--p-divider`; padding 10 12 8 plus `env(safe-area-inset-bottom)` (replaces the home indicator row, which is not built); content gets matching bottom padding so nothing hides behind it.
   - 5 items in a row, gap 2, each `flex: 1`, height 52, radius 12, flex column centered, gap 5: icon 20 + label (10 px / 400).
   - Order and labels: Overview, Macaronis, Streak, Devices, Shop. Icons: layout-dashboard, coins, flame, smartphone, shopping-bag.
   - Active: fill `--p-chip`, icon and label `--p-accent-ink`. Inactive: fill `--p-surface`, icon and label `--p-muted`. Active gets `aria-current="page"`.

### 6.3 Child switcher

- Container: fill `--p-warm`, radius 12, padding-inline 12, flex row centered, gap 10. It is a button (opens a list of the parent's children plus "Add a child"; list design is not in Figma, see section 16). In the list each row has a "Rename" button beside the choose button, and the list ends with an "Add a child" row; both open Overview's Children panel.
- Avatar: circle 36 (wide 32), fill `--p-avatar`, `{initials}` (13 px, wide 12, `--p-text`).
- Identity (flex 1, min-width 0, gap 1; wide gap 3): `{name}` (switcher-name), `{grade} · Child profile` (switcher-sub).
- Chevrons-up-down icon 17 (wide 14), color `--p-accent-ink`.
- Phone: height 58. Wide: min-height 76, padding 10, gap 7.

### 6.4 Wide (768 px and up): sidebar replaces header and bottom nav

- Layout: sidebar (216 wide) + content column. The header and bottom tab nav are not shown.
- **Sidebar**: width 216, full height (min-height 100vh), fill `--p-surface`, border-right 1 px `--p-divider`, padding 26 16 24, flex column, gap 28. Sticky/fixed so it stays while content scrolls.
  1. Brand: padding-left 8, gap 7: sprout 27 + "macworx" 25 px.
  2. Child switcher (6.3), width 100%.
  3. Destinations: flex column gap 8. Each item: height 52, radius 12, padding-inline 16, gap 12, icon 22 + label 14 px. Active: fill `--p-chip`, icon and label `--p-accent-ink`, label weight 600. Inactive: fill `--p-surface`, `--p-muted`, 400. Same five labels and icons as phone.
  4. Parent assurance block: `margin-top: auto` (pinned to the bottom of the sidebar; the Figma 148 px top padding only approximates this), padding-inline 8, gap 12: chip "PARENT SPACE" (padding 5 10, radius 100) then a row (gap 7, align start): lock-keyhole 15 + "Parent-only controls. Their progress stays theirs." (11 px, lh 1.45, muted).
- **Content column**: flex 1, padding 24 32, flex column, gap 24. First child is the **page heading** (gap 6): eyebrow (upper screen name: OVERVIEW, MACARONIS, STREAK, DEVICES, REWARDS SHOP), page-title (30), page-sub (13). Then the screen's two-column grid.

## 7. Shared components

### Panel (card)
Fill `--p-surface`, border 1 px `--p-divider`, radius 20, padding 18 (wide 22), flex column. Inner gap 14 phone; wide gap 16 unless the screen says otherwise.

### Hero panel
Fill `--p-primary`, border 1 px `--p-primary`, radius 20, padding 18 (wide 22), gap 14 (wide 16). Text is `--p-primary-ink` (numbers) and `--p-hero-muted` (labels and lines). Contains: hero-label row, hero number row (baseline aligned, gap 7; Macaronis gap 8, wide 9 to 10), hero-line.

### Section heading row
Row, align center, gap 8 (wide 12, min-height 28): section-title (flex 1) + optional section-action. Gap to the panel below: 12.

### Divider
1 px `--p-divider`, full width, inside a panel; gap above and below equals the panel's inner gap.

### Chip
Radius 100, padding 4 9 (wide 5 10), 11 px / 600. Variants: `soft` (fill `--p-chip`, text `--p-accent-ink`): PARENT SPACE, Online, "{n} connected". `warn` (fill `--p-warn-soft`, text `--p-warn-ink`): Offline.

### Buttons (parent size)
Height 48, radius 12, flex row centered, gap 8, 14 px / 600, no border, icon 18. Full width unless stated.

| Variant | Fill | Text and icon | Use |
|---|---|---|---|
| primary | `--p-primary` | `--p-primary-ink` | Review, Generate pairing code, Save |
| soft | `--p-chip` | `--p-accent-ink` | View details, Add a reward, Discard draft |
| danger | `--p-danger-soft` | `--p-danger-ink` | Remove reward, unlink (icon-only 48x48, icon 18, wide 20) |

States: **disabled** = `opacity: 0.4; cursor: default` (same as the child app). **Focus-visible**: 2 px outline `--p-accent-ink`, 2 px offset (not in Figma; required for keyboard use). **Pressed**: no change beyond the browser default. No hover treatment on phone; on wide add nothing (keep contract exact).

### Form field
Column, gap 7: field-label, then input. Input: min-height 48, padding 12, radius 12, border 1 px `--p-divider`, fill `--p-bg`, field-input text; optional right unit (field-unit, gap 8). Multiline: min-height 70. Focus-visible: border `--p-accent-ink`. Disabled: opacity 0.4. A native `<input>`/`<textarea>`, not a styled div. Number fields use `inputmode="numeric"`.

### Segmented control
Track: fill `--p-bg`, radius 12, padding 4, gap 4, flex row. Options flex 1, height 42 (wide 44), radius 9, 13 px / 600, centered. Active: fill `--p-chip`, text `--p-accent-ink`. Inactive: fill `--p-bg`, text `--p-muted`. Radio-group semantics (`role="radiogroup"` with two radios). Built as `src/ui/Segmented.tsx` (options, value, onChange, label), first used for Add / Rename on Overview.

### Safeguard (notice)
Row, align start, gap 10, padding 12, radius 12, icon 17 (wide 18) + text (safeguard, flex 1). Variants: `info` (fill `--p-chip`, text and icon `--p-accent-ink`, icon shield-check), `warn` (fill `--p-warn-soft`, text and icon `--p-warn-ink`, icon info).

### Icon tile / row icon
See per screen. All icons: inline SVG, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `aria-hidden="true"`. Icon-only buttons carry an `aria-label`.

### Two-step confirm ("Review, then Confirm")
Every parent write (adjust, streak correction, unpair) is two steps: the primary button reads "Review ..." and opens a confirm panel (same panel style, in place below the form, replacing the Review button) that restates the change and has two buttons: primary "Confirm" and soft "Cancel". Only Confirm calls the API. After success show a notice row (`info` safeguard) with the result; on error show a `warn` safeguard with plain wording (section 14).

## 8. Wide layout rules

Breakpoint: **min-width 768 px** (owner decision 3; an 820 px portrait iPad gets the wide layout). Below 768: phone layout. Add a phone project to the Playwright config.

| | Phone (< 768) | Wide (>= 768) |
|---|---|---|
| Navigation | header + bottom tab nav | 216 px sidebar |
| Switcher | in content, 58 high | in sidebar, 76 min-high |
| Page heading | title + sub | eyebrow + title (30) + sub |
| Content padding | 16 22 24 | 24 32 |
| Panel padding | 18 | 22 |
| Section title | 17 | 18 |
| Footer note | end of Overview | sidebar assurance block |
| Hero numbers, stat values, icon sizes | phone sizes | the larger sizes in the type scale and per-screen tables |

**Columns.** Content area is `1fr` of the width after the sidebar. Two columns at **>= 1024 px viewport**:
`display: grid; gap: 24px; grid-template-columns: minmax(0, Lfr) minmax(0, Rfr); align-items: start`, with L and R taken from the Figma column widths so the ratios hold at any width (1194 px frames give 914 px content: L + R + 24 gap):

| Screen | Left column (Figma px) | Right column (Figma px) | `grid-template-columns` |
|---|---|---|---|
| Overview | 508 | 382 | `minmax(0, 508fr) minmax(0, 382fr)` |
| Macaronis | 414 | 476 | `minmax(0, 414fr) minmax(0, 476fr)` |
| Streak | 450 | 440 | `minmax(0, 450fr) minmax(0, 440fr)` |
| Devices | 480 | 410 | `minmax(0, 480fr) minmax(0, 410fr)` |
| Shop | 426 | 464 | `minmax(0, 426fr) minmax(0, 464fr)` |

**768 to 1023 px (for example 820 px portrait iPad):** keep the sidebar, show **one column** (about 540 px of content at 820) in the phone's DOM order, with wide sizes (padding 22, type, icon sizes). This range is not in Figma; it is the rule that avoids 258 px columns. Content max width: none; at viewports above 1440 px center the shell with `max-width: 1440px; margin: 0 auto` (not in Figma, see section 16).

**Column contents (wide, left / right).** The DOM is the phone order, placed with grid areas.

| Screen | Phone order | Wide left | Wide right |
|---|---|---|---|
| Overview | hero, stat cards (2 across), assignments, shortcuts, footer note | hero, assignments | stat cards (2 across, each flex 1, gap 12), shortcuts |
| Macaronis | hero, adjust panel, recent activity | hero, recent activity | adjust panel |
| Streak | hero, calendar, correct-a-streak, latest-event panel | hero, calendar, latest-event panel | correct-a-streak |
| Devices | count row, device cards, pair card, "Before you disconnect", Access card | count row, device cards | pair card, "Before you disconnect", Access card |
| Shop | summary, rewards, editor, redemption | summary, rewards list, redemption | editor |

Left and right column internal gap: 22 (Devices left column: 16). Panels in a column are 100% wide of that column.

## 9. Screen: Overview

Frames: `overview-phone.png` (4:2621), `overview-wide.png` (11:1759). Route `/parent/overview`. Nav item: Overview. Eyebrow (wide): OVERVIEW.

Copy: title "A little progress, daily." Subline "{weekday}, {month} {day} · {name}'s overview" (derived from today's date, for example "Tuesday, October 27 · {name}'s overview").

Layout tree (phone; wide differences in brackets):

1. **Hero panel** "Today's homework" [wide: left column, padding 22, gap 16]
   - Row: hero-label "Today's homework" (13 / 600 / upper / `--p-hero-muted`) + sun icon 21 [22] (color `--p-hero-muted`), space-between.
   - Number row, baseline, gap 7 [10]: hero-number `{completedToday}` (42 [44] / 600) + hero-unit "assignments done" (14, `--p-hero-muted`). Singular "assignment done" when 1.
   - **No progress track, no "of 3", no "One small step to go."** (decisions 9 and 18). In their place, hero-line (12): "{earned} Macaronis earned today." when `earned > 0`; otherwise omit the line.
2. **Stat cards** row [wide: right column top], flex row, gap 12, two cards `flex: 1`. Card: panel style radius 20, padding 16 [20], column gap 7 [8], border 1 px:
   - icon 20 [22] (`--p-accent-ink`): coins / flame
   - stat-value `{balance}` / "{streak} days" (26 [30])
   - stat-label "Macaronis available" / "current streak" (11 [12], muted)
   - stat-link "Manage Macaronis →" (links to /parent/points) / "Manage streak →" (to /parent/streak). Wide: link row height 44, vertically centered.
3. **Today's assignments** [wide: left column under hero, gap 12]
   - Section heading row: "Today's assignments" + action "View all" (opens full recent results, LIST_LIMIT 50).
   - Panel: padding 18 [22], gap 14 [17]. Rows separated by dividers. Row: flex, align center, gap 12.
     - Completion tile 34x34 [40x40], radius 11, border 1 px `--p-divider`, fill `--p-chip`, check icon 17 [20] `--p-accent-ink`. (A pending tile, fill `--p-bg` with a book-open icon, exists in Figma; there is no assigned-homework data, so do not build it.)
     - Detail (flex 1, gap 2 [3]): row-eyebrow (only when the data names a subject; none today, omit), row-title, row-meta.
     - Amount right: row-amount `+{total}` (Figma: "+ 30 pt"; 12 [13], 600, `--p-accent-ink`); the unit is implied by the stat card.
   - Empty state (no results today): one row of `row-meta` text "No assignments yet today."
4. **Keep things in sync** [wide: right column, under stat cards]
   - Section heading (no action). Panel padding 18 [22], gap 14 [18], two link rows with a divider:
     - Row 1 (links to /parent/devices): tablet icon 20 [22] `--p-accent-ink`, title "{n} connected devices" (singular "1 connected device"), meta "Last synced {when}" (14 / 11), chevron-right 18 `--p-accent-ink`. Wide row min-height 62, gap 12, text gap 4.
     - Row 2 (links to /parent/shop): shopping-bag icon 20 [22], title "{name}'s rewards shop", meta "{n} rewards · {k} within reach" ("{n} rewards" when k is 0; never "X of Y"), chevron-right 18.
5. Phone only: footer note (6.2).

## 10. Screen: Macaronis

Frames: `points-phone.png` (4:2737), `points-wide.png` (11:1907). Route stays `/parent/points`; nav label is **Macaronis** (decision 7). Eyebrow (wide): MACARONIS.

Copy: title "Macaronis, kept fair." Subline "Adjust {name}'s balance without changing the work."

1. **Hero panel**: hero-label "Available balance" (12 / upper); number row baseline gap 8 [9]: `{balance}` (44 [48]) + "Macaronis" (15, `--p-hero-muted`); hero-line "+{earned} earned today" (12; omit when 0). The Figma "−120 redeemed yesterday" is dropped (no purchases data).
2. **Adjust balance** [wide: right column]
   - Section heading "Adjust balance" (no action). Panel padding 18 [22], gap 14.
   - Segmented control, options "Add Macaronis" and "Remove Macaronis" (final copy). Option height 42 [44].
   - Field: label "Macaronis to add" (or "Macaronis to remove"), input value `{amount}`, unit "Macaronis". Integer 1 to 100000 (worker `MAX_AMOUNT`).
   - Field: label "Reason · required", multiline min-height 70, max 200 chars (`MAX_NOTE`).
   - Preview row (space-between, align center; wide gap 12): preview-label "Balance after adjustment", preview-value "{after} Macaronis" (19 [18], `--p-accent-ink`). If `after < 0`, the primary button is disabled and the preview shows "Can't go below zero." (`--p-warn-ink`).
   - Safeguard `info` (shield-check 17 [18]): "Nothing changes yet. Review the amount, then confirm on the next step."
   - Primary button with arrow-right icon: "Review +{n} Macaronis" (or "Review −{n} Macaronis", U+2212). Disabled until amount and reason are valid.
   - Footnote (11): "Saved with your name and reason in the activity log. Macaronis can't go below zero."
   - After Review: confirm step (section 7). Confirm calls `adjustBalance(amount, note)`.
3. **Recent activity** [wide: left column under hero]
   - Section heading "Recent activity" + action "Full history" (expands to LIST_LIMIT 50).
   - Panel padding 18 [22], gap 14 [20]; rows separated by dividers. Row: flex, align center, gap 10, icon 18 [20] (`--p-accent-ink`; check for earned, ticket for redemption in Figma), Event (flex 1, gap 3 [4]): activity-title, row-meta; Amount column fixed 76 wide, right aligned, gap 3 [4]: activity-amount "+30" / "−120" (16 [18] / 600), activity-balance "Balance 240" (10).
   - Rows are the admin log (`GET /api/parent/log`, newest first, up to 50). One row per entry; the title is the existing `src/copy.ts` string for its `action`; the amount column is empty (no amount, no balance line) except for `balance` entries, which show `detail.amount` (signed) and "Balance {detail.after}". The meta line is the entry's date and time (`at`).

     | `action` | Icon (`--p-accent-ink`) | Title (existing copy key) |
     |---|---|---|
     | `balance` | coins | `parentLogAdded(n, note)` / `parentLogRemoved(n, note)` |
     | `streak` | flame | `parentLogStreak(streak, day)` |
     | `pairing_code` | scan-line | `parentLogPairingCode(name)` |
     | `unpair` | unlink | `parentLogUnpair(name)` (device name; `parentLogUnknownDevice` is a "device" string, decision 7) |
     | `correction` (old entries only) | check | `parentLogCorrected(...)`, kept so old logs render (decision 12) |
     | anything else | history | `parentLogOther` |

   - Earned results are not rows here (they are on Overview). Empty state: the existing `parentNoLog`.

## 11. Screen: Streak

Frames: `streak-phone.png` (4:2849), `streak-wide.png` (11:2041). Route `/parent/streak`. Eyebrow: STREAK.

Copy: title "Make every day count." Subline "{name}'s effort adds up, one day at a time." (Figma's original subline trips the never-negative rule.)

1. **Hero panel**
   - Row, align center, gap 14 [16]: flame icon 36 [40] (color `--p-hero-muted`), then column: hero-number "{streak} days" (40 [44] / 600, gap 4 on wide) and hero-line "Current streak · {start}–{end}" (12; en dash U+2013; range is the counted days ending on `lastDay`).
   - Details row (space-between, 12 px): "Personal best: {n} days" (`--p-hero-muted`; **placeholder**, section 15) and "Today ✓" (600, `--p-primary-ink`; shows when `lastDay` is today; the check mark is the text glyph U+2713).
2. **The last 7 days** [wide: left column]
   - Section heading "The last 7 days" + action "{Month}" (e.g. October).
   - Panel padding 18 [22], gap 14 [16]. Row of 7 day columns, gap 6 [8], each `flex: 1`, column centered, gap 7 [10]:
     - weekday letter (10 [11] muted)
     - date tile: phone 34 wide x 39 high [wide: 100% wide x 48 high], radius 12, date 12 [14] / 600. States: **counted** (fill `--p-chip`, text `--p-accent-ink`), **today** (fill `--p-primary`, text `--p-primary-ink`), **not counted** (fill `--p-bg`, border 1 px `--p-divider`, text `--p-muted`; derived; Figma shows only counted days; no negative wording or icon).
     - check icon 12 [14] below the tile, `--p-accent-ink`, only on counted and today.
   - Footnote (11): "One completed assignment keeps a day in the streak."
3. **Correct a streak** [wide: right column]
   - Section heading "Correct a streak". Panel padding 18 [22], gap 14 [16].
   - Field: label "Corrected streak length", value `{n}`, unit "days". Integer 0 up to the worker's `MAX_STREAK`.
   - Preview row (icon calendar-check 18 [20] `--p-accent-ink` + 12 px `--p-accent-ink`, gap 8): "Preview: {start}–{end} · {old} → {new} days" where the range ends on the last counted day (decision 13). Arrow is U+2192.
   - **No "Reason" field**: `POST /api/parent/streak` takes only `{streak, lastDay}` (decision 13: keep existing API fields). The Figma reason field and its sample are dropped.
   - Safeguard `warn` (info icon 17 [18]): "This changes only the streak. It won't complete assignments or award extra Macaronis."
   - Primary button with arrow-right: "Review streak correction"; then confirm step (Confirm calls `setStreak`).
   - Footnote (11): "Review, then Confirm. The previous value is saved in the log."
4. **Latest event** panel [wide: left column, after calendar]: panel padding 18 [22]; row gap 12, icon history 20 [22] `--p-accent-ink`; column gap 4 [5]: title (13 / 600) "Today's streak secured" (shown when `lastDay` is today), meta (12) "{what} · {time}" (omit what/time if unknown), meta (11) "No parent corrections in the last 30 days." (derived from the admin log; show the real count wording "{n} parent corrections in the last 30 days." when > 0).

## 12. Screen: Devices

Frames: `devices-phone.png` (4:2974), `devices-wide.png` (11:2195). Route `/parent/devices`. Eyebrow: DEVICES.

Copy: title "{name}'s devices, connected." Subline "Manage where {name} can open homework." The word **device**, never "iPad", wherever the thing being paired is named.

1. **Count row**: flex row, align center, gap 10 [12]: chip `soft` "{n} connected" + muted 12 px "Progress syncs across devices." (flex 1).
2. **Device cards** (one panel each, stacked, gap 12 phone / 16 wide), padding 18 [22], gap 14 [16]:
   - Identity row (gap 12, align center): symbol tile 44x48 [48x52], radius 12, fill `--p-chip`, icon tablet 25 [27] (`--p-accent-ink`; laptop for non-tablet devices, placeholder); detail column (flex 1, gap 3 [4]): device-name `{label}` (15 [16]) + row-meta "Added {date}" (Figma also shows "iPad · Safari" / "ChromeOS · Chrome": **placeholder** browser/OS line, section 15); rename pencil icon button (icon 17 [19], box 44x44 [wide], `--p-accent-ink`).
   - Connection row (space-between, align center): chip (`soft` "Online" / `warn` "Offline", placeholder) + row-meta right "Synced today, {time}" or "Last seen {when}" (11).
   - Divider.
   - Actions row (gap 8 [10]): soft button "View details" (flex 1, h 48) + danger icon button 48x48 (unlink icon 18 [20], `aria-label` "Unpair {label}").
3. **Pair a device** [wide: right column top]
   - Section heading "A new place to learn". Panel padding 18 [22], gap 14 [16].
   - Intro row (gap 12): scan-line icon 24 [26] `--p-accent-ink` + column (gap 5 [6]): pair-title "Connect another device", pair-body "Open macworx on {name}'s device, then enter the one-time pairing code."
   - Field (not in Figma, needed by `makeCode(name)`): label "Device name", input.
   - Primary button with plus icon 18: "Generate pairing code".
   - After generating (not in Figma): inside the panel show the code as one string with the existing `.parent-code-digits` style (letter-spacing 0.1 of the font size, tabular numerals, size converted to px), not the child-side `CodeBoxes`; plus muted line "Expires in 10 minutes."
   - Footnote (11): "Codes expire after 10 minutes. Keep yours private."
4. **Before you disconnect** [wide: right column]
   - Section heading "Before you disconnect". Safeguard `info` (shield-check 17 [18]): "Removing a device stops it from saving progress for {name}. {name}'s synced homework, {balance} Macaronis and {streak}-day streak stay safe." (The worker refuses the removed device's key from then on, SPEC §6.9; it does not sign the device out.)
   - Paragraph (12, muted): "You'll review the device name, then confirm. Anything not yet synced from that device stays on it."
5. **Access card**: fill `--p-warm`, radius 12, padding 16, row gap 10, align center: shield-check icon 20 [22] `--p-accent-ink`; column (gap 3 [4]): access-title "Child access only", access-body "Paired devices can't open parent controls."

Unpair flow: the danger icon button opens the confirm step (section 7): "Unpair {label}?" with Confirm/Cancel; Confirm calls `unpair(id)`.

## 13. Screen: Shop

Frames: `shop-phone.png` (4:3084), `shop-wide.png` (11:2334). Route `/parent/shop`. Eyebrow: REWARDS SHOP. **Read-only** (decision 10): every button and field is rendered disabled.

Copy: title "Motivation, made personal." Subline "Thoughtful rewards for {name}'s everyday effort."

1. **Summary card**: fill `--p-chip`, radius 12, padding 15 [18], row gap 10 [12], align center: coins icon 20 [24] `--p-accent-ink`; column (gap 3 [4]): "{name} has {balance} Macaronis" (14 / 600, `--p-text`) + "{k} rewards within reach." (11 [12], `--p-accent-ink`; count only, no "of").
2. **Rewards list**
   - Section heading "{name}'s rewards shop" + action "{n} active" (12 / 600 `--p-accent-ink`).
   - Panel padding 18 [22], gap 14 [18]. Reward rows separated by dividers. Row: flex, align center, gap 12: reward tile 46x50 [48x52], radius 14, fill `--p-warm`, icon 24 [26]; detail (flex 1, gap 3 [4]): row-title `{name}`, row-meta description (omit if config has none), price line (11 / 600): "{price} Macaronis · Within reach" (`--p-accent-ink`) or "{price} Macaronis · {diff} more to go" (`--p-muted`); edit pencil icon button 40x44 [44x44], icon 17 [19], disabled.
   - Last item in the panel: soft button with plus icon: "Add a reward" (disabled).
   - Icons: the existing `RewardIcon` (ice cream, store, tent, puppy), not the Figma placeholder art.
3. **Reward editor** [wide: right column], all controls disabled, shows the first reward
   - Heading row (gap 8 [12]): section-title "Edit reward" + chip `warn` "Read-only" (replaces "Unsaved draft").
   - Panel padding 18 [22], gap 14 (wide 13). Fields: "Reward name", "Description", "Price in Macaronis" (unit "Macaronis").
   - No price-change preview and no "future redemptions" notice (there is nothing to change).
   - Notice `info`: "Editing rewards is coming soon."
   - Buttons (disabled): primary "Save reward changes"; row gap 10: soft "Discard changes" + danger "Remove reward" (each flex 1). Footnote (11): "Removal asks for confirmation. Past redemptions stay in the history."
4. **Redemption summary**: row gap 10: ticket-check icon 19 [21] `--p-accent-ink` + column (gap 3 [4]): title (13 / 600) and meta (11). Empty state (the only state today): title "No rewards redeemed yet." and no meta line.

## 14. Copy rules

Final decisions applied to every Figma string:

- Brand: **macworx** (not "steadily"). Thing being paired: **device** (not "iPad"). Currency: **Macaronis** (not "points"; the unit abbreviation "pt" is dropped, nav label is "Macaronis", route stays `/points`).
- No PIN wording. No "X of Y" (not "2 of 3", not "2 of 3 rewards within reach").
- Never-negative: do not use lost, failed, wrong, missed, mistake, incorrect, bad, penalty, oops. Frame limits positively ("can't go below zero" is allowed; "overdraw" error code is internal only). Error messages: plain and kind, for example "That would go below zero. Try a smaller amount." / "That didn't save. Try again." / "The code didn't generate. Try again."
- Subjects (Math, Reading, Science), assignment names, device names and the child's name are data, never hard-coded.
- The Figma copy uses "her" and "Her" in headings ("Her devices, connected", "Her rewards shop"). Final copy uses `{name}` where a name fits (as above) so the screens work for any child.
- Dates: "Today, 4:05 pm", "Yesterday, 6:10 pm", "Oct 12", ranges with en dash "Oct 21–27". Times lowercase "pm". Minus sign U+2212, arrow U+2192, check U+2713, middle dot U+00B7, ellipsis never used.
- Writing "(placeholder)" in the UI is not allowed; placeholder data must read like real data (section 15).

## 15. Data mapping

Legend: **Real** = already returned by an existing route. **Derived** = computed from real data (may need a new field on an existing route). **Placeholder** = no source; dummy data from one module, `src/parent/placeholders.ts`, each export named for what it fakes, plus a follow-up issue (decision 11). Existing API: `src/parent/api.ts`, `worker/parent.ts` routes `GET /api/parent/summary|results|results/:id|log|devices`, `DELETE /api/parent/devices/:id`, `POST /api/parent/balance|streak|pairing-code`. Do not use `POST .../results/:id/correct` or `correctResult` (removed, decision 12). Old `correction` log entries still render.

| Element | Kind | Source |
|---|---|---|
| Child `{name}`, `{initials}`, `{grade}`, switcher list, "Add a child" | Real after decisions 4 to 6 | new `children` table and routes (decisions 4 to 6); until then one seeded child named "Child" |
| Overview "assignments done" count | Derived, new field | `Summary.completed` is a running total, not today's; add `completedToday` (finished results with `day` = today's calendar day) to `GET /summary` |
| Overview "{earned} Macaronis earned today" | Derived, new field | sum of `results.total` for today; `ResultRow.total` exists, `GET /results` rows have `day` |
| Stat card balance, streak | Real | `Summary.balance`, `Summary.streak` |
| Assignment rows (title, "Completed today") | Derived | `ResultRow` (`day`, `finished`, `grade`, `total`); the Figma time of day needs `results.created_at`, which exists in the table but is not in `ResultRow` (add it); title is "Assignment" plus grade label (data) because there is no subject or name |
| Assignment subject eyebrow, "Due today", pending row | Not built | no assigned-homework data |
| "{n} connected devices" | Real | count of `listDevices` rows where `revokedAt` is null |
| "Last synced {when}" | Derived, new field | latest `results.created_at` for that device (`results.device_id` exists); add to `GET /devices` |
| "{n} rewards · {k} within reach" | Real + derived | `REWARDS` from `src/engine/config.ts` (SPEC §6.7) vs `Summary.balance` |
| Macaronis hero balance | Real | `Summary.balance` |
| "+{earned} earned today" | Derived | as above |
| "−120 redeemed yesterday", "Movie night redeemed" | Not built | no purchases table (decision 10) |
| Adjust form | Real | `adjustBalance(amount, note)`; 409 `overdraw` returns balance; note 1 to 200 chars |
| Recent activity rows | Real + derived | `listLog()` entries (`action`: `balance`, `streak`, pair/unpair, old `correction`; `detail` has `amount`, `before`, `after`, `note` for balance) merged with finished `listResults()` rows, newest first; "Balance {after}" is real only on `balance` entries (`detail.after`); on result rows omit the balance line |
| Streak count and range | Real + derived | `Summary.streak`, `Summary.lastDay`; range = last `min(streak, 7)` days ending on `lastDay` |
| Weekday tiles state | Derived | same as above |
| "Personal best: {n} days" | Placeholder | `src/parent/placeholders.ts` (`personalBestStreak`) |
| "Today ✓" | Derived | `lastDay` equals today |
| Streak correction | Real | `setStreak(streak, lastDay)`; no note field in the API |
| "No parent corrections in the last 30 days" | Derived | count of `streak`/`correction` log entries in 30 days |
| "Today's streak secured · {what} · {time}" | Derived | latest finished result of today (`created_at` as above); omit unknown parts |
| Device list: `{label}`, "Added {date}" | Real | `Device.label`, `Device.createdAt` |
| Browser/OS line ("iPad · Safari") | Placeholder | `placeholders.ts` (`deviceBrowserLine`) |
| Online/Offline chip, "Last seen" | Placeholder (Online/Offline); Derived (time) | placeholder status; last-seen time from latest result as above |
| Rename pencil, View details | Placeholder, disabled | no routes; render disabled and file a follow-up |
| Unlink button | Real | `unpair(id)` |
| Generate pairing code | Real | `makeCode(name)` (needs `child_id` after decision 4); response `{code, expiresAt}` |
| "Child access only" copy | Static copy | |
| Shop rewards | Real | `REWARDS` in config (Ice Cream 30, Pet Store 75, Camping 300, Puppy 10,000; no descriptions) |
| Shop "Last redeemed" | Empty state | no redemption data |
| Reward editor | Placeholder, disabled | no rewards table |

## 16. Ambiguities and open questions

1. **Narrow-iPad columns.** Figma's wide frames are 1194 px landscape only; the 768 to 1023 px range is undefined. Rule above: sidebar stays, one column. Confirm with the owner.
2. **Wide frames above 1194 px.** Unspecified; this file caps the shell at 1440 px and centers it.
3. **Child switcher list** (open, "Add a child", rename) has no Figma frame. Interim design (owner, #83): the popover has rows in the switcher style (avatar, name, grade), a "Rename" button beside each row and an "Add a child" row at the end. Add and rename happen on Overview, in a Children Panel with the Add / Rename Segmented control (the Macaronis Add / Remove chrome) and Form fields Name, Grade (optional) and Initials, then a primary Save. Errors use the `warn` Safeguard. Needs an owner design in Figma.
4. **Pairing code display and device name field** have no frame (Figma shows only the Generate button).
5. **Disabled/read-only styles** and focus rings are not in Figma; defined in section 7.
6. **Streak not-counted day** and the Streak hero when the streak is 0 are not in Figma.
7. **"{k} rewards within reach"** with the real rewards (30 to 10,000) will often be 4 or 0.
8. **The PNGs show a sample child name** and the green theme; they are only a layout reference. The owner should confirm the sample name is not a real child's, or re-export with a neutral name.
9. **Hard-coded "her"** in Figma headings is replaced with `{name}`; the pronoun in remaining copy ("her choice") only appears in reward sample text that is not built.
10. **Result time of day** and **device id** are not on `ResultRow` today; the derived fields in section 15 need small additions to the API.
11. Panel inner gaps vary per frame in Figma (14 phone; wide 13, 16, 17, 18, 20). Section 7 says 16 on wide; per-screen overrides: Overview homework list 17, Overview shortcuts 18, Macaronis activity 20, Macaronis adjust 14, Shop rewards 18, Shop editor 13. Apply these exact values.
12. **Nav label "Macaronis"** for the Points tab: confirm the owner wants the label changed along with the copy.
13. **Home link to the portal.** Decision 2 says only "a visible link in the app". This file proposes a small text link on the child app Home to `/parent/overview`; its exact placement and wording are not designed.
14. **Copy written for this contract (not in Figma), needs owner approval:** "Editing rewards is coming soon.", "No assignments yet today.", "Read-only" (Shop chip), "No rewards redeemed yet.", "Expires in 10 minutes.", "Device name" (field label), "Add Macaronis" / "Remove Macaronis", "Can't go below zero.", the error messages in section 14, "{name}'s effort adds up, one day at a time." (replaces a Figma subline that breaks never-negative), the two rewritten Devices paragraphs, and the Home link text.

## 17. Icons

Source: the icon set is Lucide (ISC). Each icon below is exported at the pixel size Figma used, so each has its own `viewBox` equal to that size; the stroke width is 1.7 in those units. Render with `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`. Scale by changing the rendered `width`/`height`, not the viewBox: the stroke scales proportionally with it (this is how Figma's 20 px icons become 22 px in the sidebar). Colors: see per-component notes (`--p-accent-ink` for icons on light surfaces, `--p-hero-muted` for the hero panel's sun and flame, `--p-primary-ink` for arrow-right and plus on a primary button, `--p-danger-ink` for unlink, `--p-warn-ink` for the info icon in a warn notice, `--p-muted` for lock-keyhole and inactive nav icons).

Where used (sizes phone / wide): sprout (brand 25 / 27), chevrons-up-down (switcher 17 / 14), sun (hero 21 / 22), coins (nav, stat, summary 20 / 22 / 24), flame (nav, stat 20 / 22; streak hero 36 / 40), check (completion 17 / 20; activity 18 / 20; streak tile 12 / 14), tablet (nav-adjacent shortcut 20 / 22; device tile 25 / 27), chevron-right (18), shopping-bag (nav, shortcut 20 / 22), lock-keyhole (13 / 15), layout-dashboard (nav 20 / 22), smartphone (nav 20 / 22), shield-check (17 / 18; Access card 20 / 22), arrow-right (18), ticket (activity, 18 / 20), calendar-check (18 / 20), info (17 / 18), history (20 / 22), pencil (17 / 19), unlink (18 / 20), laptop (25 / 27), scan-line (24 / 26), plus (18), ticket-check (19 / 21). Design draws (not icons): the "→", "✓" and "−" are text glyphs.

### Icon paths

One row per icon: name, native `viewBox`, then every `d` string (join them as separate `<path>` elements when there is more than one).

| Icon | viewBox | Path data `d` |
|---|---|---|
| sprout | 0 0 25 25 | `M14.5831 9.93333V9.93321M14.5831 9.93321V7.29167C14.5831 6.1866 15.0221 5.12679 15.8034 4.34539C16.5847 3.56399 17.6444 3.125 18.7494 3.125H20.3117C20.4498 3.125 20.5823 3.17987 20.68 3.27755C20.7776 3.37522 20.8325 3.5077 20.8325 3.64583V5.20833C20.8325 6.3134 20.3936 7.37321 19.6122 8.15461C18.8309 8.93601 17.7712 9.375 16.6662 9.375C15.9286 9.375 15.2111 9.57065 14.5831 9.93321ZM14.5831 9.93321C14.2705 10.1137 13.98 10.3356 13.7203 10.5954C12.9389 11.3768 12.5 12.4366 12.5 13.5417M12.5 13.5417C12.5 15.625 13.5416 16.6667 13.5416 18.75C13.5416 19.8769 13.1761 20.9735 12.5 21.875M12.5 13.5417C12.5 12.5744 12.2307 11.6263 11.7222 10.8035C11.2138 9.98069 10.4862 9.31576 9.62119 8.88319C8.75614 8.45063 7.78774 8.26752 6.8245 8.35438C5.86125 8.44125 4.94122 8.79465 4.1675 9.375C4.1675 10.3423 4.43682 11.2904 4.94528 12.1132C5.45375 12.936 6.18126 13.6009 7.04631 14.0335C7.91136 14.466 8.87976 14.6492 9.843 14.5623C10.8062 14.4754 11.7263 14.122 12.5 13.5417ZM12.5 21.875H5.20906M12.5 21.875H19.7909` |
| chevrons-up-down | 0 0 17 17 | `M4.9589 10.6248L8.5 14.1661L12.0411 10.6248M4.9589 6.37521L8.5 2.8339L12.0411 6.37521` |
| sun | 0 0 21 21 | `M10.5 1.7493V3.49944M10.5 17.5006V19.2507M4.31298 4.31298L5.54683 5.54683M15.453 15.453L16.6869 16.6869M1.7493 10.5H3.49944M17.5006 10.5H19.2507M5.54683 15.453L4.31298 16.6869M16.6869 4.31298L15.453 5.54683M14.0003 10.5C14.0003 12.4332 12.4332 14.0003 10.5 14.0003C8.56685 14.0003 6.99972 12.4332 6.99972 10.5C6.99972 8.56685 8.56685 6.99972 10.5 6.99972C12.4332 6.99972 14.0003 8.56685 14.0003 10.5Z` |
| coins | 0 0 20 20 | `M11.4539 14.7792C11.2038 15.6064 10.7435 16.3546 10.118 16.9509C9.49248 17.5471 8.72311 17.9711 7.88493 18.1814C7.04675 18.3918 6.16836 18.3813 5.33544 18.151C4.50253 17.9206 3.74353 17.4784 3.13247 16.8673C2.52141 16.2563 2.07915 15.4973 1.84884 14.6644C1.61853 13.8314 1.60803 12.9531 1.81835 12.1149C2.02868 11.2767 2.45266 10.5073 3.04893 9.88182C3.6452 9.25633 4.39341 8.79605 5.22058 8.54588M12.5005 4.99933H13.3339V8.33267M5.11201 12.3056L5.83368 11.889L7.50034 14.7756M18.3339 6.666C18.3339 9.42742 16.0953 11.666 13.3339 11.666C10.5724 11.666 8.33385 9.42742 8.33385 6.666C8.33385 3.90458 10.5724 1.666 13.3339 1.666C16.0953 1.666 18.3339 3.90458 18.3339 6.666Z` |
| flame | 0 0 20 20 | `M10 2.5C10.5556 4.72232 11.6669 6.52795 13.3337 7.91689C15.0006 9.30584 15.834 10.8337 15.834 12.5004C15.834 14.0476 15.2193 15.5314 14.1253 16.6254C13.0312 17.7194 11.5473 18.334 10 18.334C8.45273 18.334 6.96883 17.7194 5.87474 16.6254C4.78065 15.5314 4.166 14.0476 4.166 12.5004C4.166 11.5988 4.45844 10.7216 4.99943 10.0003C4.99943 10.5529 5.21895 11.0828 5.60969 11.4735C6.00044 11.8642 6.5304 12.0837 7.083 12.0837C7.6356 12.0837 8.16556 11.8642 8.55631 11.4735C8.94705 11.0828 9.16657 10.5529 9.16657 10.0003C9.16657 8.33358 7.91643 7.50021 7.91643 5.83347C7.91643 4.72232 8.61095 3.61116 10 2.5Z` |
| flame (large, 36) | 0 0 36 36 | `M18 4.5C19.0001 8.50017 21.0003 11.7503 24.0007 14.2504C27.001 16.7505 28.5012 19.5006 28.5012 22.5008C28.5012 25.2856 27.3948 27.9565 25.4255 29.9257C23.4561 31.8949 20.7851 33.0012 18 33.0012C15.2149 33.0012 12.5439 31.8949 10.5745 29.9257C8.60517 27.9565 7.4988 25.2856 7.4988 22.5008C7.4988 20.8779 8.02519 19.2988 8.99897 18.0006C8.99897 18.9952 9.3941 19.949 10.0974 20.6523C10.8008 21.3556 11.7547 21.7507 12.7494 21.7507C13.7441 21.7507 14.698 21.3556 15.4014 20.6523C16.1047 19.949 16.4998 18.9952 16.4998 18.0006C16.4998 15.0004 14.2496 13.5004 14.2496 10.5003C14.2496 8.50017 15.4997 6.50008 18 4.5Z` |
| check | 0 0 17 17 | `M14.1661 4.25L6.37521 12.0411L2.8339 8.49969` |
| tablet (20) | 0 0 20 20 | `M10 15.0004H10.0083M5.0005 1.666H14.9995C15.9199 1.666 16.666 2.41225 16.666 3.3328V16.6672C16.666 17.5877 15.9199 18.334 14.9995 18.334H5.0005C4.08012 18.334 3.334 17.5877 3.334 16.6672V3.3328C3.334 2.41225 4.08012 1.666 5.0005 1.666Z` |
| tablet (device tile, 25) | 0 0 25 25 | `M12.5 18.7505H12.5104M6.25062 2.0825H18.7494C19.8999 2.0825 20.8325 3.01531 20.8325 4.166V20.834C20.8325 21.9847 19.8999 22.9175 18.7494 22.9175H6.25062C5.10015 22.9175 4.1675 21.9847 4.1675 20.834V4.166C4.1675 3.01531 5.10015 2.0825 6.25062 2.0825Z` |
| chevron-right | 0 0 18 18 | `M6.75 13.5L11.25 9L6.75 4.5` |
| shopping-bag | 0 0 20 20 | `M13.3333 8.3332C13.3333 9.21733 12.9821 10.0652 12.357 10.6904C11.7319 11.3156 10.8841 11.6668 10 11.6668C9.11594 11.6668 8.2681 11.3156 7.64298 10.6904C7.01786 10.0652 6.66667 9.21733 6.66667 8.3332M2.58545 5.02809H2.58563M2.58563 5.02809H17.4138M2.58563 5.02809C2.64191 4.85932 2.72521 4.69957 2.83333 4.5554L4.5 2.33272C4.65525 2.12571 4.85655 1.95769 5.08798 1.84197C5.3194 1.72625 5.57459 1.666 5.83333 1.666H14.1667C14.4254 1.666 14.6806 1.72625 14.912 1.84197C15.1434 1.95769 15.3448 2.12571 15.5 2.33272L17.1667 4.5554C17.383 4.84391 17.5 5.19483 17.5 5.55548V16.6672C17.5 17.1093 17.3244 17.5332 17.0118 17.8458C16.6993 18.1584 16.2754 18.334 15.8333 18.334H4.16667C3.72464 18.334 3.30072 18.1584 2.98816 17.8458C2.67559 17.5332 2.5 17.1093 2.5 16.6672V5.55548C2.5 5.37505 2.52928 5.19705 2.58563 5.02809Z` |
| lock-keyhole | 0 0 13 13 | `M3.79167 5.41658V3.79145C3.79167 3.0731 4.07701 2.38417 4.58492 1.87622C5.09283 1.36826 5.78171 1.0829 6.5 1.0829C7.2183 1.0829 7.90717 1.36826 8.41508 1.87622C8.92299 2.38417 9.20833 3.0731 9.20833 3.79145V5.41658M3.79167 5.41658H2.70833C2.11002 5.41658 1.625 5.90164 1.625 6.5V10.8337C1.625 11.432 2.11002 11.9171 2.70833 11.9171H10.2917C10.89 11.9171 11.375 11.432 11.375 10.8337V6.5C11.375 5.90164 10.89 5.41658 10.2917 5.41658H9.20833M3.79167 5.41658H9.20833M7.04167 8.66684C7.04167 8.96602 6.79915 9.20855 6.5 9.20855C6.20085 9.20855 5.95833 8.96602 5.95833 8.66684C5.95833 8.36766 6.20085 8.12513 6.5 8.12513C6.79915 8.12513 7.04167 8.36766 7.04167 8.66684Z` |
| layout-dashboard | 0 0 20 20 | `M3.33333 2.5H7.5C7.96024 2.5 8.33333 2.8731 8.33333 3.33333V9.16667C8.33333 9.6269 7.96024 10 7.5 10H3.33333C2.8731 10 2.5 9.6269 2.5 9.16667V3.33333C2.5 2.8731 2.8731 2.5 3.33333 2.5ZM12.5 2.5H16.6667C17.1269 2.5 17.5 2.8731 17.5 3.33333V5.83333C17.5 6.29357 17.1269 6.66667 16.6667 6.66667H12.5C12.0398 6.66667 11.6667 6.29357 11.6667 5.83333V3.33333C11.6667 2.8731 12.0398 2.5 12.5 2.5ZM12.5 10H16.6667C17.1269 10 17.5 10.3731 17.5 10.8333V16.6667C17.5 17.1269 17.1269 17.5 16.6667 17.5H12.5C12.0398 17.5 11.6667 17.1269 11.6667 16.6667V10.8333C11.6667 10.3731 12.0398 10 12.5 10ZM3.33333 13.3333H7.5C7.96024 13.3333 8.33333 13.7064 8.33333 14.1667V16.6667C8.33333 17.1269 7.96024 17.5 7.5 17.5H3.33333C2.8731 17.5 2.5 17.1269 2.5 16.6667V14.1667C2.5 13.7064 2.8731 13.3333 3.33333 13.3333Z` |
| smartphone | 0 0 20 20 | `M10 15.0004H10.0083M5.83286 1.666H14.1671C15.0877 1.666 15.834 2.41225 15.834 3.3328V16.6672C15.834 17.5877 15.0877 18.334 14.1671 18.334H5.83286C4.91228 18.334 4.166 17.5877 4.166 16.6672V3.3328C4.166 2.41225 4.91228 1.666 5.83286 1.666Z` |
| shield-check (17) | 0 0 17 17 | `M6.37521 8.49966L7.79174 9.91637L10.6248 7.08295M14.1661 9.20834C14.1661 12.7501 11.6872 14.521 8.74081 15.5481C8.58652 15.6004 8.41893 15.5979 8.26627 15.541C5.31282 14.521 2.8339 12.7501 2.8339 9.20834V4.24984C2.8339 4.06198 2.90852 3.8818 3.04135 3.74896C3.17417 3.61612 3.35432 3.54149 3.54216 3.54149C4.95869 3.54149 6.72934 2.69146 7.96172 1.61476C8.11177 1.48654 8.30265 1.4161 8.5 1.4161C8.69735 1.4161 8.88823 1.48654 9.03828 1.61476C10.2777 2.69854 12.0413 3.54149 13.4578 3.54149C13.6457 3.54149 13.8258 3.61612 13.9587 3.74896C14.0915 3.8818 14.1661 4.06198 14.1661 4.24984V9.20834Z` |
| arrow-right | 0 0 18 18 | `M3.7494 9H14.2506M9 14.2506L14.2506 9L9 3.7494` |
| ticket | 0 0 18 18 | `M9.75006 3.7494V5.24957M9.75006 3.7494H15.0005C15.3983 3.7494 15.7799 3.90745 16.0612 4.18879C16.3426 4.47013 16.5006 4.8517 16.5006 5.24957V6.74974C15.9038 6.74974 15.3315 6.98682 14.9095 7.40883C14.4875 7.83083 14.2504 8.40319 14.2504 9C14.2504 9.59681 14.4875 10.1692 14.9095 10.5912C15.3315 11.0132 15.9038 11.2503 16.5006 11.2503V12.7504C16.5006 13.1483 16.3426 13.5299 16.0612 13.8112C15.7799 14.0925 15.3983 14.2506 15.0005 14.2506H9.75006M9.75006 3.7494H2.99952C2.60166 3.7494 2.2201 3.90745 1.93877 4.18879C1.65745 4.47013 1.4994 4.8517 1.4994 5.24957V6.74974C2.09618 6.74974 2.66853 6.98682 3.09052 7.40883C3.51251 7.83083 3.74958 8.40319 3.74958 9C3.74958 9.59681 3.51251 10.1692 3.09052 10.5912C2.66853 11.0132 2.09618 11.2503 1.4994 11.2503V12.7504C1.4994 13.1483 1.65745 13.5299 1.93877 13.8112C2.2201 14.0925 2.60166 14.2506 2.99952 14.2506H9.75006M9.75006 12.7504V14.2506M9.75006 8.24991V9.75009` |
| calendar-check | 0 0 18 18 | `M6 1.4994V2.99952M6 2.99952V4.49964M6 2.99952H3.75C2.92157 2.99952 2.25 3.67115 2.25 4.49964V7.49988M6 2.99952H12M12 1.4994V2.99952M12 2.99952V4.49964M12 2.99952H14.25C15.0784 2.99952 15.75 3.67115 15.75 4.49964V7.49988M2.25 7.49988H15.75M2.25 7.49988V15.0005C2.25 15.829 2.92157 16.5006 3.75 16.5006H14.25C15.0784 16.5006 15.75 15.829 15.75 15.0005V7.49988M6.75 12.0002L8.25 13.5004L11.25 10.5001` |
| info | 0 0 17 17 | `M8.5 11.3336V8.5M8.5 5.66644H8.50708M15.5839 8.5C15.5839 12.4123 12.4123 15.5839 8.5 15.5839C4.58767 15.5839 1.4161 12.4123 1.4161 8.5C1.4161 4.58767 4.58767 1.4161 8.5 1.4161C12.4123 1.4161 15.5839 4.58767 15.5839 8.5Z` |
| history | 0 0 20 20 | `M2.5 10C2.5 11.4834 2.93987 12.9334 3.76398 14.1668C4.58809 15.4001 5.75943 16.3614 7.12987 16.9291C8.50032 17.4968 10.0083 17.6453 11.4632 17.3559C12.918 17.0665 14.2544 16.3522 15.3033 15.3033C16.3522 14.2544 17.0665 12.918 17.3559 11.4632C17.6453 10.0083 17.4968 8.50032 16.9291 7.12987C16.3614 5.75943 15.4001 4.58809 14.1668 3.76398C12.9334 2.93987 11.4834 2.5 10 2.5C7.90329 2.50789 5.89081 3.32602 4.38333 4.78333L2.5 6.66667M6.66667 6.66667H2.5V2.5M10 5.83333V10L13.3333 11.6667` |
| pencil | 0 0 17 17 | `M10.6253 3.54106L10.6301 3.54595M10.6301 3.54595L13.4541 6.36962M10.6301 3.54595L12.1752 2.00073C12.5497 1.62633 13.0577 1.41603 13.5873 1.4161C14.1169 1.41617 14.6248 1.62659 14.9992 2.00109C15.3736 2.37558 15.584 2.88347 15.5839 3.41302C15.5838 3.94257 15.3734 4.45041 14.9988 4.82481L13.4541 6.36962M10.6301 3.54595L2.72092 11.4561C2.55644 11.6201 2.43481 11.822 2.36672 12.044L1.43093 15.1266C1.41262 15.1879 1.41124 15.253 1.42693 15.3149C1.44262 15.3769 1.47479 15.4335 1.52004 15.4787C1.56529 15.5238 1.62193 15.5559 1.68394 15.5715C1.74595 15.5871 1.81103 15.5856 1.87226 15.5672L4.95591 14.6322C5.17776 14.5648 5.37965 14.4439 5.54388 14.2802L13.4541 6.36962M13.4541 6.36962L13.4588 6.37435` |
| unlink | 0 0 18 18 | `M14.1304 9.18751L15.4205 7.90491H15.4055C16.096 7.18938 16.4744 6.22907 16.4575 5.23483C16.4407 4.24058 16.0299 3.29366 15.3155 2.60198C14.6157 1.92707 13.6813 1.54994 12.709 1.54994C11.7368 1.54994 10.8024 1.92707 10.1026 2.60198L8.81248 3.88459M3.87704 8.81248L2.59444 10.0951C1.90391 10.8106 1.52555 11.7709 1.54243 12.7652C1.5593 13.7594 1.97004 14.7063 2.68445 15.398C3.38429 16.0729 4.31865 16.4501 5.29091 16.4501C6.26317 16.4501 7.19752 16.0729 7.89736 15.398L9.17997 14.1154M5.99976 1.4994V3.74958M1.4994 5.99976H3.74958M12.0002 14.2504V16.5006M14.2504 12.0002H16.5006` |
| laptop | 0 0 25 25 | `M20.8891 16.6526H20.8888M20.8888 16.6526H4.11123M20.8888 16.6526C20.8517 16.4957 20.8327 16.3344 20.8328 16.1721V7.29083C20.8328 6.7383 20.6133 6.20839 20.2227 5.81769C19.832 5.42699 19.3021 5.2075 18.7496 5.2075H6.25039C5.69789 5.2075 5.16802 5.42699 4.77734 5.81769C4.38666 6.20839 4.16719 6.7383 4.16719 7.29083V16.1721C4.16726 16.3344 4.14835 16.4957 4.11123 16.6526M20.8888 16.6526C20.9258 16.8092 20.981 16.9616 21.0536 17.1064L22.1661 19.3221C22.2464 19.4814 22.2844 19.6587 22.2765 19.837C22.2686 20.0153 22.215 20.1886 22.1209 20.3402C22.0268 20.4918 21.8953 20.6167 21.7391 20.7029C21.5828 20.7891 21.4071 20.8337 21.2286 20.8325H3.77138C3.59294 20.8337 3.41717 20.7891 3.26093 20.7029C3.10469 20.6167 2.97322 20.4918 2.87912 20.3402C2.78501 20.1886 2.73144 20.0153 2.72352 19.837C2.71561 19.6587 2.75363 19.4814 2.83393 19.3221L3.94637 17.1064C4.01897 16.9616 4.07417 16.8092 4.11123 16.6526M4.11123 16.6526H4.11096` |
| scan-line | 0 0 24 24 | `M3 7V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H7M17 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V7M21 17V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H17M7 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V17M7 12H17` |
| plus | 0 0 18 18 | `M3.7494 9H9M9 9H14.2506M9 9V3.7494M9 9V14.2506` |
| ticket-check | 0 0 19 19 | `M7.12481 9.5L8.70827 11.0835L11.8752 7.91649M1.5827 7.12473C2.21264 7.12473 2.81678 7.37498 3.26221 7.82043C3.70765 8.26588 3.95789 8.87004 3.95789 9.5C3.95789 10.13 3.70765 10.7341 3.26221 11.1796C2.81678 11.625 2.21264 11.8753 1.5827 11.8753V13.4588C1.5827 13.8788 1.74953 14.2815 2.04648 14.5785C2.34344 14.8755 2.7462 15.0423 3.16616 15.0423H15.8338C16.2538 15.0423 16.6566 14.8755 16.9535 14.5785C17.2505 14.2815 17.4173 13.8788 17.4173 13.4588V11.8753C16.7874 11.8753 16.1832 11.625 15.7378 11.1796C15.2924 10.7341 15.0421 10.13 15.0421 9.5C15.0421 8.87004 15.2924 8.26588 15.7378 7.82043C16.1832 7.37498 16.7874 7.12473 17.4173 7.12473V5.54121C17.4173 5.12124 17.2505 4.71847 16.9535 4.4215C16.6566 4.12453 16.2538 3.9577 15.8338 3.9577H3.16616C2.7462 3.9577 2.34344 4.12453 2.04648 4.4215C1.74953 4.71847 1.5827 5.12124 1.5827 5.54121V7.12473Z` |

Notes: `info`, `coins`, `lock-keyhole`, `pencil`, `unlink` and `sun` were exported with a clip rectangle equal to the viewBox; it is not needed. `shield-check (20)` (Access card) is the same shape as the 17 version: scale it. Reward art and the Figma-only icons `book-open`, `clapperboard` and `utensils` are not used (rewards use the existing `RewardIcon`).
