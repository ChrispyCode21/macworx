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
- **Users:** parents and one or more children. The child's side needs no sign-in: her iPad holds a device key, and every child request to the Worker carries it. Each device belongs to exactly one child, and a child request acts for its device's child. A request without a valid key is refused and changes nothing. A device can't move to another child: a parent unpairs it and pairs it again. The parent side (`/parent`, every path under it, and `/api/parent/*`) sits behind Cloudflare Access, and the Worker also checks every parent request's Access token itself, refusing any request without a valid one (§6.9).

## 3. Non-goals (MVP)

- Recorded or paid subjects other than math. Spelling and Reading are sample practice only (§5.5).
- The spinner and the loot box.
- Push notifications to the parent.
- Time limits or timers of any kind.
- Sign-ins for children.

## 4. Principles

1. **Course-correct, never punish.** The app's rules never take away anything she has earned. A missed answer shows the right one and moves on. (A parent can adjust her Macaronis and streak in the parent portal, §5.3.)
2. **Never-negative wording.** No text frames a result as failure. Grades are Excellent, Great, Good and Improving.
3. **Rewards come from effort.** Every Macaroni is earned by finishing work. There is no way to skip the work.
4. **No time pressure.** No timers, no limits, and no penalty beyond a streak starting over.

## 5. Core user flows

### 5.1 Do an assignment (child)

1. She opens the app and sees home: completed assignments, her Macaroni balance, her streak, and the grade of her latest assignment. Each includes the assignments the Worker hasn't re-scored yet (§6.8). Her streak is left out when her last counted day isn't today, yesterday or tomorrow (§6.5), and when she has no streak yet. Until a paired iPad has the Worker's numbers once, and on an iPad that isn't paired, Home shows none of these. Home has three buttons: Math starts an assignment, and Spelling and Reading open their samples (§5.5).
2. She starts an assignment: 20 math problems (§6.2).
3. Each problem is stacked like on paper: the numbers lined up by place value, one digit per column, the operator beside the second number, and a line. Below the line is one answer box per column: one more column than the numbers have for addition (room for a carry), as many as the numbers have for subtraction, and two for multiplication. No thousands separators appear in the stacked problem, so the columns stay lined up.
4. She enters her answer on an on-screen number pad (digits 0–9 and a delete key) and submits it with the Check button at the bottom right of the screen. The iPad keyboard never opens. She answers each problem once.
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

1. Home links to the reward shop: each reward has an icon, a name and a price in Macaronis (§6.7). The practice screens' top bar also has a Shop button. During a math assignment it doesn't leave: it shows "Finish this assignment first, then visit the Shop." On the Spelling and Reading samples it opens the shop.
2. She can buy any reward whose price is at most her balance, but only while the iPad can reach the Worker. The Worker checks the price against its own balance, deducts it and records the purchase, so the Worker's balance is always the one spent.
3. A parent sees the purchase on the portal's Shop screen (§5.3) and grants the reward in real life.

### 5.3 Parent portal (admin)

The parent portal is admin mode: it shows everything and can change anything, for each child. It is a multi-screen app on the same origin, for a parent's phone, tablet or computer, in the app's colors and the system font but not her playful look. It never frames a result as a failure (§4).

**Getting there:** Home shows a visible **Parents** link. A parent never has to type an address. The link is a full page load, not a route inside her app, so Cloudflare Access can ask for a sign-in (§6.9). The portal works on a phone.

**Screens and routes:** five screens, each at its own address. `/parent` and any unknown `/parent/…` address show Overview.

| Screen | Route |
|---|---|
| Overview | `/parent/overview` |
| Points | `/parent/points` |
| Streak | `/parent/streak` |
| Devices | `/parent/devices` |
| Shop | `/parent/shop` |

Choosing a tab changes the address without reloading the page. Back and Forward move between tabs, and every address opens directly and survives a reload.

