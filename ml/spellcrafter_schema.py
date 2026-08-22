from __future__ import annotations

import json
import math
import os
import random
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


SPELL_SCHOOLS = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
    "Dunamancy",
]

CLASS_OPTIONS = [
    "Artificer",
    "Bard",
    "Cleric",
    "Druid",
    "Paladin",
    "Ranger",
    "Sorcerer",
    "Warlock",
    "Wizard",
]

CASTING_TIMES = [
    "1 Action",
    "1 Bonus Action",
    "1 Reaction",
    "1 Minute",
    "10 Minutes",
    "1 Hour",
    "8 Hours",
    "12 Hours",
    "24 Hours",
    "Special",
]

RANGES = [
    "Touch",
    "Self",
    "Self (5 ft)",
    "Self (15 ft)",
    "Self (30 ft)",
    "Self (60 ft)",
    "5 ft",
    "10 ft",
    "15 ft",
    "20 ft",
    "30 ft",
    "40 ft",
    "50 ft",
    "60 ft",
    "90 ft",
    "100 ft",
    "120 ft",
    "150 ft",
    "200 ft",
    "300 ft",
    "500 ft",
    "1000 ft",
    "1 mile",
    "5 miles",
    "500 miles",
    "Sight",
    "Unlimited",
]

DURATIONS = [
    "Instantaneous",
    "1 Round",
    "6 Rounds",
    "1 Minute",
    "10 Minutes",
    "1 Hour",
    "2 Hours",
    "8 Hours",
    "24 Hours",
    "7 Days",
    "10 Days",
    "30 Days",
    "Until Dispelled",
    "Until Dispelled or Triggered",
    "Special",
]

AREAS = [
    "None",
    "Line 30 ft",
    "Line 60 ft",
    "Line 100 ft",
    "Sphere 5 ft",
    "Sphere 10 ft",
    "Sphere 15 ft",
    "Sphere 20 ft",
    "Sphere 30 ft",
    "Sphere 40 ft",
    "Sphere 60 ft",
    "Sphere 5 miles",
    "Cone 15 ft",
    "Cone 30 ft",
    "Cone 60 ft",
    "Cylinder 5 ft",
    "Cylinder 10 ft",
    "Cylinder 20 ft",
    "Cylinder 30 ft",
    "Cylinder 40 ft",
    "Cylinder 50 ft",
    "Cylinder 60 ft",
    "Square 5 ft",
    "Square 10 ft",
    "Square 20 ft",
    "Cube 1 ft",
    "Cube 5 ft",
    "Cube 10 ft",
    "Cube 15 ft",
    "Cube 20 ft",
    "Cube 30 ft",
    "Cube 40 ft",
    "Cube 60 ft",
    "Cube 100 ft",
    "Cube 150 ft",
    "Cube 200 ft",
    "2,500 ft^2",
    "40,000 ft^2",
    "Square 1 mile",
]

EFFECT_OPTIONS = [
    "None",
    "Combat",
    "Control",
    "Utility",
    "Creation",
    "Buff",
    "Communication",
    "Healing",
    "Foreknowledge",
    "Detection",
    "Charmed",
    "Debuff",
    "Frightened",
    "Blinded",
    "Prone",
    "Social",
    "Shapechanging",
    "Deception",
    "Restrained",
    "Movement",
    "Exploration",
    "Summoning",
    "Warding",
    "Unconscious",
    "Dunamancy",
    "Invisible",
    "Teleportation",
    "Deafened",
    "Additional",
    "Negation",
    "Banishment",
    "Environment",
    "Stunned",
    "Petrified",
    "Paralyzed",
    "Poison",
    "Thunder",
    "Psychic",
    "Radiant",
    "Bludgeoning",
    "Fire",
    "Force",
    "Acid",
    "Necrotic",
    "Cold",
    "Lightning",
    "Piercing",
    "Slashing",
]

