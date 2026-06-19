# Northern Ontario Region Ijtima — Dashboard Guide

A complete reference for how the Ijtima Dashboard works: what it is, who uses it, every page and feature, and how the pieces connect. This is the user/admin-facing companion to the technical setup docs ([DEPLOYMENT.md](DEPLOYMENT.md), [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md), [MASTER_SHEET_SETUP.md](MASTER_SHEET_SETUP.md)).

## 1. What this is

A single-page web dashboard for running an Ijtima (a multi-day community gathering organized into 4 **Majalis**/branches). It has a public-facing side (schedule, announcements, results, documents) and six role-based portals for the teams running the event: admins, majlis leaders (Zaim), the attendance desk, education judges, and the sports results team.

Data lives in a single Google Sheet ("Master Sheet") that the Node backend reads/writes; if Sheets isn't configured, the app falls back to in-memory sample data so it still works for local testing.

## 2. Architecture at a glance

| Piece | File | Role |
|---|---|---|
| Frontend | [index.html](index.html), [app.js](app.js), [styles.css](styles.css) | Single-page app, no framework. `app.js` renders every screen and owns all client state. |
| Backend | [server.js](server.js) | Plain Node `http` server — static file serving + `/api/*` JSON routes. No framework, no DB driver. |
| Sheets bridge | [sheetsClient.js](sheetsClient.js), [sheetsStore.js](sheetsStore.js) | Service-account JWT auth to the Google Sheets API; reads/writes the named tabs. |
| Optional Apps Script bridge | [MASTER_SHEET_APPS_SCRIPT.js](MASTER_SHEET_APPS_SCRIPT.js) | Lets the Master Sheet pull in cleaned data from separate registration/education/sports sheets via `IMPORTRANGE`. |
| Document links | [documents.json](documents.json) | Local fallback storage for the Syllabus / Sports Package links when Sheets isn't configured. |

The frontend calls `GET /api/bootstrap` on load to fetch all data in one shot, then polls every 30 seconds for live updates (paused while a user is mid-edit in a form). Login state is kept in `localStorage` (`dashboardSession`) so refreshing the page keeps you signed in.

## 3. Roles & login

| Role | Username(s) | Password | Portal label |
|---|---|---|---|
| Public (no login) | — | — | Public Dashboard |
| Admin | `admin` | `admin123` | Admin Portal |
| Zaim (majlis leader) | `zaim01`–`zaim04` (one per majlis) | `zaim123` | Zaim Dashboard |
| Attendance Team | `attendance` | `attend123` | Attendance Team Portal |
| Education Judge | `edujudge1`, `edujudge2`, `edujudge3` | `judge123` | Education Judge Portal |
| Sports Admin | `sportsadmin` | `sports123` | Sports Results Portal |

Click **Login** in the top bar to open the sign-in modal (username + password, Enter submits). Wrong credentials show "Invalid username or password." **Logout** clears the session and returns to the public view. These are the seed/demo credentials baked into the sample data — real deployments should replace them via the **Users** tab in the Master Sheet or the Admin → Users screen.

The 4 majalis are: Barrie South, Barrie North, Innisfil, Sudbury.

## 4. Public Dashboard (no login)

