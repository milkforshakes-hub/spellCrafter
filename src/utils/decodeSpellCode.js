import { codeMaps, reverseLookup } from "./spellCodeMaps.js";
import { DEFAULT_SPELL } from "./constants.js";
import { normalizeSpell } from "./normalizeSpell.js";

const META_SEPARATOR = "#!#";

function decodeBase64Unicode(value) {
  if (typeof Buffer !== "undefined") return Buffer.from(value, "base64").toString("utf8");
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function decodeSpellCode(spellCode) {
  if (!spellCode || typeof spellCode !== "string") return null;
  const [fields, metadataEncoded] = spellCode.trim().split(":");
  if (!fields || !metadataEncoded || fields.length < 42) return null;

  let metaParts = [];
  try {
    metaParts = decodeBase64Unicode(metadataEncoded).split(META_SEPARATOR);
  } catch (error) {
    return null;
  }

  const hasVersion = metaParts[0] === "SC1";
  const meta = hasVersion ? metaParts.slice(1) : metaParts;

  const decoded = {
    ...DEFAULT_SPELL,
    level: parseNumber(fields.slice(0, 1), DEFAULT_SPELL.level),
    school: reverseLookup(codeMaps.school, fields.slice(1, 3), DEFAULT_SPELL.school),
    effects: [
      reverseLookup(codeMaps.effect, fields.slice(3, 5), "None"),
      reverseLookup(codeMaps.effect, fields.slice(5, 7), "None"),
      reverseLookup(codeMaps.effect, fields.slice(7, 9), "None"),
    ],
    castingTime: reverseLookup(codeMaps.castingTime, fields.slice(9, 10), DEFAULT_SPELL.castingTime),
    range: reverseLookup(codeMaps.range, fields.slice(10, 12), DEFAULT_SPELL.range),
    duration: reverseLookup(codeMaps.duration, fields.slice(12, 13), DEFAULT_SPELL.duration),
    area: reverseLookup(codeMaps.area, fields.slice(13, 15), "None"),
    ritual: fields[15] === "1",
    concentration: fields[16] === "1",
    upcastable: fields[17] === "1",
    verbal: fields[18] === "V",
    somatic: fields[19] === "S",
    material: fields[20] === "M",
    materialCost: parseNumber(fields.slice(21, 25), 0),
    materialType: reverseLookup(codeMaps.materialType, fields.slice(25, 27), "None"),
    attackSave: reverseLookup(codeMaps.attackSave, fields.slice(27, 28), "None"),
    damageSpell: fields[28] === "1",
    avgRoll: parseNumber(fields.slice(29, 32), 0),
    targets: fields.slice(32, 34) === "-1" ? -1 : parseNumber(fields.slice(32, 34), 0),
    hasRestriction: fields[34] === "1",
    stability: parseNumber(fields.slice(35, 37), 0) / 100,
    craftingDC: parseNumber(fields.slice(37, 39), 0),
    power: parseNumber(fields.slice(39, 42), 0),
    name: meta[0] || DEFAULT_SPELL.name,
    author: meta[1] || DEFAULT_SPELL.author,
    materialText: meta[2] || "",
    restrictionText: meta[3] || "",
    description: meta[4] || "",
    classes: meta[5] ? meta[5].split(",").filter(Boolean) : ["Wizard"],
    upcastText: meta[6] || "",
    themes: meta[7] ? meta[7].split(",").filter(Boolean) : [],
    emotionalTone: meta[8] || "None",
    sourceType: meta[9] || "student",
    version: meta[10] || "1.0.0",
  };

  return normalizeSpell(decoded, { preserveDurationConcentration: true });
}
