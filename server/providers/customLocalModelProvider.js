import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLocalSpell } from "../generateSpell.js";
import { saveGeneratedSpell, scoreSpell } from "../spellCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function loadSystemPrompt() {
  try {
    return await fs.readFile(path.join(repoRoot, "ml/prompts/spellcrafter_system_prompt.txt"), "utf8");
  } catch {
    return "Return one original SpellCrafter spell as valid JSON only. Do not copy official spell names or descriptions.";
  }
}

function stripJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

function generationPrompt(body = {}) {
  const parts = [
    "Generate one original D&D 5e-style SpellCrafter spell.",
    "Return only the JSON spell object.",
  ];
  if (body.level !== undefined) parts.push(`Preferred level: ${body.level}.`);
  if (body.school) parts.push(`Preferred school: ${body.school}.`);
  if (body.theme) parts.push(`Theme: ${body.theme}.`);
  if (body.constraints) parts.push(`Additional constraints: ${JSON.stringify(body.constraints)}.`);
  return parts.join("\n");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callOllama(body) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "spellcrafter";
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: await loadSystemPrompt() },
        { role: "user", content: generationPrompt(body) },
      ],
      options: {
        temperature: Number(process.env.OLLAMA_TEMPERATURE || 0.8),
        top_p: Number(process.env.OLLAMA_TOP_P || 0.9),
      },
    }),
  }, Number(process.env.OLLAMA_TIMEOUT_MS || 20000));
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama ${model} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  const payload = await response.json();
  return stripJson(payload.message?.content || payload.response || "");
}

async function callOpenAI(body) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      messages: [
        { role: "system", content: await loadSystemPrompt() },
        { role: "user", content: generationPrompt(body) },
      ],
    }),
  }, Number(process.env.OPENAI_TIMEOUT_MS || 30000));
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${model} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  const payload = await response.json();
  return stripJson(payload.choices?.[0]?.message?.content || "");
}

async function generateOffline(body = {}) {
  const seed = body.seed || Date.now();
  const candidates = Array.from({ length: 32 }, (_, index) => {
    const candidateSeed = Number(seed) + index * 2654435761;
    const spell = generateLocalSpell(candidateSeed);
    return { seed: candidateSeed, spell: scoreSpell(spell) };
  });
  const selected = candidates.find((candidate) => candidate.spell.generated.calculated.evaluation === "Mid Power")
    || candidates.find((candidate) => candidate.spell.generated.calculated.evaluation === "High Power")
    || candidates.find((candidate) => candidate.spell.generated.calculated.evaluation === "Low Power")
    || candidates[0];
  const saved = await saveGeneratedSpell(selected.spell, { seed: selected.seed, generator: "local-generator" });
  return { source: "local-generator", attempts: candidates.length, ...saved };
}

async function generateVia(provider, body) {
  if (provider === "local") return generateOffline(body);
  if (provider === "ollama") {
    const spell = await callOllama(body);
    const saved = await saveGeneratedSpell(spell, { generator: `ollama:${process.env.OLLAMA_MODEL || "spellcrafter"}` });
    return { source: "ollama", attempts: 1, ...saved };
  }
  if (provider === "openai") {
    const spell = await callOpenAI(body);
    const saved = await saveGeneratedSpell(spell, { generator: `openai:${process.env.OPENAI_MODEL || "gpt-4.1-mini"}` });
    return { source: "openai", attempts: 1, ...saved };
  }
  throw new Error(`Unknown generator provider: ${provider}`);
}

export async function generateSpellWithProviders(body = {}) {
  const requested = String(process.env.SPELLCRAFTER_GENERATOR_PROVIDER || "auto").toLowerCase();
  const enableOpenAI = envFlag("ENABLE_OPENAI_FALLBACK", false);
  const providers = requested === "auto"
    ? ["ollama", ...(enableOpenAI && process.env.OPENAI_API_KEY ? ["openai"] : []), "local"]
    : [requested];
  const errors = [];

  for (const provider of providers) {
    try {
      const result = await generateVia(provider, body);
      if (errors.length) result.fallbackErrors = errors;
      return result;
    } catch (error) {
      const detail = `${provider}: ${error.message}`;
      errors.push(detail);
      console.warn(`[spell-generator] ${detail}`);
      if (requested !== "auto") break;
    }
  }

  if (requested !== "local") {
    const result = await generateOffline(body);
    result.fallbackErrors = errors;
    return result;
  }
  throw new Error(errors.join("; ") || "Spell generation failed.");
}
