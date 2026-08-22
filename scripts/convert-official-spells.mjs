import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSpell, normalizeNumber } from "../src/utils/normalizeSpell.js";
import { calculatePower } from "../src/utils/calculatePower.js";
import { POWER_MODELS } from "../src/utils/experimentalPower.js";
import { evaluatePower, getPowerBands } from "../src/utils/powerBands.js";
import { getDeviation, getSpellCraftingDC, getStability } from "../src/utils/spellMath.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const csvPath = process.env.OFFICIAL_SPELLS_CSV || "/Users/owner/spell_importer/Spells.csv";
const outputRoot = path.resolve(repoRoot, "data/official-spells");
const spellOutputDir = path.join(outputRoot, "json");

const KNOWN_CLASSES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const DAMAGE_TYPES = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];
const EFFECT_KEYWORDS = [
  ["Summoning", /\b(summon|conjure|spirit appears|creature appears)\b/i],
  ["Creation", /\b(create|animate|object|wall|servant|construct|food|water)\b/i],
  ["Healing", /\b(heal|regain hit points|restore hit points|restores hit points|cure)\b/i],
  ["Buff", /\b(advantage|bonus|increase|resistance|temporary hit points|extra \d+d|add \d+d|protected)\b/i],
  ["Debuff", /\b(disadvantage|penalty|reduced|subtract|minus|weaken)\b/i],
  ["Control", /\b(control|command|move the target|forced|restrain|restrained|incapacitated|stunned|paralyzed|prone|frightened|charmed|banish)\b/i],
  ["Detection", /\b(detect|sense|locate|identify|know|learn|reveal|see invisible|divine)\b/i],
  ["Communication", /\b(message|communicate|speak|understand|telepathic|telepathy)\b/i],
  ["Movement", /\b(speed|fly|teleport|move|jump|climb|swim)\b/i],
  ["Warding", /\b(ward|shield|protect|barrier|resistance|immune|immunity|cover)\b/i],
  ["Invisible", /\b(invisible|invisibility)\b/i],
  ["Social", /\b(charm|social|friendly|hostile|attitude)\b/i],
  ["Exploration", /\b(travel|track|navigate|path|terrain|environment)\b/i],
  ["Shapechanging", /\b(transform|shapechange|polymorph|form)\b/i],
  ["Utility", /\b(utility|repair|clean|open|close|light|minor magical effect)\b/i],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headers, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function normalizeLevel(raw) {
  const value = String(raw || "");
  if (/cantrip/i.test(value)) return 0;
  return Math.max(0, Math.min(9, Number.parseInt(value.match(/\d+/)?.[0] || "0", 10)));
}

function parseClasses(raw) {
  return [...new Set(String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => KNOWN_CLASSES.includes(value)))];
}

function parseCastingTime(raw) {
  const value = String(raw || "").toLowerCase();
  if (value.includes("reaction")) return "1 Reaction";
  if (value.includes("bonus")) return "1 Bonus Action";
  if (value.includes("minute")) return value.includes("10") ? "10 Minutes" : "1 Minute";
  if (value.includes("hour")) {
    if (value.includes("24")) return "24 Hours";
    if (value.includes("12")) return "12 Hours";
    if (value.includes("8")) return "8 Hours";
    return "1 Hour";
  }
  if (value.includes("special")) return "Special";
  return "1 Action";
}

function parseDuration(raw) {
  const value = String(raw || "").toLowerCase();
  if (value.includes("until dispelled or triggered")) return "Until Dispelled or Triggered";
  if (value.includes("until dispelled")) return "Until Dispelled";
  if (value.includes("instant")) return "Instantaneous";
  if (value.includes("round")) return value.includes("6") ? "6 Rounds" : "1 Round";
  if (value.includes("minute")) return value.includes("10") ? "10 Minutes" : "1 Minute";
  if (value.includes("hour")) {
    if (value.includes("24")) return "24 Hours";
    if (value.includes("8")) return "8 Hours";
    if (value.includes("2")) return "2 Hours";
    return "1 Hour";
  }
  if (value.includes("day")) {
    if (value.includes("30")) return "30 Days";
    if (value.includes("10")) return "10 Days";
    if (value.includes("7")) return "7 Days";
    return "24 Hours";
  }
  return value ? "Special" : "Instantaneous";
}

