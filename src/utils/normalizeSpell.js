import {
  AREAS,
  ATTACK_SAVE_TYPES,
  CASTING_TIMES,
  CLASS_OPTIONS,
  DAMAGE_EFFECTS,
  DEFAULT_SPELL,
  DURATIONS,
  EFFECT_OPTIONS,
  EMOTIONAL_TONES,
  MATERIAL_TYPES,
  RANGES,
  SOURCE_TYPES,
  SPELL_SCHOOLS,
  THEME_OPTIONS,
} from "./constants.js";

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function closestMatch(value, options, fallback = options[0]) {
  const lower = normalizeToken(value);
  if (!lower) return fallback;
  const exact = options.find((option) => normalizeToken(option) === lower);
  if (exact) return exact;
  const includes = options.find((option) => lower.includes(normalizeToken(option)) || normalizeToken(option).includes(lower));
  return includes || fallback;
}

function uniqueKnownList(values, options, fallback = []) {
  const rawList = Array.isArray(values) ? values : String(values || "").split(/,|\band\b/i);
  const selected = [];
  rawList.forEach((value) => {
    const match = closestMatch(value, options, null);
    if (match && !selected.includes(match)) selected.push(match);
  });
  return selected.length ? selected : fallback;
}

export function normalizeNumber(value) {
  if (value === null || value === undefined || value === "-" || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const str = String(value).trim().toLowerCase();
  const validDice = [2, 4, 6, 8, 10, 12, 20, 100];
  const terms = str.split(/[+\s]+/).filter(Boolean);
  let total = 0;
  let matched = false;

  terms.forEach((term) => {
    const diceMatch = term.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const count = Number.parseInt(diceMatch[1] || "1", 10);
      const die = Number.parseInt(diceMatch[2], 10);
      if (validDice.includes(die)) {
        total += ((die / 2) + 0.5) * count;
        matched = true;
      }
      return;
    }

    const flat = Number.parseFloat(term.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(flat)) {
      total += flat;
      matched = true;
    }
  });

  if (matched) return Math.max(0, Math.round(total));
  const fallback = Number.parseFloat(str.replace(/[^\d.-]/g, ""));
  return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : 0;
}

