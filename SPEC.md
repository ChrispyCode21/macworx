# macworx — Design Spec

Extra practice (math, reading and spelling) for a 7-year-old, on her iPad, that rewards effort and never punishes.

This is the source of truth for what the app does. It describes the MVP. Anything not described here is undecided: ask the owner before building it (CLAUDE.md).

## 1. Problem

Her homework is limited to what school assigns, and doing it needs home, a pencil and a table. Nothing rewards her for doing extra practice.

macworx gives her:

- **Access:** extra practice, math, reading and spelling, she can open anywhere on her iPad, on top of her assigned homework, never in place of it.
- **Motivation:** Macaronis, a currency she earns by doing assignments and spends on real-world rewards her parents grant.

## 2. Platform & architecture

- **Device:** an iPad. The app is a PWA, installed from Safari (Share, then Add to Home Screen), and runs full screen.
- **Offline:** math assignments work with no connection, and their results sync when the iPad is back online. Reading and spelling assignments, and buying a reward (§5.2), need a connection.
- **Hosting:** Cloudflare Workers serve the app's static files and an `/api/*` Worker. Data lives in Cloudflare D1.
- **Trust:** the Worker re-scores every result with the same question engine the app uses. The app never decides what she earned; the Worker's totals are the record. The Worker hands out the seeds math assignments are generated from, the passages reading assignments are made of and the words spelling assignments are made of (§6.8, §6.10, §6.11).
- **Users:** parents and one or more children. The child's side needs no sign-in: her iPad holds a device key, and every child request to the Worker carries it. Each device belongs to exactly one child, and a child request acts for its device's child. A request without a valid key is refused and changes nothing. A device can't move to another child: a parent unpairs it and pairs it again. The parent side (`/parent`, every path under it, and `/api/parent/*`) sits behind Cloudflare Access, and the Worker also checks every parent request's Access token itself, refusing any request without a valid one (§6.9).

## 3. Non-goals (MVP)

- Recorded or paid subjects other than Math, Reading and Spelling.
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

### 5.1 Do a math assignment (child)

1. She opens the app and sees home. Its top bar has the macworx mark and name on the left and three links on the right: Home (the current page), Shop and Parents (with a lock icon). Under it are the heading "Ready for a little progress?", the line "Choose a subject and make it your own. One small step at a time.", the two columns below, and a footer line: "Take your time. You've got this." on the left and, with a lock icon, "Grown-up settings live in Parents." on the right.
   - **Subjects:** the column "What would you like to practice?", with "3 subjects" at its right, has one card for each. Each card has an icon, its title, one line and a Start button with an arrow. Math ("20 problems. Take your time.") opens the mix screen (step 2), Spelling ("Listen to a word, then type it.") starts a spelling assignment (§5.7) and Reading ("Read a passage, then answer a few questions.") starts a reading assignment (§5.6). Every kind of assignment counts the same: none takes precedence over another in her totals, streak or grade.
   - **Your progress:** the column "Your progress" has a card with her Macaroni balance ("{n} available to spend") and, below a divider, her streak ("{n} day" or "{n} days", with "Current streak"). Both include the assignments the Worker hasn't re-scored yet (§6.8). The streak and its divider are left out when her last counted day isn't today, yesterday or tomorrow (§6.5), and when she has no streak yet. Until a paired iPad has the Worker's numbers once, and on an iPad that isn't paired, the card shows no number and no streak, and says "Your Macaronis will show up here." (never a balance of 0, §6.8). Home does not show her completed assignments or the grade of her latest assignment; her results do (§5.1 step 5, §5.3).
   - **Shop card:** under the progress card, a card says "A little effort. A little reward." and "Put your Macaronis toward something you love." with a link "Explore the shop". It and the top bar's Shop link open the reward shop (§5.2) once its screen exists; until then they show and do nothing.
   - **Layout:** at 768 px wide and up (an iPad in either orientation) the subjects are the left column and her progress and the shop card the right column. Below 768 px (a phone) there is one column: the progress card, the shop card, then the subjects. Home never scrolls sideways.
2. She taps Math and sees the mix screen: the heading "Make a math mix of your own.", the line "Tap the problems you'd like to try. Pick up to 3.", a count "n of 3 picked", and a grid with a row for each operation (Addition, Subtraction, Multiplication, Division) and a column for each level (Easy, Medium, Hard, marked with one, two and three dots). Each cell shows a sample problem: 3 + 4, 27 + 16 and 248 + 375; 8 − 3, 42 − 17 and 504 − 268; 3 × 4, 7 × 8 and 24 × 6; 12 ÷ 3, 56 ÷ 7 and 144 ÷ 12. She taps a cell to pick it and taps it again to unpick it. With 3 picked, the other cells dim and take no taps, and the note "Tap one of your picks to swap it." shows: tapping a pick unpicks it, and the cell she picks next goes last in the order. A side panel shows her mix. With none picked it says "Your next little win." and "Pick something to start"; with 1 pick, "One at a time."; with 2, "A little of both."; with 3, "A little of everything." With picks it lists each one in the order she picked it, with its operation, its level and its number of problems (§6.2), then "20 problems", "Mixed together into one practice." (for 2 or 3 picks) and "Earn up to X Macaronis.", where X is the most the assignment could pay her today (§6.4, M14 to M17). "Same as last time" picks the mix of the last assignment she started on this iPad, in the same order; it shows only when there is one, and she can still change the picks. The "Home / Math" crumb goes back to Home. The mix screen has the same top bar as home (the macworx mark and name, then the Home, Shop and Parents links). "Start 20 problems" is disabled until she has picked at least one cell; it starts the assignment: 20 math problems (§6.2) of her mix. The screen has a top bar with her Macaroni balance and her streak, shown and hidden by the same rules as on home, then a heading with the "Practice / Math" crumb and "Problem n of 20" with a progress bar, then two panels, the problem in its own panel under an "{Operation} practice" label (for example "Addition practice") with a one-line instruction, and the number pad in a panel headed "Tap to enter your answer", then a row of actions with a note on the left and the buttons on the right.
3. Each problem is stacked like on paper: the numbers lined up by place value, one digit per column, the operator beside the second number, and a line. Below the line is one answer box per column: one more column than the numbers have for addition (room for a carry), as many as the numbers have for subtraction, and one per digit of both factors together for multiplication (two for 7 × 8, three for 24 × 6). A division problem is stacked like a long-division bracket: the divisor to the left of a bracket around the dividend, with one answer box above each digit of the dividend, lined up so the last box is over the dividend's ones digit. No thousands separators appear in the stacked problem, so the columns stay lined up.
4. She enters her answer on an on-screen number pad (digits 0–9 and a delete key) and submits it with the Check button in the actions row at the bottom right of the screen. The iPad keyboard never opens. After Check, her response replaces the number pad in that same panel. She answers each problem once.
   - Addition and subtraction fill from the ones place leftward, the way she works the columns: for 100 + 200 she types 0, 0, 3.
   - Multiplication and division fill left to right, the way she writes a number: for 7 × 8 she types 5, 6, and for 56 ÷ 7 she types 8. The answer stays lined up with the ones column: her first digit goes in the ones box and moves one box left as each next digit comes, so for 144 ÷ 12 typing 1, 2 shows the 1 in the ones box, then the 1 in the tens box and the 2 in the ones box. The highlighted box is the ones box until all the boxes are full.
   - The box where her next digit goes is highlighted. Delete removes the digit she typed last. A box past the last one takes nothing.
   - Her answer is the number the boxes show; a leading 0 doesn't change it.
   - After Check, her answer stays in the boxes exactly as she typed it; the boxes never change to a different answer.
   - Correct: the app says so, and her boxes turn a soft green.
   - Not correct: her boxes turn a soft coral (never bright red, and no ✗), and the line above Next shows the right answer in a friendly way (for example "7 × 8 = 56"). The right answer appears only there, never in her boxes.
   - Either way, she taps Next when she's ready. Next takes Check's place in the actions row and ignores taps for a moment after it appears, so a quick double tap on Check can't also move on. Nothing moves on by itself.