**Navigation:** below 768px wide (a phone) the five tabs are a bar at the bottom of the screen. From 768px wide (a tablet, including an iPad in portrait) the portal uses the wide layout of the iPad frames in docs/DESIGN.md. The screens, their content and their behavior are the same in both. The tabs read Overview, Macaronis, Streak, Devices and Shop; the Macaronis tab is the screen at `/parent/points`. Choosing a tab keeps the selected child. The wide layout's navigation is a side bar; its Parent space label and the line "Parent-only controls. Their progress stays theirs." sit at its foot; on a phone that line ends the Overview screen.

**Children and the child switcher:** a household has one or more children. Every screen has a child switcher showing the selected child's name and initials; choosing another child shows that child's numbers, results, devices and activity on every screen. The selection is remembered in that browser; with none remembered, the first child is selected. The switcher opens a list of the household's children (name, grade and initials each); choosing one switches every screen to that child. A parent can add a child and rename one, with a name, a grade and initials. A name is 1 to 40 characters (counted as Unicode characters, after trimming spaces). A name has no control characters and no bidirectional embedding, override or isolate characters (U+202A to U+202E, U+2066 to U+2069), and at least one visible character: a name made only of spaces, separators, control characters or invisible characters (zero-width space, word joiner, soft hyphen, byte order mark, variation selectors, Hangul fillers) is refused. The zero-width joiner and non-joiner, other invisible characters inside an otherwise visible name, and the left-to-right and right-to-left marks are allowed. Refused names get the same 400 `bad_name` and the same message, and the same rule applies to Add and Rename. Names may repeat. A grade is optional short text, at most 20 characters, trimmed. Initials are 1 to 3 letters, stored in capitals. When the initials box is empty they are filled from the name: the first letter of each of the first two words ("Mary Jane" gives MJ, "sam" gives S); a word that doesn't start with a letter adds nothing, and when nothing can be filled (a name such as "123") the parent is asked for initials. Overview has a Children panel with a two-option control, Add and Rename, in the style of the Macaronis Add and Remove control. Add makes a new child. Rename changes the selected child's name, grade and initials. The switcher list ends with an "Add a child" row, which opens Overview in Add mode, and each child's row has a "Rename" button, which selects that child and opens Overview in Rename mode. In Rename mode the form starts with the child's current name and grade; the initials box starts with the current initials, or empty when those are just the ones filled from the current name, so the initials keep following the name until the parent types their own. Adding a child selects her on every screen and remembers the choice in that browser. Add and Rename save with one Save button and have no Review step ("Review, then Confirm" is for Macaronis and streak only). Children can't be deleted. Adding is logged for the new child; renaming is logged for the renamed child with the old and new name, grade and initials; a rename that changes nothing is not logged. Recent activity reads both in plain words. A new household has one child, named "Child", which a parent renames.

**Sample data:** a screen shows only what the app really has, or what is plainly marked as sample. A value that can be worked out from real data is worked out (a device's last sync is the time of the latest result from it). A value the app has no source for, such as a personal best streak, a device's Online or Offline state and its browser and system line, is shown as sample data: it carries a visible "Sample" label, it lives in one clearly named place in the code so that real data can replace it, and it never reads as real. The portal never invents behavior.

**Overview** has, for the selected child:

- **Today's homework:** one number, the assignments she completed today (her finished results whose day is the parent's calendar day, not the last 24 hours), with the unit "assignments done" ("assignment done" for 1). It has no "of" total and no progress bar. Any subject it names comes from data, never from fixed text. Under it, "N Macaronis earned today." shows when she earned any today (the `earnedToday` of the Points screen).
- **Summary:** two tiles, her Macaronis (balance) and her streak in days, each with a Manage link to the Macaronis and Streak screens. Under them is one line with all her completed assignments and her last counted day.
- **Today's assignments:** each assignment she finished today, newest first, with its grade, the time it was recorded and the Macaronis it earned. With none it says "No assignments yet today." A "View all" link goes to Results.
- **Keep things in sync:** a row for her devices ("N connected devices", and when the latest of them last synced), linking to Devices, and a row for her rewards shop ("N rewards", and how many are within reach of her balance, left out at 0), linking to Shop. No "of".
- **Results:** each recorded assignment, newest first (the latest 50): date, correct count (of the problems she answered), grade and Macaronis earned. A result she left early shows "Left early" in place of a grade.

