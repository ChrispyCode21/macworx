# Changelog

All notable changes to macworx. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match (`npm version X.Y.Z --no-git-tag-version`). Merging tags the release and closes its milestone automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

### Added

- **Macaronis screen (parents):** her balance with "+N earned today" (left out at 0), Add or Remove with a reason, a "Balance after adjustment" preview, and Review then Confirm (Back returns to the form without saving). Recent activity lists each change with when, which parent and what changed, and the signed amount of a balance change (for example +20 or −15). A removal bigger than her balance is refused in plain words before anything is sent.
- **Pair panel on the Devices screen (parents):** a "Connect another device" panel for the chosen child with a device name box (up to 40 characters), a Generate pairing code button, the code as one string with "Expires in N minutes." counting down, and a footnote that codes expire after 10 minutes. Beside it are a "Before you disconnect" note (using her name, Macaronis and streak) and a "Child access only" note. The Devices screen has two columns from 1024px wide. Her app now says "Pair this device" instead of "Pair this iPad".
- **Device cards with last synced (parents):** the Devices tab shows a "{n} connected" count and a card for each connected device with its name, when it was added and when it last synced ("Synced today, 4:05 pm", "Synced Oct 12" or "No results yet"), and an Unpair button that keeps its warning. An unpaired device leaves the list (the Activity log still names it). The Online or Offline status and the browser line are sample data, labelled "Sample"; renaming a device and "View details" are shown disabled. The parent pages say "device" instead of "iPad". `GET /api/parent/devices` also returns `lastResultAt`.
- **Add and rename a child (parents):** Overview has a Children panel with Add a child and Rename, for a name (1 to 40 characters), an optional grade and initials (filled from the name until you type your own). The child switcher list has a Rename button on each child and an "Add a child" row; a new child is selected right away. Children can't be deleted, and both changes show in the Activity log.
- **Parent portal shell:** `/parent` is now five tabs (Overview, Macaronis, Streak, Devices, Shop) at `/parent/overview`, `/parent/points`, `/parent/streak`, `/parent/devices` and `/parent/shop`, with a header, a child switcher, tabs along the bottom on a phone and a side bar from 768px wide, in the macworx colors. Home has a **Parents** link. Today's sections moved into the tabs unchanged.
- **Parent portal Shop screen (read-only):** the Shop tab lists the four rewards with their prices and how far her balance is from each, shows an edit panel with every control disabled ("Editing rewards is coming soon."), and an empty "Last redeemed". Nothing is stored.
- **Set or restore her streak (parents):** an Adjustments section on `/parent` with a streak form. It saves her streak (0 to 3,650) and last counted day, doesn't change her Macaronis or pay a bonus, and shows in the Activity log.
- **Add or remove Macaronis (parents):** an Adjustments section on `/parent` with Add or Remove, a number, a note and Save. Her balance can't go below 0; a removal that's too big is refused in plain words. Every change appears in the Activity log (for example "Added 20 Macaronis: Homework grades"). Her Home shows the new balance after her next sync.

### Changed

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