5. After the 20th problem she sees the result: correct answers, Macaronis earned (with the accuracy bonus, and the streak bonus on her first finished assignment of the day, shown), and the grade. Before the iPad has the Worker's numbers the streak bonus is left out.
6. She can start another assignment right away: "Do another one" starts a new assignment of the same mix. Assignments are unlimited.
7. She can leave an assignment at any time with the "Practice / Math" crumb. It ends early: she sees how many problems she did and the Macaronis they earned (§6.4), then home. When they earned none, the Macaroni line is left out rather than showing 0. Leaving before answering any problem records nothing. Leaving after answering all 20 counts as finishing, with the full result. The next assignment she starts is a new one.

### 5.2 Buy a reward (child)

1. Home's top bar and its shop card (§5.1 step 1) link to the reward shop: each reward has an icon, a name and a price in Macaronis (§6.7). The practice screens' top bar also has a Shop button. During a math, reading or spelling assignment it doesn't leave: it shows "Finish this assignment first, then visit the Shop." On the Spelling and Reading samples (§5.5) it opens the shop.
2. She can buy any reward whose price is at most her balance, but only while the iPad can reach the Worker. The Worker checks the price against its own balance, deducts it and records the purchase, so the Worker's balance is always the one spent.
3. A parent sees the purchase on the portal's Shop screen (§5.3) and grants the reward in real life.

### 5.3 Parent portal (admin)

The parent portal is admin mode: it shows everything and can change anything, for each child. It is a multi-screen app on the same origin, for a parent's phone, tablet or computer, in the app's colors and the system font but not her playful look. It never frames a result as a failure (§4).

**Getting there:** Home's top bar shows a visible **Parents** link with a lock icon, and its footer says grown-up settings live in Parents. A parent never has to type an address. The link is a full page load, not a route inside her app, so Cloudflare Access can ask for a sign-in (§6.9). The portal works on a phone.

**Screens and routes:** six screens, each at its own address. `/parent` and any unknown `/parent/…` address show Overview.

| Screen | Route |
|---|---|
| Overview | `/parent/overview` |
| Content | `/parent/content` |
| Points | `/parent/points` |
| Streak | `/parent/streak` |
| Devices | `/parent/devices` |
| Shop | `/parent/shop` |

Choosing a tab changes the address without reloading the page. Back and Forward move between tabs, and every address opens directly and survives a reload.

**Navigation:** below 768px wide (a phone) the six tabs are a bar at the bottom of the screen. From 768px wide (a tablet, including an iPad in portrait) the portal uses the wide layout of the iPad frames in docs/DESIGN.md. The screens, their content and their behavior are the same in both. The tabs read Overview, Content, Macaronis, Streak, Devices and Shop; the Macaronis tab is the screen at `/parent/points`. Choosing a tab keeps the selected child. The wide layout's navigation is a side bar; its Parent space label and the line "Parent-only controls. Their progress stays theirs." sit at its foot; on a phone that line ends the Overview screen.

**Children and the child switcher:** a household has one or more children. Every screen has a child switcher showing the selected child's name and initials; choosing another child shows that child's numbers, results, devices and activity on every screen. The selection is remembered in that browser; with none remembered, the first child is selected. The switcher opens a list of the household's children (name, grade and initials each); choosing one switches every screen to that child. A parent can add a child and rename one, with a name, a grade and initials. A name is 1 to 20 characters (counted as Unicode characters, after trimming spaces). A name has no control characters and no bidirectional embedding, override or isolate characters (U+202A to U+202E, U+2066 to U+2069), and at least one visible character: a name made only of spaces, separators, control characters or invisible characters (zero-width space, word joiner, soft hyphen, byte order mark, variation selectors, Hangul fillers, the braille blank U+2800, combining marks, other format characters such as U+0600 to U+0605 and U+FFF9 to U+FFFB, and private-use or unassigned code points) is refused. The zero-width joiner and non-joiner, other invisible characters inside an otherwise visible name, and the left-to-right and right-to-left marks are allowed. Refused names get the same 400 `bad_name` and the same message, and the same rule applies to Add and Rename. Names may repeat. A grade is optional short text, at most 5 characters ("Pre-K" is the longest of Pre-K, K and 1 to 12), trimmed, and shown as typed ("Ada · 4"); it isn't checked against a list of grades. Initials are 1 to 3 letters, stored in capitals. When the initials box is empty they are filled from the name: the first letter of each of the first two words ("Mary Jane" gives MJ, "sam" gives S); a word that doesn't start with a letter adds nothing, and when nothing can be filled (a name such as "123") the parent is asked for initials. Overview has a Children panel with a two-option control, Add and Rename, in the style of the Macaronis Add and Remove control. Add makes a new child. Rename changes the selected child's name, grade and initials. The switcher list ends with an "Add a child" row, which opens Overview in Add mode, and each child's row has a "Rename" button, which selects that child and opens Overview in Rename mode. In Rename mode the form starts with the child's current name and grade; the initials box starts with the current initials, or empty when those are just the ones filled from the current name, so the initials keep following the name until the parent types their own. Adding a child selects her on every screen and remembers the choice in that browser. Add and Rename save with one Save button and have no Review step ("Review, then Confirm" is for Macaronis and streak only). After a child is added, focus moves to the page heading; after a rename saves, focus stays on the Save button, and a rename that fails leaves focus where it is. Children can't be deleted. Adding is logged for the new child; renaming is logged for the renamed child with the old and new name, grade and initials; a rename that changes nothing is not logged. Recent activity reads both in plain words. A new household has one child, named "Child", which a parent renames. If the children can't be listed, every screen shows only "We can't show your children right now." and a **Try again** button, with no forms and no switcher; when the sign-in has run out it shows the sign-in message instead, without the button. A household with no children shows "No children yet." and the Add form, on every screen.

**Content screen:** where a parent adds the practice content that every child shares (it does not change with the selected child). It has a Spelling card and a Reading card, and a note that only a parent can manage this content.

