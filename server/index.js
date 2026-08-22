import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSpellWithProviders } from "./providers/customLocalModelProvider.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 4173);
const distPath = path.resolve(__dirname, "../dist");

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "spell-crafter", mode: process.env.NODE_ENV || "development" });
});

app.post("/api/generate-spell", async (req, res) => {
  try {
    res.json(await generateSpellWithProviders(req.body));
  } catch (error) {
    res.status(500).json({ error: "Spell generation failed.", detail: error.message });
  }
});

app.use(express.static(distPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Spell Crafter listening on http://0.0.0.0:${port}`);
});
