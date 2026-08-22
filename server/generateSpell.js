const schools = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation", "Dunamancy"];
const classes = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const damageTypes = ["Fire", "Cold", "Lightning", "Radiant", "Necrotic", "Force", "Acid", "Thunder", "Psychic"];
const ranges = ["Touch", "Self", "30 ft", "60 ft", "90 ft", "120 ft", "300 ft", "Sight"];
const durations = ["Instantaneous", "1 Round", "1 Minute", "10 Minutes", "1 Hour", "8 Hours", "Until Dispelled"];
const areas = ["None", "Line 30 ft", "Sphere 10 ft", "Sphere 20 ft", "Cone 15 ft", "Cone 30 ft", "Cube 10 ft", "Cylinder 20 ft"];
const attackSaves = ["None", "Melee Attack", "Ranged Attack", "DEX Save", "CON Save", "WIS Save", "INT Save", "CHA Save", "STR Save"];
const themes = ["Light", "Darkness", "Time", "Dreams", "Elements", "Nature", "Memory", "Protection", "Trickery", "Void", "Spirit", "Travel", "Transformation", "Binding", "Wild"];

function mulberry32(seed) {
  let t = seed || Date.now();
  return function random() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function pickSome(random, list, count) {
  const copy = [...list];
  const output = [];
  while (copy.length && output.length < count) {
    output.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return output;
}

function diceFor(level, damageSpell) {
  if (!damageSpell) return "0";
  if (level === 0) return "1d8";
  if (level <= 2) return "2d6";
  if (level <= 4) return "4d6";
  if (level <= 6) return "6d8";
  return "8d10";
}

const archetypes = [
  {
    id: "damage",
    effects: (random) => [pick(random, damageTypes), "Combat", "None"],
    duration: () => "Instantaneous",
    area: (random) => pick(random, ["None", "Line 30 ft", "Sphere 10 ft", "Cone 15 ft", "Cone 30 ft"]),
    damageSpell: true,
    attackSave: (random) => pick(random, ["Ranged Attack", "DEX Save", "CON Save", "WIS Save"]),
    targets: (area) => area === "None" ? 1 : -1,
    description: (themes, classes, damageType) => `You shape ${themes.map((theme) => theme.toLowerCase()).join(" and ")} into a focused ${damageType.toLowerCase()} spellform. The magic strikes a target or bursts through a defined area, leaving a clean tactical opening for ${classes.join(" or ")} casters.`,
  },
  {
    id: "control",
    effects: (random) => ["Control", pick(random, ["Restrained", "Frightened", "Prone", "Debuff"]), "None"],
    duration: (random) => pick(random, ["1 Round", "1 Minute", "10 Minutes"]),
    area: (random) => pick(random, ["None", "Sphere 10 ft", "Cube 10 ft"]),
    damageSpell: false,
    attackSave: (random) => pick(random, ["STR Save", "DEX Save", "WIS Save", "CHA Save"]),
    targets: (area) => area === "None" ? 1 : -1,
    description: (themes, classes) => `You bind ${themes.map((theme) => theme.toLowerCase()).join(" and ")} into a limiting enchantment. Affected creatures must resist the spell or have their movement, judgment, or timing disrupted until the magic fades.`,
  },
  {
    id: "support",
    effects: (random) => [pick(random, ["Buff", "Warding", "Healing"]), pick(random, ["Utility", "Movement", "Detection"]), "None"],
    duration: (random) => pick(random, ["1 Minute", "10 Minutes", "1 Hour"]),
    area: () => "None",
    damageSpell: false,
    attackSave: () => "None",
    targets: (area, random) => pick(random, [1, 1, 2, 3]),
    description: (themes, classes) => `You braid ${themes.map((theme) => theme.toLowerCase()).join(" and ")} into a sustaining charm. The spell bolsters allies with a contained benefit that rewards careful timing rather than raw force.`,
  },
  {
    id: "utility",
    effects: (random) => [pick(random, ["Utility", "Detection", "Communication", "Exploration"]), pick(random, ["Warding", "Movement", "Creation"]), "None"],
    duration: (random) => pick(random, ["10 Minutes", "1 Hour", "8 Hours"]),
    area: (random) => pick(random, ["None", "Cube 10 ft", "Sphere 10 ft"]),
    damageSpell: false,
    attackSave: () => "None",
    targets: (area) => area === "None" ? 0 : -1,
    description: (themes, classes) => `You arrange ${themes.map((theme) => theme.toLowerCase()).join(" and ")} into a practical spellform. The effect changes what the caster can perceive, prepare, protect, or traverse without directly deciding a fight on its own.`,
  },
  {
    id: "summon-create",
    effects: (random) => [pick(random, ["Summoning", "Creation"]), pick(random, ["Warding", "Combat", "Utility"]), "None"],
    duration: (random) => pick(random, ["1 Minute", "10 Minutes", "1 Hour"]),
    area: () => "None",
    damageSpell: false,
    attackSave: () => "None",
    targets: () => 1,
    description: (themes, classes) => `You call ${themes.map((theme) => theme.toLowerCase()).join(" and ")} into a temporary magical presence. The created force can assist, guard, carry, or threaten, but it remains bounded by the caster's direction.`,
  },
];

export function generateLocalSpell(seed) {
  const random = mulberry32(Number(seed) || Date.now());
  const level = Math.floor(random() * 10);
  const school = pick(random, schools);
  const archetype = pick(random, archetypes);
  const chosenEffects = archetype.effects(random);
  while (chosenEffects.length < 3) chosenEffects.push("None");
  const chosenThemes = pickSome(random, themes, 2);
  const damageSpell = archetype.damageSpell;
  const chosenClasses = pickSome(random, classes, 1 + Math.floor(random() * 2));
  const nameNouns = ["Lantern", "Cipher", "Aegis", "Thread", "Bloom", "Needle", "Mirror", "Crown", "Engine", "Sigil"];
  const nameAdjectives = ["Moonlit", "Static", "Quiet", "Ember", "Harmonic", "Glass", "Verdant", "Clockwork", "Velvet", "Stormbound"];
  const spellName = `${pick(random, nameAdjectives)} ${pick(random, nameNouns)}`;
  const material = random() > 0.6;
  const upcastable = level > 0 && random() > 0.55;
  const hasRestriction = random() > 0.72;
  const area = archetype.area(random);
  const duration = archetype.duration(random);
  const attackSave = archetype.attackSave(random);
  const primaryDamageType = chosenEffects.find((effect) => damageTypes.includes(effect)) || "arcane";

  return {
    name: spellName,
    author: "Spell Crafter Local Generator",
    level,
    school,
    classes: chosenClasses,
    effects: chosenEffects,
    castingTime: pick(random, archetype.id === "utility" ? ["1 Action", "1 Minute", "10 Minutes"] : ["1 Action", "1 Bonus Action", "1 Reaction"]),
    range: pick(random, ranges),
    duration,
    area,
    concentration: duration !== "Instantaneous" && random() > 0.3,
    ritual: level > 0 && archetype.id === "utility" && random() > 0.55,
    damageSpell,
    verbal: true,
    somatic: random() > 0.25,
    material,
    materialText: material ? "A polished copper thread wound around a sliver of crystal." : "",
    materialType: material ? pick(random, ["Trivial", "Costed", "Consumed"]) : "None",
    materialCost: material ? pick(random, [0, 5, 10, 25, 50, 100]) : 0,
    attackSave,
    diceValue: diceFor(level, damageSpell),
    avgRoll: 0,
    targets: archetype.targets(area, random),
    upcastable,
    upcastText: upcastable ? "When cast using a higher-level spell slot, increase the spell's primary effect by one die or extend its duration by one step for each slot level above its base level." : "",
    hasRestriction,
    restrictionText: hasRestriction ? "The spell fails if cast in an area of magical silence or while the caster cannot see the target point." : "",
    description: archetype.description(chosenThemes, chosenClasses, primaryDamageType),
    version: "1.0.0",
    themes: chosenThemes,
    emotionalTone: pick(random, ["Neutral", "Hopeful", "Ominous", "Serene", "Mysterious", "Triumphant"]),
    sourceType: "student",
  };
}
