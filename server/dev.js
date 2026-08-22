import dotenv from "dotenv";
import express from "express";
import { createServer as createViteServer } from "vite";
import { generateSpellWithProviders } from "./providers/customLocalModelProvider.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5173);

app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "spell-crafter", mode: "development" }));
app.post("/api/generate-spell", async (req, res) => {
  try {
    res.json(await generateSpellWithProviders(req.body));
  } catch (error) {
    res.status(500).json({ error: "Spell generation failed.", detail: error.message });
  }
});

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});

app.use(vite.middlewares);

app.listen(port, "0.0.0.0", () => {
  console.log(`Spell Crafter dev server listening on http://0.0.0.0:${port}`);
});