function normalizeEffects(rawEffects) {
  const effectMap = [
    { keywords: ["poison", "toxic"], tag: "Poison" },
    { keywords: ["thunder", "boom", "sonic"], tag: "Thunder" },
    { keywords: ["psychic", "mind", "mental"], tag: "Psychic" },
    { keywords: ["radiant", "light", "holy", "radient"], tag: "Radiant" },
    { keywords: ["bludgeoning", "smash", "crush"], tag: "Bludgeoning" },
    { keywords: ["fire", "flame", "burn", "ignite"], tag: "Fire" },
    { keywords: ["force", "push", "kinetic"], tag: "Force" },
    { keywords: ["acid", "corrode", "caustic"], tag: "Acid" },
    { keywords: ["necrotic", "undeath", "wither"], tag: "Necrotic" },
    { keywords: ["cold", "freeze", "ice", "frost"], tag: "Cold" },
    { keywords: ["lightning", "shock", "electric"], tag: "Lightning" },
    { keywords: ["piercing", "stab", "needle"], tag: "Piercing" },
    { keywords: ["slashing", "cut", "blade"], tag: "Slashing" },
    { keywords: ["combat", "damage", "deals", "harm", "attack"], tag: "Combat" },
    { keywords: ["control", "restrict", "suppress", "impede"], tag: "Control" },
    { keywords: ["utility", "tool", "detect", "reveal", "highlight"], tag: "Utility" },
    { keywords: ["creation", "create", "manifest", "generate"], tag: "Creation" },
    { keywords: ["weaken", "debuff", "penalty", "disadvantage"], tag: "Debuff" },
    { keywords: ["buff", "enhance", "bonus", "advantage"], tag: "Buff" },
    { keywords: ["communication", "talk", "speak", "whisper"], tag: "Communication" },
    { keywords: ["healing", "heal", "restore", "mend"], tag: "Healing" },
    { keywords: ["foreknowledge", "future", "past", "divine"], tag: "Foreknowledge" },
    { keywords: ["detection", "sense", "track", "locate"], tag: "Detection" },
    { keywords: ["charmed", "charm", "friendly"], tag: "Charmed" },
    { keywords: ["frightened", "fear", "terrify"], tag: "Frightened" },
    { keywords: ["blind", "blinded"], tag: "Blinded" },
    { keywords: ["prone", "knock down"], tag: "Prone" },
    { keywords: ["social", "emotional"], tag: "Social" },
    { keywords: ["shapechanging", "transform", "shapeshift"], tag: "Shapechanging" },
    { keywords: ["deception", "trick", "illusion"], tag: "Deception" },
    { keywords: ["restrained", "snare", "immobilize"], tag: "Restrained" },
    { keywords: ["movement", "teleport", "speed"], tag: "Movement" },
    { keywords: ["exploration", "travel", "navigate"], tag: "Exploration" },
    { keywords: ["summoning", "summon"], tag: "Summoning" },
    { keywords: ["warding", "protect", "shield"], tag: "Warding" },
    { keywords: ["unconscious", "sleep", "faint"], tag: "Unconscious" },
    { keywords: ["dunamancy", "gravity", "echo", "time"], tag: "Dunamancy" },
    { keywords: ["invisible", "invisibility", "hidden", "stealth"], tag: "Invisible" },
    { keywords: ["banish", "dismiss"], tag: "Banishment" },
    { keywords: ["negate", "cancel", "nullify"], tag: "Negation" },
    { keywords: ["environment", "weather", "storm", "terrain"], tag: "Environment" },
    { keywords: ["stun", "daze"], tag: "Stunned" },
    { keywords: ["petrify", "stone"], tag: "Petrified" },
    { keywords: ["paralyze", "paralyzed"], tag: "Paralyzed" },
  ];

  const rawList = Array.isArray(rawEffects) ? rawEffects : String(rawEffects || "").split(/,|\band\b/i);
  const found = [];

  rawList.forEach((raw) => {
    const direct = closestMatch(raw, EFFECT_OPTIONS, null);
    if (direct && direct !== "None" && !found.includes(direct)) {
      found.push(direct);
      return;
    }

    const lower = normalizeToken(raw);
    const mapped = effectMap.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)));
    if (mapped && !found.includes(mapped.tag)) found.push(mapped.tag);
  });

  const result = found.slice(0, 3);
  while (result.length < 3) result.push("None");
  return result;
}

function normalizeRange(value) {
  const lower = normalizeToken(value);
  if (!lower) return DEFAULT_SPELL.range;
  const aliasMap = {
    "15ft": "15 ft",
    "self 15ft": "Self (15 ft)",
    "self 60 ft ": "Self (60 ft)",
    "unlimited range": "Unlimited",
  };
  if (aliasMap[lower]) return aliasMap[lower];
  const exact = RANGES.find((range) => normalizeToken(range) === lower);
  if (exact) return exact;
  const feetMatch = lower.match(/(\d+)\s*(feet|foot|ft)/);
  if (feetMatch) {
    const num = Number.parseInt(feetMatch[1], 10);
    const self = lower.includes("self");
    const target = self ? `Self (${num} ft)` : `${num} ft`;
    const match = RANGES.find((range) => normalizeToken(range) === normalizeToken(target));
    if (match) return match;
  }
  return closestMatch(value, RANGES, DEFAULT_SPELL.range);
}

function normalizeDuration(value, options = {}) {
  if (!value || typeof value !== "string") return DEFAULT_SPELL.duration;
  const lower = normalizeToken(value).replace(/^concentration,?\s*/, "");
  return closestMatch(lower, DURATIONS, DEFAULT_SPELL.duration);
}

function normalizeArea(value) {
  const lower = normalizeToken(value);
  if (!lower || lower === "none") return "None";
  const exact = AREAS.find((area) => normalizeToken(area) === lower);
  if (exact) return exact;

  const shapeAliases = {
    radius: "Sphere",
    circle: "Sphere",
    sphere: "Sphere",
    cone: "Cone",
    cube: "Cube",
    cylinder: "Cylinder",
    line: "Line",
    square: "Square",
  };
  const size = lower.match(/(\d[\d,]*)/)?.[1]?.replace(/,/g, "");
  const shape = Object.entries(shapeAliases).find(([keyword]) => lower.includes(keyword))?.[1];
  if (shape && size) {
    const normalized = `${shape} ${size} ft`;
    const match = AREAS.find((area) => normalizeToken(area) === normalizeToken(normalized));
    if (match) return match;
  }
  return closestMatch(value, AREAS, "None");
}

