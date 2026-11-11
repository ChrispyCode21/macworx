# Changelog

All notable changes to macworx. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match (`npm version X.Y.Z --no-git-tag-version`). Merging tags the release and closes its milestone automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

### Added

- **Add spelling words (parents):** the Content tab has a Spelling card. Type or paste words, one per line or separated by commas; a line can be `their: They ate their dinner.` to say which word is meant, or `favourite/favorite` for another spelling that is also right. It counts them, says in plain words what to fix, and Save word list adds them, telling you how many were new and how many were already in the list. Nothing in her practice uses the list yet.
- **A Content tab (parents):** the parent portal has a Content tab where you paste a reading passage as JSON. Copy prompt + schema gives you text for an AI assistant. The box checks the passage as you paste it, says in plain words what to fix, and shows a preview with each right answer marked. Save passage adds it to Reading practice, ready for her next story. Your hand-run script still works.
- **A reading assignment gives 10 questions at most (children):** a passage with more than 10 questions gives 10 of them, chosen at random and shown in the passage's order. If she leaves before Check answers, the same 10 come back. A passage with 10 or fewer gives all of its questions, as before.
- **Reading passages can show a picture (children):** the Worker serves a passage's picture from Cloudflare R2 to a paired iPad. A passage without a picture, or one whose file isn't uploaded yet, reads without it.
- **Division looks like long division (children):** a division problem shows the divisor to the left of a bracket round the number being divided, with a box for her answer above each of its digits.
- **A math mix of her own (children):** Math now opens a screen where she taps up to 3 problems to try, from addition, subtraction, multiplication and division at three levels, and sees how many problems each gets, how many Macaronis she could earn and a Start button. "Same as last time" brings back the last mix. "Do another one" keeps the mix she did.
- **Reading is a real assignment on a paired iPad (children):** tapping Reading first sends any math she hasn't sent yet, then gets her next story from the Worker. She reads it, answers its questions two at a time (four choices each, her picks kept when she goes Back or reads again), and taps Check answers once every question has a pick. Each question then turns green or coral with its explanation, and the result shows right answers, Macaronis (with the bonuses) and the grade like Math. Without Wi-Fi Home says "Connect to Wi-Fi to get your next story!" and nothing starts, and a Check without Wi-Fi keeps her picks so she can tap it again. An iPad that isn't paired still opens the Reading sample.
- **Results show what she practiced (parents):** the Results list has a Practice column. A math result reads the problems she picked, in her order ("Multiplication, medium · Division, easy"); work from before she could pick reads "Mixed"; a reading result shows its passage. Nothing changes on her iPad yet.

### Fixed

- **Home and the mix screen match the design pixel for pixel (children):** Home has the design's sizes, colors and weights: an 80 high bar, a 36 heading, a 760 and 330 wide pair of columns, 124 high subject cards, a 228 high progress card and the Macaronis mark in place of a coin. On the mix screen the line under the heading was 4 too close, the weights of its count, panel and earn chip were lost, and its grid card was 2 too tall and 2 too narrow; all now match. The design's palette is now one shared set of colors, so the practice screens and the parent portal take its slightly lighter yellows too; the portal keeps its text readable with a slightly darker link color and a lighter warm panel (docs/DESIGN.md §5.3).
- **The mix screen matches its design (children):** the math mix screen now has the sizes of the design: an 80 high top bar, a bigger heading, a plain "Same as last time" button, round level dots, taller cells and a fixed-size summary, so it fits an iPad held sideways without scrolling.
- **Spelling and Reading fit smaller landscape iPads without scrolling (children):** on an iPad mini, a 10.2-inch iPad or an 11-inch iPad held sideways, the choices are a little shorter (56 high, from 78), the play button is a little smaller (96, from 112) the listen parts sit a little closer and the panels have a little less padding, so the whole screen stays in view, also after Check. On a bigger iPad they look as they did. Held upright, these two still scroll.
- **The pairing screen fits smaller iPads without scrolling (children):** in landscape the pairing pad now fits the screen on an iPad mini, a 10.2-inch iPad or an 11-inch iPad, where the screen is short, the keys get shorter (down to 48 high). On a bigger iPad, or held upright, it looks as it did.
- **The Math screen fits smaller iPads without scrolling (children):** on an iPad mini, a 10.2-inch iPad or any tablet shorter than the one it was drawn on, the whole Math screen stays in view. In a short window the number pad's keys get shorter (down to 48 high). On bigger iPads it looks as it did.
- **Add / Rename looks like Add / Remove (parents):** the Add and Rename choice on Overview is now the same segmented control as Add and Remove on Macaronis, as the design says. It had two plain buttons before.

