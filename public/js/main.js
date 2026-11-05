const DEFAULT_CITY = "Dhaka";
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const el = {
  form: $("searchForm"), input: $("searchInput"), card: $("card"),
  icon: $("weatherIcon"), temp: $("temperature"), city: $("cityName"),
  humidity: $("humidity"), wind: $("windSpeed"),
  weather: $("weather"), error: $("error"), errorText: $("errorText"),
  alert: $("healthAlert"), alertContent: $("alertContent"), theme: $("themeToggle"),
  box: $("suggestions"), fx: $("fx"),
};

const ICONS = {
  Clouds: "clouds", Clear: "clear", Rain: "rain", Thunderstorm: "rain",
  Drizzle: "drizzle", Snow: "snow",
  Mist: "mist", Fog: "mist", Haze: "mist", Smoke: "mist",
};

// ---- Theme ----
function applyTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
}
try { applyTheme(localStorage.getItem("theme") === "dark"); } catch { }
el.theme.addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark-mode");
  applyTheme(dark);
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { }
});

// ---- Animations ----
function restart(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth; // force reflow so the animation plays again
  node.classList.add(cls);
}

let tempRaf;
function animateTemp(to) {
  cancelAnimationFrame(tempRaf);
  if (REDUCED) { el.temp.textContent = `${to}°C`; return; }
  const start = performance.now(), dur = 800;
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.temp.textContent = `${Math.round(to * eased)}°C`;
    if (p < 1) tempRaf = requestAnimationFrame(step);
  };
  tempRaf = requestAnimationFrame(step);
}

const FX_TYPES = {
  Rain: "rain", Thunderstorm: "rain", Drizzle: "rain", Snow: "snow",
  Clouds: "clouds", Clear: "clear",
  Mist: "mist", Fog: "mist", Haze: "mist", Smoke: "mist",
};
const FX_COUNT = { rain: 34, snow: 28, clouds: 4, mist: 4, clear: 0 };
const FX_DURATION = { rain: [0.6, 1.1], snow: [4, 8], clouds: [14, 26], mist: [6, 10] };
const rand = (a, b) => a + Math.random() * (b - a);

// Builds the animated weather scene inside the hero card
function setFx(condition) {
  const type = FX_TYPES[condition] || "none";
  el.fx.dataset.type = type;
  el.fx.classList.toggle("storm", condition === "Thunderstorm");
  el.fx.replaceChildren();

  const n = condition === "Drizzle" ? 16 : (FX_COUNT[type] || 0);
  const [dMin, dMax] = FX_DURATION[type] || [1, 2];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    const d = rand(dMin, dMax);
    p.style.setProperty("--x", `${rand(0, 100)}%`);
    p.style.setProperty("--y", `${rand(4, 78)}%`);
    p.style.setProperty("--s", rand(0.7, 1.4).toFixed(2));
    p.style.setProperty("--d", `${d.toFixed(2)}s`);
    p.style.setProperty("--delay", `${(-rand(0, d)).toFixed(2)}s`); // negative: start mid-animation
    el.fx.append(p);
  }
}

// ---- UI helpers ----
function showError(message) {
  el.errorText.textContent = message;
  el.error.style.display = "block";
  el.weather.style.display = "none";
  restart(el.error, "shake");
}

function healthAlerts({ temp, humidity, windKmh, condition }) {
  const a = [];
  if (temp > 30) a.push("High temperature: stay hydrated and avoid prolonged sun exposure.");
  else if (temp < 5) a.push("Low temperature: dress in layers to stay warm.");
  if (condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm")
    a.push("Wet conditions: carry an umbrella and watch for slippery surfaces.");
  if (condition === "Thunderstorm") a.push("Thunderstorm: stay indoors and away from open areas.");
  if (condition === "Snow") a.push("Snowfall: drive carefully and dress warmly.");
  if (humidity > 80) a.push("High humidity: it may feel warmer than it is. Stay hydrated.");
  else if (humidity < 30) a.push("Low humidity: dry skin and throat are likely. Drink water.");
  if (windKmh > 40) a.push("Strong winds: secure loose objects and be careful outdoors.");
  return a;
}

function render(d, title) {
  el.city.textContent = title || (d.country ? `${d.name}, ${d.country}` : d.name);
  el.humidity.textContent = `${d.humidity}%`;
  const windKmh = Math.round(d.windSpeed * 3.6 * 10) / 10; // API gives m/s
  el.wind.textContent = `${windKmh} km/h`;
  el.icon.src = `images/${ICONS[d.condition] || "unknown"}.png`;
  el.icon.alt = d.condition;

  const alerts = healthAlerts({ ...d, windKmh });
  el.alertContent.replaceChildren();
  if (alerts.length) {
    const ul = document.createElement("ul");
    alerts.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.append(li); });
    el.alertContent.append(ul);
  }
  el.alert.style.display = alerts.length ? "block" : "none";

  el.error.style.display = "none";
  el.weather.style.display = "block";

  setFx(d.condition);
  animateTemp(Math.round(d.temp));
  restart(el.weather, "enter");
}