- **Words:** a box to type or paste words, one per line or separated by commas, with a live count ("10 words") and the note "Blank lines are ignored." A line is a word, or `word: sentence` when the sentence says which word is meant ("their: They ate their dinner."), and may carry alternates, `favourite/favorite` (§6.11). **Save word list** adds them and says how many were added and how many skipped; the box doesn't show the words already saved. Each new word is checked against the US and UK English dictionaries first and the result is shown (§6.11). **Edit list** opens a dialog: a search box, then every word with its sentence and alternates, each with a delete [x] and an edit [pencil]. The search matches the word, its alternates and its sentence, ignoring capitals; with no words it says "No words yet.", and with no match "No words match.". The pencil opens that word's word, sentence and alternates (separated by commas) in boxes with **Save** and **Cancel**; a word that is already in the list shows "That word is already in the list.". The [x] asks "Delete \"word\"?" with **Delete** and **Keep**. Editing and deleting change the list at once and leave recorded results as they were (§6.11).
- **Passage:** **Copy prompt + schema** copies a prompt for an AI assistant and the passage's JSON schema (§6.10). A box with line numbers takes the pasted JSON, and a line under it says "Valid JSON · 1 passage · N questions" or, for a passage that fails the checks, what to fix in words a parent understands ("Question 4 has two right answers"), never a stack trace. A valid passage shows a preview: its title, minutes and each question with its four choices and the right one marked. **Save passage** adds it; nothing is saved before. An optional picture is added with "Upload or drag and drop". A list of the saved passages (title, minutes, questions, times read) has Edit, which loads the passage's JSON into the box, and Delete, which asks first.

**When a read fails:** a number or list that has not loaded shows "Loading…" until a read fails, then "Not available right now." in its place (not a dash). The blocks that did load keep their values.

**Sample data:** a screen shows only what the app really has, or what is plainly marked as sample. A value that can be worked out from real data is worked out (a device's last sync is the time of the latest result from it). A value the app has no source for, such as a personal best streak, a device's Online or Offline state and its browser and system line, is shown as sample data: it carries a visible "Sample" label, it lives in one clearly named place in the code so that real data can replace it, and it never reads as real. The portal never invents behavior.

**Overview** has, for the selected child:

- **Today's homework:** one number, the assignments she completed today (her finished results whose day is the parent's calendar day, not the last 24 hours), with the unit "assignments done" ("assignment done" for 1). It has no "of" total and no progress bar. Any subject it names comes from data, never from fixed text. Under it, "N Macaronis earned today." shows when she earned any today (the `earnedToday` of the Points screen).
- **Summary:** two tiles, her Macaronis (balance) and her streak in days, each with a Manage link to the Macaronis and Streak screens. Under them is one line with all her completed assignments and her last counted day.
- **Today's assignments:** each assignment she finished today, newest first, with its kind (Math, Reading with the passage's title, or Spelling), its grade, the time it was recorded and the Macaronis it earned. With none it says "No assignments yet today." A "View all" link goes to Results.
- **Keep things in sync:** a row for her devices ("N connected devices", and when the latest of them last synced), linking to Devices, and a row for her rewards shop ("N rewards", and how many are within reach of her balance, left out at 0), linking to Shop. No "of".
- **Results:** each recorded assignment, newest first (the latest 50): date, what she practiced, correct count (of the problems or questions she answered), grade and Macaronis earned. A result she left early shows "Left early" in place of a grade. The Practice column, after Date, reads the mix for a math result and the passage's title for a reading result and "Spelling" for a spelling result. A math result's picks read in the order she picked them as an operation and its level in plain words ("Multiplication, medium"), joined with " · " ("Multiplication, medium · Division, easy"); a result with no mix (the fixed mix of §6.1) reads "Mixed". There is no screen for one result's detail: the API has it (§8).

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

Every change to a child is logged: what changed, when, which parent made it and which child it was for. Content (words and passages, which every child shares) is not logged. The app's own rules never take anything away (§4); a parent's adjustments are the exception.

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

### 5.5 The samples (child)

Spelling on an iPad that isn't paired, or whose Worker has no words, and Reading on an iPad that isn't paired, or whose Worker has no passages, are samples. They work on any iPad, online or offline. Their content is built into the app. The iPad checks her answers itself. Nothing is recorded or sent to the Worker, and they pay no Macaronis and don't count toward her streak, completed assignments or grade.

1. **Spelling sample:** 8 built-in words, one at a time, on the screens of §5.7 step 2. After the 8th word she sees that she's done, with a button back to Home.
2. **Reading sample:** one built-in passage, then its questions. It looks and works like the reading assignment's screens (§5.6), except that the iPad checks her choices itself and nothing is earned or saved.
3. She can leave either one at any time with the back control. Nothing is kept: the next time she starts, it begins again from the first word or the passage.

The screens' layout, the shared top bar and the Math screen's layout are in `docs/DESIGN-PRACTICE.md`.

### 5.6 Do a reading assignment (child)

A reading assignment is one passage and its questions. It is a paid, recorded assignment like a math assignment: it earns Macaronis (§6.4), counts toward her streak (§6.5), completed assignments and grade (§6.6), and shows in the parent portal. It needs a paired iPad and a connection, because the Worker chooses the passage and marks her choices (§6.8). The right answers never reach the iPad before she has checked.

1. She taps Reading on Home. The iPad asks the Worker for her next passage (§6.10). Without a connection, Reading shows "Connect to Wi-Fi to get your next story!" and starts nothing. An iPad that isn't paired, or a Worker with no passages, opens the Reading sample instead (§5.5).
2. **The passage:** she reads it and taps Next. The screen shows the passage's title, its genre and minutes to read, its text and, when it has one, its picture. If the picture can't load, the passage reads without it. Its hint is shown as guidance.
3. **The questions:** the questions come two at a time, in order (an odd last one comes alone). Each question has four choices, and she picks one per question. Nothing is marked while she answers. Next moves to the next pair and Back to the one before, and her choices stay. **Read again** shows the passage again and keeps her choices. On the last pair, Next becomes Check answers. Check answers is available once every question has a choice; until then a friendly line says how many are left.
4. **Check answers** sends her choices to the Worker, which marks them, records the result and pays her (§6.8). The screen then shows each question in the same soft green or soft coral as Math, and a friendly line: the question's explanation when it has one, otherwise a line naming the right answer. If the iPad can't reach the Worker, her choices stay as they are, a friendly line asks her to connect to Wi-Fi, and she can tap Check answers again. A retry never pays twice.
5. She taps Done and sees the result of §5.1 step 5: correct answers, Macaronis earned (with the accuracy bonus, and the streak bonus on her first finished assignment of the day) and the grade. A button takes her back to Home.
6. She can leave with the back control at any time before Check answers. Nothing is recorded and nothing is earned, and the next time she taps Reading she gets the same passage, because she hasn't finished it. After Check answers the result is recorded and leaving changes nothing.
7. A reading assignment has no left-early result.

### 5.7 Do a spelling assignment (child)

A spelling assignment is up to 20 words, typed one at a time. It is a paid, recorded assignment like math and reading: it earns Macaronis (§6.4), counts toward her streak (§6.5), completed assignments and grade (§6.6), and shows in the parent portal. It needs a paired iPad and a connection to start and to finish, because the Worker chooses the words and marks her typing (§6.8). Unlike a reading assignment, the words and their alternates reach the iPad before she answers, because it has to say them aloud and marks each word as she goes; the Worker still re-marks every word and decides what she earned.

