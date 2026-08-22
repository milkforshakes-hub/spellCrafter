import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeSpell, normalizeNumber } from "../src/utils/normalizeSpell.js";
import { getPowerModel } from "../src/utils/experimentalPower.js";
import { evaluatePower, getPowerBands } from "../src/utils/powerBands.js";
import { getDeviation, getSpellCraftingDC, getStability } from "../src/utils/spellMath.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "data/homebrew");
const pythonPath = "/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const powerModelId = "official-outlier-aware-v1";
const powerModel = getPowerModel(powerModelId);

const sources = [
  { id: "homebrewery-almir", title: "Almir's Old Book of Spells", type: "pdf", path: "/Users/owner/Downloads/- Spells - The Homebrewery.pdf", parser: "standard" },
  { id: "mashiro-monstrous-magic", title: "Mashiro's Manual of Monstrous Magic", type: "pdf", path: "/Users/owner/Downloads/Mashiro's Manual of Monstrous Magic _ GM Binder.pdf", parser: "standard" },
  { id: "spells-2014-improved", title: "Spells 2014 Improved", type: "text", path: "/Users/owner/Downloads/Spells 2014.txt", parser: "standard" },
  { id: "forum-1001-homebrew-spells", title: "1001 Homebrew Spells Forum Thread", type: "text", path: "/Users/owner/Downloads/FourumThread.txt", parser: "forum" },
  { id: "so-many-spells", title: "So Many Spells", type: "pdf", path: "/Users/owner/Downloads/So Many Spells _ GM Binder.pdf", parser: "standard" },
  { id: "spells-that-dont-suck", title: "Spells That Don't Suck", type: "pdf", path: "/Users/owner/Downloads/Spells That Don't Suck _ GM Binder.pdf", parser: "standard" },
  { id: "fifth-edition-tome-of-spells", title: "5th Edition Tome of Spells", type: "pdf", path: "/Users/owner/Downloads/5th Edition Tome of Spells _ GM Binder.pdf", parser: "standard" },
];

const knownClasses = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const classAliases = {
  art: "Artificer",
  artificer: "Artificer",
  brd: "Bard",
  bard: "Bard",
  clr: "Cleric",
  cleric: "Cleric",
  drd: "Druid",
  druid: "Druid",
  pal: "Paladin",
  paladin: "Paladin",
  rgr: "Ranger",
  ranger: "Ranger",
  sor: "Sorcerer",
  sorcerer: "Sorcerer",
  warlock: "Warlock",
  wiz: "Wizard",
  wizard: "Wizard",
  "sor/wiz": "Sorcerer,Wizard",
};
const schools = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation", "Dunamancy"];
const damageTypes = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];
const effectKeywords = [
  ["Summoning", /\b(summon|conjure|call|servant|familiar|golem|undead|animated)\b/i],
  ["Creation", /\b(create|animate|wall|object|weapon|armor|construct|food|water)\b/i],
  ["Healing", /\b(heal|healing|regain hit points|restore|cure|revive|raise)\b/i],
  ["Buff", /\b(advantage|bonus|increase|resistance|temporary hit points|enhance|empower|ward)\b/i],
  ["Debuff", /\b(disadvantage|penalty|reduced|weaken|enervation|drain|curse)\b/i],
  ["Control", /\b(control|restrain|restrained|incapacitated|stunned|paralyzed|prone|frightened|charmed|banish|repulsion|pull|push)\b/i],
  ["Detection", /\b(detect|sense|locate|identify|know|reveal|sight|vision|awareness)\b/i],
  ["Communication", /\b(message|communicate|speak|language|telepath|glossolalia)\b/i],
  ["Movement", /\b(speed|fly|teleport|move|jump|climb|swim|transposition|stride)\b/i],
  ["Warding", /\b(ward|shield|protect|barrier|resistance|immune|armor|aegis)\b/i],
  ["Invisible", /\b(invisible|invisibility|unseen)\b/i],
  ["Social", /\b(charm|friendly|hostile|attitude|compel|command)\b/i],
  ["Exploration", /\b(travel|track|navigate|terrain|weather|water|stone)\b/i],
  ["Shapechanging", /\b(transform|shapechange|polymorph|form|body)\b/i],
  ["Utility", /\b(repair|clean|open|close|light|coin|fog|fog|utility|moment)\b/i],
];

