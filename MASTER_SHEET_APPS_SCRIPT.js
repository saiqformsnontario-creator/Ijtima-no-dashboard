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

const REGISTRATION_SHEET_ID = "1rstkVnmEl8w1w_5lccfNzU4U68f5dTvMLBqpwBzLzKY";
const EDUCATION_RESULTS_SHEET_ID = "PASTE_EDUCATION_RESULTS_SHEET_ID";
const SPORTS_RESULTS_SHEET_ID = "PASTE_SPORTS_RESULTS_SHEET_ID";
const FORM_URL = "";

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
  setupTab(spreadsheet, "Master Members", ["code", "name", "majlis", "phone"]);
  setupTab(spreadsheet, "Members", ["code", "name", "majlis", "registered", "attended", "checkIn"]);
  setupTab(spreadsheet, "Attendance", ["code", "name", "majlis", "checkIn", "checkedInBy"]);
  setupTab(spreadsheet, "Competition Results", ["category", "competition", "position", "name", "majlis", "points"]);
  setupTab(spreadsheet, "Majlis Rankings", ["majlis", "attendance", "education", "sports", "total", "rank"]);
  setupTab(spreadsheet, "Education Competition Rosters", ["competition", "name", "code", "majlis"]);
  setupTab(spreadsheet, "Sports Competition Rosters", ["sport", "position", "name", "code", "majlis"]);

  seedUsers(spreadsheet);
  seedSchedule(spreadsheet);
  seedAnnouncements(spreadsheet);
  seedDemoMasterMembers(spreadsheet.getSheetByName("Master Members"));
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

  const sourceTab = "Form Responses 1";

  sheet.getRange("A2").setFormula(
    `=QUERY({` +
      `IMPORTRANGE("${REGISTRATION_SHEET_ID}", "${sourceTab}!C2:C"), ` +
      `IMPORTRANGE("${REGISTRATION_SHEET_ID}", "${sourceTab}!B2:B"), ` +
      `IMPORTRANGE("${REGISTRATION_SHEET_ID}", "${sourceTab}!F2:F"), ` +
      `ARRAYFORMULA(IF(IMPORTRANGE("${REGISTRATION_SHEET_ID}", "${sourceTab}!C2:C")<>"", TRUE, )), ` +
      `ARRAYFORMULA(IF(IMPORTRANGE("${REGISTRATION_SHEET_ID}", "${sourceTab}!C2:C")<>"", FALSE, )), ` +
      `ARRAYFORMULA(IF(IMPORTRANGE("${REGISTRATION_SHEET_ID}", "${sourceTab}!C2:C")<>"", "", ))` +
    `}, "select Col1, Col2, Col3, Col4, Col5, Col6 where Col1 is not null", 0)`
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

function seedDemoMasterMembers(sheet) {
  const rows = [];

  MAJALIS.forEach((majlis, index) => {
    const baseCode = (index + 1) * 100;
    rows.push([`M${baseCode + 1}`, `Member ${baseCode + 1}`, majlis, ""]);
    rows.push([`M${baseCode + 2}`, `Member ${baseCode + 2}`, majlis, ""]);
    rows.push([`M${baseCode + 3}`, `Member ${baseCode + 3}`, majlis, ""]);
    rows.push([`M${baseCode + 4}`, `Member ${baseCode + 4}`, majlis, ""]);
  });

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : "bootstrap";

  if (action === "bootstrap") {
    return jsonResponse(getBootstrapPayload());
  }

  if (action === "avConfig") {
    return jsonResponse({ status: "ok", config: loadAvConfig(SpreadsheetApp.getActiveSpreadsheet()) });
  }

  return jsonResponse({ error: "Unknown action." });
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  const action = body.action;

  if (action === "attendanceCheckIn") {
    return jsonResponse(recordAttendance(body.payload));
  }

  if (action === "attendanceMarkAbsent") {
    return jsonResponse(markAttendanceAbsent(body.payload));
  }

  if (action === "addSchedule") {
    return jsonResponse(addScheduleItem(body.payload));
  }

  if (action === "updateSchedule") {
    return jsonResponse(updateScheduleItem(body.payload));
  }

  if (action === "deleteSchedule") {
    return jsonResponse(deleteScheduleItem(body.payload));
  }

  if (action === "addAnnouncement") {
    return jsonResponse(addAnnouncement(body.payload));
  }

  if (action === "updateAnnouncement") {
    return jsonResponse(updateAnnouncement(body.payload));
  }

  if (action === "deleteAnnouncement") {
    return jsonResponse(deleteAnnouncement(body.payload));
  }

  if (action === "addUser") {
    return jsonResponse(addUser(body.payload));
  }

  if (action === "updateUser") {
    return jsonResponse(updateUser(body.payload));
  }

  if (action === "deleteUser") {
    return jsonResponse(deleteUser(body.payload));
  }

  if (action === "educationResult") {
    return jsonResponse(upsertEducationResult(body.payload));
  }

  if (action === "educationRosterAdd") {
    return jsonResponse(addEducationRosterParticipant(body.payload));
  }

  if (action === "educationRosterRemove") {
    return jsonResponse(removeEducationRosterParticipant(body.payload));
  }

  if (action === "sportsResult") {
    return jsonResponse(upsertSportsResult(body.payload));
  }

  if (action === "sportsRosterAdd") {
    return jsonResponse(addSportsRosterParticipant(body.payload));
  }

  if (action === "sportsRosterRemove") {
    return jsonResponse(removeSportsRosterParticipant(body.payload));
  }

  if (action === "getMembers") {
    return jsonResponse({ status: "ok", members: getMasterMembersForAdmin(SpreadsheetApp.getActiveSpreadsheet()) });
  }

  if (action === "addMasterMember") {
    return jsonResponse(addMasterMember(body.payload));
  }

  if (action === "bulkAddMasterMembers") {
    return jsonResponse(bulkAddMasterMembers(body.payload));
  }

  if (action === "avConfigSave") {
    return jsonResponse(saveAvConfig(body.payload));
  }

  return jsonResponse({ error: "Unknown action." });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function getBootstrapPayload() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const masterMembers = normalizeMasterMembers(rowsToObjects(spreadsheet.getSheetByName("Master Members").getDataRange().getValues()));
  const registrations = normalizeMembers(rowsToObjects(spreadsheet.getSheetByName("Members").getDataRange().getValues()));
  const attendanceRows = rowsToObjects(spreadsheet.getSheetByName("Attendance").getDataRange().getValues());

  return {
    majalis: MAJALIS,
    formUrl: FORM_URL,
    users: rowsToObjects(spreadsheet.getSheetByName("Users").getDataRange().getValues()),
    scheduleItems: rowsToObjects(spreadsheet.getSheetByName("Schedule").getDataRange().getValues()),
    announcements: rowsToObjects(spreadsheet.getSheetByName("Announcements").getDataRange().getValues()),
    masterMemberRecords: masterMembers,
    registrationRecords: registrations,
    memberRecords: mergeAttendance(mergeMasterAndRegistrations(masterMembers, registrations), attendanceRows),
    attendanceRecords: attendanceRows,
    competitionResults: rowsToObjects(spreadsheet.getSheetByName("Competition Results").getDataRange().getValues()),
    majlisRankings: normalizeRankings(rowsToObjects(spreadsheet.getSheetByName("Majlis Rankings").getDataRange().getValues())),
    educationJudgeResults: getOptionalRows(spreadsheet, "Education Judge Results"),
    educationCompetitionRosters: getEducationCompetitionRosters(spreadsheet),
    sportsCompetitionRosters: getSportsCompetitionRosters(spreadsheet),
    sportsPostedResults: getOptionalRows(spreadsheet, "Sports Posted Results"),
  };
}

function mergeAttendance(members, attendanceRows) {
  const attendanceByCode = {};
  attendanceRows.forEach((row) => {
    attendanceByCode[String(row.code || "").trim()] = row;
  });

  return members.map((member) => {
    const attendance = attendanceByCode[String(member.code || "").trim()];
    if (!attendance) {
      return member;
    }
    return { ...member, attended: true, checkIn: attendance.checkIn || member.checkIn || "" };
  });
}

function buildMajlisIdMap() {
  const map = {};
  MAJALIS.forEach((majlis, index) => {
    map[majlis] = "h" + index;
  });
  return map;
}

function rowsToObjects(values) {
  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0];

  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row, index) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = formatCellValue(row[index]);
      });
      item._rowNumber = index + 2;
      return item;
    });
}

function formatCellValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "hh:mm a");
  }
  return value;
}

function getOptionalRows(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  return sheet ? rowsToObjects(sheet.getDataRange().getValues()) : [];
}

function normalizeMembers(rows) {
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    majlis: row.majlis,
    registered: row.registered === true || String(row.registered).toLowerCase() === "true",
    attended: row.attended === true || String(row.attended).toLowerCase() === "true",
    checkIn: row.checkIn || "",
  }));
}

function normalizeMasterMembers(rows) {
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    majlis: row.majlis,
    phone: row.phone || "",
    registered: false,
    attended: false,
    checkIn: "",
    source: "master",
  }));
}

function mergeMasterAndRegistrations(masterMembers, registrations) {
  const registrationByCode = {};
  registrations.forEach((member) => {
    registrationByCode[String(member.code || "").trim()] = member;
  });

  const merged = masterMembers.map((member) => {
    const registration = registrationByCode[String(member.code || "").trim()];
    return {
      ...member,
      registered: Boolean(registration),
      attended: Boolean(registration && registration.attended),
      checkIn: registration ? registration.checkIn || "" : "",
    };
  });

  registrations.forEach((registration) => {
    const exists = merged.some((member) => String(member.code || "").trim() === String(registration.code || "").trim());
    if (!exists) {
      merged.push({ ...registration, source: "registration-only" });
    }
  });

  return merged;
}