function parseRange(raw) {
  const value = String(raw || "").toLowerCase();
  if (value.includes("self")) return "Self";
  if (value.includes("touch")) return "Touch";
  if (value.includes("sight")) return "Sight";
  if (value.includes("unlimited")) return "Unlimited";
  const miles = value.match(/(\d+)\s*mile/);
  if (miles) {
    const amount = Number(miles[1]);
    if (amount >= 500) return "500 miles";
    if (amount >= 5) return "5 miles";
    return "1 mile";
  }
  const feet = value.match(/(\d+)\s*(feet|foot|ft)/);
  if (!feet) return "30 ft";
  const amount = Number(feet[1]);
  const supported = [5, 10, 15, 20, 30, 40, 50, 60, 90, 100, 120, 150, 200, 300, 500, 1000];
  const closest = supported.reduce((best, current) => Math.abs(current - amount) < Math.abs(best - amount) ? current : best, supported[0]);
  return `${closest} ft`;
}

function parseComponents(raw) {
  const value = String(raw || "");
  const materialMatch = value.match(/M\s*\(([^)]+)\)/i);
  const costMatch = materialMatch?.[1]?.match(/(\d[\d,]*)\s*gp/i);
  return {
    verbal: /\bV\b/.test(value),
    somatic: /\bS\b/.test(value),
    material: /\bM\b/.test(value),
    materialText: materialMatch?.[1]?.trim() || "",
    materialType: costMatch ? "Costed" : /\bconsumes?\b/i.test(materialMatch?.[1] || "") ? "Consumed" : /\bM\b/.test(value) ? "Trivial" : "None",
    materialCost: costMatch ? Number(costMatch[1].replace(/,/g, "")) : 0,
  };
}

function parseAttackSave(text) {
  const lower = text.toLowerCase();
  const saves = [
    ["STR Save", /strength saving throw/],
    ["DEX Save", /dexterity saving throw/],
    ["CON Save", /constitution saving throw/],
    ["INT Save", /intelligence saving throw/],
    ["WIS Save", /wisdom saving throw/],
    ["CHA Save", /charisma saving throw/],
  ];
  const save = saves.find(([, pattern]) => pattern.test(lower));
  if (save) return save[0];
  if (/ranged spell attack|ranged attack/.test(lower)) return "Ranged Attack";
  if (/melee spell attack|melee attack/.test(lower)) return "Melee Attack";
  return "None";
}

function closestSupportedArea(shape, amount) {
  const options = {
    Sphere: [5, 10, 15, 20, 30, 40, 60],
    Cone: [15, 30, 60],
    Line: [30, 60, 100],
    Cylinder: [5, 10, 20, 30, 40, 50, 60],
    Cube: [1, 5, 10, 15, 20, 30, 40, 60, 100, 150, 200],
    Square: [5, 10, 20],
  }[shape];
  if (!options) return "None";
  const closest = options.reduce((best, current) => Math.abs(current - amount) < Math.abs(best - amount) ? current : best, options[0]);
  return `${shape} ${closest} ft`;
}

function parseArea(text) {
  const lower = text.toLowerCase();
  const direct = [
    ["Sphere", /(\d+)[-\s]*(foot|feet|ft)(?:-radius)?\s+sphere|(\d+)[-\s]*(foot|feet|ft)[-\s]*radius/i],
    ["Cone", /(\d+)[-\s]*(foot|feet|ft)\s+cone/i],
    ["Line", /(\d+)[-\s]*(foot|feet|ft)\s+line|line\s+.*?(\d+)[-\s]*(foot|feet|ft)/i],
    ["Cylinder", /(\d+)[-\s]*(foot|feet|ft)(?:-radius)?\s+cylinder/i],
    ["Cube", /(\d+)[-\s]*(foot|feet|ft)\s+cube/i],
    ["Square", /(\d+)[-\s]*(foot|feet|ft)\s+square/i],
  ];

  for (const [shape, pattern] of direct) {
    const match = lower.match(pattern);
    const amount = Number(match?.[1] || match?.[3] || match?.[4] || 0);
    if (amount > 0) return closestSupportedArea(shape, amount);
  }

  return "None";
}