function extractPdfText(filePath) {
  const script = [
    "from pypdf import PdfReader",
    "import sys",
    "reader = PdfReader(sys.argv[1])",
    "print('\\n\\n'.join((page.extract_text() or '') for page in reader.pages))",
  ].join("\n");
  return execFileSync(pythonPath, ["-c", script, filePath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

async function readSource(source) {
  const text = source.type === "pdf" ? extractPdfText(source.path) : await fs.readFile(source.path, "utf8");
  return normalizeExtractedText(text);
}

function normalizePua(text) {
  return [...text].map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 0xf020 && code <= 0xf07a) return String.fromCharCode(code - 0xf000);
    if (code === 0xf0a0 || code === 0xe000) return " ";
    return char;
  }).join("");
}

function normalizeExtractedText(text) {
  return normalizePua(text)
    .replace(/\uFEFF/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\bCasting Tim e\b/g, "Casting Time")
    .replace(/\bCom ponents\b/g, "Components")
    .replace(/\bCom ponent\b/g, "Component")
    .replace(/\bDuration:\s*/g, "Duration: ")
    .replace(/\bRange:\s*/g, "Range: ")
    .replace(/\bCasting Time:\s*/g, "Casting Time: ")
    .replace(/\bComponents:\s*/g, "Components: ")
    .replace(/\bAt H igher Levels\b/g, "At Higher Levels")
    .replace(/\bL evel\b/g, "Level")
    .replace(/\bW izard\b/g, "Wizard")
    .replace(/\bW arlock\b/g, "Warlock")
    .replace(/\bW hen\b/g, "When")
    .replace(/\btransm utation\b/gi, "transmutation")
    .replace(/\bnecrom ancy\b/gi, "necromancy")
    .replace(/\benchantm ent\b/gi, "enchantment")
    .replace(/\babjuration\b/gi, "abjuration")
    .replace(/\bconjuration\b/gi, "conjuration")
    .replace(/\bdivination\b/gi, "divination")
    .replace(/\bO n\b/g, "On")
    .replace(/\bM ake\b/g, "Make")
    .replace(/\bM akes\b/g, "Makes")
    .replace(/\bm ust\b/g, "must")
    .replace(/\bm agic\b/g, "magic")
    .replace(/\bm agical\b/g, "magical")
    .replace(/\bnonm agical\b/g, "nonmagical")
    .replace(/\bdam age\b/g, "damage")
    .replace(/\bm inute\b/g, "minute")
    .replace(/\bm inutes\b/g, "minutes")
    .replace(/\bm elee\b/g, "melee")
    .replace(/\bsum m on\b/g, "summon")
    .replace(/\banim ate\b/g, "animate")
    .replace(/\banim ated\b/g, "animated")
    .replace(/\barm or\b/g, "armor")
    .replace(/\bcom m ands\b/g, "commands")
    .replace(/\bcom m and\b/g, "command")
    .replace(/\breq uired\b/g, "required")
    .replace(/\breq uire\b/g, "require")
    .replace(/\breq uires\b/g, "requires")
    .replace(/\bcreature\b/g, "creature")
    .replace(/\n{3,}/g, "\n\n");
}

function titleCase(value) {
  let text = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[0-9]+[.)]+\s*/, "")
    .replace(/^[.)\s]+/, "")
    .replace(/\s*\((?:D&D|Dnd|5e|3\.5e?|Improved|.*?Homebrew).*?\)\s*$/i, "")
    .replace(/\s+$/, "");
  if (text.length % 2 === 0 && text.slice(0, text.length / 2) === text.slice(text.length / 2)) {
    text = text.slice(0, text.length / 2);
  }
  return text;
}