// ---- Data ----
// params is either { city } or { lat, lon }; title overrides the shown place name
async function checkWeather(params, title) {
  el.card.classList.add("loading");
  try {
    const res = await fetch(`/api/weather?${new URLSearchParams(params)}`);
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) return showError("City not found. Please try again.");
    if (!res.ok) return showError(data.error || "Something went wrong. Please try again.");
    render(data, title);
    try { localStorage.setItem("lastSearch", JSON.stringify({ params, title })); } catch { }
  } catch {
    showError("Network error. Check your connection and try again.");
  } finally {
    el.card.classList.remove("loading");
  }
}

// ---- User location (asked once, when the search box is first focused) ----
let userPos = null;
el.input.addEventListener("focus", () => {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      // rounded to ~1 km for privacy
      userPos = { lat: p.coords.latitude.toFixed(2), lon: p.coords.longitude.toFixed(2) };
    },
    () => { } // denied or unavailable: suggestions just use the normal order
  );
}, { once: true });

// ---- City suggestions ----
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';

let items = [], active = -1, timer, reqId = 0;

function hideSuggestions() {
  el.box.hidden = true;
  el.box.replaceChildren();
  items = [];
  active = -1;
}

function pick(item) {
  el.input.value = item.label;
  hideSuggestions();
  checkWeather({ lat: item.lat, lon: item.lon }, `${item.name}, ${item.country}`);
}

function showSuggestions(list) {
  const q = el.input.value.trim().toLowerCase();
  el.box.replaceChildren();
  items = list.map((c) => ({
    ...c,
    label: [c.name, c.state, c.country].filter(Boolean).join(", "),
  }));

  items.forEach((item) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");

    const icon = document.createElement("span");
    icon.className = "s-icon";
    icon.innerHTML = PIN; // static markup, no user data

    const text = document.createElement("span");
    text.className = "s-text";

    const name = document.createElement("span");
    name.className = "s-name";
    if (item.name.toLowerCase().startsWith(q)) {
      const b = document.createElement("strong");
      b.textContent = item.name.slice(0, q.length);
      name.append(b, item.name.slice(q.length));
    } else {
      name.textContent = item.name;
    }

    const sub = document.createElement("span");
    sub.className = "s-sub";
    sub.textContent = [item.state, item.country].filter(Boolean).join(", ");

    text.append(name, sub);
    li.append(icon, text);

    if (item.km != null) {
      const dist = document.createElement("span");
      dist.className = "s-dist";
      dist.textContent = item.km < 1 ? "< 1 km" : `${item.km} km`;
      li.append(dist);
    }

    li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(item); });
    el.box.append(li);
  });

  active = -1;
  el.box.hidden = items.length === 0 || document.activeElement !== el.input;
}

el.input.addEventListener("input", () => {
  clearTimeout(timer);
  const q = el.input.value.trim();
  if (q.length < 2) return hideSuggestions();
  timer = setTimeout(async () => {
    const id = ++reqId;
    try {
      const params = new URLSearchParams({ q, ...(userPos || {}) });
      const res = await fetch(`/api/cities?${params}`);
      const list = await res.json();
      if (id === reqId && Array.isArray(list)) showSuggestions(list);
    } catch { }
  }, 300);
});

el.input.addEventListener("keydown", (e) => {
  if (el.box.hidden || !items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = items.length;
    active = e.key === "ArrowDown" ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1);
    [...el.box.children].forEach((li, i) => li.classList.toggle("active", i === active));
  } else if (e.key === "Enter" && active >= 0) {
    e.preventDefault();
    pick(items[active]);
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

el.input.addEventListener("blur", hideSuggestions);

// ---- Search form ----
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = el.input.value.trim();
  if (!city) return;
  clearTimeout(timer);
  reqId++; // ignore any in-flight suggestion response
  hideSuggestions();
  checkWeather({ city });
});

// ---- Initial load ----
let last = { params: { city: DEFAULT_CITY } };
try {
  const saved = JSON.parse(localStorage.getItem("lastSearch"));
  if (saved && saved.params) last = saved;
} catch { }
checkWeather(last.params, last.title);