DAMAGE_EFFECTS = {
    "Poison",
    "Thunder",
    "Psychic",
    "Radiant",
    "Bludgeoning",
    "Fire",
    "Force",
    "Acid",
    "Necrotic",
    "Cold",
    "Lightning",
    "Piercing",
    "Slashing",
}

ATTACK_SAVE_TYPES = [
    "None",
    "Melee Attack",
    "Ranged Attack",
    "DEX Save",
    "CON Save",
    "WIS Save",
    "INT Save",
    "CHA Save",
    "STR Save",
]

MATERIAL_TYPES = ["None", "Trivial", "Costed", "Consumed"]
SOURCE_TYPES = ["student", "studentVariant", "official", "officialVariant", "faculty", "facultyVariant"]
EMOTIONAL_TONES = [
    "None",
    "Hopeful",
    "Mournful",
    "Ominous",
    "Triumphant",
    "Serene",
    "Chaotic",
    "Grim",
    "Calm",
    "Menacing",
    "Mysterious",
    "Reverent",
    "Joyful",
    "Intimidating",
    "Playful",
    "Somber",
    "Eerie",
    "Neutral",
]

THEME_OPTIONS = [
    "Life",
    "Death",
    "Light",
    "Darkness",
    "Time",
    "Dreams",
    "Elements",
    "Nature",
    "Creation",
    "Destruction",
    "Wisdom",
    "Knowledge",
    "Memory",
    "Madness",
    "Justice",
    "Peace",
    "War",
    "Vengeance",
    "Harmony",
    "Discord",
    "Protection",
    "Trickery",
    "Void",
    "Spirit",
    "Travel",
    "Transformation",
    "Binding",
    "Wild",
]

DEFAULT_SPELL = {
    "name": "Untitled Spell",
    "author": "Unknown",
    "level": 0,
    "school": "Evocation",
    "classes": ["Wizard"],
    "effects": ["Combat", "None", "None"],
    "castingTime": "1 Action",
    "range": "60 ft",
    "duration": "Instantaneous",
    "area": "None",
    "concentration": False,
    "ritual": False,
    "damageSpell": False,
    "verbal": True,
    "somatic": True,
    "material": False,
    "materialText": "",
    "materialType": "None",
    "materialCost": 0,
    "attackSave": "None",
    "diceValue": "0",
    "avgRoll": 0,
    "targets": 1,
    "upcastable": False,
    "upcastText": "",
    "hasRestriction": False,
    "restrictionText": "",
    "description": "",
    "version": "1.0.0",
    "themes": [],
    "emotionalTone": "None",
    "sourceType": "student",
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_path(value: str | os.PathLike[str], base: Path | None = None) -> Path:
    path = Path(os.path.expandvars(os.path.expanduser(str(value))))
    if path.is_absolute():
        return path
    return ((base or repo_root()) / path).resolve()


def load_config(config_path: str | os.PathLike[str]) -> dict[str, Any]:
    path = resolve_path(config_path, Path.cwd())
    with path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)
    env_map = {
        "SPELLCRAFTER_OFFICIAL_CORPUS_DIR": "officialCorpusDir",
        "SPELLCRAFTER_HOMEBREW_CORPUS_DIR": "homebrewCorpusDir",
        "SPELLCRAFTER_ML_OUTPUT_DIR": "outputDir",
        "SPELLCRAFTER_TRAIN_FILE": "trainFile",
        "SPELLCRAFTER_VALID_FILE": "validFile",
        "SPELLCRAFTER_MODEL_BASE": "modelBase",
        "OLLAMA_MODEL": "ollamaModelName",
    }
    for env_name, key in env_map.items():
        if os.getenv(env_name):
            config[key] = os.environ[env_name]
    return config


def json_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*.json") if not path.name.startswith("_"))