1. She taps Spelling on Home. The iPad asks the Worker for her next words (§6.11). Without a connection, Spelling shows "Connect to Wi-Fi to get your next words!" and starts nothing. An iPad that isn't paired, or a Worker with no words, opens the Spelling sample (§5.5).
2. **A word:** one at a time. She plays it (the iPad says the word, then its sentence when it has one) as often as she likes, and types it in a box that has autocorrect, automatic capitals, spell check and suggestions turned off. Check is available once she has typed something. Checking marks the word on the iPad (§6.3): the box turns a soft green when it matched or a soft coral when it didn't, and a friendly line shows the right spelling. She taps Next when she's ready. If the iPad can't speak, Spelling shows "This iPad can't say words out loud." and starts nothing.
3. After the last word, **Finish** sends her typing to the Worker, which marks it, records the result and pays her (§6.8). If the iPad can't reach the Worker, her typing stays as it is, a friendly line asks her to connect to Wi-Fi, and she can tap Finish again. A retry never pays twice.
4. She taps Done and sees the result of §5.1 step 5: correct answers, Macaronis earned (with the accuracy bonus, and the streak bonus on her first finished assignment of the day) and the grade. A button takes her back to Home.
5. She can leave with the back control at any time before Finish. Nothing is recorded and nothing is earned, and the next time she taps Spelling she gets the same words, because she hasn't finished them. A spelling assignment has no left-early result.

## 6. Domain rules

### 6.1 Problem generator

Problems come from code, not a question bank, so the supply never runs out. Each problem has an operation and a level (Easy, Medium or Hard):

| | Easy | Medium | Hard |
|---|---|---|---|
| Addition | both numbers 1 to 9 | both numbers 10 to 99 | both numbers 100 to 999 |
| Subtraction | both numbers 1 to 9 | both numbers 10 to 99 | both numbers 100 to 999 |
| Multiplication | both factors 0 to 5 | both factors 0 to 9 | first factor 10 to 99, second 2 to 9 |
| Division | divisor 1 to 5, answer 1 to 5 | divisor 1 to 9, answer 1 to 9 | divisor 2 to 12, answer 2 to 12 |

- **Addition:** the answer is the sum, which can have one more digit than the numbers.
- **Subtraction:** the larger number comes first, so the answer is never negative. Equal numbers are allowed, and give 0.
- **Multiplication:** the answer is the product.
- **Division:** the dividend is the divisor times the answer, so every division is exact, with no remainder. The divisor and the answer are each drawn evenly from their range, and the problem shows the dividend ÷ the divisor; her answer is the quotient. The same problem can come up twice in one assignment.
- **The fixed mix:** a result that carries no mix (§6.8) is scored against the fixed mix: 7 addition, 7 subtraction and 6 multiplication problems in shuffled order, where each addition and subtraction problem has both numbers of the same digit count, 3, 4 or 5 (each equally likely), and the multiplication factors run from 0 to 9. For a given seed it gives exactly the 20 problems, in the same order, that every earlier version of the app gave, so work saved before mixes existed is still scored against the problems she saw (M13).

### 6.2 Assignment

- A math assignment is 20 problems from her mix: 1 to 3 different picks, each an operation and a level (§6.1). Each pick gets 20 ÷ the number of picks, rounded down, and any problems left over go one each to the earliest picks: 1 pick gives 20, 2 picks give 10 and 10, and 3 picks give 7, 7 and 6, in the order she picked them. The problems are shuffled together.
- A reading assignment (§5.6) is one passage and 10 of its questions (§6.10), or all of them when it has fewer than 10. Its size is the number of questions it has.
- A spelling assignment (§5.7) is up to 20 words from the list (§6.11): all of them when the list has fewer. Its size is the number of words.
- Every math assignment is generated from a seed and its mix. The same seed and mix always give the same 20 problems, in the same order. The app sends the seed, the mix and her answers; the Worker regenerates the problems from the seed and re-scores them. A reading or spelling assignment is made from an attempt the Worker hands out (§6.8); the app sends the attempt and her choices or typing, and the Worker marks them against the passage's right answers or the words.

### 6.3 Scoring

- Each problem has one answer, computed by the generator. Each reading question has one right choice, stored with the passage. Each spelling word has its spelling and any alternates (§6.11).
- Her answer is a whole number. It is correct when its value equals the computed answer. A reading question is correct when the choice she picked is its right choice. A spelling word is correct when what she typed, after trimming spaces, ignoring capitals and reading ’, ‘ and ʼ as ' (and accented letters written one way or the other as the same), equals the word, or one of its alternates, read the same way; a missing letter, an extra letter or a different letter is not correct.
- **Accuracy** is correct answers divided by the problem count (a reading assignment's question count, a spelling assignment's word count).

### 6.4 Macaroni payout

Finishing an assignment pays:

- **Base:** the correct answers scaled to a 20-problem assignment: 20 × correct ÷ size, rounded down. A math assignment (size 20) pays 1 Macaroni per correct answer. A perfect reading assignment pays a base of 20 whatever its number of questions. A spelling assignment pays 1 Macaroni per correct word, never scaled, so a list of fewer than 20 words pays less.
- **Accuracy bonus:** 20% of the base, rounded down. A finished assignment pays up to +4.
- **Streak bonus:** on her first finished assignment of the day only, +1 per streak day, including today, up to +10 (§6.5).
- **Minimum:** a finished assignment always pays at least 1 Macaroni in total.

Every mix pays the same: the payout depends on the correct answers and the size, never on the operation or the level. The mix screen's "Earn up to X Macaronis" is the most a finished assignment could pay today: 20 plus the accuracy bonus of 4, plus the streak bonus when it would be her first finished assignment of the day (§6.5); before the iPad has the Worker's numbers (§6.8) the streak bonus is left out.

A math assignment she leaves early (§5.1) pays the base only: 1 Macaroni per correct answer so far. It gets no accuracy bonus, streak bonus, minimum or grade, and doesn't count toward the streak.

Reading and spelling assignments have no left-early result (§5.6, §5.7). Payout values live in one config module (CLAUDE.md).

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

