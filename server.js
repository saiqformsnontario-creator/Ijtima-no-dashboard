const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {
  appendAnnouncement,
  appendAttendance,
  appendScheduleItem,
  deleteDocument,
  isSheetsConfigured,
  readBootstrap,
  readDocuments,
  readUsers,
  saveDocument,
} = require("./sheetsStore");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || "");

function loadEnvFile() {
  const envPath = path.join(PUBLIC_DIR, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function normalizeBasePath(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function resolveRequestPath(pathname) {
  if (!BASE_PATH) {
    return pathname;
  }

  if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) {
    return "/";
  }

  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length);
  }

  return null;
}

loadEnvFile();

function isAppsScriptConfigured() {
  return Boolean(process.env.APPS_SCRIPT_URL);
}

async function appsScriptRequest(action, payload) {
  const url = process.env.APPS_SCRIPT_URL;
  const requestUrl = action === "bootstrap" ? `${url}?action=bootstrap` : url;
  const response = await fetch(requestUrl, {
    method: action === "bootstrap" ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: action === "bootstrap" ? undefined : JSON.stringify({ action, payload }),
  });
  const data = await response.json();

  if (data.error) {
    const error = new Error(data.error);
    error.data = data;
    throw error;
  }

  if (!response.ok) {
    throw new Error(data.error || "Apps Script request failed.");
  }

  return data;
}

const majalis = [];
const users = [];
const scheduleItems = [];
const announcements = [];
const majlisRankings = [];
const competitionResults = [];
const masterMemberRecords = [];
const memberRecords = [];
const attendanceRecords = [];

const educationJudgeResults = [];
const educationCompetitionRosters = {};
const sportsCompetitionRosters = {};
const sportsPostedResults = [];

let competitionsList = [];
let competitionFinals = [];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function fallbackBootstrapPayload() {
  return {
    majalis,
    users,
    scheduleItems,
    announcements,
    majlisRankings,
    competitionResults,
    masterMemberRecords,
    registrationRecords: memberRecords,
    memberRecords,
    attendanceRecords,
    educationJudgeResults,
    educationCompetitionRosters,
    sportsCompetitionRosters,
    sportsPostedResults,
    competitionsList,
    competitionFinals,
  };
}

function normalizeAttendanceCode(code) {
  return String(code || "").trim();
}

function mergeMasterAndRegistrations(masterMembers, registrations) {
  const registrationByCode = new Map((registrations || []).map((member) => [normalizeAttendanceCode(member.code), member]));
  const merged = (masterMembers || []).map((member) => {
    const registration = registrationByCode.get(normalizeAttendanceCode(member.code));
    return {
      ...member,
      registered: Boolean(registration?.registered ?? member.registered),
      attended: Boolean(registration?.attended || member.attended),
      checkIn: registration?.checkIn || member.checkIn || "",
      source: member.source || "master",
    };
  });

  (registrations || []).forEach((registration) => {
    if (!merged.some((member) => normalizeAttendanceCode(member.code) === normalizeAttendanceCode(registration.code))) {
      merged.push({ ...registration, source: registration.source || "registration-only" });
    }
  });

  return merged;
}

function mergeAttendanceIntoMembers(members, attendance) {
  const attendanceByCode = new Map();
  const uniqueAttendance = [];

  attendance.forEach((record) => {
    const code = normalizeAttendanceCode(record.code);

    if (!code || attendanceByCode.has(code)) {
      return;
    }

    attendanceByCode.set(code, record);
    uniqueAttendance.push(record);
  });

  return {
    memberRecords: members.map((member) => {
      const attendanceRecord = attendanceByCode.get(normalizeAttendanceCode(member.code));

      if (!attendanceRecord && !member.attended) {
        return member;
      }

      return {
        ...member,
        attended: Boolean(member.attended || attendanceRecord),
        checkIn: member.checkIn || attendanceRecord?.checkIn || "",
        registered: Boolean(member.registered),
      };
    }),
    attendanceRecords: uniqueAttendance,
  };
}

let _bootstrapCache = null;
let _bootstrapCacheTime = 0;
const BOOTSTRAP_CACHE_TTL = 30000;

