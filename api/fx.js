module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=EUR&to=KRW", {
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    const data = await response.json();
    const rawRate = data && data.rates && Number(data.rates.KRW);
    if (!rawRate || Number.isNaN(rawRate)) throw new Error("Invalid KRW rate");

    const rounded = Math.round(rawRate / 10) * 10;
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      rate: rounded,
      rawRate: Math.round(rawRate * 100) / 100,
      date: data.date || null,
      source: "frankfurter"
    });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      rate: 1550,
      rawRate: 1550,
      date: null,
      source: "fallback"
    });
  }
};