function normalizeRankings(rows) {
  return rows.map((row) => ({
    majlis: row.majlis,
    attendance: Number(row.attendance) || 0,
    education: Number(row.education) || 0,
    sports: Number(row.sports) || 0,
    total: Number(row.total) || 0,
    rank: Number(row.rank) || 0,
  }));
}

function recordAttendance(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const attendanceSheet = spreadsheet.getSheetByName("Attendance");
  const membersSheet = spreadsheet.getSheetByName("Members");
  const masterMembersSheet = spreadsheet.getSheetByName("Master Members");
  const registrations = normalizeMembers(rowsToObjects(membersSheet.getDataRange().getValues()));
  const masterMembers = normalizeMasterMembers(rowsToObjects(masterMembersSheet.getDataRange().getValues()));
  let members = mergeMasterAndRegistrations(masterMembers, registrations);
  let member = members.find((item) => String(item.code || "").trim() === String(payload.code || "").trim());

  if (!member) {
    const manual = payload.member || payload;
    const code = String(manual.code || "").trim() || `WALK-${Date.now().toString(36)}`;
    const name = String(manual.name || "").trim();
    const majlis = String(manual.majlis || "").trim();

    if (!name || !majlis) {
      return { error: "Member was not found. Enter name and majlis to add a manual walk-in." };
    }

    member = { code, name, majlis, registered: false, attended: false, checkIn: "", source: "walk-in" };
    members.push(member);
  }

  const existing = rowsToObjects(attendanceSheet.getDataRange().getValues()).find((item) => String(item.code || "").trim() === String(member.code || "").trim());

  if (existing) {
    return { error: `${member.name} is already checked in.`, attendanceRecords: rowsToObjects(attendanceSheet.getDataRange().getValues()) };
  }

  const checkIn = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "hh:mm a");
  attendanceSheet.appendRow([member.code, member.name, member.majlis, checkIn, payload.checkedInBy || "Attendance Team"]);

  return {
    memberRecords: members.map((item) => (item.code === member.code ? { ...item, attended: true, checkIn } : item)),
    attendanceRecords: rowsToObjects(attendanceSheet.getDataRange().getValues()),
    message: `${member.name} checked in successfully.`,
  };
}

