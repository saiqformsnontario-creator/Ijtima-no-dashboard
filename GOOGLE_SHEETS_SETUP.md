# Google Sheets Setup

Create one Google Sheet with these tabs and headers in row 1.

## Tabs

### Users
```text
username | password | name | role | majlis | access
```

### Schedule
```text
date | start | end | title | location | lead | status
```

### Announcements
```text
title | message | time | priority
```

### Members
```text
code | name | majlis | registered | attended | checkIn
```

### Attendance
```text
code | name | majlis | checkIn | checkedInBy
```

### Majlis Rankings
```text
majlis | attendance | education | sports | total | rank
```

### Competition Results
```text
category | competition | position | name | majlis
```

## Backend Credentials

1. Create a Google Cloud service account.
2. Create a JSON key for that service account.
3. Share the Google Sheet with the service account email as an editor.
4. Copy `.env.example` to `.env`.
5. Fill in:

```text
GOOGLE_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
```

The private key should stay on one line in `.env`, with `\n` where the key has line breaks.

Start the backend:

```text
npm start
```

Then open:

```text
http://localhost:3000
```