### Changed

- **New Home (children):** a top bar with Home, Shop and Parents; "Ready for a little progress?" with three subject cards (Math, Spelling, Reading), each with a Start button; a "Your progress" card with her Macaronis available to spend and her current streak; and a card inviting her to the shop. It is two columns on an iPad, either way up, and one column on a phone. Home no longer shows her completed assignments or the grade of her latest assignment (a parent still sees them). Before her iPad has her numbers, the card says "Your Macaronis will show up here." instead of a number. The Shop link and "Explore the shop" are there but do nothing until the shop screen is built.
- **Text on the result and the pairing screen follows the type scale (children):** the page titles are 58 (was 57.6), the main button and the Macaronis lines on the result are 40 (was 38.4), the Check key on the pairing pad is 29 (was 28.8) and the pairing code digits are 58 (were 67). The pairing code fits a little more easily.
- **The child switcher's list (parents):** the rows in the list are 48 high, and the plus beside "Add a child" is full size (18). They took on the sizes meant for the switcher button, so they were taller and the plus was smaller.
- **Wide panels spaced as the design says (parents):** on a wide screen, the Children panel and the results panel on Overview keep 16 between their parts (it was 14).
- **The support button's focus outline (children):** the outline on "Hear it in a sentence" now has square corners, matching the back button.
- **Titles that were meant to be bold now are (parents):** the pairing title, the "Child access only" title and the pairing code on Devices, the reward names and the two summary titles in the Shop, the activity titles on Macaronis, the assignment titles on Overview, and the page label at the top of each tab on a wide screen. A general text rule had been keeping them regular. The text under "Child access only" is now the muted colour, as the design says.
- **Two text sizes follow the design (parents):** reward names in the Shop are 14 (they were 15), and the line under "Child access only" on Devices is 11 (it was 12).
- **The three top panels match (parents):** Today's homework, Available balance and Current streak now share one look, and their small headings are bold, as the design says.
- **Streak's top panel:** it now has a "CURRENT STREAK" heading with the flame beside it (as Today's homework has its sun). The number is shown with "days" next to it, and the line below it shows just the date range, for example "Oct 14–16".
- **While the balance loads (parents):** Available balance shows its placeholder without "Macaronis" beside it, so a failed read no longer reads "Not available right now. Macaronis".
- **One notice look (parents):** the "coming soon" notice on Shop now uses the same notice component as the other screens, so on a wide screen its icon is 18 (it was 17), as the design says.

## [0.5.2] - 2026-11-06

### Fixed

- **A message stays until the page says otherwise (parents):** when a button gave a message (for example asking for a device name) while the page was still finishing its load, the load ending cleared that message. Only a message from a failed load is cleared now.

### Changed

- **More blank-looking names are refused (parents):** a child's name made only of combining marks, other format characters (such as U+0600 to U+0605 or U+FFF9 to U+FFFB), private-use or unassigned characters, or the braille blank (U+2800) is refused when adding or renaming, like one made of spaces or zero-width characters. A name with a visible letter and one of these still works.
- **Shorter child names and grades (parents):** a child's name is 1 to 20 characters (was 40) and a grade is at most 5 (was 20; "Pre-K" is the longest of Pre-K, K and 1 to 12), for Add and Rename. A grade is shown as typed. There is no stored data to change. The device name still allows 40.

## [0.5.1] - 2026-11-06

### Changed

- **A failed read says so, block by block (parents):** when the numbers or a list can't load, the Overview tiles, Today's assignments, the devices row and the Macaronis and Streak numbers show "Not available right now." in place of a dash, matching Results. Blocks that did load keep their values.
- **When the children can't be listed (parents):** every portal screen shows "We can't show your children right now." with a Try again button, and no forms or switcher, in place of forms with no child. If the sign-in has run out, it shows that message instead, without the button. A household with no children shows "No children yet." and the Add form on every screen.

## [0.5.0] - 2026-11-06

### Added

