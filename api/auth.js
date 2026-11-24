const crypto = require("crypto");

const COOKIE_NAME = "trip_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function getPasscode() {
  return process.env.TRIP_PASSCODE || "8931";
}

function getSecret() {
  return process.env.AUTH_SECRET || "europe-trip-2027-alumni-hmac-secret";
}

function signToken(payload) {
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function verifySession(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies[COOKIE_NAME]);
}

function buildCookieHeader(req, value, maxAge) {
  const isHttps = req.headers["x-forwarded-proto"] === "https" || process.env.VERCEL === "1";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ authenticated: verifySession(req) });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const passcode = (body && body.passcode ? String(body.passcode) : "").trim();
    if (!safeEqual(passcode, getPasscode())) {
      return res.status(401).json({ authenticated: false, error: "비밀번호가 올바르지 않습니다." });
    }
    const token = signToken(`alumni_${Date.now()}`);
    res.setHeader("Set-Cookie", buildCookieHeader(req, token, MAX_AGE_SEC));
    return res.status(200).json({ authenticated: true });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", buildCookieHeader(req, "", 0));
    return res.status(200).json({ authenticated: false });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method Not Allowed" });
}

module.exports = handler;
module.exports.verifySession = verifySession;
