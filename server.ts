import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const STEAM_API_KEY = process.env.STEAM_API_KEY?.trim();

  // API Routes
  app.get("/api/steam/resolve/:vanity", async (req, res) => {
    if (!STEAM_API_KEY) return res.status(500).json({ error: "STEAM_API_KEY not configured" });
    try {
      const response = await fetch(`http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(req.params.vanity)}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve vanity URL" });
    }
  });

  app.get("/api/steam/profile/:steamid", async (req, res) => {
    if (!STEAM_API_KEY) return res.status(500).json({ error: "STEAM_API_KEY not configured" });
    try {
      const response = await fetch(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${encodeURIComponent(req.params.steamid)}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/steam/games/:steamid", async (req, res) => {
    if (!STEAM_API_KEY) return res.status(500).json({ error: "STEAM_API_KEY not configured" });
    try {
      const response = await fetch(`http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${encodeURIComponent(req.params.steamid)}&format=json&include_appinfo=1&include_played_free_games=1`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.get("/api/steam/recent/:steamid", async (req, res) => {
    if (!STEAM_API_KEY) return res.status(500).json({ error: "STEAM_API_KEY not configured" });
    try {
      const response = await fetch(`http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${encodeURIComponent(req.params.steamid)}&format=json`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent games" });
    }
  });

  app.get("/api/steam/game-details/:appid", async (req, res) => {
    try {
      const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(req.params.appid)}&l=schinese`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch game details" });
    }
  });

  app.get("/api/steam/achievements/:steamid/:appid", async (req, res) => {
    if (!STEAM_API_KEY) return res.status(500).json({ error: "STEAM_API_KEY not configured" });
    try {
      const response = await fetch(`http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${encodeURIComponent(req.params.appid)}&key=${STEAM_API_KEY}&steamid=${encodeURIComponent(req.params.steamid)}&l=schinese`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  app.get("/api/steam/game-schema/:appid", async (req, res) => {
    if (!STEAM_API_KEY) return res.status(500).json({ error: "STEAM_API_KEY not configured" });
    try {
      const response = await fetch(`http://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${encodeURIComponent(req.params.appid)}&l=schinese`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch game schema" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
