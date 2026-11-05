# SkyCast

Live weather for any city with simple health advice.

## Folder structure

```
skycast/
├── api/
│   ├── weather.js
│   └── cities.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/main.js
│   └── images/        (clear, clouds, rain, drizzle, snow, mist, unknown, humidity, wind .png)
├── server.js
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

## Run locally

1. Install Node.js 18 or newer
2. Copy `.env.example` to `.env` and put your OpenWeather API key in it
3. `npm run dev`
4. Open http://localhost:5173

## Deploy (Vercel)

1. Push the repo to GitHub
2. Import it on vercel.com
3. Settings -> Environment Variables -> add `OPENWEATHER_API_KEY`
4. Deploy