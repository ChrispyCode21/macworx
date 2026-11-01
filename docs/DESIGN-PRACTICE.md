# Practice screens design contract

Read this whole file before building the Math assignment screen or the Spelling and Reading samples (SPEC §5.1, §5.5). The builder can't see Figma, so this file and the four PNGs in `docs/design/` are the design. Home, the result screen and the Pair screen are not in Figma and keep their current look. The only addition is Home's two new buttons (section 9).

## Contents

1. [How to use this contract](#1-how-to-use-this-contract)
2. [Build constraints](#2-build-constraints)
3. [Units and layout frame](#3-units-and-layout-frame)
4. [Type scale](#4-type-scale)
5. [Color roles and tokens](#5-color-roles-and-tokens)
6. [Shared chrome](#6-shared-chrome)
7. [Shared components](#7-shared-components)
8. [Screen: Math](#8-screen-math)
9. [Home buttons](#9-home-buttons)
10. [Screen: Spelling](#10-screen-spelling)
11. [Screen: Reading passage](#11-screen-reading-passage)
12. [Screen: Reading questions](#12-screen-reading-questions)
13. [Copy](#13-copy)
14. [Data mapping](#14-data-mapping)
15. [Sample content](#15-sample-content)
16. [Icons](#16-icons)

## 1. How to use this contract

- Four reference frames, all iPad landscape, 1194x834. There are no phone frames (her app runs on an iPad):

| Screen | PNG | Node id |
|---|---|---|
| Math | `practice-math.png` | 45:1995 |
| Spelling | `practice-spelling.png` | 45:2100 |
| Reading passage | `practice-reading-passage.png` | 45:2180 |
| Reading questions | `practice-reading-questions.png` | 45:2242 |

- The source Figma file is the same one as `docs/DESIGN.md`. Its link is `FIGMA_URL` in the owner's `.env.local`. Treat the node ids as names only.
- The PNGs are a layout reference only. They show:
  - the green "steadily" theme
  - a sample child and grade
  - a fraction problem
  - "points" and "Homework" wording
  - a check mark on the chosen answer

  **Where a PNG and this file disagree, this file wins.** Recreate shapes, sizes and spacing exactly, and recolor with section 5.
- The status bar (time, battery) and the home indicator are device chrome. **Do not build them.**
- `{name}`, `{initials}` and `{grade}` are her data. Never hard-code a child's name.

## 2. Build constraints

These come from `scripts/check-conventions.mjs` and CLAUDE.md.

- All text lives in `src/copy.ts`. Section 13 has the final strings.
- Buttons are `<Button>` from `src/ui/Button.tsx`. Add the variants in section 7; never use a raw `<button>`.
- Numbers go through `src/ui/format.ts` (`COPY.macaronis` already does).
- Colors are custom properties. A hex value appears only on a `--name: #hex;` line.
- Never-negative wording. `check-conventions` rejects wrong, fail*, incorrect, bad, lose, lost, penalty, mistake(s) and oops. Also avoid "missed".
- No text boxes on her screens. The iPad keyboard never opens (SPEC §5.1).
- No new dependencies and no webfonts. Font is `system-ui`. Figma used Inter, and Lora for the passage; the passage uses `ui-serif, Georgia, serif`.
- Icons are inline SVG (section 16).
- **Weights:** 400, 500 and 600. 500 is Figma's "Medium".
- **Superseded child CSS** (in `src/index.css`):
  - `.assignment`, `.assignment-bar`, `.pad` and `.response` are replaced by the layout in sections 6 to 8.
  - The practice screens don't use `.button-primary`, `.button-key` or `.button-check`.
  - The Pair screen still uses `.button-key` and `.button-check`, and `NumberPad` keeps its Check key for it, with no Check key on the Math screen.
  - Keep `.stacked`, `.stacked-*` and `.answer-box*`, with the size overrides in section 8.

## 3. Units and layout frame

- **All values are CSS px.** `:root` sets `font-size: 24px`, so rem and em would scale. Practice CSS uses px only, like the parent portal.
- Letter-spacing is 0 unless the type scale gives a value.
- **Frame:** a column that fills the viewport (`min-height: 100dvh`), background `--l-bg`:
  1. **Top bar**: 82 high, plus `env(safe-area-inset-top)` above it (section 6.1).
  2. **Workspace**: padding 24 40 0 plus the safe areas left and right. Flex column, gap 20, `flex: 1`. It holds:
     1. the heading block (90 high)
     2. the activity row (478 in the frame). It takes `flex: 1; min-height: 478px`, and its panels stretch to its height.
     3. the actions row (64 high)
  3. Bottom padding is `max(16px, env(safe-area-inset-bottom))`, which replaces the home indicator.
- **Activity columns** (landscape, 1024 px wide and up). The content is 1114 wide at 1194:

| Screen | `grid-template-columns` (gap 24 unless stated) |
|---|---|
| Math | `minmax(0, 650fr) minmax(0, 440fr)` |
| Spelling | one panel. Inside it: `minmax(0, 460fr) minmax(0, 540fr)`, gap 48 |
| Reading passage | `minmax(0, 746fr) minmax(0, 344fr)` |
| Reading questions | `minmax(0, 1fr) minmax(0, 1fr)`. More than two questions wrap to new rows. |

- **Below 1024 px wide** (a portrait iPad, 834 wide): one column, in DOM order. Each panel's height is its content, and the page scrolls. The heading block and actions row stay as they are; if the title doesn't fit beside the progress, the progress drops below it.
  - DOM order is: problem then pad; listen then choices; passage then companion; question 1 then question 2.
  - This is not in Figma. Today's assignment also stacks in portrait.
- **Short landscape viewports:** the page scrolls; nothing shrinks below the sizes here. The passage text scrolls inside its panel (`overflow-y: auto`) when it is taller than the panel.

## 4. Type scale

| Token | px | Weight | Line height | Letter-spacing | Case | Color | Used for |
|---|---|---|---|---|---|---|---|
| brand | 28 | 400 | normal | −0.8 | as is | `--l-text` | "macworx" |
| status | 16 | 600 | normal | 0 | as is | `--l-link` | top bar Macaronis and streak |
| avatar | 14 | 400 | normal | 0 | upper | `--l-text` | initials |
| crumb | 14 | 400 | normal | 0 | as is | `--l-link` | "Practice  /  Math" |
| crumb-meta | 14 | 400 | normal | 0 | as is | `--l-muted` | "{name} · {grade}" |
| task-title | 30 | 400 | normal | −0.6 | as is | `--l-text` | screen title |
| progress | 14 | 500 | normal | 0 | as is | `--l-link` | "Problem 4 of 20" |
| eyebrow | 12 | 600 | normal | 1 (0.7 on question cards) | upper | `--l-link` | panel labels |
| instruction | 24 | 400 | 1.3 | 0 | as is | `--l-text` | Math instruction |
| digit | 52 | 500 | 1.2 | 0 | n/a | `--l-text` | stacked numbers |
| operator | 44 | 400 | 1.2 | 0 | n/a | `--l-muted` | + − × |
| pad-heading | 15 | 600 | normal | 0 | as is | `--l-text` | "Tap to enter your answer" |
| key | 28 | 500 | normal | 0 | n/a | `--l-text` | number keys |
| response-lead | 26 | 600 | 1.3 | 0 | as is | `--l-text` | "You got it!" (not in Figma) |
| response-line | 22 | 400 | 1.4 | 0 | as is | `--l-text` | "7 × 8 = 56", the right spelling or answer |
| note | 14 | 400 | normal | 0 | as is | `--l-muted` | actions row note |
| action | 17 | 600 | normal | 0 | as is | see buttons | action buttons |
| listen-title | 26 | 500 | normal | 0 | as is | `--l-text` | "Play word" |
| listen-sub | 16 | 400 | 1.5 | 0 | as is | `--l-muted` | listen instructions |
| support | 14 | 500 | normal | 0 | as is | `--l-link` | "Hear it in a sentence" |
| choice-heading | 18 | 600 | normal | 0 | as is | `--l-text` | "Which spelling is right?" |
| choice-hint | 13 | 400 | normal | 0 | as is | `--l-muted` | "Choose one" |
| marker | 14 | 600 | normal | 0 | upper | see choice | A, B, C, D |
| word-choice | 24 | 400 (600 chosen) | 1.4 | 0 | as is | `--l-text` | spelling choices |
| answer-choice | 17 | 400 (600 chosen) | 1.4 | 0 | as is | `--l-text` | reading choices |
| footnote | 13 | 400 | normal | 0 | as is | `--l-muted` | under choices |
| passage-title | 28 | 400 | normal | −0.5 | as is | `--l-text` | passage title |
| passage | 19 | 400 | 1.55 | 0 | as is | `--l-text` | passage text, serif |
| guide-title | 21 | 500 | normal | 0 | as is | `--l-text` | "Read at your own pace." |
| guide-text | 16 | 400 | 1.5 | 0 | as is | `--l-link` | reading hint |
| question | 23 | 400 | 1.35 | 0 | as is | `--l-text` | question text |
| done-title | 30 | 400 | 1.3 | −0.6 | as is | `--l-text` | finished state (not in Figma) |

## 5. Color roles and tokens

The green and beige Figma palette becomes the macworx mustards. The tokens sit under a `.practice` class on the screen root, prefixed `--l-`. Where a role equals an existing token, it points at it.

| Role | Figma hex (reference only) | Token | macworx value |
|---|---|---|---|
| Page background | `#f6f5f0` | `--l-bg` | `var(--paper)` (`#fff6dc`) |
| Surface (top bar, panels, keys, choices) | `#ffffff` | `--l-surface` | `#ffffff` |
| Inset (listen panel) | `#fafaf7` | `--l-inset` | `#fffbee` (new) |
| Divider and border | `#e0e5dd` | `--l-line` | `#efdba5` |
| Primary fill (action button, play button, chosen marker) | `#275d48` | `--l-primary` | `var(--accent)` (`#f2a516`) |
| On primary | `#ffffff` | `--l-primary-ink` | `var(--ink)` |
| Link ink (links, status, eyebrows, progress fill, chosen border, icons on light) | `#275d48` as text | `--l-link` | `var(--answer-ink)` (`#8a5a00`) |
| Soft fill (status chips, chosen choice, reading companion) | `#e7eee6` | `--l-chip` | `var(--soft)` (`#fde9b8`) |
| Warm (number pad panel) | `#efe7d8` | `--l-warm` | `#f6dc9e` |
| Avatar | `#eac9ac` | `--l-avatar` | `#f2c46b` |
| Text | `#243c32` | `--l-text` | `var(--ink)` |
| Muted text | `#748078` | `--l-muted` | `#6b5420` |
| Marker (not chosen) | `#f6f5f0` | (uses `--l-bg`) | |
| After Check: right | not in Figma | (existing) | `--right-soft` fill, `--right-edge` border |
| After Check: not right | not in Figma | (existing) | `--not-right-soft` fill, `--not-right-edge` border |

```css
.practice {
  --l-bg: var(--paper);
  --l-surface: #ffffff;
  --l-inset: #fffbee;
  --l-line: #efdba5;
  --l-primary: var(--accent);
  --l-primary-ink: var(--ink);
  --l-link: var(--answer-ink);
  --l-chip: var(--soft);
  --l-warm: #f6dc9e;
  --l-avatar: #f2c46b;
  --l-text: var(--ink);
  --l-muted: #6b5420;
}
```

**Contrast** (WCAG AA, 4.5:1 for text). Every pair the screens use:

| Text | On | Ratio |
|---|---|---|
| `--l-text` | bg / surface / inset / chip / warm / primary / avatar | 12.81 / 13.82 / 13.35 / 11.53 / 10.30 / 6.69 / 8.48 |
| `--l-text` | `--right-soft` / `--not-right-soft` | 11.72 / 11.11 |
| `--l-link` | surface / bg / inset / chip | 5.93 / 5.49 / 5.73 / 4.95 |
| `--l-muted` | surface / bg / inset / chip | 7.21 / 6.68 / 6.96 / 6.01 |

Rules that follow from the ratios:

- `--l-link` on `--l-warm` is 4.42. **Never put link text on the warm pad panel.** Its heading is `--l-text`.
- `--l-primary` is 2.07:1 on white, so it is never text or a thin icon on a light surface.
- The progress fill (`--l-link`) on its track (`--l-line`) is 4.33, which passes for a graphic.

## 6. Shared chrome

### 6.1 Top bar

- **Bar:** height 82, fill `--l-surface`, border-bottom 1 px `--l-line`. Padding-inline 40 (plus safe areas). Flex, space-between, centered.
- **Brand** (gap 12): sprout 25 (`--l-link`) and "macworx" (brand). Not a button.
- **Tools** (gap 12, centered). Every one is hidden when its data is missing (section 14):
  - **Macaronis:** status chip (7.2), coins icon 20 + `COPY.macaronis(balance)`.
  - **Streak:** status chip, flame icon 20 + "{n} days" ("1 day").
  - **Avatar:** circle 44, fill `--l-avatar`, `{initials}` (avatar).
- **Shop** (#123): a `Button` with the status chip's size (height 48, padding-inline 16, gap 10, radius 12), fill `--l-surface`, shopping-bag 20 + "Shop", status text style.
  - **Math assignment:** tapping it doesn't leave. The actions-row note becomes "Finish this assignment first, then visit the Shop." until her next tap on the pad or the action button, and the live region reads it.
  - **Spelling and Reading samples:** it opens the shop, since there is nothing to keep (SPEC §5.5).
  - Her app has no child Shop screen yet (SPEC §5.2), so the button is left out until that screen exists.
  - A read-only rewards dialog is a later idea.
- **The numbers are the ones Home showed** when the screen opened. They don't change mid-assignment.

### 6.2 Heading block

Column, gap 12, height 90.

1. **Context row:** height 24, space-between, centered.
   - **Left: the back control**, a `crumb` button (7.4): arrow-left 18 + "Practice  /  {Subject}" (two spaces each side of the slash).
     - Math: it does what "Done for now" does today (SPEC §5.1 step 7). Its accessible name is `COPY.leave`.
     - Spelling and Reading: it goes to Home.
   - **Right:** crumb-meta "{name} · {grade}". Without a grade it shows "{name}"; without a name, nothing.
2. **Task row:** height 54, space-between, centered.
   - Left: task-title.
   - Right: the progress block, width 182, column, gap 10:
     - progress label
     - track: height 6, radius 100, fill `--l-line`
     - fill: height 6, radius 100, `--l-link`, width = done ÷ total (Math: the problem she is on ÷ 20, as in Figma's 4 of 10 = 40%)
   - The progress block has `role="progressbar"` with `aria-valuenow`/`aria-valuemax` and the label as its name.

### 6.3 Actions row

Height 64, space-between, centered.

- **Left:** the note: row, gap 10, optional icon 20 (`--l-muted`) + note text.
- **Right:** the buttons, row, gap 12.

## 7. Shared components

### 7.1 Panel

Fill `--l-surface`, border 1 px `--l-line`, radius 20, padding 32 (question cards 28). Column. Variants:

- `warm`: fill `--l-warm`, no border, padding 24 (number pad)
- `soft`: fill `--l-chip`, no border, padding 0 (reading companion)

### 7.2 Status chip

Height 48, padding-inline 16, gap 10, radius 12, fill `--l-chip`. Icon 20 `--l-link` + status text. It is text, not a button.

### 7.3 Choice

A `<Button variant="choice">` in a `role="radiogroup"`. Each choice has `role="radio"` and `aria-checked`.

- **Shape:** height 78 (min-height 78; a reading choice may wrap to 2 lines), padding-inline 18, gap 16, radius 12, flex row centered.
- **Marker:** circle 32, centered letter (marker).
- **Text:** `flex: 1`, word-choice or answer-choice.

| State | Fill | Border | Marker | Text | Trailing icon |
|---|---|---|---|---|---|
| Not chosen | `--l-surface` | 1 px `--l-line` | fill `--l-bg`, letter `--l-muted` | 400 | none |
| Chosen (before Check) | `--l-chip` | 2 px `--l-link` | fill `--l-primary`, letter `--l-primary-ink` | 600 | **none**. Figma's check here would read as "right" before she has checked. |
| After Check, right | `--right-soft` | 2 px `--right-edge` | fill `--l-primary`, letter `--l-primary-ink` | 600 | check 22, `--l-text` |
| After Check, not right | `--not-right-soft` | 2 px `--not-right-edge` | fill `--l-primary`, letter `--l-primary-ink` | 600 | none (never a ✗) |
| After Check, others | as not chosen | | | | |

- After Check, the choices are disabled (no taps), with no opacity change.
- The right choice is never highlighted. The response line names it (SPEC §5.5).
- Focus-visible: 2 px outline `--l-link`, 2 px offset.

### 7.4 Buttons (new `Button` variants)

| Variant | Size | Fill | Border | Text and icon | Use |
|---|---|---|---|---|---|
| `action` | height 56, min-width 220, radius 12, gap 12, icon 20 after the label | `--l-primary` | 1 px `--l-primary` | `--l-primary-ink`, action | Check, Next, Check answers, Done, Back to Home |
| `action-secondary` | height 56, min-width 170, same | `--l-surface` | 1 px `--l-line` | `--l-link`, action | Read again |
| `crumb` | min-height 44 (hit area; the row is 24), gap 8, no padding, no fill | none | none | `--l-link`, crumb | back control |
| `key` (practice size) | height 72, radius 12 | `--l-surface` | none | `--l-text`, key; delete icon 27 `--l-link` | number pad |
| `play` | circle 112 | `--l-primary` | none | play icon 40, `--l-primary-ink` | Play word |
| `support` | height 44, gap 8 | none | none | `--l-link`, support; volume-2 18 | Hear it in a sentence |
| `choice` | 7.3 | | | | |

- **Disabled:** `opacity: 0.4; cursor: default`, as in the rest of the app.
- **Focus-visible:** 2 px outline `--l-link`, 2 px offset.
- No hover or pressed styles beyond the browser default.

### 7.5 Response line

Not in Figma. After Check, a column with gap 8:

- response-lead: a cheer when right
- response-line: the friendly answer when not right

It is announced through the existing hidden live region. Focus moves to the action button.

## 8. Screen: Math

Frame `practice-math.png`. Crumb "Practice  /  Math". Title "A little practice, a little progress." Progress `COPY.progress(n, 20)` ("Problem 4 of 20"; Figma's "Question 4 of 10" is a sample).

**Activity row** (columns in section 3):

1. **Problem panel** (7.1, padding 32, column, `justify-content: space-between`):
   - **Instructions** (gap 10): eyebrow "{Operation} practice" (Addition, Subtraction or Multiplication), then instruction: "Add the numbers." / "Subtract the bottom number from the top number." / "Multiply the numbers."
   - **The stacked problem** (`StackedProblem`, SPEC §5.1 step 3), centered both ways in the remaining space:
     - `.stacked` font-size 52, weight 500 (digit). The operator is 44 / 400 / `--l-muted`. The rule is 2 px `--l-text` (Figma's fraction bar), margin 8 0.
     - Answer boxes keep their classes and colors.
   - **Dropped from Figma:**
     - the fraction equation, the "Your answer" field and its hint (her answer is the boxes)
     - "Add the fractions. Simplify your answer."

   Fractions are a "Later" subject (SPEC §9): the PNG is their layout reference.
2. **Number pad panel** (7.1 `warm`, padding 24, column, gap 16):
   - **Heading row** (height 24): pad-heading "Tap to enter your answer". Figma's keyboard icon is dropped, because the keyboard never opens.
   - **Keys:** a 3-column grid, gap 10, `key` buttons 72 high, filled 1 2 3 / 4 5 6 / 7 8 9.
     - The bottom row is an empty cell, 0, then delete (delete icon 27, accessible name "Delete").
     - Figma's "/" key is dropped, and so is "Clear answer" (not in SPEC §5.1).
   - **After Check:** the panel's contents are replaced by the response (7.5), centered, in the same panel at the same size, so nothing jumps.
     - Right: the lead is `COPY.cheers`.
     - Not right: the lead is `COPY.showHow`, then the response-line equation, then `COPY.keepGoing` or `COPY.lastOne` as note text.

**Actions row:**

- Note (no icon): "Take your time. There's no timer."
- Button `action`:
  - Before Check: "Check" with check icon 20. Disabled until she types a digit.
  - After Check: "Next" with arrow-right 20.
  - After the 20th: "See how I did" with arrow-right 20.

## 9. Home buttons

Not in Figma (interim design, #122). Home keeps its current look, except that its "Start" button becomes a row of three `primary` buttons in the existing child style: "Math", "Spelling" and "Reading". The row wraps and is centered, with gap 16, and `startHint` stays below it.

- "Math" starts an assignment, exactly as "Start" does today.
- "Spelling" and "Reading" open the samples (sections 10 to 12).
- All three show on every iPad, paired or not.

## 10. Screen: Spelling

Frame `practice-spelling.png`. Crumb "Practice  /  Spelling". Title "Listen closely. Choose confidently." Progress "Word {n} of 8".

**Activity row:** one panel (7.1, padding 32) holding two columns (section 3):

1. **Listen** (fill `--l-inset`, radius 12, no border, column, centered both ways, gap 20, height 100%):
   - eyebrow "Listen and spell"
   - `play` button (accessible name "Play word"). It speaks the word with `speechSynthesis` (`lang` `en-US`, `rate` 0.8). Tapping again stops and replays.
   - Text block (width 360, max 100%, gap 8, centered): listen-title "Play word", listen-sub "Listen to the word, then choose its spelling."
   - `support` button "Hear it in a sentence": speaks the sample sentence.
   - **No speech** (`'speechSynthesis' in window` is false): both buttons are disabled, and listen-sub reads "This iPad can't play the word. You can still choose a spelling." (SPEC §5.5 step 4).
2. **Choices** (column, gap 10, height 100%):
   - Heading row (height 30, space-between, centered): choice-heading "Which spelling is right?" + choice-hint "Choose one".
   - Four `choice` buttons, A to D, word-choice text.
   - Footnote:
     - Before a choice: "Choose one spelling."
     - After a choice: "Ready to check."
     - After Check: replaced by the response (7.5).
       - Right: lead `COPY.cheers`.
       - Not right: response-line "This word is spelled {word}."

**Actions row:**

- Note: volume-2 icon 20 + "You can play the word as many times as you need."
- Button `action`:
  - "Check" with check 20, disabled until a choice is made.
  - Then "Next" with arrow-right 20.
  - After word 8: "Finish" with arrow-right 20.

**Finished** (not in Figma):

- The progress fills, and the activity row becomes one panel, centered, column, gap 16: done-title "You finished all 8 words!"
- The actions row has no note, and the button is `action` "Back to Home".
- There is no Macaroni line (SPEC §5.5).

## 11. Screen: Reading passage

Frame `practice-reading-passage.png`. Crumb "Practice  /  Reading". Title "Every good answer starts with a story." Progress "Step 1 of 2 · Read", 50%.

**Activity row** (columns in section 3):

1. **Passage panel** (7.1, padding 32, column, gap 20, `overflow-y: auto`):
   - Heading (gap 10): eyebrow "{kind} · {minutes} min read" (sample data), passage-title.
   - Text: paragraphs in passage style, serif, gap 18.
2. **Companion** (7.1 `soft`, radius 20, `overflow: hidden`, column):
   - **Art:** height 282, full width, `object-fit: cover`, `alt=""`. Shown only when the passage has art; the sample has none, so it is omitted.
   - **Guidance** (padding 24, column, gap 12): book-open 24 `--l-link`, guide-title "Read at your own pace.", guide-text (the passage's hint, sample data).

**Actions row:**

- Note: book-open 20 + "When you're ready, there are {n} questions about this passage."
- Button `action` "Next" with arrow-right 20 → Reading questions.

## 12. Screen: Reading questions

Frame `practice-reading-questions.png`. Crumb "Practice  /  Reading". Title is the passage title. Progress "Step 2 of 2 · Questions", 100%.

**Activity row:** one question card per question (7.1, padding 28, column, gap 16, columns in section 3):

- eyebrow (letter-spacing 0.7) "Question {n} · {skill}" (skill is sample data)
- question text, min-height 64 (two lines)
- choices: column, gap 12, three `choice` buttons with answer-choice text, A to C, each its own radiogroup
- footnote:
  - Before Check: "Choose one answer."
  - After Check: the response (7.5).
    - Right: lead `COPY.cheers` (rotating by question number).
    - Not right: response-line "The best answer is {letter}."

**Actions row:**

- Note: book-open 20 + one of:
  - "You can read the passage again." (none chosen)
  - "{k} answer chosen. You can read the passage again." (one chosen)
  - "{k} answers chosen. You can read the passage again." (more than one)
- Buttons:
  - `action-secondary` "Read again" (arrow-left 20 after the label, as in Figma) → the passage screen. Her choices are kept, and Next comes back here.
  - Then `action`:
    - "Check answers" with check 20, disabled until every question has a choice.
    - After Check: "Done" with arrow-right 20.
- After Check, "Read again" still works and the results stay.

**Finished:** as Spelling (section 10), done-title "You finished the passage and its questions!"

## 13. Copy

Final decisions on every Figma string:

- "steadily" → **macworx**. "points" → **Macaronis** (`COPY.macaronis`). "Homework" → **Practice**: the app is extra practice, never homework (SPEC §1).
- "Question 4 of 10" → `COPY.progress` "Problem {n} of 20". "Check answer" → "Check" (SPEC §5.1).
- "Which spelling is correct?" → "Which spelling is right?", which matches the app's right/not-right wording. "Listen to the word, then choose its correct spelling." → "Listen to the word, then choose its spelling."
- "Take your time. Your progress is saved." → "Take your time. There's no timer." Leaving starts a new assignment, and the samples save nothing.
- "One answer selected · Ready to check" → "Ready to check."; "2 answers selected · …" → "{k} answers chosen. …".
- "LISTEN & SPELL" → "Listen and spell".
- Figma's sample name, grade, word, passage and questions are replaced by her data and section 15.
- Dot separators are U+00B7 with a space each side; arrows are icons, not glyphs.

**New strings (not in Figma; the owner approves them in the PR):**

- **Math:**
  - "{Operation} practice"
  - the three instructions
  - "Take your time. There's no timer."
  - "Delete"
- **Spelling:**
  - "Choose one spelling."
  - "Ready to check."
  - "This word is spelled {word}."
  - "This iPad can't play the word. You can still choose a spelling."
  - "Finish"
  - "You finished all 8 words!"
  - "Back to Home"
- **Reading:**
  - "The best answer is {letter}."
  - the "answers chosen" lines
  - "Done"
  - "You finished the passage and its questions!"
- **Home:** "Math", "Spelling" and "Reading".
- **Top bar:** "Shop" and "Finish this assignment first, then visit the Shop."

## 14. Data mapping

| Element | Kind | Source |
|---|---|---|
| Top bar Macaroni balance, streak | Real | `numbers` from `homeNumbers()` (ARCHITECTURE "Home numbers"), hidden exactly when Home hides them (SPEC §5.1 step 1) |
| Avatar `{initials}`, "{name} · {grade}" | Real, new field | `children.name`, `grade` and `initials` exist, but `GET /api/state` doesn't return them. Add them to it and keep them with the Worker's state on the iPad. Until then the avatar and the meta line are left out. |
| Shop control | Not built | no child Shop screen yet; behavior settled (section 6.1, #123) |
| Problem, progress, Check, response | Real | engine `generateAssignment`, `checkAnswer`; unchanged flow (SPEC §5.1) |
| Spelling words, sentences, choices; passage, hint, questions, choices, skills | Sample | one module, `src/practice/samples.ts`, content in section 15 |
| Spelling and Reading answer checking | Engine | a pure `checkChoice(chosen, answer)` in `src/engine/` with its test, so a later recorded subject scores the same way on the Worker |
| Passage art | Not built | the placeholder passage has none. The Figma illustration is not added to the repo. Real passages and pictures come from the database later (SPEC §9). |

## 15. Sample content

`src/practice/samples.ts` holds exactly this. `answer` is the index of the right choice. Words are for a 7-year-old, unlike Figma's "necessary".

**Spelling** (8 words: word, sentence, choices A to D):

| Word | Sentence | Choices |
|---|---|---|
| friend | My friend sits next to me. | frend, freind, friend, frind |
| because | I smiled because it was sunny. | because, becuase, becos, beacause |
| said | Mom said it was time for lunch. | sed, siad, saide, said |
| again | Let's play that game again. | agin, again, agian, egain |
| people | Many people came to the park. | peple, poeple, people, peeple |
| there | The cat is over there. | there, thare, ther, theer |
| could | I could see the moon. | cood, culd, coud, could |
| where | Where did you put the ball? | whare, where, wher, wheer |

**Reading** (one passage):

Placeholder text (owner decision). Real passages, with a picture each, come later from the database (SPEC §9). There is no art, so the companion shows only its guidance block.

- Kind "Informational text", 2 min read. Title "Lorem ipsum dolor".
- Paragraphs:
  1. "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
  2. "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
  3. "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."
- Hint: "Lorem ipsum dolor sit amet."
- Question 1, skill "Find a detail": "Lorem ipsum dolor sit amet?"
  - A "Consectetur adipiscing elit."
  - B "Sed do eiusmod tempor." (answer)
  - C "Ut labore et dolore."
- Question 2, skill "Think it through": "Ut enim ad minim veniam?"
  - A "Quis nostrud exercitation." (answer)
  - B "Ullamco laboris nisi."
  - C "Ut aliquip ex ea commodo."

## 16. Icons

All inline SVG, Lucide (ISC). Render with `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`. Figma's practice icons use stroke 1.8; the portal's use 1.7. Scale by `width`/`height`, never the viewBox.

**Reused from `docs/DESIGN.md` §17** (same paths, stroke 1.8 here): sprout (25), coins (20), flame (20), shopping-bag (20, for later), check (render at 20 and 22).

**New:**

| Icon | viewBox | Path data `d` | Used at |
|---|---|---|---|
| arrow-left | 0 0 18 18 | `M9 3.7494L3.7494 9L9 14.2506M3.7494 9H14.2506` | crumb 18; Read again 20 (scale) |
| arrow-right | 0 0 20 20 | `M4.166 10H15.834M10 15.834L15.834 10L10 4.166` | Next, Finish, Done 20 |
| delete | 0 0 27 27 | `M13.5 10.1246L16.8753 13.5M16.8753 13.5L20.2506 16.8754M16.8753 13.5L20.2506 10.1246M16.8753 13.5L13.5 16.8754M11.2498 5.6241C10.6907 5.62413 10.1517 5.8323 9.73766 6.20804L2.61807 12.6663C2.50187 12.7717 2.40901 12.9003 2.34547 13.0438C2.28193 13.1873 2.2491 13.3425 2.2491 13.4994C2.2491 13.6564 2.28193 13.8116 2.34547 13.955C2.40901 14.0985 2.50187 14.2271 2.61807 14.3326L9.73766 20.792C10.1517 21.1677 10.6907 21.3759 11.2498 21.3759H22.5007C23.0975 21.3759 23.6698 21.1388 24.0918 20.7168C24.5138 20.2948 24.7509 19.7224 24.7509 19.1256V7.87436C24.7509 7.27755 24.5138 6.70519 24.0918 6.28318C23.6698 5.86118 23.0975 5.6241 22.5007 5.6241H11.2498Z` | pad 27 |
| play | 0 0 40 40 | `M8.332 8.3341C8.33183 7.74763 8.48643 7.17149 8.78019 6.66386C9.07396 6.15623 9.49649 5.73509 10.0051 5.44295C10.5138 5.15082 11.0905 4.99803 11.6771 5.00002C12.2636 5.00201 12.8393 5.15871 13.3459 5.45429L33.3434 17.1169C33.8481 17.4096 34.267 17.8297 34.5585 18.3351C34.8499 18.8405 35.0035 19.4135 35.004 19.9969C35.0045 20.5803 34.8519 21.1535 34.5613 21.6594C34.2708 22.1653 33.8526 22.5862 33.3484 22.8798L13.3459 34.5457C12.8393 34.8413 12.2636 34.998 11.6771 35C11.0905 35.002 10.5138 34.8492 10.0051 34.557C9.49649 34.2649 9.07396 33.8438 8.78019 33.3361C8.48643 32.8285 8.33183 32.2524 8.332 31.6659V8.3341Z` | play 40 |
| volume-2 | 0 0 18 18 | `M12.0001 6.75018C12.4869 7.39928 12.7501 8.18876 12.7501 9.00013C12.7501 9.8115 12.4869 10.601 12.0001 11.2501M14.5234 13.7728C15.1503 13.146 15.6475 12.4019 15.9867 11.583C16.326 10.7641 16.5006 9.88635 16.5006 8.99994C16.5006 8.11353 16.326 7.2358 15.9867 6.41686C15.6475 5.59793 15.1503 4.85383 14.5234 4.22704M8.24983 3.52677C8.24968 3.42231 8.21858 3.32023 8.16047 3.23342C8.10235 3.14661 8.01982 3.07896 7.9233 3.03901C7.82677 2.99905 7.72057 2.98858 7.61809 3.00892C7.51562 3.02926 7.42147 3.07949 7.34752 3.15328L4.80936 5.69047C4.71141 5.78901 4.59487 5.86712 4.46651 5.92029C4.33814 5.97346 4.2005 6.00063 4.06156 6.00022H2.24945C2.05052 6.00022 1.85974 6.07923 1.71908 6.21988C1.57842 6.36053 1.4994 6.55129 1.4994 6.7502V11.2501C1.4994 11.449 1.57842 11.6398 1.71908 11.7804C1.85974 11.9211 2.05052 12.0001 2.24945 12.0001H4.06156C4.2005 11.9997 4.33814 12.0268 4.46651 12.08C4.59487 12.1332 4.71141 12.2113 4.80936 12.3098L7.34677 14.8478C7.42072 14.9219 7.51501 14.9723 7.61768 14.9928C7.72035 15.0133 7.82679 15.0028 7.9235 14.9627C8.02021 14.9226 8.10285 14.8547 8.16094 14.7677C8.21904 14.6806 8.24997 14.5782 8.24983 14.4735V3.52677Z` | support 18; Spelling note 20 (scale) |
| book-open | 0 0 24 24 | `M12 7V21M12 7C12 5.93913 11.5785 4.92172 10.8283 4.17157C10.0781 3.42143 9.06063 3 7.99968 3H2.99928C2.73404 3 2.47967 3.10536 2.29212 3.29289C2.10457 3.48043 1.9992 3.73478 1.9992 4V17C1.9992 17.2652 2.10457 17.5196 2.29212 17.7071C2.47967 17.8946 2.73404 18 2.99928 18H8.99976C9.79547 18 10.5586 18.3161 11.1213 18.8787C11.6839 19.4413 12 20.2044 12 21M12 7C12 5.93913 12.4215 4.92172 13.1717 4.17157C13.9219 3.42143 14.9394 3 16.0003 3H21.0007C21.266 3 21.5203 3.10536 21.7079 3.29289C21.8954 3.48043 22.0008 3.73478 22.0008 4V17C22.0008 17.2652 21.8954 17.5196 21.7079 17.7071C21.5203 17.8946 21.266 18 21.0007 18H15.0002C14.2045 18 13.4414 18.3161 12.8787 18.8787C12.3161 19.4413 12 20.2044 12 21` | companion 24; Reading notes 20 (scale) |

**Colors:**

- `--l-link`: crumb, status, support, the companion's book-open and the delete key.
- `--l-primary-ink`: icons on action buttons and the play button.
- `--l-muted`: actions-row notes.
- `--l-text`: the after-Check check.

**Not used:** keyboard, cloud-check, Figma's "steadily" mark (the sprout replaces it) and the rain-garden illustration.