| Page | What it shows |
|---|---|
| **Overview** | Live/next program banner, top announcements, prayer times, document links, latest competition results, service status tiles (registration desk, prayer, transport, food). |
| **Schedule** | Full event timeline with auto-computed status badges: Completed ✓ / Live Now ● / Next → / Upcoming ○. |
| **Announcements** | All announcements with priority (Info / Important / Critical / Success) and timestamps. |
| **Documents** | "View PDF" links for the Ijtima Syllabus and Sports Package. |
| **Competitions** | Education + Sports winners leaderboard with medal styling (Gold/Silver/Bronze/#n). |
| **Help** | Emergency contact and help-desk info. |

## 5. Zaim Dashboard (majlis leaders)

Scoped entirely to the leader's own majlis.

- **Dashboard** — hero card (registered vs. total Tajnid, performance score ring), KPI grid (Registration %, Attendance %, Rank, Pending check-ins), daily goals checklist (register everyone / 100% attendance / break into top 2), mini leaderboard.
- **Members** ("My Majlis Registration Details") — search by name/code, filter by Registered / Not Registered, **PDF Report** / **Excel** export.
- **Attendance** ("My Majlis Attendance Details") — search/filter by Present / Pending, shows check-in time, **PDF Report** / **Excel** export.
- **Rankings** — own rank and score breakdown (registration % + attendance %), full 4-majlis leaderboard with the current majlis highlighted, and a "need +X points for top 2" callout.

## 6. Attendance Team Portal

- **Check-In Station** — live stats bar (Checked In, Pre-Registered, Total Tajnid, Not-Registered Checked In, Pending Registered, Attendance Rate). Search by code/name/badge scan (`Enter` = lookup, `F2` = focus search, `Esc` = close popup), pick from up to 5 matches, then confirm in a modal (Confirm Attendance / Already Checked In / Attendance Recorded / Admin override). Includes **Report Issue** and **Undo Check-in**. A recent-activity feed shows the last 6 check-ins.
- **Manual Entry** — "Member Not In System" walk-in form: optional code, required name + majlis, optional phone/notes → **Add Walk-In & Check In** creates the record and checks them in immediately.
- **Activity Log** — last 10 check-ins with time, code, name, majlis, and who checked them in.
- **Issues** — review queue for potential duplicate codes, badge problems, and missing registrations.

### Check-in flow, step by step
1. Desk staff search by code/name/scan.
2. Pick the right person from the candidate list.
3. Modal confirms identity and current status (new check-in / duplicate / success).
4. **Check In** records the time and writes an attendance row (`code, name, majlis, checkIn, checkedInBy`).
5. If not found, the walk-in form creates a new member record on the fly (tagged `manual` or `walk-in` depending on whether a code was supplied) and checks them in in the same action.
6. Re-checking in the same person same day is flagged as a duplicate rather than double-counted; admins can also mark people **absent** in bulk to undo a check-in.

## 7. Education Judge Portal

Single **Final Positions** page with two tabs:

- **Enter Results** — pick or create a competition (`+ New`: name, category fixed to Education, type Individual/Team). Position grid defaults to 1st/2nd/3rd (more can be added); each slot takes one or more members (code/name/majlis, with add/remove rows for team events). **Save All Positions** persists the leaderboard.
- **View Results** — competition cards with ranked entries, **Print Report**, **Export PDF**, **Export Excel**, filterable by competition and by majlis.

Education competitions in the sample data set: Tilawat, Nazm, Adhan, Speech (Urdu/English/French), Impromptu Speech (Urdu/English), Hifz-e-Qur'an, Hifz-e-Hadith, Hifz-e-Adiyah, Hifz-e-Ilhamat, Message Relay, Bait Bazi.

Scoring (where rosters/rubrics are used) is recorded per judge and averaged; majlis education points feed directly into the Majlis Rankings.

## 8. Sports Admin Portal

Single **Final Positions** page, two tabs:

- **Enter Results** — pick a sport, then fill the 1st/2nd/3rd-place podium grid: majlis/team, score/time/distance, and a participant roster per position (search-and-add, with add/remove rows). **Save Draft** or **Publish Results** (publishing requires at least 3 positions filled). A live preview shows how the announcement will read.
- **View Results** — published sport cards with podium + roster, plus **Edit**, **Export Excel**, **Export PDF**.

Sample sports: Basketball, Soccer, Cricket, Volleyball, Kickball, Hockey, Dodgeball (team); Badminton (doubles); Shot Put, Running/Standing Long Jump (measured individual); 100m Race (timed individual); Tug of War (individual). Points: 1st = 10, 2nd = 7, 3rd = 5 — these roll up into the Sports Standings / Majlis Rankings.

## 9. Admin Portal

The Admin sidebar has three groups:

**Manage**
- **Overview** — system summary (data areas, user roles).
- **Schedule Manager** — add/edit programs with date, start/end time (with +30/45/60/90-min quick-duration buttons), location, lead, and status (Auto / Upcoming / Next / Live / Completed). Quick templates: Tilawat, Nazm, Speech, Sports, Break. Warns on time overlaps.
- **Announcements** — create/edit with title (≤80 chars), message (≤200 chars, live counter), priority (Info/Important/Critical/Success), and quick templates (Registration, Prayer, Lunch, Transport, Sports, Emergency). Save as Draft or Send.

**Operations**
- **Registrations** — live KPIs (Registered, Total Tajnid, Not Registered, Registration %), an "attention required" panel (members not checked in, majalis with zero registrations, possible duplicates), per-majlis registration ranking cards, and a searchable/filterable table with **PDF Report** / **Excel** export.
- **Attendance Input** — same Check-In Station used by the Attendance Team, available to admins for cross-majlis corrections.
- **Attendance Reports** — KPIs (Present, Pending, Attendance Rate, Tajnid Reach), attention panel (majalis below 30% attendance, biggest gap), check-ins-by-hour trend, per-majlis attendance ranking, searchable/filterable table, **PDF Report** / **Excel** export.
- **Competitions** — combined view of posted Education + Sports results, with totals by category.

**Admin**
- **Users** — add/edit/delete accounts: username, password (optional on edit — "leave blank to keep current"), name, role (admin/zaim/attendance/educationJudge/sportsAdmin), majlis (for Zaim), free-text access note. Role-count summary cards double as filters.
- **Documents** — paste a Google Drive "anyone with the link can view" URL for the **Ijtima Syllabus** and **Sports Package**; each shows a "Link saved / No link yet" status with Save / View / Remove actions. These are the two keys the backend allows (`syllabus`, `sports-package`).

## 10. Majlis Rankings — how the score is built

For each majlis: `Total = Attendance % + Education points + Sports points`, where:
- **Attendance %** = present ÷ registered.
- **Education points** = sum of that majlis's education competition results.
- **Sports points** = sum of that majlis's sports placements (10/7/5 per event).

Ranking is computed live from current data (falling back to the precomputed `Majlis Rankings` sheet tab if live scores aren't available yet), sorted by total score, then attendance %, then name.

## 11. Reports & exports

Every report screen (Registrations, Attendance Reports, Zaim Members/Attendance, Education/Sports Final Positions) offers the same two export buttons:

- **PDF Report** — opens a print-ready window with logo header, report title, applied filters, a generated timestamp, summary metrics, and the data table. Use the browser's print dialog to save as PDF or print physically.
- **Excel** — downloads a UTF-8 CSV with the same columns, ready to open in Excel/Sheets.

Filters available depend on the screen but generally include free-text search (name/code/majlis), a Majlis dropdown, and a status dropdown (Registered/Not Registered, Present/Pending, or Competition/Majlis for results).

## 12. Data model & sync

- The Google Sheet is the single source of truth (tabs: `Users`, `Master Members`, `Members`, `Schedule`, `Announcements`, `Attendance`, `Majlis Rankings`, `Competition Results`, `Documents`). Tab layouts are documented in [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) and [MASTER_SHEET_SETUP.md](MASTER_SHEET_SETUP.md).
- `Master Members` is the full Tajnid list (everyone, registered or not); `Members` is the pre-registration list. The server merges them so a member shows as registered/attended regardless of which list they came from, and walk-ins who match neither get added on the spot during check-in.
- The backend caches `/api/bootstrap` for 30 seconds and refreshes it in the background, so the UI's 30-second poll is effectively reading a warm cache, not hammering the Sheets API.
- Without Sheets credentials configured, the server uses in-memory sample data — fine for local development/demo, but nothing persists across a restart (except document links, which fall back to [documents.json](documents.json)).

## 13. Deployment & setup

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting (Render, Heroku-style, Hostinger + subdomain/subpath via `BASE_PATH`), and [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) / [MASTER_SHEET_SETUP.md](MASTER_SHEET_SETUP.md) for wiring up the Google Sheet and service account. Locally: `npm start`, then open `http://localhost:3000`.
