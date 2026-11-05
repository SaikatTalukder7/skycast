const toRad = (d) => (d * Math.PI) / 180;
function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim();
  if (q.length < 2 || q.length > 100) return res.status(200).json([]);

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({ name: q, count: "20", language: "en", format: "json" });

    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(502).json([]);
    const data = await upstream.json();

    let list = data.results || [];

    // Prefer names that start with what was typed
    const starts = list.filter((c) => c.name.toLowerCase().startsWith(q.toLowerCase()));
    if (starts.length) list = starts;

    // Nearest first
    list = list.map((c) => ({
      ...c,
      dist: hasPos ? distanceKm(lat, lon, c.latitude, c.longitude) : null,
    }));
    if (hasPos) list.sort((a, b) => a.dist - b.dist);

    res.setHeader("Cache-Control", "s-maxage=3600");
    return res.status(200).json(
      list.slice(0, 6).map((c) => ({
        name: c.name,
        state: c.admin1 || "",
        country: c.country_code || "",
        lat: c.latitude,
        lon: c.longitude,
        km: c.dist == null ? null : Math.round(c.dist),
      }))
    );
  } catch {
    return res.status(502).json([]);
  }
}