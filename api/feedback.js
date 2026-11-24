const { verifySession } = require("./auth");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://buourcdbrjafedkhnxon.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_ZqEf-kLzJO5Znh7AWOibyw_nzIW1N0E";

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

module.exports = async function handler(req, res) {
  if (!verifySession(req)) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/trip_feedback?id=eq.main&select=votes,comments,custom_schedule,custom_places`;

  if (req.method === "GET") {
    try {
      const r = await fetch(endpoint, { headers: supabaseHeaders() });
      if (!r.ok) {
        return res.status(r.status).json({ error: "Supabase fetch failed" });
      }
      const rows = await r.json();
      const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
      return res.status(200).json(row);
    } catch (err) {
      return res.status(502).json({ error: "Upstream connection failed" });
    }
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const payload = {
      votes: body.votes,
      comments: body.comments,
      custom_schedule: body.custom_schedule,
      custom_places: body.custom_places,
      updated_at: new Date().toISOString()
    };
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/trip_feedback?id=eq.main`, {
        method: "PATCH",
        headers: supabaseHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        return res.status(r.status).json({ ok: false, error: "Supabase update failed" });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(502).json({ ok: false, error: "Upstream connection failed" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
};