function markAttendanceAbsent(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const attendanceSheet = spreadsheet.getSheetByName("Attendance");
  const membersSheet = spreadsheet.getSheetByName("Members");
  const codes = (payload.codes || []).map((code) => String(code || "").trim()).filter(Boolean);
  const codeSet = {};

  codes.forEach((code) => {
    codeSet[code] = true;
  });

  if (!codes.length) {
    return { error: "No members were selected." };
  }

  const attendanceValues = attendanceSheet.getDataRange().getValues();

  for (let rowIndex = attendanceValues.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const rowCode = String(attendanceValues[rowIndex][0] || "").trim();

    if (codeSet[rowCode]) {
      attendanceSheet.deleteRow(rowIndex + 1);
    }
  }

  const memberValues = membersSheet.getDataRange().getValues();

  for (let rowIndex = 1; rowIndex < memberValues.length; rowIndex += 1) {
    const rowCode = String(memberValues[rowIndex][0] || "").trim();

    if (codeSet[rowCode]) {
      membersSheet.getRange(rowIndex + 1, 5).setValue(false);
      membersSheet.getRange(rowIndex + 1, 6).setValue("");
    }
  }

  return {
    memberRecords: normalizeMembers(rowsToObjects(membersSheet.getDataRange().getValues())),
    attendanceRecords: rowsToObjects(attendanceSheet.getDataRange().getValues()),
    message: `${codes.length} member${codes.length === 1 ? "" : "s"} marked absent.`,
  };
}

function addScheduleItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Schedule");
  sheet.appendRow([payload.start, payload.end, payload.title, payload.location, payload.lead, payload.status || "Upcoming"]);
  return { scheduleItems: rowsToObjects(sheet.getDataRange().getValues()) };
}

function updateScheduleItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Schedule");
  const rowNumber = Number(payload.rowId);

  if (rowNumber >= 2) {
    sheet.getRange(rowNumber, 1, 1, 6).setValues([
      [payload.start, payload.end, payload.title, payload.location, payload.lead, payload.status || "Upcoming"],
    ]);
  }

  return { scheduleItems: rowsToObjects(sheet.getDataRange().getValues()) };
}

function deleteScheduleItem(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Schedule");
  const rowNumber = Number(payload.rowId);

  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
  }

  return { scheduleItems: rowsToObjects(sheet.getDataRange().getValues()) };
}

function addAnnouncement(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Announcements");
  sheet.appendRow([payload.title, payload.message, payload.time, payload.priority || "Info"]);
  return { announcements: rowsToObjects(sheet.getDataRange().getValues()) };
}

function updateAnnouncement(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Announcements");
  const rowNumber = Number(payload.rowId);

  if (rowNumber >= 2) {
    sheet.getRange(rowNumber, 1, 1, 4).setValues([[payload.title, payload.message, payload.time, payload.priority || "Info"]]);
  }

  return { announcements: rowsToObjects(sheet.getDataRange().getValues()) };
}

function deleteAnnouncement(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Announcements");
  const rowNumber = Number(payload.rowId);

  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
  }

  return { announcements: rowsToObjects(sheet.getDataRange().getValues()) };
}

function addUser(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  sheet.appendRow([
    normalizeUsername(payload.username),
    payload.password || "",
    payload.name || "",
    payload.role || "zaim",
    payload.majlis || "",
    payload.access || "",
  ]);
  return { users: rowsToObjects(sheet.getDataRange().getValues()) };
}

function updateUser(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const rowNumber = Number(payload.rowId);

  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    const existingPassword = sheet.getRange(rowNumber, 2).getValue();
    sheet.getRange(rowNumber, 1, 1, 6).setValues([
      [
        normalizeUsername(payload.username),
        payload.password || existingPassword,
        payload.name || "",
        payload.role || "zaim",
        payload.majlis || "",
        payload.access || "",
      ],
    ]);
  }

  return { users: rowsToObjects(sheet.getDataRange().getValues()) };
}

function deleteUser(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  const rowNumber = Number(payload.rowId);

  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
  }

  return { users: rowsToObjects(sheet.getDataRange().getValues()) };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function upsertEducationResult(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "Education Judge Results", [
    "competition",
    "participantType",
    "participantName",
    "participantCode",
    "teamMembers",
    "majlis",
    "criteria",
    "total",
    "judge",
    "postedAt",
  ]);
  upsertRow(sheet, payload, ["judge", "competition", "participantName", "majlis"], [
    payload.competition,
    payload.participantType,
    payload.participantName,
    payload.participantCode,
    JSON.stringify(payload.teamMembers || []),
    payload.majlis,
    JSON.stringify(payload.criteria || {}),
    payload.total,
    payload.judge,
    payload.postedAt,
  ]);
  return { educationJudgeResults: rowsToObjects(sheet.getDataRange().getValues()) };
}

