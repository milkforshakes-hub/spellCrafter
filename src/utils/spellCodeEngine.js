import { codeMaps } from "./spellCodeMaps.js";

const FIELD_WIDTH = 42;
const META_SEPARATOR = "#!#";
const VERSION = "SC1";

function pad(value, length) {
  const numeric = Math.max(0, Math.min(Number(value) || 0, Number("9".repeat(length))));
  return String(Math.round(numeric)).padStart(length, "0");
}

function encodeBase64Unicode(value) {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64");
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function safeLookup(map, key, fallback) {
  return map[key] || fallback;
}

export function encodeSpellToSpellCode(spell, stability, power, craftingDC) {
  const effects = Array.isArray(spell.effects) ? spell.effects.slice(0, 3) : ["None", "None", "None"];
  while (effects.length < 3) effects.push("None");

  const encoded =
    String(Math.max(0, Math.min(9, Number(spell.level) || 0))) +
    safeLookup(codeMaps.school, spell.school, codeMaps.school.Abjuration) +
    effects.map((effect) => safeLookup(codeMaps.effect, effect, codeMaps.effect.None)).join("") +
    safeLookup(codeMaps.castingTime, spell.castingTime, codeMaps.castingTime["1 Action"]) +
    safeLookup(codeMaps.range, spell.range, codeMaps.range["30 ft"]) +
    safeLookup(codeMaps.duration, spell.duration, codeMaps.duration.Instantaneous) +
    safeLookup(codeMaps.area, spell.area, codeMaps.area.None) +
    (spell.ritual ? "1" : "0") +
    (spell.concentration ? "1" : "0") +
    (spell.upcastable ? "1" : "0") +
    (spell.verbal ? "V" : "N") +
    (spell.somatic ? "S" : "N") +
    (spell.material ? "M" : "N") +
    pad(spell.materialCost, 4) +
    safeLookup(codeMaps.materialType, spell.materialType, codeMaps.materialType.None) +
    safeLookup(codeMaps.attackSave, spell.attackSave, codeMaps.attackSave.None) +
    (spell.damageSpell ? "1" : "0") +
    pad(spell.avgRoll, 3) +
    (Number(spell.targets) < 0 ? "-1" : pad(spell.targets, 2)) +
    (spell.hasRestriction ? "1" : "0") +
    pad((Number(stability) || 0) * 100, 2) +
    pad(craftingDC, 2) +
    pad(power, 3);

  if (encoded.length !== FIELD_WIDTH) {
    throw new Error(`SpellCode field length mismatch. Expected ${FIELD_WIDTH}, received ${encoded.length}.`);
  }

  const metadata = [
    VERSION,
    spell.name || "Untitled Spell",
    spell.author || "Unknown",
    spell.materialText || "",
    spell.restrictionText || "",
    spell.description || "",
    Array.isArray(spell.classes) ? spell.classes.join(",") : "Wizard",
    spell.upcastText || "",
    Array.isArray(spell.themes) ? spell.themes.join(",") : "",
    spell.emotionalTone || "None",
    spell.sourceType || "student",
    spell.version || "1.0.0",
  ].join(META_SEPARATOR);

  return `${encoded}:${encodeBase64Unicode(metadata)}`;
}
