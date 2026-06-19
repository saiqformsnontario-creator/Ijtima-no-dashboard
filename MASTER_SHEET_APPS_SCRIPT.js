/**
 * Paste this file into Extensions > Apps Script inside your Master Dashboard Sheet.
 *
 * Before running setupMasterDashboardSheet(), update these IDs:
 * - REGISTRATION_SHEET_ID
 * - EDUCATION_RESULTS_SHEET_ID
 * - SPORTS_RESULTS_SHEET_ID
 *
 * The dashboard backend reads this Master Sheet only.
 */

const REGISTRATION_SHEET_ID = "PASTE_REGISTRATION_SHEET_ID";
const EDUCATION_RESULTS_SHEET_ID = "PASTE_EDUCATION_RESULTS_SHEET_ID";
const SPORTS_RESULTS_SHEET_ID = "PASTE_SPORTS_RESULTS_SHEET_ID";

const MAJALIS = [
  "Barrie South",
  "Barrie North",
  "Innisfil",
  "Sudbury",
];

function setupMasterDashboardSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  setupTab(spreadsheet, "Users", ["username", "password", "name", "role", "majlis", "access"]);
  setupTab(spreadsheet, "Schedule", ["start", "end", "title", "location", "lead", "status"]);
  setupTab(spreadsheet, "Announcements", ["title", "message", "time", "priority"]);
  setupTab(spreadsheet, "Members", ["code", "name", "majlis", "registered", "attended", "checkIn"]);
  setupTab(spreadsheet, "Attendance", ["code", "name", "majlis", "checkIn", "checkedInBy"]);
  setupTab(spreadsheet, "Competition Results", ["category", "competition", "position", "name", "majlis", "points"]);
  setupTab(spreadsheet, "Majlis Rankings", ["majlis", "attendance", "education", "sports", "total", "rank"]);

  seedUsers(spreadsheet);
  seedSchedule(spreadsheet);
  seedAnnouncements(spreadsheet);
  setupMembersImport(spreadsheet);
  setupCompetitionResultsImport(spreadsheet);
  setupMajlisRankings(spreadsheet);
}

function setupTab(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function seedUsers(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Users");
  const users = [
    ["admin", "admin123", "Admin User", "admin", "", "Full portal access"],
    ["attendance", "attend123", "Attendance Team", "attendance", "", "Check-in portal access"],
    ["edujudge1", "judge123", "Education Judge 1", "educationJudge", "", "Education judging access"],
    ["edujudge2", "judge123", "Education Judge 2", "educationJudge", "", "Education judging access"],
    ["edujudge3", "judge123", "Education Judge 3", "educationJudge", "", "Education judging access"],
    ["sportsadmin", "sports123", "Sports Admin", "sportsAdmin", "", "Sports results access"],
    ["av", "av123", "AV Team", "av", "", "Projector display access"],
  ];

  MAJALIS.forEach((majlis, index) => {
    const number = String(index + 1).padStart(2, "0");
    users.push([`zaim${number}`, "zaim123", `Zaim ${number}`, "zaim", majlis, `${majlis} only`]);
  });

  sheet.getRange(2, 1, users.length, users[0].length).setValues(users);
}

function seedSchedule(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Schedule");
  const rows = [
    ["09:00 AM", "09:30 AM", "Opening Session", "Main Hall", "Ijtima Nazim", "Completed"],
    ["09:30 AM", "10:15 AM", "Tilawat & Nazm", "Main Hall", "Education Team", "Live"],
    ["10:20 AM", "11:15 AM", "Educational Competitions", "Classroom Block", "Taleem Department", "Next"],
    ["10:30 AM", "12:00 PM", "Sports Round 1", "Sports Ground", "Sports Team", "Upcoming"],
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function seedAnnouncements(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Announcements");
  const rows = [
    ["Registration desk open", "Pre-registered members can collect badges from the entrance desk.", "08:45 AM", "Info"],
    ["Sports location update", "Football round 1 has moved to the north field.", "09:20 AM", "Important"],
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function setupMembersImport(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Members");

  if (REGISTRATION_SHEET_ID.indexOf("PASTE_") === 0) {
    seedDemoMembers(sheet);
    return;
  }

  sheet.getRange("A2").setFormula(
    `=QUERY(IMPORTRANGE("${REGISTRATION_SHEET_ID}", "Form Responses 1!A:Z"), ` +
      `"select Col2, Col3, Col4, true, false, '' where Col2 is not null", 1)`
  );
}

function setupCompetitionResultsImport(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Competition Results");

  if (EDUCATION_RESULTS_SHEET_ID.indexOf("PASTE_") === 0 || SPORTS_RESULTS_SHEET_ID.indexOf("PASTE_") === 0) {
    const rows = [
      ["Education", "Tilawat", "1st", "Ahmad Khan", "Barrie South", 10],
      ["Education", "Nazm", "1st", "Bilal Ahmed", "Innisfil", 10],
      ["Sports", "Football", "1st", "Team Sudbury", "Sudbury", 10],
      ["Sports", "100m Race", "1st", "Usman Raza", "Barrie North", 10],
    ];
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    return;
  }

  sheet.getRange("A2").setFormula(
    `={QUERY(IMPORTRANGE("${EDUCATION_RESULTS_SHEET_ID}", "Results!A:F"), ` +
      `"select Col1, Col2, Col3, Col4, Col5, Col6 where Col1 is not null", 1);` +
      `QUERY(IMPORTRANGE("${SPORTS_RESULTS_SHEET_ID}", "Results!A:F"), ` +
      `"select Col1, Col2, Col3, Col4, Col5, Col6 where Col1 is not null", 1)}`
  );
}

function setupMajlisRankings(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Majlis Rankings");

  MAJALIS.forEach((majlis, index) => {
    const row = index + 2;
    sheet.getRange(row, 1).setValue(majlis);
    sheet.getRange(row, 2).setFormula(`=IFERROR(ROUND(COUNTIFS(Attendance!C:C,A${row})/COUNTIFS(Members!C:C,A${row},Members!D:D,TRUE)*100,0),0)`);
    sheet.getRange(row, 3).setFormula(`=SUMIFS('Competition Results'!F:F,'Competition Results'!A:A,"Education",'Competition Results'!E:E,A${row})`);
    sheet.getRange(row, 4).setFormula(`=SUMIFS('Competition Results'!F:F,'Competition Results'!A:A,"Sports",'Competition Results'!E:E,A${row})`);
    sheet.getRange(row, 5).setFormula(`=ROUND(B${row}*0.5+C${row}+D${row},0)`);
    sheet.getRange(row, 6).setFormula(`=RANK(E${row},E$2:E$5,0)`);
  });

  sheet.autoResizeColumns(1, 6);
}

function seedDemoMembers(sheet) {
  const rows = [];

  MAJALIS.forEach((majlis, index) => {
    const baseCode = (index + 1) * 100;
    rows.push([`M${baseCode + 1}`, `Member ${baseCode + 1}`, majlis, true, false, ""]);
    rows.push([`M${baseCode + 2}`, `Member ${baseCode + 2}`, majlis, true, false, ""]);
    rows.push([`M${baseCode + 3}`, `Member ${baseCode + 3}`, majlis, false, false, ""]);
  });

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
