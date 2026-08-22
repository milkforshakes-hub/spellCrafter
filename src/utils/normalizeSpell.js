// File: src/utils/normalizeSpell.js

import {
    SPELL_SCHOOLS,
    CASTING_TIMES,
    RANGES,
    DURATIONS,
    AREAS,
    EFFECT_OPTIONS,
    ATTACK_SAVE_TYPES,
    MATERIAL_TYPES,
  } from "./constants";
  
  function closestMatch(value, options) {
    if (!value || typeof value !== "string") return options[0];
    const match = options.find(opt => value.toLowerCase().includes(opt.toLowerCase()));
    return match || options[0];
  }
  
  export function normalizeSpell(spell) {
    return {
      ...spell,
      school: closestMatch(spell.school, SPELL_SCHOOLS),
      castingTime: closestMatch(spell.castingTime, CASTING_TIMES),
      range: normalizeRange(spell.range),
      duration: normalizeDuration(spell.duration),
      concentration: spell.duration?.toLowerCase().includes("concentration") || false,
      area: normalizeArea(spell.area),
      attackSave: normalizeAttackSave(spell.attackSave),
      materialType: normalizeMaterialType(spell.materialType, spell.materialCost),
      effects: normalizeEffects(spell.effects),
      avgRoll: normalizeNumber(spell.avgRoll),
      materialCost: normalizeMaterialCost(spell.materialCost),
      targets: normalizeTargets(spell.targets),
      damageSpell: normalizeDamageFlag(spell),
      classes: Array.isArray(spell.classes) && spell.classes.length ? spell.classes : ["Wizard"],
    };
  }

  function normalizeEffects(rawEffects) {
 
    const effectMap = [
        { keywords: ["poison", "toxic"], tag: "Poison" },
        { keywords: ["thunder", "boom"], tag: "Thunder" },
        { keywords: ["psychic", "mind"], tag: "Psychic" },
        { keywords: ["radiant", "light", "holy", "radient"], tag: "Radiant" },
        { keywords: ["bludgeoning", "smash"], tag: "Bludgeoning" },
        { keywords: ["fire", "flame", "burn"], tag: "Fire" },
        { keywords: ["force", "push"], tag: "Force" },
        { keywords: ["acid", "corrode"], tag: "Acid" },
        { keywords: ["necrotic", "undeath"], tag: "Necrotic" },
        { keywords: ["cold", "freeze", "ice"], tag: "Cold" },
        { keywords: ["lightning", "shock"], tag: "Lightning" },
        { keywords: ["piercing", "stab"], tag: "Piercing" },
        { keywords: ["slashing", "cut"], tag: "Slashing" },
      { keywords: ["combat", "damage", "deals", "harm"], tag: "Combat" },
      { keywords: ["control", "restrict", "inhibit", "suppress", "disorient", "impede"], tag: "Control" },
      { keywords: ["utility", "useful", "tool", "detect", "reveal", "scan", "highlight", "see"], tag: "Utility" },
      { keywords: ["creation", "create", "conjure", "manifest", "generate"], tag: "Creation" },
      { keywords: ["weaken", "debuff", "reduce", "penalty", "confusion", "disadvantage"], tag: "Debuff" },
      { keywords: ["buff", "enhance", "bonus", "advantage", "extra action", "increases speed"], tag: "Buff" },
      { keywords: ["communication", "talk", "speak", "communicate", "voice", "whispers"], tag: "Communication" },
      { keywords: ["healing", "heal", "restores", "regenerate", "mend"], tag: "Healing" },
      { keywords: ["foreknowledge", "know", "divine", "foretell", "future", "past", "read"], tag: "Foreknowledge" },
      { keywords: ["detection", "detect", "sense", "track", "locate"], tag: "Detection" },
      { keywords: ["charmed", "charm", "friendly"], tag: "Charmed" },
      { keywords: ["frightened", "frighten", "fear", "terrify"], tag: "Frightened" },
      { keywords: ["blind", "blinded"], tag: "Blinded" },
      { keywords: ["prone", "knock down"], tag: "Prone" },
      { keywords: ["social", "emotional"], tag: "Social" },
      { keywords: ["shapechanging", "change form", "transform", "morph", "shapeshift"], tag: "Shapechanging" },
      { keywords: ["deception", "lie", "trick", "deceive", "fake", "illusion"], tag: "Deception" },
      { keywords: ["restrained", "restrain", "immobilize", "snare"], tag: "Restrained" },
      { keywords: ["movement", "move", "mobility", "teleport", "blink", "speed"], tag: "Movement" },
      { keywords: ["exploration", "explore", "travel", "navigate", "search"], tag: "Exploration" },
      { keywords: ["summoning", "summon", "conjure"], tag: "Summoning" },
      { keywords: ["warding", "protective", "protect", "shield", "ward", "defend"], tag: "Warding" },
      { keywords: ["unconscious", "sleep", "knock out", "faint"], tag: "Unconscious" },
      { keywords: ["dunamancy", "gravity", "echo", "time"], tag: "Dunamancy" },
      { keywords: ["invisible", "invisibility", "hidden", "stealth"], tag: "Invisible" },
      { keywords: ["teleport", "teleportation"], tag: "Teleportation" },
      { keywords: ["deafen", "mute", "deafened"], tag: "Deafened" },
      { keywords: ["banish", "dismiss", "banishment"], tag: "Banishment" },
      { keywords: ["negate", "cancel", "nullify", "negation"], tag: "Negation" },
      { keywords: ["environment", "weather", "storm", "natural", "darkness", "light", "terrain"], tag: "Environment" },
      { keywords: ["stun", "daze", "stunned"], tag: "Stunned" },
      { keywords: ["petrify", "stone", "petrified"], tag: "Petrified" },
      { keywords: ["paralyze", "paralyzed"], tag: "Paralyzed" },
    ];
  
    const found = new Set();
  // Handle string-based input (e.g., "Teleportation, Invisible, None")
  let sources = [];

  // Split string by commas and "and", including Oxford comma edge cases
  if (typeof rawEffects === "string") {
    sources = rawEffects.split(/\s*,\s*|\s+and\s+/i);
  } else if (Array.isArray(rawEffects)) {
    sources = rawEffects;
  } else {
    sources = ["None"];
  }

  for (const raw of sources) {
    const lower = (raw || "").toLowerCase();
    for (const { keywords, tag } of effectMap) {
      if (keywords.some(k => lower.includes(k))) {
        found.add(tag);
        break;
      }
    }
  }

  const result = Array.from(found).slice(0, 3);
  while (result.length < 3) result.push("None");
  return result;
}
  
  
  function normalizeRange(value) {
    if (!value || typeof value !== "string") return RANGES[0];
  
    // ✅ Early manual alias map
    const aliasMap = {
      "5 feet": "5 ft",
      "10 feet": "10 ft",
      "15 feet": "15 ft",
      "20 feet": "20 ft",
      "30 feet": "30 ft",
      "40 feet": "40 ft",
      "60 feet": "60 ft",
      "90 feet": "90 ft",
      "100 feet": "100 ft",
      "120 feet": "120 ft",
      "150 feet": "150 ft",
      "200 feet": "200 ft",
      "300 feet": "300 ft",
      "500 feet": "500 ft",
      "1000 feet": "1000 ft",
    };
  
    const lower = value.toLowerCase();
    for (let key in aliasMap) {
      if (lower.includes(key)) {
        return aliasMap[key];
      }
    }
  
    // ✅ Exact match fallback
    const exact = RANGES.find(r => r.toLowerCase() === lower);
    if (exact) return exact;
  
    // ✅ Extract number and find closest numeric match
    const numberMatch = lower.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
  
      const numericRanges = RANGES.map(r => {
        const match = r.match(/(\d+)/);
        return match ? { label: r, value: parseInt(match[1]) } : null;
      }).filter(Boolean);
  
      let closest = numericRanges[0];
      for (let r of numericRanges) {
        if (Math.abs(r.value - num) < Math.abs(closest.value - num)) {
          closest = r;
        }
      }
  
      return closest.label;
    }
  
    // ✅ Fallback to closest textual match
    return closestMatch(value, RANGES);
  }
  
  function normalizeDuration(value) {
    if (!value || typeof value !== "string") return DURATIONS[0];
    const lower = value.toLowerCase();
  
    for (let d of DURATIONS) {
      if (lower.includes(d.toLowerCase())) return d;
    }
  
    return DURATIONS[0];
  }
  

  function normalizeArea(value) {
    if (!value || typeof value !== "string") return "None";
  
    const lower = value.toLowerCase();
  
    // Try to find a number (radius/diameter/size/etc.)
    const numMatch = lower.match(/(\d+)/);
    const size = numMatch ? parseInt(numMatch[1]) : null;
  
    // Shape keywords mapped to preferred shape name
    const shapeAliases = {
      "radius": "sphere",
      "circle": "sphere",
      "sphere": "sphere",
      "cone": "cone",
      "cube": "cube",
      "cylinder": "cylinder",
      "line": "line",
      "square": "square"
    };
  
    let detectedShape = null;
    for (const [keyword, shape] of Object.entries(shapeAliases)) {
      if (lower.includes(keyword)) {
        detectedShape = shape;
        break;
      }
    }
  
    // Build normalized name
    if (detectedShape && size) {
      const normalized = `${capitalize(detectedShape)} ${size} ft`;
      const match = AREAS.find(a => a.toLowerCase() === normalized.toLowerCase());
      if (match) return match;
    }
  
    // Try fallback fuzzy match
    const fallback = AREAS.find(a => lower.includes(a.toLowerCase()));
    if (fallback) return fallback;
  
    return "None";
  }
  
  
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  

  function normalizeAttackSave(value) {
    const map = {
      "strength": "STR Save",
      "dexterity": "DEX Save",
      "constitution": "CON Save",
      "intelligence": "INT Save",
      "wisdom": "WIS Save",
      "charisma": "CHA Save",
      "melee": "Melee Attack",
      "ranged": "Ranged Attack",
      "none": "None",
    };
    if (!value) return "None";
    const lower = value.toLowerCase();
    for (let key in map) {
      if (lower.includes(key)) return map[key];
    }
    return "None";
  }
  
  function normalizeMaterialType(value, cost) {
    // Default to "Trivial" if unknown
    let type = MATERIAL_TYPES.includes(value) ? value : MATERIAL_TYPES[0];
  
    // If cost is over 4gp, force it to "Costed" at minimum
    if (normalizeNumber(cost) > 4 && type === "Trivial") {
      type = "Costed";
    }
  
    return type;
  }
  
  
  export function normalizeNumber(value) {
    if (value === null || value === undefined || value === "-" || value === "") return 0;
  
    if (typeof value === "number") return value;
  
    const str = value.toString().trim().toLowerCase();
    const validDice = [2, 4, 6, 8, 10, 12, 20, 100];
  
    // Match terms like 2d6, d8, or +6
    const terms = str.split(/[\+\s]+/).filter(Boolean);
  
    let total = 0;
  
    for (const term of terms) {
      const diceMatch = term.match(/^(\d*)d(\d+)$/);
      if (diceMatch) {
        const count = parseInt(diceMatch[1] || "1", 10); // support 'd6' as '1d6'
        const die = parseInt(diceMatch[2], 10);
        if (!validDice.includes(die)) continue; // skip invalid die types
        const avg = ((die / 2) + 1) * count;
        total += avg;
      } else {
        const flat = parseFloat(term);
        if (!isNaN(flat)) total += flat;
      }
    }
  
    // Fallback if nothing matched
    if (total === 0) {
      const fallback = parseFloat(str);
      return isNaN(fallback) ? 0 : fallback;
    }
  
    return Math.round(total);
  }
  
  
  
  
  function normalizeMaterialCost(value) {
    if (typeof value === "boolean") return 0;
    return normalizeNumber(value);
  }
  
  function normalizeTargets(value) {
    if (!value) return 0;
    const str = value.toString().toLowerCase().trim();
  
    // If it mentions "all", "every", "within", "range", or "area", set to -1 (AOE)
    const aoeIndicators = ["all", "every", "within", "range", "area"];
    if (aoeIndicators.some(word => str.includes(word))) return -1;
  
    // If it mentions single target / one creature, set to 1
    const singleIndicators = ["single", "one", "a humanoid", "a creature"];
    if (singleIndicators.some(word => str.includes(word))) return 1;
  
    // Try to extract a number
    const num = parseInt(str);
    return isNaN(num) ? 0 : num;
  }
  
  function normalizeDamageFlag(spell) {
    const { avgRoll, effects, description } = spell;
  
    // Heuristic 1: If avgRoll is non-zero, it's likely a damage spell
    if (normalizeNumber(avgRoll) > 0) return true;
  
    // Heuristic 2: If effects include known damage types
    const damageKeywords = [
      "fire", "cold", "lightning", "acid", "force", "necrotic", "radiant", "psychic",
      "poison", "bludgeoning", "piercing", "slashing", "thunder"
    ];
  
    const effectsText = Array.isArray(effects) ? effects.join(" ").toLowerCase() : "";
    if (damageKeywords.some(type => effectsText.includes(type))) return true;
  
    // Heuristic 3: If the description says "deal(s)" or "takes X damage"
    const desc = description?.toLowerCase() || "";
    if (desc.includes("deal") || desc.includes("takes") && desc.includes("damage")) return true;
  
    return false;
  }
  