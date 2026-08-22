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
const modelId = process.env.POWER_MODEL || "official-outlier-aware-v1";
const model = getPowerModel(modelId);
const corpora = [
  { id: "official", label: "Official", dir: path.join(repoRoot, "data/official-spells/json") },
  { id: "homebrew", label: "Homebrew", dir: path.join(repoRoot, "data/homebrew") },
  { id: "generated", label: "Generated", dir: path.join(repoRoot, "data/generated") },
];

async function readJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await readJsonFiles(fullPath));
      if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("_")) files.push(fullPath);
    }
    return files;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function scoreSpell(spell) {
  const normalized = normalizeSpell(spell, { preserveDurationConcentration: true });
  const power = model.calculate(normalized);
  const evaluation = evaluatePower(normalized.level, power);
  const deviation = getDeviation(normalized.level, power);
  const stability = getStability(normalized, power, deviation);
  return {
    name: normalized.name,
    level: normalized.level,
    school: normalized.school,
    classes: normalized.classes,
    effects: normalized.effects,
    power,
    evaluation,
    deviation,
    stability,
    craftingDC: getSpellCraftingDC(normalized, stability, evaluation),
    bands: getPowerBands(normalized.level),
  };
}

function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const count = sorted.length;
  if (!count) return { count: 0, min: null, q1: null, median: null, q3: null, max: null, average: null, standardDeviation: null };
  const sum = sorted.reduce((total, value) => total + value, 0);
  const average = sum / count;
  const variance = sorted.reduce((total, value) => total + (value - average) ** 2, 0) / count;
  const middle = Math.floor(count / 2);
  return {
    count,
    min: sorted[0],
    q1: sorted[Math.floor((count - 1) * 0.25)],
    median: count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    q3: sorted[Math.floor((count - 1) * 0.75)],
    max: sorted[count - 1],
    average: Math.round(average * 100) / 100,
    standardDeviation: Math.round(Math.sqrt(variance) * 100) / 100,
  };
}

function summarizeRecords(records) {
  const bandCounts = records.reduce((acc, record) => {
    acc[record.evaluation] = (acc[record.evaluation] || 0) + 1;
    return acc;
  }, {});
  const byLevel = {};
  for (const record of records) {
    byLevel[record.level] ||= [];
    byLevel[record.level].push(record);
  }
  return {
    recordCount: records.length,
    overall: stats(records.map((record) => record.power)),
    bandCounts,
    levels: Object.fromEntries(Object.entries(byLevel).map(([level, levelRecords]) => [
      level,
      {
        recordCount: levelRecords.length,
        ...stats(levelRecords.map((record) => record.power)),
        bandCounts: levelRecords.reduce((acc, record) => {
          acc[record.evaluation] = (acc[record.evaluation] || 0) + 1;
          return acc;
        }, {}),
        strongest: [...levelRecords].sort((a, b) => b.power - a.power).slice(0, 10),
        weakest: [...levelRecords].sort((a, b) => a.power - b.power).slice(0, 10),
      },
    ])),
  };
}

function reportMarkdown(analysis) {
  const lines = [
    "# Spell Corpus Analysis",
    "",
    `Power model: ${analysis.modelLabel} (\`${analysis.modelId}\`)`,
    `Generated at: ${analysis.generatedAt}`,
    "",
    "| Corpus | Count | Mid | High | Low | Over | Under | Avg | Median | Std Dev |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const corpus of Object.values(analysis.corpora)) {
    lines.push([
      `| ${corpus.label}`,
      corpus.summary.recordCount,
      corpus.summary.bandCounts["Mid Power"] || 0,
      corpus.summary.bandCounts["High Power"] || 0,
      corpus.summary.bandCounts["Low Power"] || 0,
      corpus.summary.bandCounts.Overpowered || 0,
      corpus.summary.bandCounts.Underpowered || 0,
      corpus.summary.overall.average ?? "-",
      corpus.summary.overall.median ?? "-",
      `${corpus.summary.overall.standardDeviation ?? "-"} |`,
    ].join(" | "));
  }

  for (const corpus of Object.values(analysis.corpora)) {
    lines.push("", `## ${corpus.label}`, "");
    if (!corpus.records.length) {
      lines.push("No spells found.");
      continue;
    }
    lines.push("| Level | Count | Avg | Median | Min | Max | Band Counts |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const [level, data] of Object.entries(corpus.summary.levels).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      lines.push(`| ${level} | ${data.recordCount} | ${data.average} | ${data.median} | ${data.min} | ${data.max} | ${Object.entries(data.bandCounts).map(([band, count]) => `${band}: ${count}`).join(", ")} |`);
    }
  }

  return `${lines.join("\n")}\n`;
}

const analysis = {
  generatedAt: new Date().toISOString(),
  modelId,
  modelLabel: model.label,
  corpora: {},
};

for (const corpus of corpora) {
  const files = await readJsonFiles(corpus.dir);
  const records = [];
  for (const file of files) {
    const spell = JSON.parse(await fs.readFile(file, "utf8"));
    records.push({ ...scoreSpell(spell), file: path.relative(repoRoot, file) });
  }
  analysis.corpora[corpus.id] = {
    label: corpus.label,
    dir: path.relative(repoRoot, corpus.dir),
    records,
    summary: summarizeRecords(records),
  };
}

await fs.mkdir(path.join(repoRoot, "data"), { recursive: true });
await fs.writeFile(path.join(repoRoot, "data/spell-corpus-analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`);
await fs.writeFile(path.join(repoRoot, "data/spell-corpus-analysis.md"), reportMarkdown(analysis));

console.log(`Analyzed ${Object.values(analysis.corpora).reduce((sum, corpus) => sum + corpus.records.length, 0)} spells with ${model.label}.`);
console.log(`Wrote ${path.join(repoRoot, "data/spell-corpus-analysis.md")}`);
