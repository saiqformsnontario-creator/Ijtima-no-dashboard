# Master Sheet Setup

Use one Google Sheet as the dashboard source. Registration, education judging, and sports judging can stay in their own sheets; the Master Sheet imports their cleaned data.

## Steps

1. Create a new Google Sheet called `Ijtima Dashboard Master`.
2. Add a tab named `Master Members`. This is the source of truth for every member, whether or not they pre-registered:

```text
Code | Name | Majlis | Phone/Notes
```

The existing `Members` tab is the Ijtima pre-registration list. Put only pre-registered members there:

```text
Code | Name | Majlis | Registered | Attended | Check In
```

If someone attends but is not in `Master Members`, the attendance screen can add them manually as a walk-in during check-in.

The `Schedule` tab should use these columns:

```text
date | start | end | title | location | lead | status
```

3. Open `Extensions > Apps Script`.
4. Paste the contents of `MASTER_SHEET_APPS_SCRIPT.js`.
5. Replace these constants at the top:

```javascript
const REGISTRATION_SHEET_ID = "PASTE_REGISTRATION_FORM_RESPONSE_SHEET_ID";
const EDUCATION_RESULTS_SHEET_ID = "PASTE_EDUCATION_RESULTS_SHEET_ID";
const SPORTS_RESULTS_SHEET_ID = "PASTE_SPORTS_RESULTS_SHEET_ID";
```

6. Run:

```javascript
setupMasterDashboardSheet()
```

7. Approve the `IMPORTRANGE` permissions inside the Master Sheet if Google asks.
8. Put the Master Sheet ID in `.env`:

```text
GOOGLE_SPREADSHEET_ID=your_master_sheet_id
```

## Expected External Sheet Shapes

Registration form response sheet should expose:

```text
Col2 = member code
Col3 = name
Col4 = majlis
```

Education and sports result sheets should each have a `Results` tab:

```text
category | competition | position | name | majlis | points
```

The dashboard reads only the Master Sheet tabs:

```text
Users
Master Members
Schedule
Announcements
Members
Attendance
Competition Results
Majlis Rankings
```
