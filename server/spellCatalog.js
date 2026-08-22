import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSpell } from "../src/utils/normalizeSpell.js";
import { getPowerModel } from "../src/utils/experimentalPower.js";
import { evaluatePower, getPowerBands } from "../src/utils/powerBands.js";
import { getDeviation, getSpellCraftingDC, getStability } from "../src/utils/spellMath.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(repoRoot, "data/generated");
const DEFAULT_MODEL = "official-outlier-aware-v1";

function slugify(value) {
  return String(value || "spell")
    .normalize("NFKD")
    .replace(/[^\w\s'.-]/g, "")
    .replace(/['"]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function scoreSpell(spell, modelId = DEFAULT_MODEL) {
  const normalized = normalizeSpell(spell, { preserveDurationConcentration: true });
  const model = getPowerModel(modelId);
  const power = model.calculate(normalized);
  const evaluation = evaluatePower(normalized.level, power);
  const deviation = getDeviation(normalized.level, power);
  const stability = getStability(normalized, power, deviation);
  const craftingDC = getSpellCraftingDC(normalized, stability, evaluation);

  return {
    ...normalized,
    generated: {
      ...(normalized.generated || {}),
      modelId,
      modelLabel: model.label,
      generatedAt: normalized.generated?.generatedAt || new Date().toISOString(),
      calculated: {
        power,
        evaluation,
        deviation,
        stability,
        craftingDC,
        bands: getPowerBands(normalized.level),
      },
    },
  };
}

export async function saveGeneratedSpell(spell, options = {}) {
  await fs.mkdir(generatedDir, { recursive: true });
  const scored = scoreSpell({
    ...spell,
    sourceType: spell.sourceType || "student",
    generated: {
      ...(spell.generated || {}),
      generator: options.generator || "local-generator",
      seed: options.seed,
    },
  }, options.modelId || DEFAULT_MODEL);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}-${slugify(scored.name)}.json`;
  const outputPath = path.join(generatedDir, filename);
  await fs.writeFile(outputPath, `${JSON.stringify(scored, null, 2)}\n`);
  return { spell: scored, savedAs: `data/generated/${filename}` };
}
