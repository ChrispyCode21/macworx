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
- **Offline:** assignments work with no connection. Results sync when the iPad is back online.
- **Hosting:** Cloudflare Workers serve the app's static files and an `/api/*` Worker. Data lives in Cloudflare D1.
- **Trust:** the Worker re-scores every result with the same question engine the app uses. The app never decides what she earned; the Worker's totals are the record.
- **Users:** one child and her parents. The child's side needs no sign-in. The parent side (`/parent`, `/api/parent/*`) sits behind Cloudflare Access.

## 3. Non-goals (MVP)

- Subjects other than math.
- The spinner and the loot box.
- Push notifications to the parent.
- Time limits or timers of any kind.
- More than one child.
- Editing anything from the parent side (it is read-only).

## 4. Principles

1. **Course-correct, never punish.** Nothing she has earned is ever taken away. A missed answer shows the right one and moves on.
2. **Never-negative wording.** No text frames a result as failure. Grades are Excellent, Great, Good and Improving.
3. **Rewards come from effort.** Every Macaroni is earned by finishing work. There is no way to skip the work.
4. **No time pressure.** No timers, no limits, and no penalty beyond a streak starting over.

## 5. Core user flows

### 5.1 Do an assignment (child)

1. She opens the app and sees home: completed assignments, her Macaroni balance, her streak, and the grade of her latest assignment.
2. She starts an assignment: 20 math problems (§6.2).
3. Each problem is stacked like on paper: the numbers lined up by place value, one digit per column, the operator beside the second number, and a line. Below the line is one answer box per column: one more column than the numbers have for addition (room for a carry), as many as the numbers have for subtraction, and two for multiplication. No thousands separators appear in the stacked problem, so the columns stay lined up.
4. She enters her answer on an on-screen number pad (digits 0–9, a delete key and Check) and submits it with Check. The iPad keyboard never opens. She answers each problem once.
   - Addition and subtraction fill from the ones place leftward, the way she works the columns: for 100 + 200 she types 0, 0, 3.
   - Multiplication fills left to right, the way she writes a number: for 7 × 8 she types 5, 6. The answer stays lined up under the ones column, so a one-digit product sits in the ones box.
   - The box where her next digit goes is highlighted. Delete removes the digit she typed last. A box past the last one takes nothing.
   - Her answer is the number the boxes show; a leading 0 doesn't change it.
   - Correct: the app says so and shows the problem with its answer.
   - Not correct: the app shows the right answer in a friendly way (for example "7 × 8 = 56").
   - Either way, she taps Next when she's ready. Nothing moves on by itself.
5. After the 20th problem she sees the result: correct answers, Macaronis earned (with the accuracy and streak bonuses shown), and the grade.
6. She can start another assignment right away. Assignments are unlimited.
7. She can leave an assignment at any time. It ends early: she sees how many problems she did and the Macaronis they earned (§6.4), then home. When they earned none, the Macaroni line is left out rather than showing 0. Leaving before answering any problem records nothing. Leaving after answering all 20 counts as finishing, with the full result. The next assignment she starts is a new one.

### 5.2 Buy a reward (child)

1. Home links to the reward shop: each reward has an icon, a name and a price in Macaronis (§6.6).
2. She can buy any reward whose price is at most her balance. Buying it deducts the price from her balance and records the purchase.
3. A parent sees the purchase on the dashboard and grants the reward in real life.

### 5.3 Review progress (parent)

The parent dashboard reads the same data and changes nothing. It shows:

- Each finished assignment: date, every problem with her answer and the right answer, correct count, grade and Macaronis earned.
- Her balance, streak and purchase history.

A streak broken by something outside her control is restored by a parent editing D1 directly.

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

| Reward | Price |
|---|---|
| Ice cream | 75 |
| Pet shelter visit | 100 |
| Camping trip | 300 |

Prices are fixed. The streak bonus only speeds up earning.

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

### 7.R Rewards (§6.4, §6.7)

One 20-problem assignment a day, all correct, starting a fresh streak: day `n` pays 24 + min(n, 10).

| ID | Given | Expected |
|---|---|---|
| R1 | Ice cream, 75 | Balance 51 after day 2, 78 after day 3 → affordable on **day 3** |
| R2 | Pet shelter visit, 100 | Balance 78 after day 3, 106 after day 4 → affordable on **day 4** |
| R3 | Camping trip, 300 | Balance 295 after day 10, 329 after day 11 → affordable on **day 11** |

## 8. Contracts (signatures are in code, `src/engine/`)

The question engine is pure TypeScript: no React, no `fetch`, no D1, no clock and no `Math.random`. Randomness comes from the seed, and dates are passed in. It exposes:

- `generateAssignment(seed)`: the 20 problems of §6.2.
- `checkAnswer(problem, answer)`: §6.3.
- `nextStreak(state, today)`: the streak after finishing an assignment today, and whether it was the first of the day (§6.5).
- `payout(result)`: base, accuracy bonus, streak bonus and total for a finished assignment (§6.4).
- `leftEarlyPayout({ correct, answered, problemCount })`: the base-only payout for an assignment she leaves early (§6.4).
- `grade(correct, total)`: §6.6.

## 9. Later

Ideas outside the MVP. Each needs a spec section before it is built.

- **More subjects:** phonics (spoken word via the Web Speech API, pick the word or starting letters), spelling (pick the correct spelling, seeded from school lists), reading comprehension (parent-reviewed passages with multiple-choice questions).
- **Spinner:** earned spins that pick the subject or a reward, never "no work".
- **Loot box:** earned-only surprise rewards.
- **Carrying and borrowing:** work space on the stacked problem to mark a carried 1 or regroup from the next place.
- **Retry and partial credit:** a hint and a second try, with partial credit for a fixed answer.
- **Difficulty levels:** stretch problems that pay more than warm-ups.
- **Parent tools:** push notification on a purchase, adding spelling words and assignments, restoring a streak from the dashboard.
- **Full reward menu** with prices.