async function fetchFreshBootstrap() {
  const fallback = fallbackBootstrapPayload();

  if (isAppsScriptConfigured()) {
    const data = await appsScriptRequest("bootstrap");
    const mergedMembers = mergeMasterAndRegistrations(
      data.masterMemberRecords || data.memberRecords || fallback.masterMemberRecords || fallback.memberRecords,
      data.registrationRecords || data.memberRecords || fallback.registrationRecords || fallback.memberRecords
    );
    const mergedAttendance = mergeAttendanceIntoMembers(
      mergedMembers,
      data.attendanceRecords || fallback.attendanceRecords
    );
    return {
      ...fallback,
      ...data,
      ...mergedAttendance,
      educationCompetitionRosters: data.educationCompetitionRosters || educationCompetitionRosters,
      sportsCompetitionRosters: data.sportsCompetitionRosters || sportsCompetitionRosters,
    };
  }

  const data = await readBootstrap(fallback);
  const mergedMembers = mergeMasterAndRegistrations(
    data.masterMemberRecords || fallback.masterMemberRecords || fallback.memberRecords,
    data.registrationRecords || data.memberRecords || fallback.registrationRecords || fallback.memberRecords
  );
  return {
    ...data,
    masterMemberRecords: data.masterMemberRecords || fallback.masterMemberRecords || fallback.memberRecords,
    ...mergeAttendanceIntoMembers(mergedMembers, data.attendanceRecords || fallback.attendanceRecords),
  };
}

async function bootstrapPayload() {
  const now = Date.now();
  if (_bootstrapCache && (now - _bootstrapCacheTime) < BOOTSTRAP_CACHE_TTL) {
    return _bootstrapCache;
  }
  const result = await fetchFreshBootstrap();
  _bootstrapCache = result;
  _bootstrapCacheTime = Date.now();
  return result;
}

function invalidateBootstrapCache() {
  _bootstrapCache = null;
  _bootstrapCacheTime = 0;
}

// Warm the cache on startup and refresh every 30 seconds in the background
fetchFreshBootstrap().then((result) => {
  _bootstrapCache = result;
  _bootstrapCacheTime = Date.now();
}).catch(() => {});
setInterval(() => {
  fetchFreshBootstrap().then((result) => {
    _bootstrapCache = result;
    _bootstrapCacheTime = Date.now();
  }).catch(() => {});
}, BOOTSTRAP_CACHE_TTL);

function normalizeManualMember(body) {
  const suppliedCode = normalizeAttendanceCode(body.code);
  return {
    code: suppliedCode || `WALK-${Date.now().toString(36)}`,
    name: String(body.name || "").trim(),
    majlis: String(body.majlis || "").trim(),
    phone: String(body.phone || "").trim(),
    registered: false,
    attended: false,
    checkIn: "",
    source: suppliedCode ? "manual" : "walk-in",
  };
}