function parseTargets(text, area) {
  const lower = text.toLowerCase();
  if (area !== "None") return -1;
  const upTo = lower.match(/up to (\w+|\d+)(?:\s+\w+){0,4}\s+(?:creatures?|objects?|targets?)/);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  if (upTo) return Number(upTo[1]) || words[upTo[1]] || 1;
  if (/\btwo creatures?\b/.test(lower)) return 2;
  if (/\bthree creatures?\b/.test(lower)) return 3;
  if (/\beach creature\b|\ball creatures\b|\bany number of creatures\b/.test(lower)) return -1;
  if (/\bone creature\b|\ba creature\b|\bone target\b|\ba target\b/.test(lower)) return 1;
  return 0;
}

function parseDice(text) {
  const diceMatches = [...text.matchAll(/(\d*)d(4|6|8|10|12|20|100)(?:\s*[+]\s*\d+)?/gi)]
    .map((match) => match[0].replace(/\s+/g, ""));
  if (!diceMatches.length) return { diceValue: "0", avgRoll: 0 };
  const diceValue = diceMatches[0];
  return { diceValue, avgRoll: normalizeNumber(diceValue) };
}

function inferEffects(text, diceValue) {
  const found = [];
  const lower = text.toLowerCase();
  for (const [effect, pattern] of EFFECT_KEYWORDS) {
    if (found.length >= 3) break;
    if (pattern.test(text) && !found.includes(effect)) found.push(effect);
  }
  for (const type of DAMAGE_TYPES) {
    if (found.length >= 3) break;
    if (new RegExp(`\\b${type.toLowerCase()}\\b`).test(lower) && !found.includes(type)) found.push(type);
  }
  if (diceValue !== "0" && !found.includes("Combat") && !found.some((effect) => DAMAGE_TYPES.includes(effect))) found.push("Combat");
  const result = found.slice(0, 3);
  while (result.length < 3) result.push("None");
  return result;
}

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

function toOfficialSpell(row, index) {
  const text = row.Text || "";
  const higher = row["At Higher Levels"] || "";
  const fullText = `${text}\n${higher}`.trim();
  const dice = parseDice(text);
  const area = parseArea(text);
  const components = parseComponents(row.Components);
  const classes = parseClasses(row.Classes);
  const normalized = normalizeSpell({
    name: row.Name,
    author: "Official D&D",
    level: normalizeLevel(row.Level),
    school: row.School,
    classes: classes.length ? classes : ["Wizard"],
    effects: inferEffects(fullText, dice.diceValue),
    castingTime: parseCastingTime(row["Casting Time"]),
    range: parseRange(row.Range),
    duration: parseDuration(row.Duration),
    area,
    concentration: /concentration/i.test(row.Duration),
    ritual: /\britual\b/i.test(row["Casting Time"]) || /\britual\b/i.test(text),
    damageSpell: dice.avgRoll > 0 || /\bdamage\b/i.test(text),
    ...components,
    attackSave: parseAttackSave(text),
    diceValue: dice.diceValue,
    avgRoll: dice.avgRoll,
    targets: parseTargets(text, area),
    upcastable: higher.trim().length > 0,
    upcastText: higher,
    hasRestriction: /\bcan't\b|\bcannot\b|\bmust\b|\bonly\b/i.test(text),
    restrictionText: "",
    description: text,
    version: "1.0.0",
    themes: [],
    emotionalTone: "Neutral",
    sourceType: row.Source?.includes("24") ? "officialVariant" : "official",
    official: {
      source: row.Source,
      page: row.Page,
      levelLabel: row.Level,
      optionalVariantClasses: parseClasses(row["Optional/Variant Classes"]),
      rowIndex: index,
    },
  }, { preserveDurationConcentration: true });

  const power = calculatePower(normalized);
  const evaluation = evaluatePower(normalized.level, power);
  const deviation = getDeviation(normalized.level, power);
  const stability = getStability(normalized, power, deviation);
  const craftingDC = getSpellCraftingDC(normalized, stability, evaluation);
  const experimental = Object.fromEntries(POWER_MODELS
    .filter((model) => model.id !== "legacy")
    .map((model) => {
      const experimentalPower = model.calculate(normalized);
      const experimentalEvaluation = evaluatePower(normalized.level, experimentalPower);
      const experimentalDeviation = getDeviation(normalized.level, experimentalPower);
      const experimentalStability = getStability(normalized, experimentalPower, experimentalDeviation);
      return [model.id, {
        label: model.label,
        power: experimentalPower,
        evaluation: experimentalEvaluation,
        deviation: experimentalDeviation,
        stability: experimentalStability,
        craftingDC: getSpellCraftingDC(normalized, experimentalStability, experimentalEvaluation),
      }];
    }));

  return {
    ...normalized,
    official: {
      ...normalized.official,
      calculated: {
        power,
        evaluation,
        deviation,
        stability,
        craftingDC,
        bands: getPowerBands(normalized.level),
        experimental,
      },
    },
  };
}

