# macworx — Design Spec

Extra math practice for a 7-year-old, on her iPad, that rewards effort and never punishes.

This is the source of truth for what the app does. It describes the MVP. Anything not described here is undecided: ask the owner before building it (CLAUDE.md).

## 1. Problem

Her homework is limited to what school assigns, and doing it needs home, a pencil and a table. Nothing rewards her for doing extra practice.

macworx gives her:

- **Access:** extra math practice she can open anywhere on her iPad, on top of her assigned homework, never in place of it.
- **Motivation:** Macaronis, a currency she earns by doing problems and spends on real-world rewards her parents grant.

## 2. Platform & architecture

- **Device:** an iPad. The app is a PWA, installed from Safari (Share, then Add to Home Screen), and runs full screen.
- **Offline:** assignments work with no connection. Results sync when the iPad is back online. Buying a reward needs a connection (§5.2).
- **Hosting:** Cloudflare Workers serve the app's static files and an `/api/*` Worker. Data lives in Cloudflare D1.
- **Trust:** the Worker re-scores every result with the same question engine the app uses. The app never decides what she earned; the Worker's totals are the record. The Worker hands out the seeds assignments are generated from (§6.8).
- **Users:** one child and her parents. The child's side needs no sign-in: her iPad holds a device key, and every child request to the Worker carries it. A request without a valid key is refused and changes nothing. The parent side (`/parent`, `/api/parent/*`) sits behind Cloudflare Access, and the Worker also checks every parent request's Access token itself, refusing any request without a valid one (§6.9).

## 3. Non-goals (MVP)

- Subjects other than math.
- The spinner and the loot box.
- Push notifications to the parent.
- Time limits or timers of any kind.
- More than one child.

## 4. Principles

1. **Course-correct, never punish.** The app's rules never take away anything she has earned. A missed answer shows the right one and moves on. (A parent can correct anything in the dashboard, §5.3.)
2. **Never-negative wording.** No text frames a result as failure. Grades are Excellent, Great, Good and Improving.
3. **Rewards come from effort.** Every Macaroni is earned by finishing work. There is no way to skip the work.
4. **No time pressure.** No timers, no limits, and no penalty beyond a streak starting over.

## 5. Core user flows

### 5.1 Do an assignment (child)

1. She opens the app and sees home: completed assignments, her Macaroni balance, her streak, and the grade of her latest assignment. Each includes the assignments the Worker hasn't re-scored yet (§6.8). Her streak is left out when her last counted day isn't today, yesterday or tomorrow (§6.5), and when she has no streak yet. Until a paired iPad has the Worker's numbers once, and on an iPad that isn't paired, Home shows none of these.
2. She starts an assignment: 20 math problems (§6.2).
3. Each problem is stacked like on paper: the numbers lined up by place value, one digit per column, the operator beside the second number, and a line. Below the line is one answer box per column: one more column than the numbers have for addition (room for a carry), as many as the numbers have for subtraction, and two for multiplication. No thousands separators appear in the stacked problem, so the columns stay lined up.
4. She enters her answer on an on-screen number pad (digits 0–9, a delete key and Check) and submits it with Check. The iPad keyboard never opens. She answers each problem once.
   - Addition and subtraction fill from the ones place leftward, the way she works the columns: for 100 + 200 she types 0, 0, 3.
   - Multiplication fills left to right, the way she writes a number: for 7 × 8 she types 5, 6. The answer stays lined up under the ones column, so a one-digit product sits in the ones box.
   - The box where her next digit goes is highlighted. Delete removes the digit she typed last. A box past the last one takes nothing.
   - Her answer is the number the boxes show; a leading 0 doesn't change it.
   - After Check, her answer stays in the boxes exactly as she typed it; the boxes never change to a different answer.
   - Correct: the app says so, and her boxes turn a soft green.
   - Not correct: her boxes turn a soft coral (never bright red, and no ✗), and the line above Next shows the right answer in a friendly way (for example "7 × 8 = 56"). The right answer appears only there, never in her boxes.
   - Either way, she taps Next when she's ready. Nothing moves on by itself.