function getCurrentCheckInTime() {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const datePart = `${months[now.getMonth()]} ${now.getDate()}`;
  const timePart = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

function getRowId(item, index) {
  return String(item._rowNumber || item.id || index);
}

function updateByRowId(items, rowId, patch) {
  const index = items.findIndex((item, itemIndex) => getRowId(item, itemIndex) === String(rowId));

  if (index >= 0) {
    items[index] = { ...items[index], ...patch };
  }

  return items;
}

function deleteByRowId(items, rowId) {
  const index = items.findIndex((item, itemIndex) => getRowId(item, itemIndex) === String(rowId));

  if (index >= 0) {
    items.splice(index, 1);
  }

  return items;
}

function normalizeUserPayload(payload, existingUser = {}) {
  return {
    username: String(payload.username || existingUser.username || "").trim().toLowerCase(),
    password: String(payload.password || existingUser.password || ""),
    name: String(payload.name || existingUser.name || "").trim(),
    role: String(payload.role || existingUser.role || "zaim"),
    majlis: String(payload.majlis || ""),
    access: String(payload.access || existingUser.access || "").trim(),
  };
}

async function handleApi(request, response, url) {
  const requestPath = resolveRequestPath(url.pathname);

  if (requestPath === null) {
    return false;
  }

  if (request.method === "GET" && requestPath === "/api/bootstrap") {
    sendJson(response, 200, await bootstrapPayload());
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/login") {
    const body = await readJson(request);
    const availableUsers = isAppsScriptConfigured() ? (await bootstrapPayload()).users || users : await readUsers(users);
    const user = availableUsers.find(
      (candidate) =>
        candidate.username === String(body.username || "").trim().toLowerCase() && candidate.password === body.password
    );

    if (!user) {
      sendError(response, 401, "Invalid username or password.");
      return true;
    }

    sendJson(response, 200, { user: publicUser(user) });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/attendance/check-in") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("attendanceCheckIn", body);
      sendJson(response, 200, data);
      return true;
    }

    const activeData = await bootstrapPayload();
    const activeMembers = activeData.memberRecords;
    const activeAttendance = activeData.attendanceRecords;
    let member = activeMembers.find((record) => normalizeAttendanceCode(record.code) === normalizeAttendanceCode(body.code));

    if (!member) {
      member = normalizeManualMember(body.member || body);

      if (!member.name || !member.majlis) {
        sendError(response, 404, "Member was not found. Enter name and majlis to add a manual walk-in.");
        return true;
      }

      activeMembers.push(member);
    }

    if (member.attended || activeAttendance.some((record) => normalizeAttendanceCode(record.code) === normalizeAttendanceCode(member.code))) {
      sendJson(response, 409, { error: `${member.name} is already checked in.`, member, attendanceRecords });
      return true;
    }

    const checkIn = getCurrentCheckInTime();
    member.attended = true;
    member.checkIn = checkIn;

    const attendanceRecord = {
      code: member.code,
      name: member.name,
      majlis: member.majlis,
      checkIn,
      checkedInBy: body.checkedInBy || "Attendance Team",
      registered: Boolean(member.registered),
      source: member.source || (member.registered ? "registered" : "unregistered"),
    };
    activeAttendance.unshift(attendanceRecord);

    if (!isSheetsConfigured()) {
      const fallbackMember = memberRecords.find((record) => normalizeAttendanceCode(record.code) === normalizeAttendanceCode(member.code));
      if (fallbackMember) {
        fallbackMember.attended = true;
        fallbackMember.checkIn = checkIn;
      } else {
        memberRecords.push(member);
      }
      attendanceRecords.unshift(attendanceRecord);
    }

    await appendAttendance(attendanceRecord);

    sendJson(response, 200, {
      memberRecords: activeMembers,
      attendanceRecords: activeAttendance,
      message: `${member.name} checked in successfully.`,
    });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/attendance/mark-absent") {
    const body = await readJson(request);
    const absentCodes = new Set((body.codes || []).map(normalizeAttendanceCode).filter(Boolean));

    if (!absentCodes.size) {
      sendError(response, 400, "No members were selected.");
      return true;
    }

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("attendanceMarkAbsent", { codes: [...absentCodes] });
      sendJson(response, 200, data);
      return true;
    }

    const activeData = await bootstrapPayload();
    const activeMembers = activeData.memberRecords.map((member) =>
      absentCodes.has(normalizeAttendanceCode(member.code)) ? { ...member, attended: false, checkIn: "" } : member
    );
    const activeAttendance = activeData.attendanceRecords.filter((record) => !absentCodes.has(normalizeAttendanceCode(record.code)));

    if (!isSheetsConfigured()) {
      memberRecords = memberRecords.map((member) =>
        absentCodes.has(normalizeAttendanceCode(member.code)) ? { ...member, attended: false, checkIn: "" } : member
      );
      attendanceRecords = attendanceRecords.filter((record) => !absentCodes.has(normalizeAttendanceCode(record.code)));
    }

    sendJson(response, 200, {
      memberRecords: activeMembers,
      attendanceRecords: activeAttendance,
      message: `${absentCodes.size} member${absentCodes.size === 1 ? "" : "s"} marked absent.`,
    });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/schedule") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("addSchedule", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    const scheduleItem = {
      date: body.date,
      start: body.start,
      end: body.end,
      title: body.title,
      location: body.location,
      lead: body.lead,
      status: body.status || "Upcoming",
    };
    scheduleItems.push(scheduleItem);
    await appendScheduleItem(scheduleItem);
    sendJson(response, 200, { scheduleItems: isSheetsConfigured() ? (await bootstrapPayload()).scheduleItems : scheduleItems });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/schedule/update") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("updateSchedule", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    updateByRowId(scheduleItems, body.rowId, body);
    sendJson(response, 200, { scheduleItems });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/schedule/delete") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("deleteSchedule", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    deleteByRowId(scheduleItems, body.rowId);
    sendJson(response, 200, { scheduleItems });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/announcements") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("addAnnouncement", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    const announcement = {
      title: body.title,
      message: body.message,
      time: body.time,
      priority: body.priority || "Info",
    };
    announcements.unshift(announcement);
    await appendAnnouncement(announcement);
    sendJson(response, 200, {
      announcements: isSheetsConfigured() ? (await bootstrapPayload()).announcements : announcements,
    });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/announcements/update") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("updateAnnouncement", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    updateByRowId(announcements, body.rowId, body);
    sendJson(response, 200, { announcements });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/announcements/delete") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("deleteAnnouncement", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    deleteByRowId(announcements, body.rowId);
    sendJson(response, 200, { announcements });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/users") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("addUser", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    users.push(normalizeUserPayload(body));
    sendJson(response, 200, { users });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/users/update") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("updateUser", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    const existingIndex = users.findIndex((user, index) => getRowId(user, index) === String(body.rowId));
    if (existingIndex >= 0) {
      users[existingIndex] = normalizeUserPayload(body, users[existingIndex]);
    }
    sendJson(response, 200, { users });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/admin/users/delete") {
    const body = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("deleteUser", body);
      invalidateBootstrapCache();
      sendJson(response, 200, data);
      return true;
    }

    deleteByRowId(users, body.rowId);
    sendJson(response, 200, { users });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/education/results") {
    const result = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("educationResult", result);
      sendJson(response, 200, data);
      return true;
    }

    const existingIndex = educationJudgeResults.findIndex((existing) => {
      return (
        existing.judge === result.judge &&
        existing.competition === result.competition &&
        String(existing.participantName || "").toLowerCase() === String(result.participantName || "").toLowerCase() &&
        existing.majlis === result.majlis
      );
    });

    if (existingIndex >= 0) {
      educationJudgeResults[existingIndex] = result;
    } else {
      educationJudgeResults.push(result);
    }

    sendJson(response, 200, { educationJudgeResults });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/education/rosters/add") {
    const body = await readJson(request);
    const competition = String(body.competition || "").trim();
    const participant = {
      name: String(body.participant?.name || "").trim(),
      code: String(body.participant?.code || "").trim(),
      majlis: String(body.participant?.majlis || "").trim(),
    };

    if (!competition || !participant.name) {
      sendError(response, 400, "Competition and participant name are required.");
      return true;
    }

    const roster = educationCompetitionRosters[competition] || [];
    const exists = roster.some((item) => {
      const codeMatches = participant.code && item.code && String(item.code).toLowerCase() === participant.code.toLowerCase();
      const nameMatches = String(item.name || "").toLowerCase() === participant.name.toLowerCase() && item.majlis === participant.majlis;
      return codeMatches || nameMatches;
    });

    if (!exists) {
      educationCompetitionRosters[competition] = [...roster, participant];
    }

    if (isAppsScriptConfigured()) {
      try {
        const data = await appsScriptRequest("educationRosterAdd", { competition, participant });
        sendJson(response, 200, {
          ...data,
          educationCompetitionRosters: data.educationCompetitionRosters || educationCompetitionRosters,
        });
        return true;
      } catch (error) {
        // Use local in-memory roster until the deployed Apps Script includes roster actions.
      }
    }

    sendJson(response, 200, { educationCompetitionRosters });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/education/rosters/remove") {
    const body = await readJson(request);
    const competition = String(body.competition || "").trim();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();

    if (!competition) {
      sendError(response, 400, "Competition is required.");
      return true;
    }

    educationCompetitionRosters[competition] = (educationCompetitionRosters[competition] || []).filter((participant) => {
      if (code) {
        return participant.code !== code;
      }

      return participant.name !== name;
    });

    if (isAppsScriptConfigured()) {
      try {
        const data = await appsScriptRequest("educationRosterRemove", { competition, code, name });
        sendJson(response, 200, {
          ...data,
          educationCompetitionRosters: data.educationCompetitionRosters || educationCompetitionRosters,
        });
        return true;
      } catch (error) {
        // Use local in-memory roster until the deployed Apps Script includes roster actions.
      }
    }

    sendJson(response, 200, { educationCompetitionRosters });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/sports/rosters/add") {
    const body = await readJson(request);
    const sport = String(body.sport || "").trim();
    const position = String(body.position || "").trim();
    const participant = {
      name: String(body.participant?.name || "").trim(),
      code: String(body.participant?.code || "").trim(),
      majlis: String(body.participant?.majlis || "").trim(),
    };

    if (!sport || !position || !participant.name) {
      sendError(response, 400, "Sport, position, and participant name are required.");
      return true;
    }

    const roster = sportsCompetitionRosters[sport]?.[position] || [];
    const exists = roster.some((item) => {
      const codeMatches = participant.code && item.code && String(item.code).toLowerCase() === participant.code.toLowerCase();
      const nameMatches = String(item.name || "").toLowerCase() === participant.name.toLowerCase() && item.majlis === participant.majlis;
      return codeMatches || nameMatches;
    });

    if (!exists) {
      sportsCompetitionRosters[sport] = {
        ...(sportsCompetitionRosters[sport] || {}),
        [position]: [...roster, participant],
      };
    }

    if (isAppsScriptConfigured()) {
      try {
        const data = await appsScriptRequest("sportsRosterAdd", { sport, position, participant });
        sendJson(response, 200, {
          ...data,
          sportsCompetitionRosters: data.sportsCompetitionRosters || sportsCompetitionRosters,
        });
        return true;
      } catch (error) {
        // Use local in-memory roster until the deployed Apps Script includes roster actions.
      }
    }

    sendJson(response, 200, { sportsCompetitionRosters });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/sports/rosters/remove") {
    const body = await readJson(request);
    const sport = String(body.sport || "").trim();
    const position = String(body.position || "").trim();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();

    if (!sport || !position) {
      sendError(response, 400, "Sport and position are required.");
      return true;
    }

    sportsCompetitionRosters[sport] = {
      ...(sportsCompetitionRosters[sport] || {}),
      [position]: (sportsCompetitionRosters[sport]?.[position] || []).filter((participant) => {
        if (code) {
          return participant.code !== code;
        }

        return participant.name !== name;
      }),
    };

    if (isAppsScriptConfigured()) {
      try {
        const data = await appsScriptRequest("sportsRosterRemove", { sport, position, code, name });
        sendJson(response, 200, {
          ...data,
          sportsCompetitionRosters: data.sportsCompetitionRosters || sportsCompetitionRosters,
        });
        return true;
      } catch (error) {
        // Use local in-memory roster until the deployed Apps Script includes roster actions.
      }
    }

    sendJson(response, 200, { sportsCompetitionRosters });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/sports/results") {
    const result = await readJson(request);

    if (isAppsScriptConfigured()) {
      const data = await appsScriptRequest("sportsResult", result);
      sendJson(response, 200, data);
      return true;
    }

    const existingIndex = sportsPostedResults.findIndex((existing) => {
      return existing.sport === result.sport && existing.position === result.position;
    });

    if (existingIndex >= 0) {
      sportsPostedResults[existingIndex] = result;
    } else {
      sportsPostedResults.push(result);
    }

    sendJson(response, 200, { sportsPostedResults });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/competitions/add") {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    if (!name) {
      sendError(response, 400, "Competition name is required.");
      return true;
    }
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const competition = {
      id,
      name,
      category: String(body.category || "Education").trim(),
      type: String(body.type || "Individual").trim(),
    };
    competitionsList.push(competition);
    sendJson(response, 200, { competitionsList, addedId: id });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/competitions/delete") {
    const body = await readJson(request);
    const id = String(body.id || "").trim();
    const idx = competitionsList.findIndex((c) => c.id === id);
    if (idx >= 0) competitionsList.splice(idx, 1);
    const kept = competitionFinals.filter((f) => f.competitionId !== id);
    competitionFinals.length = 0;
    kept.forEach((f) => competitionFinals.push(f));
    sendJson(response, 200, { competitionsList, competitionFinals });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/competition/finals/save") {
    const body = await readJson(request);
    const competitionId = String(body.competitionId || "").trim();
    if (!competitionId) {
      sendError(response, 400, "Competition ID is required.");
      return true;
    }
    const comp = competitionsList.find((c) => c.id === competitionId);
    const slots = Array.isArray(body.slots) ? body.slots : [];
    const kept = competitionFinals.filter((f) => f.competitionId !== competitionId);
    slots.forEach((slot, slotIdx) => {
      const members = (Array.isArray(slot.members) ? slot.members : [])
        .filter((m) => String(m.name || "").trim() || String(m.code || "").trim())
        .map((m) => ({
          code: String(m.code || "").trim(),
          name: String(m.name || "").trim(),
          majlis: String(m.majlis || "").trim(),
        }));
      if (members.length) {
        kept.push({
          id: `f${competitionId}-${slotIdx}-${Date.now().toString(36)}`,
          competitionId,
          competition: comp ? comp.name : competitionId,
          category: comp ? comp.category : "Education",
          rank: String(slot.rank || "1st").trim(),
          members,
        });
      }
    });
    competitionFinals.length = 0;
    kept.forEach((f) => competitionFinals.push(f));
    sendJson(response, 200, { competitionFinals });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/competition/final/save") {
    const body = await readJson(request);
    const competition = String(body.competition || "").trim();
    const category = String(body.category || "").trim();
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (!competition) {
      sendError(response, 400, "Competition name is required.");
      return true;
    }

    const kept = competitionResults.filter((r) => r.competition !== competition);
    entries.forEach((entry) => {
      if (String(entry.name || "").trim()) {
        kept.push({
          category,
          competition,
          position: String(entry.position || "").trim(),
          name: String(entry.name || "").trim(),
          majlis: String(entry.majlis || "").trim(),
          points: "",
        });
      }
    });
    competitionResults.length = 0;
    kept.forEach((r) => competitionResults.push(r));
    sendJson(response, 200, { competitionResults });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/competition/final/delete") {
    const body = await readJson(request);
    const competition = String(body.competition || "").trim();
    const kept = competitionResults.filter((r) => r.competition !== competition);
    competitionResults.length = 0;
    kept.forEach((r) => competitionResults.push(r));
    sendJson(response, 200, { competitionResults });
    return true;
  }

  const DOCUMENTS_FILE = path.join(PUBLIC_DIR, "documents.json");
  const ALLOWED_DOCUMENT_KEYS = ["syllabus", "sports-package"];

  const DEFAULT_DOCUMENTS = {
    syllabus: {
      url: "https://drive.google.com/file/d/1m-pGHin05ScQ32-cJ-WWmtDvsbs_dWbM/view",
      label: "",
      updatedAt: 1781548185624,
    },
    "sports-package": {
      url: "https://drive.google.com/file/d/1XGE3cQ4etF7KqvGbaMfZE7bbo7zKji7R/view?usp=sharing",
      label: "",
      updatedAt: 1781731200000,
    },
  };

  function readDocumentsFile() {
    let stored = {};
    try {
      stored = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, "utf8"));
    } catch {
      stored = {};
    }
    return { ...DEFAULT_DOCUMENTS, ...stored };
  }

  function writeDocumentsFile(data) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(data, null, 2), "utf8");
  }

  if (request.method === "GET" && requestPath === "/api/documents") {
    const stored = { ...readDocumentsFile(), ...((await readDocuments()) || {}) };
    const docs = ALLOWED_DOCUMENT_KEYS.map((key) => {
      const entry = stored[key];
      return entry ? { key, uploaded: true, url: entry.url, label: entry.label, updatedAt: entry.updatedAt } : { key, uploaded: false };
    });
    sendJson(response, 200, { documents: docs });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/documents/save") {
    const body = await readJson(request);
    const key = String(body.key || "").trim();
    const url = String(body.url || "").trim();
    const label = String(body.label || "").trim();
    if (!ALLOWED_DOCUMENT_KEYS.includes(key)) {
      sendError(response, 400, "Unknown document key.");
      return true;
    }
    if (!url) {
      sendError(response, 400, "URL is required.");
      return true;
    }
    if (isSheetsConfigured()) {
      const saved = await saveDocument(key, url, label);
      sendJson(response, 200, { key, uploaded: true, url: saved.url, label: saved.label, updatedAt: saved.updatedAt });
      return true;
    }
    const stored = readDocumentsFile();
    stored[key] = { url, label, updatedAt: Date.now() };
    writeDocumentsFile(stored);
    sendJson(response, 200, { key, uploaded: true, url, label, updatedAt: stored[key].updatedAt });
    return true;
  }

  if (request.method === "POST" && requestPath === "/api/documents/delete") {
    const body = await readJson(request);
    const key = String(body.key || "").trim();
    if (!ALLOWED_DOCUMENT_KEYS.includes(key)) {
      sendError(response, 400, "Unknown document key.");
      return true;
    }
    if (isSheetsConfigured()) {
      await deleteDocument(key);
      sendJson(response, 200, { key, uploaded: false });
      return true;
    }
    const stored = readDocumentsFile();
    delete stored[key];
    writeDocumentsFile(stored);
    sendJson(response, 200, { key, uploaded: false });
    return true;
  }

  return false;
}