- **Reading sample (iPad):** Reading opens one passage (placeholder text, no picture) with a short guide beside it, and a Next button. Next opens its two questions, each with three choices. "Read again" shows the passage again and keeps her choices, before and after Check. Check answers turns on once every question has a choice. Each choice then turns soft green when it's right or soft coral when it's not, with a friendly line naming the best answer. Done shows that she's finished, with a button back to Home. It works paired or not, online or offline. Nothing is recorded or paid, and leaving starts again at the passage.
- **Spelling sample (iPad):** Spelling opens 8 words, one at a time. She taps Play word to hear it (and "Hear it in a sentence"), picks its spelling from four choices and taps Check. Her choice turns soft green when it's right or soft coral when it's not, with a friendly line naming the right spelling. After the 8th word she sees she's finished and taps Back to Home. If the iPad can't speak, both Play buttons are disabled with a line saying so, and she can still choose. It works paired or not, online or offline. Nothing is recorded or paid, and leaving starts again at word 1.
- **Math screen in two panels (iPad):** the problem, with its "Addition practice" label and instruction, sits beside a number pad panel on a wide iPad (landscape, or a portrait 12.9-inch iPad Pro), and stacks above it on narrower ones. After Check, her response replaces the pad in the same panel.
- **Home subject buttons (iPad):** Home shows Math, Spelling and Reading buttons in place of Start. Math starts the assignment as before; Spelling and Reading open their practice screen with its crumb and title, and the crumb returns to Home. Nothing is recorded.
- **Her name on the practice screen (iPad):** her initials in a circle at the top right of the top bar, and "{name} · {grade}" (just the name without a grade) opposite the back control. `GET /api/state` returns her `name`, `grade` and `initials`, and the iPad keeps them with the Worker's state. Until the iPad has them, neither shows.

- **Overview screen (parents):** Today's homework (one number: the assignments she finished today, with "N Macaronis earned today." under it when she earned any), Macaronis and streak tiles with Manage links, Today's assignments (or "No assignments yet today."), Keep things in sync links to Devices and Shop, and Results. The old four-box summary is replaced by the tiles and one line with her completed assignments and last counted day. `GET /api/parent/summary` adds `completedToday`.
- **Streak screen (parents):** her streak with the days it covers, "Today ✓" and a Personal best that is sample data (labelled "Sample"); The last 7 days, with a check on each day she finished an assignment; and Correct a streak, with a preview of the days it implies, then Review and Confirm (Back returns without saving). The strip shows real finished days, so after a correction it can differ from the streak. `GET /api/parent/days` reads the days. Replaces the old streak form.
- **Macaronis screen (parents):** her balance with "+N earned today" (left out at 0), Add or Remove with a reason, a "Balance after adjustment" preview, and Review then Confirm (Back returns to the form without saving). Recent activity lists each change with when, which parent and what changed, and the signed amount of a balance change (for example +20 or −15). A removal bigger than her balance is refused in plain words before anything is sent.
- **Pair panel on the Devices screen (parents):** a "Connect another device" panel for the chosen child with a device name box (up to 40 characters), a Generate pairing code button, the code as one string with "Expires in N minutes." counting down, and a footnote that codes expire after 10 minutes. Beside it are a "Before you disconnect" note (using her name, Macaronis and streak) and a "Child access only" note. The Devices screen has two columns from 1024px wide. Her app now says "Pair this device" instead of "Pair this iPad".
- **Device cards with last synced (parents):** the Devices tab shows a "{n} connected" count and a card for each connected device with its name, when it was added and when it last synced ("Synced today, 4:05 pm", "Synced Oct 12" or "No results yet"), and an Unpair button that keeps its warning. An unpaired device leaves the list (the Activity log still names it). The Online or Offline status and the browser line are sample data, labelled "Sample"; renaming a device and "View details" are shown disabled. The parent pages say "device" instead of "iPad". `GET /api/parent/devices` also returns `lastResultAt`.
- **Add and rename a child (parents):** Overview has a Children panel with Add a child and Rename, for a name (1 to 40 characters), an optional grade and initials (filled from the name until you type your own). The child switcher list has a Rename button on each child and an "Add a child" row; a new child is selected right away. Children can't be deleted, and both changes show in the Activity log.
- **Parent portal shell:** `/parent` is now five tabs (Overview, Macaronis, Streak, Devices, Shop) at `/parent/overview`, `/parent/points`, `/parent/streak`, `/parent/devices` and `/parent/shop`, with a header, a child switcher, tabs along the bottom on a phone and a side bar from 768px wide, in the macworx colors. Home has a **Parents** link. Today's sections moved into the tabs unchanged.
- **Parent portal Shop screen (read-only):** the Shop tab lists the four rewards with their prices and how far her balance is from each, shows an edit panel with every control disabled ("Editing rewards is coming soon."), and an empty "Last redeemed". Nothing is stored.
- **Set or restore her streak (parents):** an Adjustments section on `/parent` with a streak form. It saves her streak (0 to 3,650) and last counted day, doesn't change her Macaronis or pay a bonus, and shows in the Activity log.
- **Add or remove Macaronis (parents):** an Adjustments section on `/parent` with Add or Remove, a number, a note and Save. Her balance can't go below 0; a removal that's too big is refused in plain words. Every change appears in the Activity log (for example "Added 20 Macaronis: Homework grades"). Her Home shows the new balance after her next sync.

