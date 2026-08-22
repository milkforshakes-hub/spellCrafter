// File: src/utils/constants.js
// This file contains constants used throughout the application.
const SPELL_SCHOOLS = [
  "Abjuration", "Conjuration", "Divination", "Enchantment",
  "Evocation", "Illusion", "Necromancy", "Transmutation"
];

const CLASS = [
  "Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"
]

const CASTING_TIMES = [
  "1 Action", "1 Bonus Action", "1 Reaction", "1 Minute", "10 Minutes", "1 Hour", "8 Hours", "12 Hours", "24 Hours","Special"
];

const RANGES = [
  "Touch", "Self", "Self (5 ft)", "Self (15ft)", "Self (30 ft)", "Self (60 ft)", "5 ft", "10 ft", "15 ft", "20 ft", "30 ft", "40 ft", "60 ft", "90 ft", "100 ft","120 ft", "150 ft", "200 ft", "300 ft", "500 ft", "1000 ft", "1 mile", "5 miles", "500 miles", "Sight", "Unlimited"
];

const DURATIONS = [
  "Instantaneous", "1 Round", "1 Minute", "10 Minutes", "1 Hour", "8 Hours", "24 Hours", "7 Days", "10 Days", "30 Days", "Until Dispelled", "Until Dispelled or Triggered", "Special"];

const AREAS = ["None", "Line 30 ft", "Line 60 ft", "Line 100 ft", "Sphere 5 ft", "Sphere 10 ft", "Sphere 15 ft", "Sphere 20 ft", "Sphere 30 ft", "Sphere 40 ft", "Sphere 60 ft", "Sphere 5 miles", "Cone 15 ft", "Cone 30 ft", "Cone 60 ft", "Cylinder 5 ft", "Cylinder 10 ft", "Cylinder 20 ft", "Cylinder 30 ft", "Cylinder 40 ft", "Cylinder 50 ft", "Cylinder 60 ft", "Square 5 ft", "Square 10 ft", "Square 20 ft", "Cube 1 ft", "Cube 5 ft", "Cube 10 ft", "Cube 15 ft", "Cube 20 ft", "Cube 30 ft", "Cube 40 ft", "Cube 60 ft", "Cube 100 ft", "Cube 150 ft", "Cube 200 ft", "2,500 ft^2", "40,000 ft^2", "square 1 mile"];

const EFFECT_OPTIONS = [
  "Combat", "Control", "Utility", "Creation", "Buff", "Communication", "Healing", "Foreknowledge", "Detection", "Charmed", "Debuff", "Frightened", "Blinded", "Prone", "Social", "Shapechanging", "Deception", "Restrained", "Movement", "Exploration", "Summoning", "Warding", "Unconscious", "Dunamancy", "Invisible", "Teleportation", "Deafened", "Additional", "Negation", "Banishment", "Environment", "Stunned", "Petrified", "Paralyzed", "Poison", "Thunder", "Psychic", "Radiant", "Bludgeoning", "Fire", "Force", "Acid", "Necrotic", "Cold", "Lightning", "Piercing", "Slashing"
];

const ATTACK_SAVE_TYPES = [
  "None", "Melee Attack", "Ranged Attack", "DEX Save", "CON Save", "WIS Save", "INT Save", "CHA Save", "STR Save"
];

const MATERIAL_TYPES = [
    "Trivial", "Costed", "Consumed"
  ];

  const evaluationColors = {
    "Underpowered": "bg-purple-200 text-purple-800",
    "Low Power": "bg-blue-200 text-blue-800",
    "Mid Power": "bg-green-200 text-green-800",
    "High Power": "bg-orange-200 text-orange-800",
    "Overpowered": "bg-red-200 text-red-800"
  };

  const THEME_OPTIONS = [
      // Core Magical Forces
      "Life", "Death", "Light", "Darkness", "Time", "Dreams", "Elements", "Nature", "Creation", "Destruction",
    
      // Abstract Ideals
      "Wisdom", "Knowledge", "Memory", "Madness", "Justice", "Peace", "War", "Vengeance", "Harmony", "Discord",
    
      // Social / Ethical
      "Protection", "Trickery", "Chaos", "Order", "Balance", "Corruption", "Purity",
    
      // Mystical / Spiritual
      "Divinity", "Fate", "Void", "Soul", "Spirit", "Curse", "Blessing",
    
      // Practical / Utility
      "Travel", "Communication", "Transformation", "Illusion", "Summoning", "Binding", "Control",

      // Chaotic / Silly
      "Luck", "Wild", "Unstable", "Surprise", "Absurdity", "Whimsy", "Joke",
  
    
    "None"
  ];

  export {
    SPELL_SCHOOLS,
    CLASS,
    CASTING_TIMES,
    RANGES,
    DURATIONS,
    AREAS,
    EFFECT_OPTIONS,
    ATTACK_SAVE_TYPES,
    MATERIAL_TYPES,
    evaluationColors,
    THEME_OPTIONS
  };
  