function getEducationCompetitionRosters(spreadsheet) {
  const rows = getOptionalRows(spreadsheet, "Education Competition Rosters");
  return rows.reduce((groups, row) => {
    const competition = row.competition;

    if (!competition) {
      return groups;
    }

    if (!groups[competition]) {
      groups[competition] = [];
    }

    groups[competition].push({
      name: row.name,
      code: row.code,
      majlis: row.majlis,
    });
    return groups;
  }, {});
}

function addEducationRosterParticipant(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "Education Competition Rosters", ["competition", "name", "code", "majlis"]);
  const participant = payload.participant || {};
  const rowPayload = {
    competition: payload.competition,
    name: participant.name,
    code: participant.code,
    majlis: participant.majlis,
  };

  upsertRow(sheet, rowPayload, rowPayload.code ? ["competition", "code"] : ["competition", "name", "majlis"], [
    rowPayload.competition,
    rowPayload.name,
    rowPayload.code,
    rowPayload.majlis,
  ]);

  return { educationCompetitionRosters: getEducationCompetitionRosters(spreadsheet) };
}

function removeEducationRosterParticipant(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "Education Competition Rosters", ["competition", "name", "code", "majlis"]);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const competitionIndex = headers.indexOf("competition");
  const nameIndex = headers.indexOf("name");
  const codeIndex = headers.indexOf("code");
  const code = String(payload.code || "");
  const name = String(payload.name || "");

  for (let index = values.length - 1; index >= 1; index -= 1) {
    const row = values[index];
    const isCompetition = String(row[competitionIndex]) === String(payload.competition);
    const isParticipant = code ? String(row[codeIndex]) === code : String(row[nameIndex]) === name;

    if (isCompetition && isParticipant) {
      sheet.deleteRow(index + 1);
    }
  }

  return { educationCompetitionRosters: getEducationCompetitionRosters(spreadsheet) };
}

function getSportsCompetitionRosters(spreadsheet) {
  const rows = getOptionalRows(spreadsheet, "Sports Competition Rosters");
  return rows.reduce((groups, row) => {
    const sport = row.sport;
    const position = row.position;

    if (!sport || !position) {
      return groups;
    }

    if (!groups[sport]) {
      groups[sport] = {};
    }

    if (!groups[sport][position]) {
      groups[sport][position] = [];
    }

    groups[sport][position].push({
      name: row.name,
      code: row.code,
      majlis: row.majlis,
    });
    return groups;
  }, {});
}

function addSportsRosterParticipant(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "Sports Competition Rosters", ["sport", "position", "name", "code", "majlis"]);
  const participant = payload.participant || {};
  const rowPayload = {
    sport: payload.sport,
    position: payload.position,
    name: participant.name,
    code: participant.code,
    majlis: participant.majlis,
  };

  upsertRow(sheet, rowPayload, rowPayload.code ? ["sport", "position", "code"] : ["sport", "position", "name", "majlis"], [
    rowPayload.sport,
    rowPayload.position,
    rowPayload.name,
    rowPayload.code,
    rowPayload.majlis,
  ]);

  return { sportsCompetitionRosters: getSportsCompetitionRosters(spreadsheet) };
}

function removeSportsRosterParticipant(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "Sports Competition Rosters", ["sport", "position", "name", "code", "majlis"]);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const sportIndex = headers.indexOf("sport");
  const positionIndex = headers.indexOf("position");
  const nameIndex = headers.indexOf("name");
  const codeIndex = headers.indexOf("code");
  const code = String(payload.code || "");
  const name = String(payload.name || "");

  for (let index = values.length - 1; index >= 1; index -= 1) {
    const row = values[index];
    const isSport = String(row[sportIndex]) === String(payload.sport);
    const isPosition = String(row[positionIndex]) === String(payload.position);
    const isParticipant = code ? String(row[codeIndex]) === code : String(row[nameIndex]) === name;

    if (isSport && isPosition && isParticipant) {
      sheet.deleteRow(index + 1);
    }
  }

  return { sportsCompetitionRosters: getSportsCompetitionRosters(spreadsheet) };
}