Her result shows the grade (§5.1 step 5). Grade cutoffs live in the same config module as the payout values.

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
- **Reading:** the Worker chooses her next passage (§6.10) and hands it out with an attempt and the questions chosen for it: a single-use number kept for her device (and its child), with the day it was handed out. Her choices come back with the attempt. The Worker marks them against the passage's right answers, records the result, with the passage's title and, for each question, its text, its choices, its explanation, her choice and the right choice as they are at that moment, and pays it by the rules below. Before any reading or spelling start or result, the iPad sends the math results it hasn't sent yet, oldest first, so offline work is counted before the streak moves; if they can't be sent, Reading shows the Wi-Fi line of §5.6 and starts nothing. Her day comes with the choices and follows the day range rule below. The right answers stay on the Worker until the result is recorded. An attempt she never checks records nothing.
- **Spelling:** works like Reading. The Worker chooses her next words (§6.11) and hands them out with an attempt, under the same rules: single use, kept for her device, handed out again while unchecked. Her typing comes back with the attempt. The Worker marks every word again, records the result with each word, its alternates, what she typed and whether it matched, as they are at that moment, and pays it by the rules below. The earlier-math-results-first rule, the day rule and the same-result-twice rule apply unchanged.
- **Recording:** a math result carries its seed, its mix and her answers. The Worker regenerates the assignment from the seed and the mix and re-scores her answers; a result with no mix is the fixed mix of §6.1, and the Worker records the mix it used. An absent `mix` is the fixed mix; a `mix` that is present has 1 to 3 picks, each a known operation and level, none repeated, and anything else is refused with 400 `bad_mix`, records nothing and leaves the seed unused (W8, W9). 20 answers is a finished assignment (§6.4 payout, §6.5 streak, §6.6 grade); fewer is one she left early (base only, no streak change, no grade).
- **The same result twice:** sending a result for a seed or attempt that's already recorded returns the recorded result and counts nothing again, so a retry after a lost connection is safe.
- **Day range:** a result's day may be no earlier than the day before its seed (or attempt) was handed out and no later than the day after the Worker's date (UTC), allowing for time zones. A day outside that range is recorded on the nearest day inside it rather than refused, so finished work is never lost. A day that had to be moved means the iPad's clock was wrong, so that result doesn't touch the streak: it's paid its base and accuracy bonus and counts as completed, but the streak, last counted day and streak bonus stay as they were. Because of this, her last counted day is never more than a day ahead of the real date, and a clock that's off by more than a day can't reset her streak. (A clock off by only a day looks the same as a time-zone difference, so it counts like any other day.)
- **Results that arrive late:** a result whose day is earlier than her last counted day counts as that same last day for the streak (no streak change, no streak bonus) and is still paid.
- **Completed assignments** counts finished assignments only, math, reading and spelling.
- **On the iPad:** a paired iPad keeps its unused seeds, the results it hasn't sent yet, and the Worker's latest state in its own storage, and asks the browser to keep that storage. Each assignment uses the next stored seed, and the iPad keeps the mix of the last assignment she started for "Same as last time". Unpairing leaves that mix, since it holds nothing of hers. Its result is dated with the iPad's own day. Results go to the Worker one at a time, oldest first, whenever the app opens, Home shows, a result is saved, or the connection comes back; the Worker's numbers replace the iPad's. Home shows the Worker's latest numbers with each result not yet sent applied on top, oldest first, using the engine. Every result adds what it pays to the balance. A finished result also adds 1 to completed assignments, moves the streak (§6.5; a result dated before her last counted day counts as that day) and sets the latest grade. A result she left early adds only its base. Each result is applied with the day the iPad dated it. The Worker's numbers replace these after each sync. A result the Worker refuses as not valid is dropped, so it can't hold up the rest. When the iPad tops up its seeds, it leaves out seeds in its unsent results and the one she's working on. A stored seed she leaves without answering anything goes to the back of the list.
- **No seeds:** when a paired iPad has no seeds left and can't reach the Worker, Start 20 problems on the mix screen shows "Connect to Wi-Fi to get more problems!"; Math still opens the mix screen. "Do another one" with no seeds does the same: it opens the mix screen with the picks of the assignment she just did and that line.
- **Before the iPad has numbers:** a paired iPad that hasn't yet received the Worker's state, and an iPad that isn't paired, show no numbers in Home's progress card (not a balance of 0). A finished result leaves out the streak bonus: its total is base plus accuracy bonus, with the minimum applied.
- **Not paired:** an iPad without a device key still does math assignments, each from a random seed, and saves nothing but the mix for "Same as last time". Its Reading and Spelling are the samples (§5.5).

### 6.9 Parent access and pairing

- **Parent access:** every `/api/parent/*` request must carry a valid Cloudflare Access token for this app: signed by the team's keys, issued by the team, for this application, not expired, with the parent's email. Anything else is refused (401), including when the Worker isn't configured for Access, so PR previews never serve parent routes.
- **Pairing:** the parent chooses a child, names the device (up to 40 characters) and gets a 6-digit code for that child, valid for 10 minutes and for one use. Making a new code, for any child, voids any earlier unused one. The device that enters the right code is paired to that child. Five wrong tries void the code. On the iPad, entering the right code pairs it: the Worker returns its device key once and stores only the key's SHA-256.
- **Pairing rate limit:** at most 10 pairing tries a minute from one network address (an IPv6 address counts by its /64 block, roughly one home or connection). Beyond that the Worker answers 429 without looking at the code. This slows a flood of guesses; it can't stop someone who sends a few wrong guesses a minute from voiding a code, since 5 wrong tries void it. If that ever happens, the parent makes a new code later. The code's own one use, 10 minutes and 5 tries are what keep an iPad from being paired by anyone else. If the Worker has no rate limiter, pairing is refused (503) rather than left unguarded.
- **Preview pairing:** a PR preview can pair without a parent, so paired screens can be checked on a phone. The preview's own 6-digit code is a secret held in Cloudflare's preview settings, never in the repo. Typing it on the Pair screen pairs the device: the Worker makes a new device named "Preview" for the first child in the preview database and returns its key once. The code can be used any number of times and never expires; the pairing rate limit still applies first, and it is the only guard against guessing. It works only when the Worker is marked as a preview, has no Access settings and holds a valid code; any other code goes through the normal checks. Production never has the preview mark and always has Access settings, so the preview code does nothing there. A preview build also shows the Pair button outside the installed app (§5.4).
- **Unpairing:** an unpaired iPad's key is refused from then on, including results it hasn't synced yet. The portal warns before unpairing: "Results this device hasn't sent yet won't be saved."

### 6.10 Reading passages