def load_json_file(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
        if not isinstance(value, dict):
            return None, "JSON root is not an object"
        return value, None
    except Exception as error:
        return None, str(error)


def token(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def closest(value: Any, options: list[str], fallback: str) -> str:
    lower = token(value)
    if not lower:
        return fallback
    for option in options:
        if token(option) == lower:
            return option
    for option in options:
        if lower in token(option) or token(option) in lower:
            return option
    return fallback


def known_list(value: Any, options: list[str], fallback: list[str] | None = None) -> list[str]:
    if isinstance(value, list):
        raw = value
    else:
        raw = re.split(r",|\band\b", str(value or ""))
    result: list[str] = []
    for item in raw:
        match = closest(item, options, "")
        if match and match not in result:
            result.append(match)
    return result or list(fallback or [])


def average_roll(value: Any) -> int:
    if value in (None, "", "-"):
        return 0
    if isinstance(value, (int, float)) and math.isfinite(value):
        return max(0, round(value))
    total = 0.0
    matched = False
    for term in re.split(r"[+\s]+", str(value).strip().lower()):
        if not term:
            continue
        dice = re.match(r"^(\d*)d(\d+)$", term)
        if dice:
            count = int(dice.group(1) or "1")
            die = int(dice.group(2))
            if die in {2, 4, 6, 8, 10, 12, 20, 100}:
                total += count * (die / 2 + 0.5)
                matched = True
            continue
        try:
            total += float(re.sub(r"[^\d.-]", "", term))
            matched = True
        except ValueError:
            pass
    return max(0, round(total)) if matched else 0


def infer_effects(value: Any, description: str = "") -> list[str]:
    raw = value if isinstance(value, list) else re.split(r",|\band\b", str(value or ""))
    found: list[str] = []
    combined = " ".join(str(item) for item in raw) + " " + description
    keyword_map = [
        ("Fire", ["fire", "flame", "burn"]),
        ("Cold", ["cold", "ice", "frost"]),
        ("Lightning", ["lightning", "electric", "shock"]),
        ("Necrotic", ["necrotic", "wither", "undeath"]),
        ("Radiant", ["radiant", "holy", "light"]),
        ("Thunder", ["thunder", "sonic"]),
        ("Psychic", ["psychic", "mind"]),
        ("Force", ["force", "kinetic"]),
        ("Acid", ["acid", "caustic"]),
        ("Healing", ["heal", "restore"]),
        ("Warding", ["ward", "protect", "shield"]),
        ("Control", ["control", "restrain", "bind", "impede"]),
        ("Movement", ["move", "speed", "teleport"]),
        ("Detection", ["detect", "sense", "reveal"]),
        ("Summoning", ["summon", "conjure"]),
        ("Creation", ["create", "manifest"]),
        ("Dunamancy", ["dunamancy", "gravity", "time", "echo"]),
    ]
    for item in raw:
        match = closest(item, EFFECT_OPTIONS, "")
        if match and match != "None" and match not in found:
            found.append(match)
    lowered = token(combined)
    for tag, words in keyword_map:
        if tag not in found and any(word in lowered for word in words):
            found.append(tag)
    if not found and any(word in lowered for word in ["damage", "deals", "takes"]):
        found.append("Combat")
    result = found[:3]
    while len(result) < 3:
        result.append("None")
    return result


def normalize_spell(spell: dict[str, Any], source_type: str | None = None) -> dict[str, Any]:
    source = {**DEFAULT_SPELL, **(spell or {})}
    description = str(source.get("description") or "")
    effects = infer_effects(source.get("effects"), description)
    avg = average_roll(source.get("diceValue") or source.get("avgRoll"))
    material_cost = average_roll(source.get("materialCost"))
    material = bool(source.get("material") or material_cost > 0 or source.get("materialText"))
    area = closest(source.get("area"), AREAS, DEFAULT_SPELL["area"])
    damage = bool(source.get("damageSpell") or avg > 0 or any(effect in DAMAGE_EFFECTS for effect in effects))
    dice_value = str(source.get("diceValue") or ("0" if avg == 0 else avg))
    targets = source.get("targets", DEFAULT_SPELL["targets"])
    try:
        targets = int(targets)
    except Exception:
        targets = -1 if area != "None" else 1
    if area != "None" and targets == 0:
        targets = -1
    if not material:
        material_cost = 0

    normalized = {
        "name": str(source.get("name") or "Untitled Spell").strip() or "Untitled Spell",
        "author": str(source.get("author") or "Unknown").strip() or "Unknown",
        "level": max(0, min(9, int(source.get("level") or 0))),
        "school": closest(source.get("school"), SPELL_SCHOOLS, DEFAULT_SPELL["school"]),
        "classes": known_list(source.get("classes"), CLASS_OPTIONS, ["Wizard"]),
        "effects": effects,
        "castingTime": closest(source.get("castingTime"), CASTING_TIMES, DEFAULT_SPELL["castingTime"]),
        "range": closest(source.get("range"), RANGES, DEFAULT_SPELL["range"]),
        "duration": closest(source.get("duration"), DURATIONS, DEFAULT_SPELL["duration"]),
        "area": area,
        "concentration": bool(source.get("concentration")),
        "ritual": bool(source.get("ritual")),
        "damageSpell": damage,
        "verbal": bool(source.get("verbal")),
        "somatic": bool(source.get("somatic")),
        "material": material,
        "materialText": str(source.get("materialText") or "") if material else "",
        "materialType": closest(source.get("materialType"), MATERIAL_TYPES, "Trivial") if material else "None",
        "materialCost": material_cost if material else 0,
        "attackSave": closest(source.get("attackSave"), ATTACK_SAVE_TYPES, DEFAULT_SPELL["attackSave"]),
        "diceValue": dice_value if damage else "0",
        "avgRoll": avg if damage else 0,
        "targets": targets,
        "upcastable": bool(source.get("upcastable")),
        "upcastText": str(source.get("upcastText") or ""),
        "hasRestriction": bool(source.get("hasRestriction") or source.get("restrictionText")),
        "restrictionText": str(source.get("restrictionText") or ""),
        "description": description.strip(),
        "version": str(source.get("version") or "1.0.0"),
        "themes": known_list(source.get("themes"), THEME_OPTIONS, []),
        "emotionalTone": closest(source.get("emotionalTone"), EMOTIONAL_TONES, "None"),
        "sourceType": closest(source_type or source.get("sourceType"), SOURCE_TYPES, "student"),
    }
    if not normalized["upcastable"]:
        normalized["upcastText"] = ""
    if not normalized["hasRestriction"]:
        normalized["restrictionText"] = ""
    return normalized


def validate_spell(spell: dict[str, Any], official_names: set[str] | None = None) -> list[str]:
    errors: list[str] = []
    required = list(DEFAULT_SPELL.keys())
    for field in required:
        if field not in spell:
            errors.append(f"missing field: {field}")
    if not isinstance(spell.get("level"), int) or not 0 <= spell.get("level", -1) <= 9:
        errors.append("level must be integer 0-9")
    enum_checks = [
        ("school", SPELL_SCHOOLS),
        ("castingTime", CASTING_TIMES),
        ("range", RANGES),
        ("duration", DURATIONS),
        ("area", AREAS),
        ("materialType", MATERIAL_TYPES),
        ("attackSave", ATTACK_SAVE_TYPES),
        ("emotionalTone", EMOTIONAL_TONES),
        ("sourceType", SOURCE_TYPES),
    ]
    for field, options in enum_checks:
        if spell.get(field) not in options:
            errors.append(f"{field} has invalid value: {spell.get(field)!r}")
    if not isinstance(spell.get("classes"), list) or not spell.get("classes"):
        errors.append("classes must be a non-empty list")
    else:
        bad = [value for value in spell["classes"] if value not in CLASS_OPTIONS]
        if bad:
            errors.append(f"classes contains invalid values: {bad}")
    if not isinstance(spell.get("effects"), list) or len(spell.get("effects", [])) != 3:
        errors.append("effects must contain exactly 3 values")
    else:
        bad = [value for value in spell["effects"] if value not in EFFECT_OPTIONS]
        if bad:
            errors.append(f"effects contains invalid values: {bad}")
    if spell.get("material") is False:
        if spell.get("materialText") or spell.get("materialType") != "None" or spell.get("materialCost") != 0:
            errors.append("material fields inconsistent with material=false")
    if spell.get("damageSpell") is False and (spell.get("diceValue") not in ("0", "", None) or spell.get("avgRoll", 0) != 0):
        errors.append("damageSpell=false but diceValue/avgRoll indicate damage")
    if spell.get("damageSpell") is True and spell.get("diceValue") not in ("0", "", None):
        expected = average_roll(spell.get("diceValue"))
        if abs(expected - int(spell.get("avgRoll") or 0)) > 1:
            errors.append(f"avgRoll {spell.get('avgRoll')} does not match diceValue {spell.get('diceValue')}")
    if spell.get("area") != "None" and spell.get("targets") not in (-1, 0):
        errors.append("area spells should usually use targets=-1")
    if spell.get("upcastable") is False and spell.get("upcastText"):
        errors.append("upcastText present while upcastable=false")
    if spell.get("hasRestriction") is False and spell.get("restrictionText"):
        errors.append("restrictionText present while hasRestriction=false")
    if official_names and token(spell.get("name")) in official_names:
        errors.append("assistant output uses an official spell name")
    return errors


def strip_json_from_text(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else None
    except Exception:
        pass
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return None
    try:
        value = json.loads(match.group(0))
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def safe_description_summary(description: str, max_words: int = 28) -> str:
    words = re.findall(r"[A-Za-z0-9'-]+", description or "")
    return " ".join(words[:max_words])


def make_variant_name(spell: dict[str, Any], rng: random.Random) -> str:
    adjectives = ["Astral", "Verdant", "Mnemonic", "Runebound", "Lucent", "Gravetide", "Amber", "Silent", "Kinetic", "Wayward"]
    nouns = ["Axiom", "Mantle", "Lattice", "Beacon", "Cipher", "Ward", "Bloom", "Engine", "Step", "Crown"]
    return f"{rng.choice(adjectives)} {rng.choice(nouns)}"


def transformed_spell(spell: dict[str, Any], rng: random.Random, source_type: str) -> dict[str, Any]:
    variant = normalize_spell(spell, source_type=source_type)
    original_name = variant["name"]
    variant["name"] = make_variant_name(variant, rng)
    variant["author"] = "SpellCrafter Dataset Forge"
    variant["sourceType"] = source_type
    tone = rng.choice(["practical", "strange", "elegant", "battlefield-ready", "exploratory"])
    class_text = " or ".join(variant["classes"][:2])
    effect_text = ", ".join(effect for effect in variant["effects"] if effect != "None") or "utility"
    variant["description"] = (
        f"You shape a {tone} {variant['school'].lower()} working that emphasizes {effect_text.lower()}. "
        f"Choose a target or point in range; the spell produces an original effect suited to {class_text} casters "
        f"without duplicating the known spell that inspired its balance profile."
    )
    if variant["damageSpell"] and variant["diceValue"] == "0":
        variant["diceValue"] = "1d6" if variant["level"] == 0 else f"{max(2, variant['level'] + 1)}d6"
        variant["avgRoll"] = average_roll(variant["diceValue"])
    if token(variant["name"]) == token(original_name):
        variant["name"] = f"{variant['school']} Praxis"
    return normalize_spell(variant, source_type=source_type)


def counters_to_dict(counter: Counter) -> dict[str, int]:
    return dict(counter.most_common())
