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
const outputDir = path.join(repoRoot, "data/generated");
const modelId = "official-outlier-aware-v1";
const model = getPowerModel(modelId);

const faculty = [
  { name: "Professor Elowen Wardglass", title: "Head Professor of Abjuration", school: "Abjuration", classes: ["Cleric", "Wizard"], motif: "warded glass", serious: "Aegis", flavorful: "Parlor Ward", damage: "Force" },
  { name: "Professor Bram Oathroot", title: "Head Professor of Conjuration", school: "Conjuration", classes: ["Druid", "Wizard"], motif: "summoning circles", serious: "Concord", flavorful: "Helpful Elsewhere", damage: "Acid" },
  { name: "Professor Selene Farclock", title: "Head Professor of Divination", school: "Divination", classes: ["Cleric", "Wizard"], motif: "silver clocks", serious: "Oracle", flavorful: "Minor Omen", damage: "Psychic" },
  { name: "Professor Mirabel Vowmere", title: "Head Professor of Enchantment", school: "Enchantment", classes: ["Bard", "Wizard"], motif: "spoken vows", serious: "Accord", flavorful: "Social Lubricant", damage: "Psychic" },
  { name: "Professor Kael Cindersong", title: "Head Professor of Evocation", school: "Evocation", classes: ["Sorcerer", "Wizard"], motif: "controlled flame", serious: "Lance", flavorful: "Dramatic Spark", damage: "Fire" },
  { name: "Professor Nyx Veilwright", title: "Head Professor of Illusion", school: "Illusion", classes: ["Bard", "Warlock", "Wizard"], motif: "living shadow", serious: "Veil", flavorful: "Stage Trick", damage: "Psychic" },
  { name: "Professor Ossian Gravebloom", title: "Head Professor of Necromancy", school: "Necromancy", classes: ["Cleric", "Warlock", "Wizard"], motif: "bone flowers", serious: "Thanatic", flavorful: "Polite Haunting", damage: "Necrotic" },
  { name: "Professor Tamsin Quickforge", title: "Head Professor of Transmutation", school: "Transmutation", classes: ["Artificer", "Druid", "Wizard"], motif: "mercurial tools", serious: "Mutable", flavorful: "Campus Convenience", damage: "Bludgeoning" },
  { name: "Dean Aster Vellum-Null", title: "Dean of Dunamancy", school: "Dunamancy", classes: ["Wizard"], motif: "folded time", serious: "Chronal", flavorful: "Improbable Office Hour", damage: "Force" },
];

const seriousEffects = {
  Abjuration: ["Warding", "Buff", "None"],
  Conjuration: ["Summoning", "Creation", "None"],
  Divination: ["Detection", "Foreknowledge", "None"],
  Enchantment: ["Charmed", "Control", "None"],
  Evocation: ["Combat", "Force", "None"],
  Illusion: ["Deception", "Invisible", "None"],
  Necromancy: ["Necrotic", "Debuff", "None"],
  Transmutation: ["Shapechanging", "Buff", "None"],
  Dunamancy: ["Dunamancy", "Control", "None"],
};

const flavorfulEffects = {
  Abjuration: ["Warding", "Utility", "None"],
  Conjuration: ["Creation", "Utility", "None"],
  Divination: ["Foreknowledge", "Social", "None"],
  Enchantment: ["Social", "Charmed", "None"],
  Evocation: ["Fire", "Utility", "None"],
  Illusion: ["Deception", "Social", "None"],
  Necromancy: ["Communication", "Necrotic", "None"],
  Transmutation: ["Utility", "Movement", "None"],
  Dunamancy: ["Dunamancy", "Utility", "None"],
};

const levelProfiles = [
  { level: 0, range: "60 ft", duration: "Instantaneous", seriousDice: "1d8", flavorDice: "0", targets: 1 },
  { level: 1, range: "60 ft", duration: "1 Minute", seriousDice: "2d6", flavorDice: "0", targets: 1 },
  { level: 2, range: "90 ft", duration: "10 Minutes", seriousDice: "3d6", flavorDice: "1d6", targets: 1 },
  { level: 3, range: "120 ft", duration: "1 Minute", seriousDice: "5d6", flavorDice: "2d6", targets: -1 },
  { level: 4, range: "120 ft", duration: "10 Minutes", seriousDice: "6d8", flavorDice: "3d6", targets: -1 },
  { level: 5, range: "150 ft", duration: "1 Hour", seriousDice: "8d8", flavorDice: "4d6", targets: -1 },
  { level: 6, range: "300 ft", duration: "1 Hour", seriousDice: "10d8", flavorDice: "5d6", targets: -1 },
  { level: 7, range: "500 ft", duration: "8 Hours", seriousDice: "11d10", flavorDice: "6d6", targets: -1 },
  { level: 8, range: "Sight", duration: "24 Hours", seriousDice: "12d10", flavorDice: "7d6", targets: -1 },
  { level: 9, range: "1 mile", duration: "Until Dispelled", seriousDice: "14d10", flavorDice: "8d6", targets: -1 },
];

const areasByLevel = ["None", "None", "None", "Sphere 10 ft", "Sphere 20 ft", "Sphere 30 ft", "Cube 40 ft", "Sphere 40 ft", "Sphere 60 ft", "Cube 100 ft"];

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

function averageDice(dice) {
  if (dice === "0") return 0;
  const match = dice.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!match) return 0;
  return Math.round(Number(match[1]) * (Number(match[2]) / 2 + 0.5) + Number(match[3] || 0));
}

function attackSaveFor(facultyMember, flavorful) {
  if (flavorful) return ["Divination", "Conjuration", "Transmutation"].includes(facultyMember.school) ? "None" : "WIS Save";
  if (facultyMember.school === "Evocation") return "DEX Save";
  if (facultyMember.school === "Necromancy") return "CON Save";
  if (facultyMember.school === "Transmutation") return "STR Save";
  if (facultyMember.school === "Dunamancy") return "WIS Save";
  return "None";
}