- **A passage** has a title, a number of minutes to read, its text in paragraphs and one or more questions. It may also have a genre (for example "Story"), a hint and a picture; whatever it lacks is left out of the screen. A question has its text and exactly four choices in a fixed order, exactly one of them the right choice, and may have an explanation of why that choice is right (it comes only after she checks, §5.6). Different passages may have different numbers of questions (the first passages have 10 each, and a passage may have up to 50). A reading assignment never has more than 10 questions: the Worker chooses 10 of the passage's questions at random for each attempt, and they are shown in the passage's order.
- **Her next passage:** the passage with the lowest id that she has no finished result for. When she has finished every passage, the one whose latest finished result the Worker recorded longest ago (the order the Worker saved them, not the day on the result, so a wrong iPad clock can't reorder her stories). A passage she started and left is not finished, so it comes again, with the attempt she left unchecked handed out again and its day set to the day it is handed out again. A passage that isn't complete (a question without exactly four choices and exactly one right one, or no questions) is never handed out; with no complete passage left, there are no passages (§5.6). A repeat pays in full (§6.4).
- **Where they live:** passages, questions and choices are rows in the database, and pictures are files in Cloudflare R2, named by the passage id and the picture's extension (for example `3.webp`); the passage row holds that name, or nothing. A parent adds, edits and deletes them on the Content screen (§5.3), and no passage text or picture is in the repository. The Worker serves a picture only to a request with a valid device key. A passage that has a recorded result is never deleted.
- **The passage JSON:** a parent adds a passage by pasting one JSON object (up to 64 KB). Required: `title`; `minutes`, a whole number from 1 to 999; `passage`, an array of one or more non-empty paragraphs; and `questions`, 1 to 50 of them, each with `question`, `options` (exactly four different, non-empty strings) and `correct_answer`, which equals exactly one option. A question may have an `explanation`; the passage may have a `topic`, shown as its genre, and a `hint`. Any other field (for example `type`, `grade`, `reading_level`, `target_word_count`, `image_prompt`, `skill`, `number` and `settings`) is kept with the passage and does nothing: the app's own payout, grades and fixed choice order apply whatever `settings` says. Each question's choices are shuffled once when the passage is saved and then stay fixed. Text is trimmed first, so a value of only spaces counts as empty; options are different when they differ after trimming (capitals count), and `correct_answer` must equal one option after trimming; `topic`, `hint` and `explanation` may be empty, and `null` counts as absent; a paragraph can't have a blank line inside it. The size limit counts the passage as compact JSON, without extra spaces or line breaks, not the request around it. A request body that isn't JSON or has no `passage` is refused like any other bad passage. The checks run on the Content screen before saving and again in the Worker, which refuses a passage that fails them (400) and saves nothing. The schema that Copy prompt + schema copies describes the same checks.
- **Pictures:** PNG, JPEG or WebP, up to 2 MB, accepted by the file's own first bytes and not by its name or declared type. A new picture replaces the old one.
- **Editing and deleting:** a parent can change any passage. A change to its questions or choices voids the attempts she has left unchecked, so her next start is the edited passage; recorded results keep the passage as it was (D14). Deleting removes the passage, its questions, choices, unchecked attempts and picture together, and is refused (409) for a passage that has a recorded result.
- **What the iPad gets:** the title, genre, minutes, hint, text, picture and, per question, its text and choices. Never which choice is right, and never a question's explanation, until she has checked (§5.6).

### 6.11 Spelling words

- **A word** is 1 to 40 characters, each a letter (of any language), an apostrophe (' or ’) or a hyphen, with at least one letter and no spaces, kept as typed. A word with a character she can't type back (a ligature such as ﬁ, a full-width letter, an invisible mark) is refused. It may also have a sentence (up to 200 characters, trimmed; an empty one means none) that the iPad says after the word, accepted alternates (each a word of the same kind, such as the US spelling of a UK one; one equal to the word ignoring capitals, or repeated, is dropped), and a grade, a whole number or nothing (kept for later; nothing reads it yet). Words are shared by every child and live in the database.
- **Adding:** a parent adds words on the Content screen (§5.3), one or many. A word already in the list is skipped: two words are the same when they match the way her typing does (§6.3), ignoring capitals, apostrophe forms and accent forms. A word repeated within one save is one word: its sentence is the first one given, its alternates are all of them, and the repeats count as skipped. The dictionary check there is advice only and never blocks a save: a word found in neither the US nor the UK English dictionary gets a warning, and a word found in only one is offered with the other spelling as an alternate, which the parent can keep or remove. The Worker checks the rules of the first bullet on every save and refuses a bad word (400), saving nothing; neither it nor scoring ever looks a word up in a dictionary. A parent can edit and delete words; either voids the unchecked attempts that include that word, so her next start is new words. A recorded result keeps each word, its alternates, her typing and whether it matched as they were, so editing or deleting a word never changes it (D15).
- **Her next words:** up to 20, in this order: words she has no finished result for, lowest id first; then the words whose latest finished result the Worker recorded longest ago, ties by lowest id (the order the Worker saved them, not the day on the result). An attempt she left unchecked comes again with the same words, its day set to the day it is handed out again. With no words, there are none (§5.7). A repeat pays in full (§6.4).
- **What the iPad gets:** the attempt and, per word, its id, the word, its sentence and its alternates, because it says the word and marks each one as she goes (§5.7).

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
| M1 | One pick (any), any seed | **20** problems, all of that operation and level |
| M2 | Addition and subtraction problems of each level from 1,000 seeds | Both numbers in the level's range: **1 to 9**, **10 to 99**, **100 to 999** |
| M3 | Subtraction problems from 1,000 seeds | First number ≥ second; answer **never negative** |
| M4 | Subtraction 4,512 − 4,512 | Allowed; answer **0** |
| M5 | Addition 999 + 999 | Answer **1,998** (one more digit than the numbers) |
| M6 | Multiplication problems of each level from 1,000 seeds | Easy: both factors **0 to 5**; Medium: both **0 to 9**; Hard: first **10 to 99**, second **2 to 9** |
| M7 | 7 × 8, answered 56; then answered 54 | 56 is **correct**; 54 is **not correct** |
| M8 | The same seed and mix, generated twice | **Identical** problems in identical order |
| M9 | Two picks | **10 and 10** problems, shuffled together |
| M10 | Three picks, in the order Multiplication Medium, Division Easy, Addition Hard | **7, 7 and 6** problems, in that order of picks |
| M11 | Division problems of each level from 1,000 seeds | Dividend ÷ divisor is a **whole number**; Easy: divisor and answer **1 to 5**; Medium: **1 to 9**; Hard: **2 to 12** |
| M12 | A division problem 144 ÷ 12, answered 12; then answered 11 | 12 is **correct**; 11 is **not correct** |
| M13 | Seed 1, no mix | The fixed mix: **7 addition, 7 subtraction, 6 multiplication**; its first four problems are 463 + 322 = **785**, 1 × 7 = **7**, 692 − 591 = **101**, 74,885 − 27,353 = **47,532** |
| M14 | The mix screen with a mix picked; streak 0, no assignment finished today | Earn up to **25** (20 + 4 + 1) |
| M15 | The same, but an assignment is already finished today | Earn up to **24** |
| M16 | Streak 9, last counted day yesterday | Earn up to **34** (20 + 4 + 10) |
| M17 | The iPad has no Worker numbers yet | Earn up to **24** (no streak bonus, §6.8) |

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
| W8 | A math result whose mix has 4 picks | Refused: **400 `bad_mix`**, nothing recorded, the seed still unused |
| W9 | A math result whose mix repeats a pick | Refused: **400 `bad_mix`**, nothing recorded, the seed still unused |
| W10 | A math result with a mix of 2 picks, 20 answers | Re-scored against that seed's 10 + 10 problems; recorded with its mix |

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

### 7.L Reading assignments (§5.6, §6.2–§6.4, §6.8, §6.10)

Unless stated, her state is balance 0, streak 0, no last counted day, the passage has 4 questions, and "not first of the day" means another assignment was already finished today.

| ID | Given | Expected |
|---|---|---|
| L1 | 4 of 4 correct, first of the day, streak 1 | base 20 + bonus 4 + 1 streak → **25**; grade **Excellent** |
| L2 | 3 of 4 correct (75%), not first of the day | base 15 + bonus 3 → **18**; grade **Improving** |
| L3 | A 3-question passage, 2 correct, not first of the day | base 20 × 2 ÷ 3 = 13.3, rounded down → 13, bonus 2 → **15**; grade **Improving** |
| L4 | A 3-question passage, 0 correct, not first of the day | 0 earned, raised to the minimum → **1** |
| L5 | A 5-question passage, 4 correct, not first of the day | base 16 + bonus 3 → **19**; grade **Good** |
| L6 | Passages 1, 2 and 3; she has finished 1 and 2 | Her next passage is **3** |
| L7 | Passages 1, 2 and 3 all finished, their latest finished results recorded in the order 2, 3, 1 | Her next passage is **2** |
| L8 | She starts passage 1, leaves before Check answers, and starts Reading again | Nothing recorded; her next passage is **1** again |
| L9 | A reading result sent twice with the same attempt | The recorded result comes back; balance and completed assignments count it **once** |
| L10 | Math finished earlier today (streak 3, last counted day today); a reading result, 3 of 3 on a 3-question passage | Paid 20 + 4 = **24**; streak stays **3**; completed **+1** |
| L11 | Her latest assignment was a math "Excellent"; she then finishes a reading assignment with 2 of 3 | The latest grade is **Improving**; completed **+1** |
| L12 | The Worker hands out any passage | No field of the response says which choice is right |
| L13 | A start or a result with no device key, or an invalid one | Refused (401); nothing recorded |
| L14 | A result whose choices miss a question, or name a choice of another question | Refused (400); nothing recorded; the attempt stays usable |
| L15 | The Worker has no passages | The start response has no passage, and the iPad opens the Reading sample |
| L16 | Worker's date 2026-10-17; the attempt was handed out that day; a finished result, 3 of 3 on a 3-question passage, dated 2026-10-19 | Recorded on **2026-10-18**, paid 20 + 4 = **24** (no streak bonus); streak and last counted day unchanged; completed **+1** |
| L17 | Streak 5, last counted day two days ago; a math result from yesterday is unsent; she taps Reading | The math result is sent first, so the streak is **6** before the reading result is recorded, and the reading result (first of the day) takes it to **7** |
| L18 | A pasted passage with a title, minutes, paragraphs and questions that each have four different options and a `correct_answer` equal to one of them | Valid; saving adds it, and it is handed out like any passage |
| L19 | A pasted passage with a question of three options, or a `correct_answer` that matches no option or two, or no `minutes` | Refused (400) with a plain sentence naming the question or field; nothing saved |
| L20 | A passage whose `settings` say `shuffle_options` true and `points_per_question` 5 | Saved with the settings kept; its choices are shuffled once on save, whatever `shuffle_options` says; payout is unchanged |
| L21 | Deleting a passage that has a recorded result, and one that has none | The first is refused (409) and stays; the second is removed with its questions, choices and picture |
| L22 | A parent edits a question of passage 3 while she has an unchecked attempt on it | The attempt is voided; her next start is the edited passage |
| L23 | A picture upload named `a.png` whose bytes are not a PNG, JPEG or WebP, or one over 2 MB | Refused (400); nothing stored |
| L24 | The schema that Copy prompt + schema copies, and the checks, given the same sample passages | Both accept the valid ones and refuse the others |
| L25 | A passage with 25 questions | Each attempt has exactly **10** of its questions, in the passage's order, and the result's size is 10; an attempt she left unchecked comes again with the same 10 |

### 7.D Recorded results (§8)

A parent opens a result the Worker recorded.

| ID | Given | Expected |
|---|---|---|
| D13 | A parent opens a recorded result | Its mix, and each problem with its operation, numbers (for division, the dividend then the divisor), her answer and the right answer, in order; the same seed and mix always show the same problems |
| D14 | A parent opens a recorded reading result, after the owner has since edited the passage's text or a right choice | The passage's title, then each question with its choices, her choice and the right choice, in order, as they were when the result was recorded |
| D15 | A parent opens a recorded spelling result, after a word in it has since been edited or deleted | Each word with its alternates, her typing and whether it matched, in order, as they were when the result was recorded |

### 7.E Spelling assignments (§5.3, §5.7, §6.3, §6.4, §6.8, §6.11)

Unless stated, her state is balance 0, streak 0 and no last counted day, the list has 20 words, and "not first of the day" means another assignment was already finished today.

| ID | Given | Expected |
|---|---|---|
| E1 | 20 of 20 correct, first of the day, streak 1 | base 20 + bonus 4 + 1 streak → **25**; grade **Excellent** |
| E2 | 15 of 20 correct, not first of the day | base 15 + bonus 3 → **18**; grade **Improving** |
| E3 | A list of 5 words, 4 correct, not first of the day | base 4 (1 per correct word) + bonus 0 → **4**; grade **Good** |
| E4 | 0 correct, not first of the day | 0 earned, raised to the minimum → **1** |
| E5 | She types " Favourite " for the word "favourite" | Correct |
| E6 | She types "favorite" for "favourite", with the alternate "favorite" and without it | Correct with the alternate; not correct without it |
| E7 | She types "dont" for "don't", and "don’t" (a curly apostrophe) for "don't" | The first is not correct; the second is correct |
| E8 | 25 words, none practiced; she finishes the first 20 (ids 1 to 20) and starts again | The first start gives ids 1 to 20; the second gives 21 to 25, then the oldest finished, 1 to 15 |
| E9 | A list of 8 words | Her next words are all **8** |
| E10 | She starts, leaves before Check answers, and starts Spelling again | Nothing recorded; her next words are the **same** ones |
| E11 | A spelling result sent twice with the same attempt | The recorded result comes back; balance and completed assignments count it **once** |
| E12 | The Worker hands out words | Each has its id, word, sentence and alternates, and nothing else of the list |
| E13 | A start or a result with no device key, or an invalid one | Refused (401); nothing recorded |
| E14 | A result that misses a word, or names a word that isn't in its attempt | Refused (400); nothing recorded; the attempt stays usable |
| E15 | The Worker has no words | The start response has no words, and the iPad opens the Spelling sample |
| E16 | The pasted text `because, friend`, a line `favourite/favorite`, a line `their: They ate their dinner, then left.` and blank lines | Entries: because, friend, favourite (alternate favorite) and their with the sentence "They ate their dinner, then left." |
| E17 | Adding "Friend" when "friend" is already in the list | Skipped; the result says 0 added, 1 skipped |
| E18 | "mother-in-law" and "don't", then "ice cream", "r2d2", an empty word, "'-'" and a 41-letter word, each checked as a word | The first two are accepted; the rest are refused with a plain sentence |
| E19 | A word that is in an unchecked attempt is deleted | The attempt is voided; her next start is new words |
| E20 | A save that includes a word the checks refuse | 400 `bad_word`; nothing is saved, not even the good words |

## 8. Contracts (signatures are in code, `src/engine/`)

The question engine is pure TypeScript: no React, no `fetch`, no D1, no clock and no `Math.random`. Randomness comes from the seed, and dates are passed in. It exposes:

- `generateAssignment(seed, mix)`: the 20 problems of §6.2 for a mix of 1 to 3 picks, `{ operation, level }`; with no mix, the fixed mix of §6.1.
- `checkAnswer(problem, answer)`: §6.3.
- `nextStreak(state, today)`: the streak after finishing an assignment today, and whether it was the first of the day (§6.5).
- `payout(result)`: base, accuracy bonus, streak bonus and total for a finished assignment of any kind, from its correct answers and its size (§6.4).
- `scoreReading(rightChoices, picks)`: the questions she got right (§6.3).
- `scoreSpelling(words, typed)`: the words she got right (§6.3).
- `parseWords(text)`: the entries of a pasted word list (§5.3).
- `spellingPayout(result)`: the same, for a spelling assignment: the base is 1 Macaroni per correct word, never scaled (§6.4).
- `checkWord(entry)` and `checkPassage(json)`: the rules of §6.11 and §6.10, answering with the entry or passage or with plain-language problems. The portal and the Worker both use them.
- `leftEarlyPayout({ correct, answered, problemCount })`: the base-only payout for an assignment she leaves early (§6.4).
- `grade(correct, total)`: §6.6.
- `addDays(day, n)`: the calendar day `n` days after (or before) `day`.

The Worker's child API (every route needs the iPad's device key):

- `GET /api/state?pending=…`: the device's child (name, grade and initials, for the practice screens' top bar), balance, streak, last counted day, completed assignments, the latest finished assignment's grade, and which of the listed seeds (up to 100) are already recorded.
- `POST /api/seeds`: tops the iPad up to 20 unused seeds and returns them.
- `POST /api/results`: records a math result (§6.8), with its `mix` when it has one, and returns it with the new state.
- `POST /api/reading/start`: chooses her next passage (§6.10), makes an attempt and returns both, without the right choices. With no passages it returns `passage: null`.
- `POST /api/reading/result { attempt, day, picks }`: `day` is the iPad's own day (§6.5). Marks her choices, records the result with the passage's title and each question's text, choices, explanation, her choice and the right choice, and returns it with, per question, whether she was right, the right choice and the question's explanation (empty when it has none), and the new state (§6.8). 400 for choices that miss a question or name a choice of another question; 404 for an attempt that isn't this device's.
- `GET /api/reading/image/:name`: a passage's picture from R2. `:name` is a passage id and an extension (for example `3.webp`) and must be the picture name of a passage; any other name, a picture missing from R2, or a Worker with no picture store answers 404 (`not_found`), so the bucket can't be probed. The picture is sent with its content type and a long private cache. The iPad fetches it with its device key and shows it from a blob URL (§5.6).
- `POST /api/spelling/start`: chooses her next words (§6.11), makes an attempt and returns both. With no words it returns `words: null`.
- `POST /api/spelling/result { attempt, day, answers }`: `day` is the iPad's own day (§6.5). Marks her typing, records the result with each word, its alternates, her typing and whether it matched, and returns it with, per word, whether she was right and the right spelling, and the new state (§6.8). 400 for answers that miss a word or name a word that isn't in the attempt; 404 for an attempt that isn't this device's.