function parseLevel(raw) {
  const value = String(raw || "");
  if (/cantrip|0[- ]?level/i.test(value)) return 0;
  const match = value.match(/(\d+)(?:st|nd|rd|th)?(?:[- ]*level| Level|$)/i);
  return Math.max(0, Math.min(9, Number(match?.[1] || 0)));
}

function parseSchool(raw, fallback = "Evocation") {
  const match = schools.find((school) => new RegExp(`\\b${school}\\b`, "i").test(raw));
  return match || fallback;
}

function parseClasses(raw) {
  const found = new Set();
  const text = String(raw || "").replace(/\//g, "/").replace(/\band\b/gi, ",");
  for (const cls of knownClasses) {
    if (new RegExp(`\\b${cls}\\b`, "i").test(text)) found.add(cls);
  }
  for (const token of text.split(/[,;() ]+/).filter(Boolean)) {
    const key = token.toLowerCase();
    const mapped = classAliases[key];
    if (!mapped) continue;
    mapped.split(",").forEach((cls) => found.add(cls));
  }
  if (/sor\s*\/\s*wiz/i.test(text)) {
    found.add("Sorcerer");
    found.add("Wizard");
  }
  return [...found];
}

function parseComponents(raw) {
  const value = String(raw || "");
  const compact = value.toUpperCase();
  const materialMatch = value.match(/M\s*\(([^)]+)\)/i);
  const costMatch = materialMatch?.[1]?.match(/(\d[\d,]*)\s*gp/i);
  return {
    verbal: compact.includes("V"),
    somatic: compact.includes("S"),
    material: compact.includes("M"),
    materialText: materialMatch?.[1]?.trim() || "",
    materialType: costMatch ? "Costed" : /\bconsumes?|expended\b/i.test(materialMatch?.[1] || "") ? "Consumed" : /\bM\b/i.test(value) ? "Trivial" : "None",
    materialCost: costMatch ? Number(costMatch[1].replace(/,/g, "")) : 0,
  };
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
  if (value.includes("round")) return value.includes("6") || value.includes("10 rounds") ? "6 Rounds" : "1 Round";
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
  if (value.includes("personal") || value.includes("self")) return "Self";
  if (value.includes("touch")) return "Touch";
  if (value.includes("sight")) return "Sight";
  if (value.includes("unlimited")) return "Unlimited";
  if (value.includes("close")) return "30 ft";
  if (value.includes("medium")) return "120 ft";
  if (value.includes("long")) return "300 ft";
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

function parseAttackSave(text) {
  const lower = text.toLowerCase();
  const saves = [
    ["STR Save", /strength|fortitude/],
    ["DEX Save", /dexterity|reflex/],
    ["CON Save", /constitution|fortitude/],
    ["INT Save", /intelligence/],
    ["WIS Save", /wisdom|will/],
    ["CHA Save", /charisma/],
  ];
  if (/saving throw:\s*none|saving throw:\s*n\/a/i.test(text)) return "None";
  const explicit = lower.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma|will|reflex|fortitude) saving throw|saving throw:\s*(will|reflex|fortitude)/);
  if (explicit) return saves.find(([, pattern]) => pattern.test(explicit[0]))?.[0] || "None";
  if (/ranged spell attack|ranged touch attack|ranged attack/.test(lower)) return "Ranged Attack";
  if (/melee spell attack|melee touch attack|melee attack/.test(lower)) return "Melee Attack";
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
  if (/\ball creatures|each creature|creatures in (?:the|that|this) area|area of effect/i.test(text)) return "Sphere 10 ft";
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
  if (/\bone creature\b|\ba creature\b|\bone target\b|\ba target\b|creature touched|target creature/.test(lower)) return 1;
  return 0;
}

function parseDice(text) {
  const diceMatches = [...text.matchAll(/(\d*)d(4|6|8|10|12|20|100)(?:\s*[+]\s*\d+)?/gi)].map((match) => match[0].replace(/\s+/g, ""));
  if (!diceMatches.length) return { diceValue: "0", avgRoll: 0 };
  const diceValue = diceMatches[0];
  return { diceValue, avgRoll: normalizeNumber(diceValue) };
}