function normalizeAttackSave(value) {
  const lower = normalizeToken(value);
  const map = {
    strength: "STR Save",
    str: "STR Save",
    dexterity: "DEX Save",
    dex: "DEX Save",
    constitution: "CON Save",
    con: "CON Save",
    intelligence: "INT Save",
    int: "INT Save",
    wisdom: "WIS Save",
    wis: "WIS Save",
    charisma: "CHA Save",
    cha: "CHA Save",
    melee: "Melee Attack",
    ranged: "Ranged Attack",
    none: "None",
  };
  for (const [keyword, normalized] of Object.entries(map)) {
    if (lower.includes(keyword)) return normalized;
  }
  return closestMatch(value, ATTACK_SAVE_TYPES, "None");
}

function normalizeTargets(value) {
  if (value === -1) return -1;
  const str = normalizeToken(value);
  if (!str) return 0;
  const aoeIndicators = ["all", "every", "within", "area", "creatures in"];
  if (aoeIndicators.some((word) => str.includes(word))) return -1;
  const singleIndicators = ["single", "one", "a humanoid", "a creature", "target"];
  if (singleIndicators.some((word) => str.includes(word))) return 1;
  const numeric = Number.parseInt(str, 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeDamageFlag(spell, avgRoll, effects) {
  if (avgRoll > 0) return true;
  if (effects.some((effect) => DAMAGE_EFFECTS.includes(effect))) return true;
  const desc = normalizeToken(spell.description);
  return desc.includes("damage") || desc.includes("deal") || desc.includes("takes");
}

export function normalizeSpell(spell = {}, options = {}) {
  const source = { ...DEFAULT_SPELL, ...spell };
  const level = Math.max(0, Math.min(9, Number.parseInt(source.level, 10) || 0));
  const effects = normalizeEffects(source.effects);
  const avgRoll = source.diceValue ? normalizeNumber(source.diceValue) : normalizeNumber(source.avgRoll);
  const material = Boolean(source.material || normalizeNumber(source.materialCost) > 0 || source.materialText);
  const materialType = material ? closestMatch(source.materialType, MATERIAL_TYPES, "Trivial") : "None";
  const duration = normalizeDuration(source.duration, options);
  const durationText = normalizeToken(source.duration);
  const concentration = options.preserveDurationConcentration
    ? Boolean(source.concentration)
    : Boolean(source.concentration || durationText.includes("concentration"));

  return {
    ...source,
    name: source.name === undefined ? "Untitled Spell" : String(source.name),
    author: source.author === undefined ? "Unknown" : String(source.author),
    level,
    school: closestMatch(source.school, SPELL_SCHOOLS, DEFAULT_SPELL.school),
    classes: uniqueKnownList(source.classes, CLASS_OPTIONS, ["Wizard"]),
    effects,
    castingTime: closestMatch(source.castingTime, CASTING_TIMES, DEFAULT_SPELL.castingTime),
    range: normalizeRange(source.range),
    duration,
    area: normalizeArea(source.area),
    concentration,
    ritual: Boolean(source.ritual),
    damageSpell: Boolean(source.damageSpell || normalizeDamageFlag(source, avgRoll, effects)),
    verbal: Boolean(source.verbal),
    somatic: Boolean(source.somatic),
    material,
    materialText: source.materialText || "",
    materialType,
    materialCost: normalizeNumber(source.materialCost),
    attackSave: normalizeAttackSave(source.attackSave),
    diceValue: source.diceValue || (avgRoll ? String(avgRoll) : "0"),
    avgRoll,
    targets: normalizeTargets(source.targets),
    upcastable: Boolean(source.upcastable),
    upcastText: source.upcastText || "",
    hasRestriction: Boolean(source.hasRestriction || source.restrictionText),
    restrictionText: source.restrictionText || "",
    description: source.description || "",
    version: source.version || "1.0.0",
    themes: uniqueKnownList(source.themes, THEME_OPTIONS, []),
    emotionalTone: closestMatch(source.emotionalTone, EMOTIONAL_TONES, "None"),
    sourceType: closestMatch(source.sourceType, SOURCE_TYPES, "student"),
  };
}