function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const count = sorted.length;
  if (!count) return null;
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

function getCalculated(spell, modelId = "legacy") {
  if (modelId === "legacy") return spell.official.calculated;
  return spell.official.calculated.experimental[modelId];
}

function summarize(spells, modelId = "legacy") {
  const byLevel = {};
  for (const spell of spells) {
    byLevel[spell.level] ||= [];
    byLevel[spell.level].push(spell);
  }

  const levels = Object.fromEntries(Object.entries(byLevel).map(([level, levelSpells]) => {
    const powers = levelSpells.map((spell) => getCalculated(spell, modelId).power);
    const levelStats = stats(powers);
    const bandCounts = levelSpells.reduce((acc, spell) => {
      const band = getCalculated(spell, modelId).evaluation;
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {});
    const oddities = levelSpells
      .map((spell) => ({
        name: spell.name,
        source: spell.official.source,
        power: getCalculated(spell, modelId).power,
        band: getCalculated(spell, modelId).evaluation,
        zScore: levelStats.standardDeviation ? Math.round(((getCalculated(spell, modelId).power - levelStats.average) / levelStats.standardDeviation) * 100) / 100 : 0,
      }))
      .filter((spell) => Math.abs(spell.zScore) >= 1.75 || spell.band === "Overpowered" || spell.band === "Underpowered")
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    return [level, { ...levelStats, bandCounts, oddities }];
  }));

  return {
    generatedAt: new Date().toISOString(),
    sourceCsv: csvPath,
    modelId,
    modelLabel: getModelLabel(modelId),
    spellCount: spells.length,
    levels,
    overall: stats(spells.map((spell) => getCalculated(spell, modelId).power)),
    bandCounts: spells.reduce((acc, spell) => {
      const band = getCalculated(spell, modelId).evaluation;
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {}),
  };
}

function getModelLabel(modelId) {
  return POWER_MODELS.find((model) => model.id === modelId)?.label || "Legacy Formula";
}

function summarizeAllModels(spells) {
  return Object.fromEntries(POWER_MODELS.map((model) => [model.id, summarize(spells, model.id)]));
}

function analysisMarkdown(analysis) {
  const lines = [
    "# Official Spell Power Analysis",
    "",
    `Generated from ${analysis.spellCount} spells in \`${analysis.sourceCsv}\`.`,
    `Power model: ${analysis.modelLabel} (\`${analysis.modelId}\`).`,
    "",
    "## Overall",
    "",
    `Average power: ${analysis.overall.average}`,
    `Median power: ${analysis.overall.median}`,
    `Minimum power: ${analysis.overall.min}`,
    `Maximum power: ${analysis.overall.max}`,
    `Standard deviation: ${analysis.overall.standardDeviation}`,
    `Band counts: ${Object.entries(analysis.bandCounts).map(([band, count]) => `${band} ${count}`).join(", ")}`,
    "",
    "## By Level",
    "",
    "| Level | Count | Avg | Median | Min | Max | Std Dev | Band Counts |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const [level, data] of Object.entries(analysis.levels).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    lines.push(`| ${level} | ${data.count} | ${data.average} | ${data.median} | ${data.min} | ${data.max} | ${data.standardDeviation} | ${Object.entries(data.bandCounts).map(([band, count]) => `${band}: ${count}`).join(", ")} |`);
  }

  lines.push("", "## Oddities");
  for (const [level, data] of Object.entries(analysis.levels).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (!data.oddities.length) continue;
    lines.push("", `### Level ${level}`);
    for (const oddity of data.oddities.slice(0, 12)) {
      lines.push(`- ${oddity.name} (${oddity.source}): power ${oddity.power}, ${oddity.band}, z ${oddity.zScore}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function modelComparisonMarkdown(modelAnalysis) {
  const lines = [
    "# Power Model Comparison",
    "",
    "Experimental models preserve the legacy formula and apply a calibrated band-centered transform for debugging.",
    "",
    "| Model | Mid | High | Low | Overpowered | Underpowered | Average | Median | Std Dev |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const analysis of Object.values(modelAnalysis)) {
    lines.push([
      `| ${analysis.modelLabel}`,
      analysis.bandCounts["Mid Power"] || 0,
      analysis.bandCounts["High Power"] || 0,
      analysis.bandCounts["Low Power"] || 0,
      analysis.bandCounts.Overpowered || 0,
      analysis.bandCounts.Underpowered || 0,
      analysis.overall.average,
      analysis.overall.median,
      `${analysis.overall.standardDeviation} |`,
    ].join(" | "));
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- `Official Mid-Max v1` is intentionally aggressive and is best for testing the maximum possible Mid Power clustering.",
    "- `Official Balanced v1` is the best first candidate for normal use because it greatly reduces extreme tails while leaving more High/Low signal.",
    "- `Official Outlier-Aware v1` is the best first candidate when known table outliers should remain more visibly high or low.",
    "- `Official Gentle v1` is closest to the original spread and is useful when the balanced model feels too compressed.",
  );

  return `${lines.join("\n")}\n`;
}

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(spellOutputDir, { recursive: true });

const rows = parseCsv(await fs.readFile(csvPath, "utf8"));
const spells = rows.map(toOfficialSpell);
const filenameCounts = new Map();
const indexEntries = [];

for (const spell of spells) {
  const base = slugify(`${spell.name}-${spell.official.source || "official"}-${spell.official.page || spell.official.rowIndex}`);
  const count = filenameCounts.get(base) || 0;
  filenameCounts.set(base, count + 1);
  const filename = `${base}${count ? `-${count + 1}` : ""}.json`;
  await fs.writeFile(path.join(spellOutputDir, filename), `${JSON.stringify(spell, null, 2)}\n`);
  indexEntries.push({
    name: spell.name,
    level: spell.level,
    source: spell.official.source,
    page: spell.official.page,
    classes: spell.classes,
    power: spell.official.calculated.power,
    evaluation: spell.official.calculated.evaluation,
    file: `json/${filename}`,
  });
}

const analysis = summarize(spells);
const modelAnalysis = summarizeAllModels(spells);
await fs.writeFile(path.join(outputRoot, "index.json"), `${JSON.stringify(indexEntries, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, "analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, "model-analysis.json"), `${JSON.stringify(modelAnalysis, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, "analysis.md"), analysisMarkdown(analysis));
await fs.writeFile(path.join(outputRoot, "model-comparison.md"), modelComparisonMarkdown(modelAnalysis));

console.log(`Converted ${spells.length} official spells.`);
console.log(`Wrote JSON spells to ${spellOutputDir}`);
console.log(`Wrote analysis to ${path.join(outputRoot, "analysis.md")}`);
