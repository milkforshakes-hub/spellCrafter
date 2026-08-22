import { getPowerBands } from "./powerBands.js";

const SCHOOL_STABILITY_MODS = {
  Abjuration: 5,
  Conjuration: -5,
  Divination: 0,
  Enchantment: -3,
  Evocation: -2,
  Illusion: -6,
  Necromancy: -4,
  Transmutation: -1,
  Dunamancy: -5,
};

const SCHOOL_DC_MODS = {
  Abjuration: -1,
  Conjuration: 1,
  Divination: 2,
  Enchantment: 1,
  Evocation: 0,
  Illusion: 2,
  Necromancy: 1,
  Transmutation: 0,
  Dunamancy: 2,
};

const FULL_CASTERS = new Set(["Wizard", "Cleric", "Druid", "Sorcerer", "Warlock", "Bard"]);
const HALF_CASTERS = new Set(["Paladin", "Ranger", "Artificer"]);

export function formatDeviationAsPercent(deviation) {
  return `${Math.round((Number(deviation) || 0) * 100)}%`;
}

export function formatStabilityAsPercent(stability) {
  return `${Math.round((Number(stability) || 0) * 100)}%`;
}

export function getDeviation(level, power) {
  const numericPower = Number(power);
  if (!Number.isFinite(numericPower)) return 0;
  const { avgDown, avgUp } = getPowerBands(level);
  const midpoint = (avgDown + avgUp) / 2;
  const rawDeviation = (numericPower - midpoint) / Math.max(1, avgUp - avgDown);
  let deviation = 0;
  if (rawDeviation < -0.5) deviation = rawDeviation + 0.5;
  if (rawDeviation > 0.5) deviation = rawDeviation - 0.5;
  return Math.round(deviation * 100) / 100;
}

function casterCounts(classes = ["Wizard"]) {
  const list = Array.isArray(classes) && classes.length > 0 ? classes : ["Wizard"];
  return {
    fullCount: list.filter((cls) => FULL_CASTERS.has(cls)).length,
    halfCount: list.filter((cls) => HALF_CASTERS.has(cls)).length,
    total: list.length,
  };
}

export function getStability(spell, power, deviation) {
  const level = Math.max(0, Number(spell.level) || 0);
  const [e1 = "None", e2 = "None", e3 = "None"] = (spell.effects || []).map((effect) => effect || "None");
  const { fullCount, halfCount } = casterCounts(spell.classes);
  const { avgDown, avgUp } = getPowerBands(level);
  const avgPowerMid = Math.max(1, (avgDown + avgUp) / 2);

  let stability = 100;
  if (e1 !== "None" && e2 !== "None") stability -= 5;
  if (e3 !== "None") stability -= 5;
  if (spell.upcastable) stability -= 6;
  if (spell.area !== "None") stability -= 5;
  if (!spell.concentration) stability -= 4;
  if (spell.damageSpell) stability -= 5;
  if ((Number(spell.materialCost) || 0) > 25) stability -= 5;
  if ((Number(spell.avgRoll) || 0) > 0) stability -= 5;
  if (level > 5) stability -= 5;
  if ([e1, e2, e3].includes("Control")) stability -= 5;

  stability += SCHOOL_STABILITY_MODS[spell.school] || 0;
  stability -= level / avgPowerMid;
  stability -= (Number(deviation) || 0) * 25;
  stability -= fullCount * fullCount + fullCount + (halfCount * halfCount - halfCount);

  return Math.max(10, Math.min(99, Math.round(stability))) / 100;
}

export function getSpellCraftingDC(spell, stability, band) {
  const level = Math.max(0, Number(spell.level) || 0);
  const { total } = casterCounts(spell.classes);
  const [e1 = "None", e2 = "None", e3 = "None"] = spell.effects || [];

  let dc = 10 + level / 2;
  const bandModifiers = {
    Underpowered: -2,
    "Low Power": 0,
    "Mid Power": 2,
    "High Power": 3,
    Overpowered: 6,
  };

  dc += bandModifiers[band] ?? 0;
  if (!["None", ""].includes(e2)) dc += 2;
  if (!["None", ""].includes(e3)) dc += 2;
  if (spell.area !== "None") dc += 1;
  if (spell.upcastable) dc += 1;
  if (spell.hasRestriction) dc -= 1;
  if (spell.concentration) dc -= 1;
  if ((Number(spell.targets) || 0) > 1 || (Number(spell.targets) || 0) < 0) dc += 1;
  if (spell.materialType === "Consumed" || (Number(spell.materialCost) || 0) >= 50) dc -= 3;
  if ((Number(spell.avgRoll) || 0) > 10) dc += 1;
  if (spell.ritual) dc -= 1;
  dc += SCHOOL_DC_MODS[spell.school] || 0;
  dc += Math.max(0, total - 1);

  const scale = (1 + (1 - (Number(stability) || 0))) * 0.85;
  return Math.round(Math.max(8, dc * scale));
}
