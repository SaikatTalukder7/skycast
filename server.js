// Tiny local dev server – no dependencies. Run: npm run dev  ->  http://localhost:5173
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import weather from "./api/weather.js";
import cities from "./api/cities.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const PORT = process.env.PORT || 5173;

// Load .env (simple KEY=value lines)
try {
  const text = fs.readFileSync(path.join(root, ".env"), "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json",
};

const routes = { "/api/weather": weather, "/api/cities": cities };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API routes: same handlers that Vercel runs in production
  const route = routes[url.pathname];
  if (route) {
    req.query = Object.fromEntries(url.searchParams);
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    try { return await route(req, res); }
    catch (e) { console.error(e); res.statusCode = 500; return res.end("Server error"); }
  }

  // Static files from /public
  let file = path.normalize(path.join(publicDir, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
  if (!file.startsWith(publicDir)) { res.statusCode = 403; return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`SkyCast running at http://localhost:${PORT}`);
  if (!process.env.OPENWEATHER_API_KEY) console.log("Warning: OPENWEATHER_API_KEY not found in .env");
});