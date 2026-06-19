const crypto = require("crypto");

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

let cachedToken = null;

function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getPrivateKey() {
  return process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer
    .sign(getPrivateKey(), "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to authenticate with Google.");
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };

  return cachedToken.token;
}

async function sheetsRequest(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${SHEETS_API_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Google Sheets request failed.");
  }

  return data;
}

function range(tabName, cellRange) {
  return `/${encodeURIComponent(`'${tabName}'!${cellRange}`)}`;
}

async function getValues(tabName, cellRange) {
  const data = await sheetsRequest(`/values${range(tabName, cellRange)}`);
  return data.values || [];
}

async function appendValues(tabName, cellRange, values) {
  return sheetsRequest(`/values${range(tabName, cellRange)}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

async function updateValues(tabName, cellRange, values) {
  return sheetsRequest(`/values${range(tabName, cellRange)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

async function clearValues(tabName, cellRange) {
  return sheetsRequest(`/values${range(tabName, cellRange)}:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

module.exports = {
  appendValues,
  updateValues,
  clearValues,
  getValues,
  isSheetsConfigured,
};