function inferEffects(text, diceValue) {
  const found = [];
  const lower = text.toLowerCase();
  for (const [effect, pattern] of effectKeywords) {
    if (found.length >= 3) break;
    if (pattern.test(text) && !found.includes(effect)) found.push(effect);
  }
  for (const type of damageTypes) {
    if (found.length >= 3) break;
    if (new RegExp(`\\b${type.toLowerCase()}\\b`).test(lower) && !found.includes(type)) found.push(type);
  }
  if (diceValue !== "0" && !found.includes("Combat") && !found.some((effect) => damageTypes.includes(effect))) found.push("Combat");
  const result = found.slice(0, 3);
  while (result.length < 3) result.push("None");
  return result;
}

function getLineValue(block, label) {
  const match = block.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() || "";
}

function splitHigherLevels(description) {
  const match = description.match(/\bAt Higher Levels?\.?\s*/i);
  if (!match) return { description: description.trim(), upcastText: "" };
  return {
    description: description.slice(0, match.index).trim(),
    upcastText: description.slice(match.index).trim(),
  };
}

function standardBlocks(text) {
  const lines = text.split(/\n/);
  const starts = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const previous = lines[index - 1].trim();
    const isHeader = /^(?:\d+(?:st|nd|rd|th)?[- ]*)?level\s+\w+|^\w+\s+cantrip|^cantrip\s+\w+|^\d+(?:st|nd|rd|th)?[- ]*level/i.test(line);
    const hasStats = lines.slice(index, index + 10).some((candidate) => /^Casting Time:/i.test(candidate.trim()));
    if (!isHeader || !previous || /^(?:Cantrips?|[1-9](?:st|nd|rd|th)? Level|Spell Descriptions|SP ELLS)$/i.test(previous)) continue;
    if (!hasStats) continue;
    if (!/^[A-Z0-9][A-Za-z0-9'’/ -]{1,80}$/.test(previous)) continue;
    starts.push({ line: index - 1, title: previous });
  }

  return starts.map((start, index) => {
    const next = starts[index + 1]?.line ?? lines.length;
    return { title: start.title, block: lines.slice(start.line, next).join("\n") };
  });
}

function forumBlocks(text) {
  const matches = [...text.matchAll(/^\s*(\d+)[.)]+\s*([^\n]*)$/gm)];
  const blocks = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index;
    const end = matches[index + 1]?.index ?? text.length;
    const title = titleCase(matches[index][2] || `Forum Spell ${matches[index][1]}`);
    const block = text.slice(start, end);
    if (title.length >= 2) blocks.push({ title, block });
  }

  // A few forum posts are unnumbered but still well structured.
  for (const unnumbered of ["The Long Goodbye"]) {
    const pos = text.indexOf(unnumbered);
    if (pos >= 0 && !blocks.some((block) => block.title === unnumbered)) {
      const end = matches.find((match) => match.index > pos)?.index ?? text.length;
      blocks.push({ title: unnumbered, block: text.slice(pos, end) });
    }
  }

  return blocks;
}