function upsertSportsResult(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "Sports Posted Results", [
    "sport",
    "eventType",
    "position",
    "participantType",
    "participantName",
    "roster",
    "majlis",
    "scoreValue",
    "scoreUnit",
    "points",
    "postedBy",
    "postedAt",
  ]);
  upsertRow(sheet, payload, ["sport", "position"], [
    payload.sport,
    payload.eventType,
    payload.position,
    payload.participantType,
    payload.participantName,
    JSON.stringify(payload.roster || []),
    payload.majlis,
    payload.scoreValue,
    payload.scoreUnit,
    payload.points,
    payload.postedBy,
    payload.postedAt,
  ]);
  return { sportsPostedResults: rowsToObjects(sheet.getDataRange().getValues()) };
}

function ensureTab(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function upsertRow(sheet, payload, keyFields, rowValues) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const existingRowIndex = values.slice(1).findIndex((row) => {
    return keyFields.every((field) => {
      const columnIndex = headers.indexOf(field);
      return String(row[columnIndex]).toLowerCase() === String(payload[field]).toLowerCase();
    });
  });

  if (existingRowIndex >= 0) {
    sheet.getRange(existingRowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// ── AV Display admin panel: Master Members CRUD ─────────────────
function getMasterMembersForAdmin(spreadsheet) {
  const majlisIdMap = buildMajlisIdMap();
  const masterMembers = normalizeMasterMembers(rowsToObjects(spreadsheet.getSheetByName("Master Members").getDataRange().getValues()));
  const registrations = normalizeMembers(rowsToObjects(spreadsheet.getSheetByName("Members").getDataRange().getValues()));
  const attendanceRows = rowsToObjects(spreadsheet.getSheetByName("Attendance").getDataRange().getValues());
  const merged = mergeAttendance(mergeMasterAndRegistrations(masterMembers, registrations), attendanceRows);

  return merged.map((member) => ({
    memberId: String(member.code || ""),
    name: String(member.name || ""),
    majlisId: majlisIdMap[member.majlis] || "",
    majlisName: String(member.majlis || ""),
    phone: member.phone || "",
    registered: Boolean(member.registered),
    checkedIn: Boolean(member.attended),
    checkInTime: member.checkIn || "",
  }));
}

function addMasterMember(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master Members");
  const memberId = String(payload.memberId || "").trim();
  const name = String(payload.name || "").trim();

  if (!memberId || !name) {
    return { status: "error", message: "Member ID and name are required." };
  }

  upsertRow(sheet, { code: memberId }, ["code"], [memberId, name, payload.majlisName || "", payload.phone || ""]);

  return { status: "ok", message: `${name} added to the database.` };
}

function bulkAddMasterMembers(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master Members");
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  let added = 0;

  rows.forEach((row) => {
    const memberId = String(row.memberId || "").trim();
    const name = String(row.name || "").trim();

    if (!memberId || !name) {
      return;
    }

    upsertRow(sheet, { code: memberId }, ["code"], [memberId, name, row.majlisName || "", row.phone || ""]);
    added += 1;
  });

  return { status: "ok", message: `${added} member${added === 1 ? "" : "s"} imported.` };
}

// ── AV Display admin panel: content config (event info, schedule, competitions, branding) ──
function loadAvConfig(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("AV Config");

  if (!sheet) {
    return null;
  }

  const values = sheet.getDataRange().getValues();
  const row = values.find((r) => r[0] === "content");

  if (!row || !row[1]) {
    return null;
  }

  try {
    return JSON.parse(row[1]);
  } catch (error) {
    return null;
  }
}

function saveAvConfig(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTab(spreadsheet, "AV Config", ["key", "value"]);
  upsertRow(sheet, { key: "content" }, ["key"], ["content", JSON.stringify(payload || {})]);
  return { status: "ok", message: "AV display config saved." };
}