5. After the 20th problem she sees the result: correct answers, Macaronis earned (with the accuracy bonus, and the streak bonus on her first finished assignment of the day, shown), and the grade. Before the iPad has the Worker's numbers the streak bonus is left out.
6. She can start another assignment right away. Assignments are unlimited.
7. She can leave an assignment at any time. It ends early: she sees how many problems she did and the Macaronis they earned (§6.4), then home. When they earned none, the Macaroni line is left out rather than showing 0. Leaving before answering any problem records nothing. Leaving after answering all 20 counts as finishing, with the full result. The next assignment she starts is a new one.

### 5.2 Buy a reward (child)

1. Home links to the reward shop: each reward has an icon, a name and a price in Macaronis (§6.7).
2. She can buy any reward whose price is at most her balance, but only while the iPad can reach the Worker. The Worker checks the price against its own balance, deducts it and records the purchase, so the Worker's balance is always the one spent.
3. A parent sees the purchase on the dashboard and grants the reward in real life.

### 5.3 Parent dashboard (admin)

The parent dashboard is admin mode: it shows everything and can change anything. It lives at `/parent` on the same app, for a parent's phone or computer; nothing on her screens links to it. It is a plain, lightweight admin page for two parents, with the app's colors but not her playful look: small type, tables for lists, plain words, and never a result framed as a failure (§4). There is no navigation or routing; the page is one screen:

- **Summary strip** (top): her balance, streak, last counted day and completed assignments.
- **Results:** each recorded assignment, newest first (the latest 50): date, correct count (of the problems she answered), grade and Macaronis earned. A result she left early shows "Left early" in place of a grade.
- **iPads:** pair an iPad and the paired iPads, with Unpair (§6.9).
- **Adjustments:** add or remove Macaronis with a note (below).
- **Activity log:** every change a parent has made, newest first (the latest 50): when, which parent and what changed, in plain words.

On a phone the sections are stacked in that order below the summary. On a wide screen they sit in two columns: Results on the left; iPads, Adjustments and the Activity log on the right.

A parent can:

- Pair an iPad and unpair one (§6.9).
- Add or remove Macaronis with a note, for example to fix a mistake or to reward her real homework grades.
- Set or restore her streak and last counted day.
- Correct a recorded result.

Every change is logged: what changed, when, and which parent made it. The app's own rules never take anything away (§4); a parent's corrections are the exception.

**Adding or removing Macaronis:** the Adjustments section has a choice of Add or Remove, a number of Macaronis, a note and a Save button.