function spellFromBlock(entry, source) {
  const block = entry.block;
  const headerLine = block.split(/\n/).map((line) => line.trim()).find((line) =>
    /(?:cantrip|level).*(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)|(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation).*(cantrip|level)/i.test(line),
  ) || "";
  const levelLine = getLineValue(block, "Level") || headerLine;
  const components = parseComponents(getLineValue(block, "Components") || getLineValue(block, "Component"));
  const castingTime = getLineValue(block, "Casting Time");
  const duration = getLineValue(block, "Duration");
  const range = getLineValue(block, "Range");
  const classes = parseClasses(headerLine || levelLine);
  const dice = parseDice(block);
  const area = parseArea(block);
  const descriptionStart = block.search(/^You\b|^The\b|^A\b|^An\b|^As\b|^When\b|^For\b|^Choose\b/im);
  const rawDescription = descriptionStart >= 0
    ? block.slice(descriptionStart)
    : block.split(/\n/).filter((line) => !/^(Level|Components?|Casting Time|Range|Target|Area|Duration|Saving Throw|Spell Resistance):/i.test(line)).slice(2).join("\n");
  const split = splitHigherLevels(rawDescription);
  const name = titleCase(entry.title);

  const normalized = normalizeSpell({
    name,
    author: source.title,
    level: parseLevel(levelLine || headerLine),
    school: parseSchool(headerLine || block),
    classes: classes.length ? classes : ["Wizard"],
    effects: inferEffects(block, dice.diceValue),
    castingTime: parseCastingTime(castingTime),
    range: parseRange(range),
    duration: parseDuration(duration),
    area,
    concentration: /concentration/i.test(duration),
    ritual: /\britual\b/i.test(castingTime) || /\britual\b/i.test(block),
    damageSpell: dice.avgRoll > 0 || /\bdamage\b/i.test(block),
    ...components,
    attackSave: parseAttackSave(block),
    diceValue: dice.diceValue,
    avgRoll: dice.avgRoll,
    targets: parseTargets(block, area),
    upcastable: split.upcastText.length > 0,
    upcastText: split.upcastText,
    hasRestriction: /\bcan't\b|\bcannot\b|\bmust\b|\bonly\b|saving throw/i.test(block),
    restrictionText: "",
    description: split.description,
    version: "1.0.0",
    themes: [],
    emotionalTone: "Neutral",
    sourceType: "student",
    homebrew: {
      sourceId: source.id,
      sourceTitle: source.title,
      sourcePath: source.path,
      parser: source.parser,
    },
  }, { preserveDurationConcentration: true });

  const power = powerModel.calculate(normalized);
  const evaluation = evaluatePower(normalized.level, power);
  const deviation = getDeviation(normalized.level, power);
  const stability = getStability(normalized, power, deviation);
  return {
    ...normalized,
    homebrew: {
      ...normalized.homebrew,
      calculated: {
        modelId: powerModelId,
        modelLabel: powerModel.label,
        power,
        evaluation,
        deviation,
        stability,
        craftingDC: getSpellCraftingDC(normalized, stability, evaluation),
        bands: getPowerBands(normalized.level),
      },
    },
  };
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

await fs.mkdir(outputDir, { recursive: true });
for (const file of await fs.readdir(outputDir)) {
  if (file.endsWith(".json")) await fs.rm(path.join(outputDir, file));
}

const seen = new Map();
const imported = [];
const rejected = [];
for (const source of sources) {
  const text = await readSource(source);
  const blocks = source.parser === "forum" ? forumBlocks(text) : standardBlocks(text);
  let sourceCount = 0;
  for (const block of blocks) {
    try {
      const spell = spellFromBlock(block, source);
      if (!spell.name || spell.description.length < 30) {
        rejected.push({ source: source.id, name: block.title, reason: "missing name or short description" });
        continue;
      }
      const base = slugify(`${source.id}-${spell.name}`);
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      const filename = `${base}${count ? `-${count + 1}` : ""}.json`;
      await fs.writeFile(path.join(outputDir, filename), `${JSON.stringify(spell, null, 2)}\n`);
      imported.push({ source: source.id, name: spell.name, level: spell.level, file: `data/homebrew/${filename}`, evaluation: spell.homebrew.calculated.evaluation, power: spell.homebrew.calculated.power });
      sourceCount += 1;
    } catch (error) {
      rejected.push({ source: source.id, name: block.title, reason: error.message });
    }
  }
  console.log(`${source.title}: imported ${sourceCount} of ${blocks.length} detected blocks.`);
}

await fs.writeFile(path.join(outputDir, "_import-index.json"), `${JSON.stringify({ importedAt: new Date().toISOString(), powerModelId, imported, rejected }, null, 2)}\n`);
console.log(`Imported ${imported.length} homebrew spells to ${outputDir}.`);
console.log(`Rejected ${rejected.length} detected blocks. See data/homebrew/_import-index.json.`);