Choosing a link keeps the selected child and does not reload the page.

**Points** has, for the selected child:

- Her balance, and **Adjust balance** to add or remove Macaronis (below). Review stays disabled until the amount and note are valid, and the form shows her balance after the change.
- **Earned today:** the Macaronis she earned today (the parent's calendar day): the total paid on her results of that day, finished or left early. A parent's adjustment is not counted. It shows beside her balance and is left out when it is 0.
- **Recent activity:** every change a parent has made to her, newest first (the latest 50): when, which parent and what changed, in plain words. A balance change also shows its signed amount (for example +20 or −15), and not her balance before or after.

**Streak** has, for the selected child:

- A hero with her streak in days and, when she has a last counted day, the days it covers ("Oct 14–16"). "Today ✓" shows when her last counted day is today (the parent's calendar day). A "Personal best" line is sample data and carries the visible "Sample" label (see "Sample data").
- **The last 7 days:** the seven calendar days ending today (the parent's calendar day), oldest first, each with its weekday letter and date. A day is marked counted when she finished at least one assignment that day (a recorded finished result on it). Today has its own look and shows a check only when it is counted. Other days carry no mark and no text. The month of today names the strip.
- The form to correct her streak and last counted day (below).

**Devices** has, for the selected child:

- A count of her connected devices ("1 connected"), then one card for each connected device. An unpaired device is not listed (the activity log still names it). A card shows the device's name, "Added {date}", when it last synced, its status and browser line, and Unpair (§6.9). Last synced is the time of the latest result from the device: "Synced today, 4:05 pm" for today, "Synced Oct 12" for any other day, or "No results yet". The status (Online or Offline) and the browser line are sample data until the app has a source, each with a visible "Sample" label. Renaming a device and "View details" are shown disabled until they exist.
- **Pair a device** for this child (§5.4, §6.9): a panel with a device name box (1 to 40 characters; the box takes no more than 40, and a blank name, or one of only spaces, shows "Give the device a name of up to 40 characters." and makes no code) and a Generate pairing code button. Once made, the code shows as one string with "Expires in N minutes." counting down, then "This code has run out. Make a new one." A footnote says codes expire after 10 minutes and are private.
- **Before you disconnect** says that removing a device stops it saving progress for the child, while her synced homework, balance and streak stay safe (it uses her name, balance and streak), and that unpairing is reviewed, then confirmed, and work not yet synced stays on the device. A **Child access only** note says paired devices can't open parent controls.

**Shop** shows the rewards of §6.7 as in her shop (icon, name, price), read-only: every button and field is disabled. A summary says how many of them are within reach of her balance (a price at most her balance). Each reward says "Within reach" or how many Macaronis more it needs. An edit panel for the first reward is shown with every control disabled and the note "Editing rewards is coming soon." **Last redeemed** lists purchases (§5.2); with none it shows "No rewards redeemed yet." Prices are fixed (§6.7).

A parent can:

- Add a child, rename one, and switch between children.
- Pair a device to a child and unpair one (§6.9).
- Add or remove Macaronis with a note, for example to fix a mistake or to reward her real homework grades.
- Set or restore her streak and last counted day.

**Review, then Confirm:** every change to Macaronis or to a streak takes two steps. The parent fills in the form and chooses Review, which shows exactly what will change (for example, balance 40 to 60). Confirm saves it; Back returns to the form with nothing saved. There is no PIN; Cloudflare Access is the sign-in. Unpairing keeps its own warning (§6.9).

**Setting her streak:** the Streak screen has a form with two boxes, Streak (labelled "Corrected streak length", with the unit "days") and Last counted day, filled with her current values, and a **Review streak correction** button. Under the boxes it shows the range the streak implies: the days from (last counted day minus streak plus 1) to the last counted day. A range reads without a year ("Oct 29–Nov 2") unless its ends fall in different calendar years, when both ends carry it ("Sep 12, 2025–Oct 16, 2026"). The hero's range is the last counted day and up to 6 days before it (at most 7 days), while the preview range is never capped. The preview reads "Preview: Oct 10–16 · 3 → 7 days" and, with no counted days (streak 0), "Preview: no counted days · 3 → 0 days". Review shows the old and new streak and last counted day, and while it shows the two boxes can't be edited. Confirm saves; Back returns to the form with nothing saved and the typed values kept. After Confirm a "Streak saved." notice shows. There is no note box (the API takes only the streak and the day). Streak is a whole number from 0 to 3650. Last counted day is a date or empty; it may be empty only when the streak is 0, and may not be more than 1 day after the Worker's date (UTC), so a typo can't stall her streak (§6.8). Confirming changes only the streak and last counted day: not her balance, completed assignments or results, and it pays no streak bonus. Her next finished assignment continues from the saved values (§6.5). Each save is logged with the old and new streak and last counted day. If a result is being recorded at the same moment, the Worker works from the newest numbers, and after three lost races it answers 503 and nothing changes.

Every change is logged: what changed, when, which parent made it and which child it was for. The app's own rules never take anything away (§4); a parent's adjustments are the exception.

A recorded result and her answers never change; Add or Remove on the Points screen is the only way a parent changes the Macaronis she has earned. Recent activity still reads older result corrections in plain words, for example "Corrected the result of Oct 16: 15 to 18 right, +3 Macaronis: Marked a right answer wrong".

**Adding or removing Macaronis:** the Adjust balance form on the Points screen has a choice of Add or Remove, a number of Macaronis, a note and a Review button.

- The amount is a whole number from 1 to 100,000; Remove makes it negative. The note is required, 1 to 200 characters (spaces at either end don't count).
- Her balance can never end below 0. A removal larger than her balance is refused, with a line saying her balance and that it can't go lower. Nothing is changed.
- It changes her balance only: not her streak, completed assignments or results. Nothing on her screens mentions it; her Home shows the new balance after her next sync (§6.8).
- The log entry records the amount, her balance before and after, and the note. In Recent activity it reads, for example, "Added 20 Macaronis: Homework grades" or "Removed 5 Macaronis: Counted twice by mistake".
- After Review the form shows what will change and can't be edited. Back returns to the form with what was typed. After Confirm the form clears, a notice says her new balance, and her balance, Earned today and Recent activity update.
- If a result is being recorded at the same moment, neither change is lost: the adjustment is worked out again from the new balance (§6.8; ARCHITECTURE "Data"). If it can't be saved after a few tries, the page says to try again in a minute.

### 5.4 Pair her device

1. Until her device is paired, she can still practice; Home also shows a **Pair this device** button. It shows only when the app runs installed from the home screen, because Safari and the installed app keep separate storage, so a pairing done in Safari wouldn't reach her app. A PR preview build shows it in a browser tab too (§6.9), so paired screens can be checked on a phone or tablet.
2. A parent chooses the child on the portal's Devices screen and makes a code for her (§5.3, §6.9). On the Pair screen, the code is typed on the same number pad into six boxes, filled left to right, and sent with **Pair**.
3. Paired: the screen says so and the button disappears from Home. The device keeps its device key and belongs to the child the code was made for.
4. Not paired: a friendly line says what to do (ask for a new code, wait a minute, connect to Wi-Fi, or try again soon), and the boxes clear.
5. Whenever Home opens with a stored key, the device checks it with the Worker. If a parent has unpaired the device, the device forgets the key and the button comes back.

### 5.5 Spelling and Reading practice (child, samples)

Spelling and Reading are sample practice: they work on any iPad, paired or not, and online or offline. Their content is a fixed set of samples built into the app. The iPad checks her answers itself. Nothing is recorded or sent to the Worker, and they pay no Macaronis and don't count toward her streak, completed assignments or grade.

1. **Spelling:** 8 words, one at a time. For each word she plays it (the iPad says it aloud), can hear it in a sentence, and picks its spelling from four choices. She can play it as often as she likes. She picks one choice and taps Check. Then the choice she picked turns a soft green when it's right, or a soft coral when it's not, and a friendly line shows the right spelling. She taps Next when she's ready. After the 8th word she sees that she's done, with a button back to Home.
2. **Reading:** one passage, then its questions. She reads the passage and taps Next. Each question has three choices, and she picks one per question. **Read again** shows the passage again and keeps her choices. When every question has a choice she taps Check answers. Each question then shows the same green or coral as Spelling, with a friendly line naming the right answer. Then she taps Done and sees that she's done, with a button back to Home.
3. She can leave either one at any time with the back control. Nothing is kept: the next time she starts, it begins again from the first word or the passage.
4. If the iPad can't speak, the Play buttons are disabled and a line says the word can't be played on this iPad. She can still pick a choice.

The screens' layout, the shared top bar and the Math screen's layout are in `docs/DESIGN-PRACTICE.md`.

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

- **Whose numbers:** seeds, results and numbers belong to the child of the device that sends them. A child's balance, streak, last counted day and completed assignments are hers alone.
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
- **Pairing:** the parent chooses a child, names the device (up to 40 characters) and gets a 6-digit code for that child, valid for 10 minutes and for one use. Making a new code, for any child, voids any earlier unused one. The device that enters the right code is paired to that child. Five wrong tries void the code. On the iPad, entering the right code pairs it: the Worker returns its device key once and stores only the key's SHA-256.
- **Pairing rate limit:** at most 10 pairing tries a minute from one network address (an IPv6 address counts by its /64 block, roughly one home or connection). Beyond that the Worker answers 429 without looking at the code. This slows a flood of guesses; it can't stop someone who sends a few wrong guesses a minute from voiding a code, since 5 wrong tries void it. If that ever happens, the parent makes a new code later. The code's own one use, 10 minutes and 5 tries are what keep an iPad from being paired by anyone else. If the Worker has no rate limiter, pairing is refused (503) rather than left unguarded.
- **Preview pairing:** a PR preview can pair without a parent, so paired screens can be checked on a phone. The preview's own 6-digit code is a secret held in Cloudflare's preview settings, never in the repo. Typing it on the Pair screen pairs the device: the Worker makes a new device named "Preview" for the first child in the preview database and returns its key once. The code can be used any number of times and never expires; the pairing rate limit still applies first, and it is the only guard against guessing. It works only when the Worker is marked as a preview, has no Access settings and holds a valid code; any other code goes through the normal checks. Production never has the preview mark and always has Access settings, so the preview code does nothing there. A preview build also shows the Pair button outside the installed app (§5.4).
- **Unpairing:** an unpaired iPad's key is refused from then on, including results it hasn't synced yet. The portal warns before unpairing: "Results this device hasn't sent yet won't be saved."

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
| A12 | A preview build, not installed | Home shows **Pair this device**; a production build, not installed, does not |

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

### 7.C Streak edits (§5.3)

The Worker's date is 2026-10-17 UTC. Her state: balance 40, streak 3, last counted day 2026-10-16, completed 5, unless stated.

| ID | Given | Expected |
|---|---|---|
| C1 | A parent sets streak 7 and last counted day 2026-10-16 | Streak **7**, last counted day **2026-10-16**; balance **40**, completed **5** and results unchanged; one log entry with old streak 3 and day 2026-10-16, new streak 7 and day 2026-10-16, and the parent's email |
| C2 | Streak 0 with an empty last counted day (empty string or null) | Streak **0**, no last counted day; logged |
| C3 | An empty last counted day with streak 3 | Refused (400); nothing changed or logged |
| C4 | Last counted day 2026-10-18 (1 day after the Worker's date) | Accepted. 2026-10-19 is refused (400); nothing changed or logged |
| C5 | A streak of -1, 3651, 2.5, "5" or missing | Refused (400); nothing changed or logged. 0 and 3650 are accepted |
| C6 | A last counted day of "2026-02-30", "10/16/2026", 20261016 or missing | Refused (400); nothing changed or logged. An earlier real day (2026-01-05) is accepted |
| C7 | A result is recorded between the edit's read and its write | The edit is worked out again from the new row: the result's balance and completed stay, the streak and day are the edited ones, and the log shows the old values it really saw |
| C8 | The write loses the race three times | 503; nothing changed or logged |
| C9 | No Access token | Refused (401) |
| C10 | After a parent sets streak 7 and day 2026-10-16, a finished 20-correct result dated 2026-10-17 arrives | Streak **8**, last counted day **2026-10-17**, payout 20 + 4 + 8 streak = **32** (the edit paid nothing) |

### 7.T Last 7 days (§5.3)

The Worker's date is 2026-10-17 UTC; child 1; `today` = 2026-10-17 unless stated.

| ID | Given | Expected |
|---|---|---|
| T1 | Finished results on 2026-10-17, 2026-10-15, 2026-10-11 and 2026-10-10 | `days` is **["2026-10-11", "2026-10-15", "2026-10-17"]**: the seven days are 10-11 to 10-17, 10-10 is outside, oldest first. With `today` absent, the same (the Worker's date is used) |
| T2 | Three finished results on 2026-10-16 | 2026-10-16 is listed **once** |
| T3 | A result she left early (not finished) on 2026-10-16 | Not listed |
| T4 | A finished result on 2026-10-16 that belongs to another child | Not listed for this child |
| T5 | `today` "2026-02-30", "10/17/2026", 20261017, or 2026-10-19 (2 days after the Worker's date) | 400 `bad_day`; nothing read. 2026-10-18 and 2026-10-16 are accepted |
| T6 | No Access token | Refused (401) |

The page's day helpers:

| ID | Given | Expected |
|---|---|---|
| T7 | Today 2026-10-17; counted days 2026-10-15 and 2026-10-16 | Seven tiles, Oct 11 to Oct 17, weekday letters S M T W T F S; 15 and 16 counted, 17 today **without** a check, the rest plain. With 2026-10-17 also counted: 17 is today **with** a check |
| T8 | The range of a streak and last counted day (preview: whole streak; hero: at most the last 7 days) | Streak 3 ending 2026-10-16 → **Oct 14–16**; streak 7 → **Oct 10–16**; streak 20: preview **Sep 27–Oct 16**, hero **Oct 10–16**; streak 400: preview **Sep 12, 2025–Oct 16, 2026**; streak 3 ending 2026-01-02 → **Dec 31, 2025–Jan 2, 2026**; streak 5 ending 2026-11-02 → **Oct 29–Nov 2**; streak 1 → **Oct 16**; streak 0, or no last counted day → no range |
| T9 | The preview for old streak 3, boxes 7 and 2026-10-16 | "Preview: Oct 10–16 · 3 → 7 days". Boxes 0 and empty → "Preview: no counted days · 3 → 0 days". Boxes 1 and 2026-10-16 → "Preview: Oct 16 · 3 → 1 day". Boxes that can't be sent → no preview |
| T10 | The boxes as the Worker wants them (mirrors C2-C6) | "7" and 2026-10-16 → {7, 2026-10-16}; "0" and empty → {0, null}; "3" and empty → can't be sent; "3651", "2.5", "-1", "" or "abc" → can't be sent; "3650" accepted; a date that is not a real calendar day (20261-01-01, 2026-02-30) → can't be sent |

### 7.O Overview (§5.3)

The Worker's date is 2026-10-17 UTC; child 1; `today` = 2026-10-17 unless stated.

| ID | Given | Expected |
|---|---|---|
| O1 | Finished results on 2026-10-17 (two, paying 24 and 28), a result she left early on 2026-10-17 (paying 2), a finished result on 2026-10-16 | `completedToday` **2**; `earnedToday` 54 (the left-early result earns but does not complete) |
| O2 | No results at all | `completedToday` **0** |
| O3 | A finished result on 2026-10-17 that belongs to another child | `completedToday` 0 for this child |
| O4 | Finished results on 2026-10-17 (one) and 2026-10-18 (two); `today` = 2026-10-18 | `completedToday` **2**; with `today` absent, **1**. A `today` of 2026-02-30 or 2026-10-19 is 400 `bad_day` (as T5) |
| O5 | A parent sets a streak (POST /api/parent/streak) when she has one finished result on 2026-10-17 | The answer includes `completedToday` **1** |
| O6 | No Access token | Refused (401) on `GET /api/parent/summary` |

The page's helpers (today is the browser's local 2026-10-17; timestamps are local times):

| ID | Given | Expected |
|---|---|---|
| O7 | Hero count 0, 1, 2 and 1234 | "0 assignments done", "1 assignment done", "2 assignments done", "1,234 assignments done" |
| O8 | Results: a finished one today (grade Excellent, 24 Macaronis, recorded 4:05 pm), a left-early one today, a finished one yesterday | One row: "Assignment · Excellent", "Completed today, 4:05 pm", "+24". The left-early and yesterday results are not listed. With none: "No assignments yet today." |
| O9 | Devices: two connected (latest results Oct 12 and today 4:05 pm) and one unpaired (latest result today 5:30 pm) | "2 connected devices", "Last synced today, 4:05 pm" (the unpaired device's later result is ignored). With the connected device's latest result on Oct 12 only (and the unpaired one still at today 5:30 pm): "Last synced Oct 12". One connected, no results: "1 connected device", "No results yet". None connected: "0 connected devices", "No results yet" |
| O10 | Balance 41, 29, 30, 10,000 and unknown | "4 rewards · 1 within reach", "4 rewards", "4 rewards · 1 within reach", "4 rewards · 4 within reach", "4 rewards" (never "of") |
| O11 | The four shortcut links | "Manage Macaronis →" goes to /parent/points, "Manage streak →" to /parent/streak, the devices row to /parent/devices and the shop row to /parent/shop. Each has a real `href`, opens without a page load and keeps the selected child |

### 7.D Recorded results (§8)

A parent opens a result the Worker recorded.

| ID | Given | Expected |
|---|---|---|
| D13 | A parent opens a recorded result | Each problem with its operation, numbers, her answer and the right answer, in order; the same seed always shows the same problems |

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

- `GET /api/state?pending=…`: the device's child (name, grade and initials, for the practice screens' top bar), balance, streak, last counted day, completed assignments, the latest finished assignment's grade, and which of the listed seeds (up to 100) are already recorded.
- `POST /api/seeds`: tops the iPad up to 20 unused seeds and returns them.
- `POST /api/results`: records a result (§6.8) and returns it with the new state.

Child routes read and write only the device's child: the numbers are hers, and the seeds and results are the device's.

The parent API (every route needs a valid Access token, §6.9). A parent can list, add and rename children. Every parent route that reads or changes a child's data takes that child's id as the `child` query parameter, except the routes under `/api/parent/children`, which take no `child` (the PATCH names the child in its path), for example `GET /api/parent/summary?child=2` or `POST /api/parent/balance?child=2`. A missing or non-numeric `child` is 400 `bad_child`; a child that doesn't exist is 404 `unknown_child`; nothing is read or changed. A device, result or log entry that belongs to another child is 404 (`unknown_device`, `unknown_result`) and is never shown or changed. The routes below are listed by what they do for the chosen child.

- `GET /api/parent/children`: the household's children in the order they were added: id, name, grade and initials. It takes no `child`.
- `POST /api/parent/children { name, grade?, initials? }`: adds a child with a balance of 0 and returns her (201): id, name, grade and initials. An empty or missing `initials` is filled from the name. Logged for the new child.
- `PATCH /api/parent/children/:id { name?, grade?, initials? }`: changes the fields sent and returns her (200); fields not sent stay as they were. An empty `initials` is filled from the name (the new name if one is sent). Logged for that child with the old and new fields; a change that changes nothing is a 200 with no log row. Errors for both: 400 `bad_name`, `bad_grade`, `bad_initials` (also when nothing can be filled from the name) and `bad_body` (not JSON, or nothing to change); 404 `unknown_child` for an id that doesn't exist (PATCH); 503 `busy` after 3 lost races (PATCH).
- There is no route to delete a child.
- `GET /api/parent/devices`: the chosen child's paired and unpaired devices, each with `id`, `label`, `createdAt`, `revokedAt` and `lastResultAt` (the time the Worker recorded that device's latest result, or null when it has none).
- `DELETE /api/parent/devices/:id`: unpairs a device of the chosen child (logged).
- `POST /api/parent/pairing-code { name }`: a new pairing code for a device with that name; the device that uses it belongs to the chosen child (logged).
- `POST /api/parent/streak { streak, lastDay }`: sets her streak and last counted day (logged).
- `GET /api/parent/summary`: balance, streak, last counted day, completed assignments and `earnedToday`: the sum of the total paid on the chosen child's results whose day is the parent's calendar day (finished and left-early results count; parent adjustments do not), 0 with none, and `completedToday`: the number of the chosen child's finished results whose day is the parent's calendar day (results she left early do not count), 0 with none. It takes an optional `today` query parameter, the parent's calendar day as `YYYY-MM-DD`. A value that is not a real date, or is more than 1 day from the Worker's UTC date, is 400 `bad_day`. Without it, the Worker's UTC date is used. The `child` check comes first. `POST /api/parent/streak` answers with the same fields, for the Worker's UTC date.
- `GET /api/parent/days`: for the chosen child, the days among the seven ending on the parent's calendar day on which she has at least one finished result, oldest first, each once: `{ days: ["2026-10-11", ...] }`. It takes the same optional `today` query parameter as `GET /api/parent/summary`, with the same rule (absent: the Worker's date; not a real date, or more than 1 day from the Worker's date: 400 `bad_day`, nothing read).
- `GET /api/parent/results`: the latest 50 recorded results, newest first: day, answered, correct, finished, grade, total paid and `createdAt` (when the Worker recorded the result, an ISO timestamp).
- `POST /api/parent/balance { amount, note }`: adds (positive) or removes (negative) Macaronis with a note (§5.3). 400 for a bad amount or note, 409 for a removal larger than her balance (logged nothing), 503 when it can't be saved after 3 tries. Returns the new balance (logged).
- `GET /api/parent/results/:id`: one recorded result with its problems: day, answered, correct, finished, grade, total and, per problem, the operation, both numbers, her answer and the right answer. 404 for an unknown id.
- `GET /api/parent/log`: the latest 50 admin log entries for the chosen child, newest first: when, which parent, the action and its details.

Pairing, the one route with no key or token (the code is the gate, CLAUDE.md):

- `POST /api/pair { code }`: pairs the iPad and returns its device key once.

## 9. Later

Ideas outside the MVP. Each needs a spec section before it is built.

- **More subjects:** phonics (spoken word via the Web Speech API, pick the word or starting letters), recorded and paid spelling (words seeded from school lists, replacing the samples in §5.5), recorded and paid reading comprehension (short passages stored in the database, each with a relevant picture, parent-reviewed, replacing the placeholder passage in §5.5), and fractions (the fraction layout in `docs/DESIGN-PRACTICE.md`).
- **Spinner:** earned spins that pick the subject or a reward, never "no work".
- **Loot box:** earned-only surprise rewards.
- **Carrying and borrowing:** work space on the stacked problem to mark a carried 1 or regroup from the next place.
- **Retry and partial credit:** a hint and a second try, with partial credit for a fixed answer.
- **Difficulty levels:** stretch problems that pay more than warm-ups.
- **Parent tools:** push notification on a purchase, adding spelling words and assignments.
- **Rewards peek:** a read-only list of rewards, opened from the practice top bar during an assignment.
- **Portal detail:** purchase history beyond Last redeemed (with the reward shop, §5.2).
- **Editable rewards:** a parent changes the rewards and prices from the portal.
- **Child sign-ins:** a child who uses more than one device, or moves a device to another child.
- **More rewards:** the full reward menu beyond the four in §6.7.