- The amount is a whole number from 1 to 100,000; Remove makes it negative. The note is required, 1 to 200 characters (spaces at either end don't count).
- Her balance can never end below 0. A removal larger than her balance is refused, with a line saying her balance and that it can't go lower. Nothing is changed.
- It changes her balance only: not her streak, completed assignments or results. Nothing on her screens mentions it; her Home shows the new balance after her next sync (§6.8).
- The log entry records the amount, her balance before and after, and the note. In the Activity log it reads, for example, "Added 20 Macaronis: Homework grades" or "Removed 5 Macaronis: Counted twice by mistake".
- If a result is being recorded at the same moment, neither change is lost: the adjustment is worked out again from the new balance (§6.8; ARCHITECTURE "Data"). If it can't be saved after a few tries, the page says to try again in a minute.

### 5.4 Pair her iPad

1. Until her iPad is paired, she can still practice; Home also shows a **Pair this iPad** button. It shows only when the app runs installed from the home screen, because Safari and the installed app keep separate storage, so a pairing done in Safari wouldn't reach her app. A PR preview build shows it in a browser tab too (§6.9), so paired screens can be checked on a phone or tablet.
2. A parent makes a code on the parent dashboard (§5.3, §6.9). On the Pair screen, the code is typed on the same number pad into six boxes, filled left to right, and sent with **Pair**.
3. Paired: the screen says so and the button disappears from Home. The iPad keeps its device key.
4. Not paired: a friendly line says what to do (ask for a new code, wait a minute, connect to Wi-Fi, or try again soon), and the boxes clear.
5. Whenever Home opens with a stored key, the iPad checks it with the Worker. If a parent has unpaired the iPad, the iPad forgets the key and the button comes back.

## 6. Domain rules

### 6.1 Problem generator

Problems come from code, not a question bank, so the supply never runs out.

- **Addition:** pick a digit count `d` from 3, 4 or 5, each equally likely. Both numbers have `d` digits (between 10^(d−1) and 10^d − 1). The answer is their sum, which can have `d + 1` digits.
- **Subtraction:** same digit rule as addition. The larger number comes first, so the answer is never negative. Equal numbers are allowed, and give 0.
- **Multiplication:** both factors are whole numbers from 0 to 9. The answer is their product, which can have two digits.

### 6.2 Assignment

- An assignment is 20 problems: 7 addition, 7 subtraction and 6 multiplication, in shuffled order.
- Every assignment is generated from a seed. The same seed always gives the same 20 problems, in the same order. The app sends the seed and her answers; the Worker regenerates the problems from the seed and re-scores them.

### 6.3 Scoring

- Each problem has one answer, computed by the generator.
- Her answer is a whole number. It is correct when its value equals the computed answer.
- **Accuracy** is correct answers divided by the problem count.

### 6.4 Macaroni payout

Finishing an assignment pays:

- **Base:** 1 Macaroni per correct answer.
- **Accuracy bonus:** 20% of the correct answers, rounded down. A 20-problem assignment pays up to +4.
- **Streak bonus:** on her first finished assignment of the day only, +1 per streak day, including today, up to +10 (§6.5).
- **Minimum:** a finished assignment always pays at least 1 Macaroni in total.

An assignment she leaves early (§5.1) pays the base only: 1 Macaroni per correct answer so far. It gets no accuracy bonus, streak bonus, minimum or grade, and doesn't count toward the streak.

Payout values live in one config module (CLAUDE.md).

### 6.5 Streak

- A **day** is a calendar date in the iPad's local time. A day counts toward the streak once she finishes at least one assignment that day.
- Her streak is the number of consecutive counted days ending today.
- If she finished an assignment yesterday, today's first finished assignment adds 1 to the streak. If her last counted day is earlier than yesterday, or there is none, the streak starts over at 1.
- Later assignments on the same day leave the streak unchanged and pay no streak bonus.
- If today is 1 day earlier than her last counted day (the iPad's clock was set back, or she crossed time zones), it counts as the same day: the streak and last counted day stay as they are, and no streak bonus is paid.
- If her last counted day is more than 1 day after today (the clock had jumped far ahead), the streak starts over at 1 and today becomes the last counted day, so one wrong clock reading can't stall the streak.

### 6.6 Grade

Each finished assignment gets one grade, from its accuracy:

| Grade | Accuracy |
|---|---|
| Excellent | 100% |
| Great | 90% or more |
| Good | 80% or more |
| Improving | Below 80% |

Home shows the grade of her latest assignment. Grade cutoffs live in the same config module as the payout values.

### 6.7 Rewards

| Reward | Icon | Price |
|---|---|---|
| Ice Cream | ice cream cone | 30 |
| Pet Store | storefront | 75 |
| Camping | tent | 300 |
| Puppy | puppy | 10,000 |

Prices are fixed. The streak bonus only speeds up earning. The small rewards cost a day of high effort, or a couple of days of light effort. The Puppy takes sustained, concerted effort, saving and budgeting: about 10 months of daily assignments.

### 6.8 Saving results

- **Seeds:** the Worker hands each iPad up to 20 unused seeds at a time and accepts each seed once. An iPad keeps its unused seeds so assignments work offline.
- **Recording:** the Worker regenerates the assignment from its seed and re-scores her answers. 20 answers is a finished assignment (§6.4 payout, §6.5 streak, §6.6 grade); fewer is one she left early (base only, no streak change, no grade).
- **The same result twice:** sending a result for a seed that's already recorded returns the recorded result and counts nothing again, so a retry after a lost connection is safe.
- **Day range:** a result's day may be no earlier than the day before its seed was handed out and no later than the day after the Worker's date (UTC), allowing for time zones. A day outside that range is recorded on the nearest day inside it rather than refused, so finished work is never lost. A day that had to be moved means the iPad's clock was wrong, so that result doesn't touch the streak: it's paid its base and accuracy bonus and counts as completed, but the streak, last counted day and streak bonus stay as they were. Because of this, her last counted day is never more than a day ahead of the real date, and a clock that's off by more than a day can't reset her streak. (A clock off by only a day looks the same as a time-zone difference, so it counts like any other day.)
- **Results that arrive late:** a result whose day is earlier than her last counted day counts as that same last day for the streak (no streak change, no streak bonus) and is still paid.
- **Completed assignments** counts finished assignments only.
- **On the iPad:** a paired iPad keeps its unused seeds, the results it hasn't sent yet, and the Worker's latest state in its own storage, and asks the browser to keep that storage. Each assignment uses the next stored seed, and its result is dated with the iPad's own day. Results go to the Worker one at a time, oldest first, whenever the app opens, Home shows, a result is saved, or the connection comes back; the Worker's numbers replace the iPad's. Home shows the Worker's latest numbers with each result not yet sent applied on top, oldest first, using the engine. Every result adds what it pays to the balance. A finished result also adds 1 to completed assignments, moves the streak (§6.5; a result dated before her last counted day counts as that day) and sets the latest grade. A result she left early adds only its base. Each result is applied with the day the iPad dated it. The Worker's numbers replace these after each sync. A result the Worker refuses as not valid is dropped, so it can't hold up the rest. When the iPad tops up its seeds, it leaves out seeds in its unsent results and the one she's working on. A stored seed she leaves without answering anything goes to the back of the list.
- **No seeds:** when a paired iPad has no seeds left and can't reach the Worker, Start shows "Connect to Wi-Fi to get more problems!"
- **Before the iPad has numbers:** a paired iPad that hasn't yet received the Worker's state, and an iPad that isn't paired, show no numbers on Home (not a balance of 0). A finished result leaves out the streak bonus: its total is base plus accuracy bonus, with the minimum applied.
- **Not paired:** an iPad without a device key still does assignments, each from a random seed, and saves nothing.

### 6.9 Parent access and pairing

- **Parent access:** every `/api/parent/*` request must carry a valid Cloudflare Access token for this app: signed by the team's keys, issued by the team, for this application, not expired, with the parent's email. Anything else is refused (401), including when the Worker isn't configured for Access, so PR previews never serve parent routes.
- **Pairing:** the parent names the iPad (up to 40 characters) and gets a 6-digit code, valid for 10 minutes and for one use. Making a new code voids any earlier unused one. Five wrong tries void the code. On the iPad, entering the right code pairs it: the Worker returns its device key once and stores only the key's SHA-256.
- **Pairing rate limit:** at most 10 pairing tries a minute from one network address (an IPv6 address counts by its /64 block, roughly one home or connection). Beyond that the Worker answers 429 without looking at the code. This slows a flood of guesses; it can't stop someone who sends a few wrong guesses a minute from voiding a code, since 5 wrong tries void it. If that ever happens, the parent makes a new code later. The code's own one use, 10 minutes and 5 tries are what keep an iPad from being paired by anyone else. If the Worker has no rate limiter, pairing is refused (503) rather than left unguarded.
- **Preview pairing:** a PR preview can pair without a parent, so paired screens can be checked on a phone. The preview's own 6-digit code is a secret held in Cloudflare's preview settings, never in the repo. Typing it on the Pair screen pairs the device: the Worker makes a new device named "Preview" in the preview database and returns its key once. The code can be used any number of times and never expires; the pairing rate limit still applies first, and it is the only guard against guessing. It works only when the Worker is marked as a preview, has no Access settings and holds a valid code; any other code goes through the normal checks. Production never has the preview mark and always has Access settings, so the preview code does nothing there. A preview build also shows the Pair button outside the installed app (§5.4).
- **Unpairing:** an unpaired iPad's key is refused from then on, including results it hasn't synced yet. The dashboard warns before unpairing: "Results this iPad hasn't sent yet won't be saved."

## 7. Worked examples → test cases

Each example is one unit test named with its stable ID, e.g. `it('P4: ...')`. If a rule changes, update its examples. Unless stated, an assignment has 20 problems, and "not first of the day" means another assignment was already finished today, so no streak bonus applies.

### 7.P Payout (§6.4)

| ID | Given | Expected |
|---|---|---|
| P1 | 20 correct, not first of the day | 20 + 4 accuracy → **24** |
| P2 | 15 correct (75%), not first of the day | 15 + 3 → **18** |
| P3 | 10 correct (50%), not first of the day | 10 + 2 → **12** |
| P4 | 20 correct, first of the day, 7-day streak | 20 + 4 + 7 streak → **31** |
| P5 | 17 correct, not first of the day | 20% of 17 is 3.4, rounded down → 17 + 3 → **20** |
| P6 | 4 correct, not first of the day | 20% of 4 is 0.8, rounded down → 4 + 0 → **4** |
| P7 | 0 correct, not first of the day | 0 earned, raised to the minimum → **1** |
| P8 | 0 correct, first of the day, 3-day streak | 0 + 0 + 3 streak → **3** (already above the minimum) |
| P9 | Left early after 8 problems, 7 correct, first of the day, 3-day streak | Base only → **7** (no bonus, streak bonus or grade) |
| P10 | Left early after 3 problems, 0 correct | Base only → **0** (no minimum) |

### 7.S Streak (§6.4, §6.5)

| ID | Given | Expected |
|---|---|---|
| S1 | No assignment ever finished; she finishes one today | Streak **1**, streak bonus **+1** |
| S2 | Streak 6, last counted day yesterday; she finishes one today | Streak **7**, streak bonus **+7** |
| S3 | Streak 9, last counted day yesterday; she finishes one today | Streak **10**, streak bonus **+10** |
| S4 | Streak 14, last counted day yesterday; she finishes one today | Streak **15**, streak bonus **+10** (capped) |
| S5 | She already finished one today (streak 7); she finishes another | Streak stays **7**, streak bonus **+0** |
| S6 | Streak 12, last counted day 2 days ago; she finishes one today | Streak starts over at **1**, streak bonus **+1** |
| S7 | Streak 5, last counted day tomorrow (the clock was set back); she finishes one today | Same as the same day: streak stays **5**, last counted day stays tomorrow, streak bonus **+0** |
| S8 | Streak 5, last counted day 3 days after today (the clock had jumped ahead); she finishes one today | Streak starts over at **1**, today becomes the last counted day, streak bonus **+1** |

### 7.G Grade (§6.6)

| ID | Given | Expected |
|---|---|---|
| G1 | 20 of 20 correct (100%) | **Excellent** |
| G2 | 19 of 20 (95%) | **Great** |
| G3 | 18 of 20 (90%) | **Great** (90% counts as Great) |
| G4 | 17 of 20 (85%) | **Good** |
| G5 | 16 of 20 (80%) | **Good** (80% counts as Good) |
| G6 | 15 of 20 (75%) | **Improving** |
| G7 | 0 of 20 (0%) | **Improving** |

### 7.M Generator and scoring (§6.1–§6.3)

| ID | Given | Expected |
|---|---|---|
| M1 | Any seed | 20 problems: **7 addition, 7 subtraction, 6 multiplication** |
| M2 | Addition and subtraction problems from 1,000 seeds | Both numbers have the **same digit count, 3 to 5** (100–999, 1,000–9,999 or 10,000–99,999) |
| M3 | Subtraction problems from 1,000 seeds | First number ≥ second; answer **never negative** |
| M4 | Subtraction 4,512 − 4,512 | Allowed; answer **0** |
| M5 | Addition 99,999 + 99,999 | Answer **199,998** (one more digit than the numbers) |
| M6 | Multiplication problems from 1,000 seeds | Both factors **0 to 9** |
| M7 | 7 × 8, answered 56; then answered 54 | 56 is **correct**; 54 is **not correct** |
| M8 | The same seed, generated twice | **Identical** problems in identical order |

### 7.W Saving results (§6.8)

Unless stated, the Worker's date is 2026-10-17 (UTC), the seed was handed out that day, and her state is balance 0, streak 0, no last counted day.

| ID | Given | Expected |
|---|---|---|
| W1 | A finished result, 20 correct, day 2026-10-17 | Recorded: payout 20 + 4 + 1 streak = **25**, balance **25**, streak **1**, completed **1**, grade **Excellent**; the seed is used |
| W2 | The same seed sent again | The recorded result comes back; balance stays **25**, completed stays **1** |
| W3 | A finished result dated 2026-10-19 (two days after the Worker's date) | Recorded on **2026-10-18** (the Worker's tomorrow) |
| W4 | A result with no device key, or a key that isn't valid | Refused (401); nothing recorded |
| W5 | Last counted day 2026-10-17 (streak 4); a finished result dated 2026-10-15 arrives | Counts as 2026-10-17: streak stays **4**, last counted day stays **2026-10-17**, no streak bonus; still paid |
| W6 | A result she left early: 8 answered, 7 correct | Paid **7**; streak, last counted day and completed unchanged; no grade |
| W7 | Streak 5, last counted day 2026-10-16; a finished result, 20 correct, dated 2026-10-20 (the clock was wrong) | Recorded on **2026-10-18**, paid 20 + 4 = **24** (no streak bonus); streak stays **5**, last counted day stays **2026-10-16**; completed **+1**, grade **Excellent** |

### 7.A Parent access and pairing (§6.9)

| ID | Given | Expected |
|---|---|---|
| A1 | A parent makes a code named "Her iPad"; the iPad sends that code within 10 minutes | Paired: a device key comes back once, and it works on child routes |
| A2 | The same code sent again | Refused; no second device |
| A3 | The code sent 11 minutes after it was made | Refused |
| A4 | Five wrong codes, then the right one | All refused: the fifth wrong try voids the code |
| A5 | A parent unpairs an iPad | Its key is refused (401) on every child route |
| A6 | A parent route without a valid Access token, or with the Worker's Access settings missing | Refused (401) |
| A7 | Ten pairing tries from one address within a minute, then an eleventh with the right code | The eleventh is refused (429) and the code is untouched: no try counted, still usable from another address |
| A8 | On a preview, the preview code sent twice | Paired both times: two devices named "Preview", each key works on child routes |
| A9 | The preview code sent to a Worker that has the Access settings, or lacks the preview mark, or has no preview code | Refused (400), no device |
| A10 | On a preview, a wrong code | Refused (400) like any wrong code |
| A11 | Eleven preview-code tries from one address within a minute | The eleventh is refused (429) before the code is read |
| A12 | A preview build, not installed | Home shows **Pair this iPad**; a production build, not installed, does not |

### 7.B Balance adjustments (§5.3)

Her balance is 40 unless stated.

| ID | Given | Expected |
|---|---|---|
| B1 | A parent adds 20 with the note "Homework grades" | Balance **60**; one log entry with amount 20, balance before 40 and after 60, the note and the parent's email; streak, last counted day, completed and results unchanged |
| B2 | A parent removes 15 (amount -15) with a note | Balance **25**; logged |
| B3 | A parent removes 41 | Refused (409), balance stays **40**, nothing logged |
| B4 | A parent removes exactly 40 | Balance **0**, logged |
| B5 | A missing, empty or all-spaces note, or one of 201 characters | Refused (400); nothing changed or logged. A note of 200 characters is accepted |
| B6 | An amount of 0, 100001, -100001, 2.5 or "5" | Refused (400); nothing changed or logged. 100000 and -40 are accepted |
| B7 | A result is recorded between the adjustment's read and its write | The adjustment is worked out again from the new balance: both changes apply, and the log shows the balance it really saw |
| B8 | A removal that was fine when read but the balance is lower when the write happens | Refused (409); balance never goes below 0 |
| B9 | The write loses the race three times | 503; nothing changed or logged |
| B10 | No Access token | Refused (401) |

### 7.R Rewards (§6.4, §6.7)

One 20-problem assignment a day, all correct, starting a fresh streak: day `n` pays 24 + min(n, 10).

| ID | Given | Expected |
|---|---|---|
| R1 | Ice Cream, 30 | Balance 25 after day 1, 51 after day 2 → affordable on **day 2** |
| R2 | Pet Store, 75 | Balance 51 after day 2, 78 after day 3 → affordable on **day 3** |
| R3 | Camping, 300 | Balance 295 after day 10, 329 after day 11 → affordable on **day 11** |
| R4 | Puppy, 10,000 | Balance 9,985 after day 295, 10,019 after day 296 → affordable on **day 296** |

## 8. Contracts (signatures are in code, `src/engine/`)

The question engine is pure TypeScript: no React, no `fetch`, no D1, no clock and no `Math.random`. Randomness comes from the seed, and dates are passed in. It exposes:

- `generateAssignment(seed)`: the 20 problems of §6.2.
- `checkAnswer(problem, answer)`: §6.3.
- `nextStreak(state, today)`: the streak after finishing an assignment today, and whether it was the first of the day (§6.5).
- `payout(result)`: base, accuracy bonus, streak bonus and total for a finished assignment (§6.4).
- `leftEarlyPayout({ correct, answered, problemCount })`: the base-only payout for an assignment she leaves early (§6.4).
- `grade(correct, total)`: §6.6.
- `addDays(day, n)`: the calendar day `n` days after (or before) `day`.

The Worker's child API (every route needs the iPad's device key):

- `GET /api/state?pending=…`: balance, streak, last counted day, completed assignments, the latest finished assignment's grade, and which of the listed seeds (up to 100) are already recorded.
- `POST /api/seeds`: tops the iPad up to 20 unused seeds and returns them.
- `POST /api/results`: records a result (§6.8) and returns it with the new state.

The parent API (every route needs a valid Access token, §6.9):

- `GET /api/parent/devices`: the paired and unpaired iPads.
- `DELETE /api/parent/devices/:id`: unpairs an iPad (logged).
- `POST /api/parent/pairing-code { name }`: a new pairing code for an iPad with that name (logged).
- `GET /api/parent/summary`: balance, streak, last counted day and completed assignments.
- `GET /api/parent/results`: the latest 50 recorded results, newest first: day, answered, correct, finished, grade and total paid.
- `POST /api/parent/balance { amount, note }`: adds (positive) or removes (negative) Macaronis with a note (§5.3). 400 for a bad amount or note, 409 for a removal larger than her balance (logged nothing), 503 when it can't be saved after 3 tries. Returns the new balance (logged).
- `GET /api/parent/log`: the latest 50 admin log entries, newest first: when, which parent, the action and its details.

Pairing, the one route with no key or token (the code is the gate, CLAUDE.md):

- `POST /api/pair { code }`: pairs the iPad and returns its device key once.

## 9. Later

Ideas outside the MVP. Each needs a spec section before it is built.

- **More subjects:** phonics (spoken word via the Web Speech API, pick the word or starting letters), spelling (pick the correct spelling, seeded from school lists), reading comprehension (parent-reviewed passages with multiple-choice questions).
- **Spinner:** earned spins that pick the subject or a reward, never "no work".
- **Loot box:** earned-only surprise rewards.
- **Carrying and borrowing:** work space on the stacked problem to mark a carried 1 or regroup from the next place.
- **Retry and partial credit:** a hint and a second try, with partial credit for a fixed answer.
- **Difficulty levels:** stretch problems that pay more than warm-ups.
- **Parent tools:** push notification on a purchase, adding spelling words and assignments.
- **Dashboard detail:** every problem of a result with her answer and the right answer, and purchase history (with the reward shop, §5.2).
- **More rewards:** the full reward menu beyond the four in §6.7.