function ordinal(level) {
  const special = { 1: "1st", 2: "2nd", 3: "3rd" };
  return special[level] || `${level}th`;
}

function makeSpell(facultyMember, profile, flavorful) {
  const tone = flavorful ? "flavorful" : "serious";
  const noun = flavorful ? facultyMember.flavorful : facultyMember.serious;
  const levelLabel = profile.level === 0 ? "Cantrip" : `Level ${profile.level}`;
  const name = `Thilmorn ${noun} ${levelLabel}`;
  const diceValue = flavorful ? profile.flavorDice : profile.seriousDice;
  const area = flavorful ? "None" : areasByLevel[profile.level];
  const damageSpell = diceValue !== "0" || facultyMember.school === "Evocation" || facultyMember.school === "Necromancy";
  const concentration = profile.level >= 2 && profile.duration !== "Instantaneous" && !flavorful;
  const material = profile.level >= 4 || flavorful;
  const classes = facultyMember.classes;

  const description = flavorful
    ? `A classroom-safe expression of ${facultyMember.motif} magic produces a memorable but useful effect. The spell can label, tidy, signal, amuse, or gently redirect a situation while teaching apprentices how ${facultyMember.school.toLowerCase()} changes ordinary academy life.`
    : `You invoke ${facultyMember.motif} through a formal Thilmorn Academy theorem. The spell asserts the principles of ${facultyMember.school.toLowerCase()} magic in the field, shaping a reliable combat or expedition effect suitable for advanced practical examinations.`;

  const upcastText = profile.level > 0 && profile.level < 9 && !flavorful
    ? `When cast using a spell slot of ${ordinal(profile.level + 1)} level or higher, increase the spell's primary effect by one die or expand its controlled area by one step for each slot level above ${ordinal(profile.level)}.`
    : "";

  return normalizeSpell({
    name,
    author: facultyMember.name,
    level: profile.level,
    school: facultyMember.school,
    classes,
    effects: flavorful ? flavorfulEffects[facultyMember.school] : seriousEffects[facultyMember.school],
    castingTime: flavorful ? "1 Action" : profile.level >= 7 ? "1 Minute" : "1 Action",
    range: flavorful ? "30 ft" : profile.range,
    duration: flavorful ? profile.level >= 5 ? "8 Hours" : "10 Minutes" : profile.duration,
    area,
    concentration,
    ritual: flavorful && profile.level > 0 && profile.level <= 5,
    damageSpell,
    verbal: true,
    somatic: !flavorful || profile.level % 2 === 0,
    material,
    materialText: material ? `a faculty token marked with ${facultyMember.motif}` : "",
    materialType: material ? "Trivial" : "None",
    materialCost: 0,
    attackSave: attackSaveFor(facultyMember, flavorful),
    diceValue,
    avgRoll: averageDice(diceValue),
    targets: area === "None" ? profile.targets === -1 ? 1 : profile.targets : -1,
    upcastable: upcastText.length > 0,
    upcastText,
    hasRestriction: flavorful || profile.level >= 6,
    restrictionText: flavorful ? "The spell fails if used to directly harm a creature." : profile.level >= 6 ? "The caster must be able to clearly perceive the spell's anchor point." : "",
    description,
    version: "1.0.0",
    themes: [facultyMember.school, flavorful ? "Academy Life" : "Advanced Praxis"],
    emotionalTone: flavorful ? "Playful" : "Focused",
    sourceType: "student",
    generated: {
      generator: "thilmorn-faculty-corpus-v1",
      faculty: facultyMember.name,
      facultyTitle: facultyMember.title,
      tone,
      generatedAt: new Date().toISOString(),
    },
  }, { preserveDurationConcentration: true });
}

function scoreSpell(spell) {
  const power = model.calculate(spell);
  const evaluation = evaluatePower(spell.level, power);
  const deviation = getDeviation(spell.level, power);
  const stability = getStability(spell, power, deviation);
  return {
    ...spell,
    generated: {
      ...spell.generated,
      modelId,
      modelLabel: model.label,
      calculated: {
        power,
        evaluation,
        deviation,
        stability,
        craftingDC: getSpellCraftingDC(spell, stability, evaluation),
        bands: getPowerBands(spell.level),
      },
    },
  };
}

await fs.mkdir(outputDir, { recursive: true });
for (const file of await fs.readdir(outputDir)) {
  if (file.endsWith(".json")) await fs.rm(path.join(outputDir, file));
}

const spells = [];
for (const facultyMember of faculty) {
  for (const profile of levelProfiles) {
    spells.push(scoreSpell(makeSpell(facultyMember, profile, false)));
    spells.push(scoreSpell(makeSpell(facultyMember, profile, true)));
  }
}

const index = [];
for (const spell of spells) {
  const filename = `${slugify(spell.generated.faculty)}-${String(spell.level).padStart(2, "0")}-${slugify(spell.name)}.json`;
  await fs.writeFile(path.join(outputDir, filename), `${JSON.stringify(spell, null, 2)}\n`);
  index.push({
    name: spell.name,
    faculty: spell.generated.faculty,
    tone: spell.generated.tone,
    level: spell.level,
    school: spell.school,
    power: spell.generated.calculated.power,
    evaluation: spell.generated.calculated.evaluation,
    file: `data/generated/${filename}`,
  });
}

await fs.writeFile(path.join(outputDir, "_thilmorn-index.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), modelId, count: spells.length, index }, null, 2)}\n`);

console.log(`Generated ${spells.length} Thilmorn Academy faculty spells in ${outputDir}.`);