const staticCache = new Map();

function serveStatic(request, response, url) {
  const requestPath = resolveRequestPath(url.pathname);

  if (requestPath === null) {
    sendError(response, 404, "Not found.");
    return;
  }

  const requestedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(response, 403, "Forbidden.");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const contentType = contentTypes[extension] || "application/octet-stream";
  const isCompressible = [".html", ".css", ".js", ".json"].includes(extension);
  const acceptsGzip = (request.headers["accept-encoding"] || "").includes("gzip");
  const useGzip = isCompressible && acceptsGzip;
  const cacheKey = filePath + (useGzip ? ":gz" : "");

  if (staticCache.has(cacheKey)) {
    const { content, etag } = staticCache.get(cacheKey);
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304);
      response.end();
      return;
    }
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
      "ETag": etag,
    };
    if (useGzip) headers["Content-Encoding"] = "gzip";
    response.writeHead(200, headers);
    response.end(content);
    return;
  }

  fs.readFile(filePath, (error, raw) => {
    if (error) {
      sendError(response, 404, "Not found.");
      return;
    }

    const etag = `"${raw.length}-${fs.statSync(filePath).mtimeMs}"`;

    const serve = (content) => {
      staticCache.set(cacheKey, { content, etag });
      if (request.headers["if-none-match"] === etag) {
        response.writeHead(304);
        response.end();
        return;
      }
      const headers = {
        "Content-Type": contentType,
        "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
        "ETag": etag,
      };
      if (useGzip) headers["Content-Encoding"] = "gzip";
      response.writeHead(200, headers);
      response.end(content);
    };

    if (useGzip) {
      zlib.gzip(raw, { level: 6 }, (err, compressed) => {
        serve(err ? raw : compressed);
      });
    } else {
      serve(raw);
    }
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(request, response, url);
      if (!handled) {
        sendError(response, 404, "API route not found.");
      }
      return;
    }

    serveStatic(request, response, url);
  } catch (error) {
    sendError(response, 500, error.message || "Server error.");
  }
});

server.listen(PORT, () => {
  console.log(`Ijtima Dashboard backend running at http://localhost:${PORT}`);
  console.log(`Base path: ${BASE_PATH || "/"}`);
  console.log(`Apps Script bridge: ${isAppsScriptConfigured() ? "enabled" : "not configured"}`);
  console.log(`Google Sheets integration: ${isSheetsConfigured() ? "enabled" : "not configured, using sample data"}`);
});