### Changed

- **Her assignment screen has a new frame:** a top bar with her Macaronis and streak (left out when Home leaves them out), the title with "Problem n of 20" and a progress bar, a "Practice / Math" back link that does what "Done for now" did, and a Check or Next button at the bottom right. The number pad no longer has a Check key.
- **Focus after renaming a child (parents):** after a rename saves, keyboard focus stays on Save, so the "Saved" message is read where you are working. Adding a child still moves focus to the page heading.
- **Child names need a visible character (parents):** adding or renaming a child is refused when the name has nothing you can see (for example only zero-width spaces) or contains bidirectional control characters. Emoji sequences and names with joiners still work.
- **Macaronis tab replaces the old form (parents):** the Add or Remove form and the Activity log table on the Macaronis tab are replaced by the Macaronis screen.
- **Behind the scenes: each child's numbers are kept separate:** the parent and child sides now keep each child's numbers, results, devices and activity apart, and a pairing code is made for a chosen child (no visible change yet).
- **Parent page is now a dashboard:** at `/parent`, a summary strip with her Macaroni balance, streak, last counted day and assignments done, then her Results (date, how many right, grade, Macaronis earned), the iPads, and an Activity log of changes made on the page. Its sections now live in the portal's tabs. Pairing and unpairing work as before.

## [0.3.0] - 2026-10-22

### Added

- **The reward menu:** Ice Cream (30 Macaronis), Pet Store (75), Camping (300) and Puppy (10,000), each with its own picture. The shop screen where she can buy them comes later.

### Fixed

- **Home numbers update when the connection comes back:** they used to stay out of date until Home was opened again.

## [0.2.0] - 2026-10-22

### Added

- **Her numbers on Home:** completed assignments, Macaroni balance, streak and the grade of her latest assignment, counting results that haven't been sent yet. The streak is left out when she hasn't finished one recently, and nothing shows until a paired iPad has its numbers. The result screen shows the streak bonus on her first finished assignment of the day.
- **Her results are saved:** a paired iPad keeps a batch of problems from the server, so assignments work with no connection, and sends each result when it can, oldest first. If it runs out of problems while offline, Start says "Connect to Wi-Fi to get more problems!"
- **Parent page:** at `/parent`, behind your Cloudflare Access sign-in. Name an iPad and make a 6-digit pairing code (it counts down from 10 minutes), see the paired iPads, and unpair one after a warning.
- **Pair her iPad:** in the installed app, Home shows **Pair this iPad** until the iPad is paired. A parent's 6-digit code goes in on the number pad, and the iPad keeps its key. If a parent later unpairs it, the button comes back. Practice works either way.
- **Pairing in PR previews:** a preview shows **Pair this iPad** in a browser tab, and its own preview code (kept in Cloudflare, never in the repo) pairs a device in the preview database, so paired screens can be checked on a phone. It does nothing on the live app.

### Removed

- **"Macaronis start saving soon!"** is gone from the result screen: her Macaronis are saved now.

## [0.1.1] - 2026-10-19

### Fixed

- **Her answer stays put after Check:** the boxes used to switch to the right answer, so her own boxes seemed to show the answer she'd gotten wrong. Now they keep exactly what she typed, tinted soft green when it's right and soft coral when it isn't, and the right answer appears only in the line above Next.

## [0.1.0] - 2026-10-17

Practice on the iPad: 20 math problems at a time, worked on paper-style columns, live on Cloudflare.

### Added

- **Do an assignment:** tap Start for 20 math problems, stacked like on paper with an answer box under each column, and answer each on a big number pad. Addition and subtraction answers fill from the ones place, the way she works them on paper. A right answer gets a cheer; otherwise the app shows how the problem works out. Tap Next when ready. At the end, see how many were right, the grade and the Macaronis earned. Tap "Done for now" to stop early and keep the Macaronis earned so far. Macaronis aren't saved yet.
- **Live on Cloudflare:** every merge to `main` deploys the app, so it can be opened and installed on the iPad from its workers.dev address. Each pull request gets its own preview address.

## [0.0.0] - 2026-10-17

### Added

- **Project scaffold:** the app installs to the iPad's home screen from Safari and opens offline. It shows only its name for now.