Child routes read and write only the device's child: the numbers are hers, and the seeds and results are the device's.

The parent API (every route needs a valid Access token, §6.9). A parent can list, add and rename children. Every parent route that reads or changes a child's data takes that child's id as the `child` query parameter, except the routes under `/api/parent/children`, which take no `child` (the PATCH names the child in its path), and the content routes (`/api/parent/words`, `/api/parent/passages`), which take none because content is shared, for example `GET /api/parent/summary?child=2` or `POST /api/parent/balance?child=2`. A missing or non-numeric `child` is 400 `bad_child`; a child that doesn't exist is 404 `unknown_child`; nothing is read or changed. A device, result or log entry that belongs to another child is 404 (`unknown_device`, `unknown_result`) and is never shown or changed. The routes below are listed by what they do for the chosen child.

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
- `GET /api/parent/results`: the latest 50 recorded results, newest first: kind (`math`, `reading` or `spelling`), the mix of a math result (its picks, or none for the fixed mix of §6.1), the passage's title for a reading result, day, answered, correct, finished, grade, total paid and `createdAt` (when the Worker recorded the result, an ISO timestamp).
- `POST /api/parent/balance { amount, note }`: adds (positive) or removes (negative) Macaronis with a note (§5.3). 400 for a bad amount or note, 409 for a removal larger than her balance (logged nothing), 503 when it can't be saved after 3 tries. Returns the new balance (logged).
- `GET /api/parent/results/:id`: one recorded result with its problems (a math result: its mix as in the list; a reading result: the passage's title and, per question, its text, choices, her choice, the right choice and its explanation; a spelling result: per word, its alternates, her typing and whether it matched): day, answered, correct, finished, grade, total and, per problem, the operation, both numbers, her answer and the right answer. 404 for an unknown id.
- `GET /api/parent/log`: the latest 50 admin log entries for the chosen child, newest first: when, which parent, the action and its details.

The content routes (every one needs a valid Access token, and none takes `child`):

- `GET /api/parent/words`: every word with its id, sentence, alternates and grade, in alphabetical order ignoring capitals.
- `POST /api/parent/words { words }`: adds the entries (§6.11: each a word, with an optional sentence, alternates and grade) and returns `{ added, skipped }` (201); 400 `bad_word`, with the problems, for an entry that fails the rules (including a `grade` that is not a whole number from 0 to 99), more than 500 entries, a body of more than 256 KB (counted in bytes), or a body that isn't JSON like `{ "words": [ … ] }`, saving none.
- `PATCH /api/parent/words/:id { word?, sentence?, alternates?, grade? }` and `DELETE /api/parent/words/:id`: edit and delete a word (a PATCH is checked like an entry, 400 `bad_word`, and so is one with none of those fields); a PATCH that renames to a word already in the list is 409 `duplicate`; 404 `unknown_word`.
- `GET /api/parent/passages`: each passage's id, title, minutes, number of questions and times read. `GET /api/parent/passages/:id`: its JSON.
- `POST /api/parent/passages { passage }` and `PUT /api/parent/passages/:id { passage }`: add (201, returns the id) and replace a passage; 400 `bad_passage` with the plain-language problems, saving nothing.
- `DELETE /api/parent/passages/:id`: 409 `has_results` for a passage with a recorded result; 404 `unknown_passage`.
- `PUT /api/parent/passages/:id/image`: the picture's bytes (§6.10); 400 `bad_image`.

Pairing, the one route with no key or token (the code is the gate, CLAUDE.md):

- `POST /api/pair { code }`: pairs the iPad and returns its device key once.

## 9. Later

Ideas outside the MVP. Each needs a spec section before it is built.

- **More subjects:** phonics (spoken word via the Web Speech API, pick the word or starting letters) and fractions (the fraction layout in `docs/DESIGN-PRACTICE.md`).
- **Spinner:** earned spins that pick the subject or a reward, never "no work".
- **Loot box:** earned-only surprise rewards.
- **Carrying and borrowing:** work space on the stacked problem to mark a carried 1 or regroup from the next place.
- **Retry and partial credit:** a hint and a second try, with partial credit for a fixed answer.
- **Parent tools:** push notification on a purchase.
- **Content:** a way to add a passage without writing JSON, a grade box when adding words, and people other than the owner adding content (with the OAuth overhaul of parent sign-in).
- **Rewards peek:** a read-only list of rewards, opened from the practice top bar during an assignment.
- **Portal detail:** purchase history beyond Last redeemed (with the reward shop, §5.2).
- **Editable rewards:** a parent changes the rewards and prices from the portal.
- **Child sign-ins:** a child who uses more than one device, or moves a device to another child.
- **More rewards:** the full reward menu beyond the four in §6.7.
