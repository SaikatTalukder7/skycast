// Serverless proxy: keeps the OpenWeather API key on the server.
export default async function handler(req, res) {
  const city = String(req.query.city || "").trim();
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const byCoords = Number.isFinite(lat) && Number.isFinite(lon);

  if (!byCoords && (!city || city.length > 100)) {
    return res.status(400).json({ error: "Please provide a valid city name." });
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is not configured." });

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    const params = byCoords ? { lat: String(lat), lon: String(lon) } : { q: city };
    url.search = new URLSearchParams({ ...params, units: "metric", appid: key });

    const upstream = await fetch(url);
    const data = await upstream.json();

    if (!upstream.ok) {
      console.error(`OpenWeather error ${upstream.status}: ${data.message}`);
      if (upstream.status === 404) return res.status(404).json({ error: "City not found." });
      if (upstream.status === 401)
        return res.status(502).json({ error: "API key invalid or not activated yet. New keys can take up to a few hours." });
      if (upstream.status === 429)
        return res.status(502).json({ error: "Too many requests. Please wait a minute." });
      return res.status(502).json({ error: `Weather service error (${upstream.status}).` });
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
    return res.status(200).json({
      name: data.name,
      country: data.sys?.country ?? "",
      temp: data.main.temp,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed, // m/s
      condition: data.weather[0].main,
    });
  } catch {
    return res.status(502).json({ error: "Weather service unreachable." });
  }
}