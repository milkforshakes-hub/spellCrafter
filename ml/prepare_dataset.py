#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))
from spellcrafter_schema import (
    json_files,
    load_config,
    load_json_file,
    normalize_spell,
    repo_root,
    resolve_path,
    safe_description_summary,
    token,
    transformed_spell,
    validate_spell,
)


def read_prompt(name: str) -> str:
    path = repo_root() / "ml" / "prompts" / name
    return path.read_text(encoding="utf-8").strip()


def assistant_json(spell: dict) -> str:
    return json.dumps(spell, ensure_ascii=False, separators=(",", ":"))


def chat(system_prompt: str, user: str, spell: dict, meta: dict) -> dict:
    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant_json(spell)},
        ],
        "meta": meta,
    }


def full_generation_example(system_prompt: str, spell: dict, corpus: str, path: Path) -> dict:
    user = (
        f"Create an original level {spell['level']} {spell['school']} spell for "
        f"{', '.join(spell['classes'])}. It should emphasize {', '.join(spell['effects'])} "
        "and return one complete SpellCrafter JSON object."
    )
    return chat(system_prompt, user, spell, {"type": "full_generation", "corpus": corpus, "sourceFile": str(path)})


def constrained_example(system_prompt: str, spell: dict, corpus: str, path: Path) -> dict:
    user = json.dumps(
        {
            "task": "Generate a constrained original spell.",
            "constraints": {
                "level": spell["level"],
                "school": spell["school"],
                "classes": spell["classes"],
                "castingTime": spell["castingTime"],
                "range": spell["range"],
                "duration": spell["duration"],
                "mustUseEffects": spell["effects"],
            },
        },
        ensure_ascii=False,
    )
    return chat(system_prompt, user, spell, {"type": "constrained_generation", "corpus": corpus, "sourceFile": str(path)})


def repair_example(system_prompt: str, spell: dict, corpus: str, path: Path) -> dict:
    broken = dict(spell)
    broken.pop("effects", None)
    broken["material"] = False
    broken["materialText"] = spell.get("materialText", "")
    user = (
        "Repair this incomplete SpellCrafter spell. Return only one complete, valid JSON spell object:\n"
        f"{json.dumps(broken, ensure_ascii=False)}"
    )
    return chat(system_prompt, user, spell, {"type": "spell_repair", "corpus": corpus, "sourceFile": str(path)})


def balance_revision_example(system_prompt: str, spell: dict, corpus: str, path: Path) -> dict:
    draft = dict(spell)
    if draft["damageSpell"] and draft["level"] < 9:
        draft["diceValue"] = f"{draft['level'] + 5}d10"
    if draft["area"] == "None" and draft["level"] >= 3:
        draft["area"] = "Sphere 60 ft"
        draft["targets"] = -1
    user = (
        "Revise this draft into a more balanced, table-ready SpellCrafter spell while preserving its core idea. "
        "Return only one valid JSON spell object:\n"
        f"{json.dumps(draft, ensure_ascii=False)}"
    )
    return chat(system_prompt, user, spell, {"type": "balance_revision", "corpus": corpus, "sourceFile": str(path)})


def field_completion_example(system_prompt: str, spell: dict, corpus: str, path: Path) -> dict:
    partial = {
        "name": spell["name"],
        "level": spell["level"],
        "school": spell["school"],
        "classes": spell["classes"],
        "description": safe_description_summary(spell["description"]),
    }
    user = (
        "Complete this partial spell into the exact SpellCrafter schema. "
        "Return only one valid JSON spell object:\n"
        f"{json.dumps(partial, ensure_ascii=False)}"
    )
    return chat(system_prompt, user, spell, {"type": "field_completion", "corpus": corpus, "sourceFile": str(path)})


def build_examples(spell: dict, corpus: str, path: Path, system_prompt: str, max_examples: int, rng: random.Random) -> list[dict]:
    builders = [
        full_generation_example,
        constrained_example,
        repair_example,
        balance_revision_example,
        field_completion_example,
    ]
    if corpus == "official":
        builders = [full_generation_example, constrained_example, balance_revision_example, field_completion_example]
    rng.shuffle(builders)
    selected = builders[: max(1, max_examples)]
    return [builder(system_prompt, spell, corpus, path) for builder in selected]


def load_official_names(root: Path) -> set[str]:
    names = set()
    for path in json_files(root):
        spell, error = load_json_file(path)
        if not error and spell:
            names.add(token(spell.get("name")))
    return names


def process_corpus(label: str, root: Path, config: dict, system_prompt: str, rng: random.Random, official_names: set[str]) -> tuple[list[dict], list[dict]]:
    examples = []
    quarantined = []
    max_examples = int(config.get("maxExamplesPerSpell", 3))
    mode = config.get("officialMode" if label == "official" else "homebrewMode", "transform")

    for path in json_files(root):
        raw, error = load_json_file(path)
        if error or not raw:
            quarantined.append({"file": str(path), "reason": error or "empty"})
            continue
        try:
            normalized = normalize_spell(raw, source_type="officialVariant" if label == "official" else "student")
            candidates = []
            name_matches_official = token(normalized.get("name")) in official_names
            if label == "homebrew" and "direct" in mode and not name_matches_official:
                candidates.append(normalized)
            if "transform" in mode or label == "official":
                source_type = "officialVariant" if label == "official" else rng.choice(["studentVariant", "facultyVariant"])
                candidates.append(transformed_spell(normalized, rng, source_type))

            for candidate in candidates:
                errors = validate_spell(candidate, official_names=official_names if label == "official" else None)
                if errors:
                    quarantined.append({"file": str(path), "spell": candidate.get("name"), "reason": "; ".join(errors)})
                    continue
                examples.extend(build_examples(candidate, label, path, system_prompt, max_examples, rng))
        except Exception as error:
            quarantined.append({"file": str(path), "reason": str(error)})

    return examples, quarantined


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    rng = random.Random(int(config.get("randomSeed", 1337)))

    output_dir = resolve_path(config.get("outputDir", "./ml/output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    train_file = resolve_path(config.get("trainFile", output_dir / "spellcrafter_train.jsonl"))
    valid_file = resolve_path(config.get("validFile", output_dir / "spellcrafter_valid.jsonl"))
    official_root = resolve_path(config["officialCorpusDir"])
    homebrew_root = resolve_path(config["homebrewCorpusDir"])
    system_prompt = read_prompt("spellcrafter_system_prompt.txt")
    official_names = load_official_names(official_root)

    official_examples, official_quarantine = process_corpus("official", official_root, config, system_prompt, rng, official_names)
    homebrew_examples, homebrew_quarantine = process_corpus("homebrew", homebrew_root, config, system_prompt, rng, official_names)
    examples = official_examples + homebrew_examples
    rng.shuffle(examples)

    validation_ratio = float(config.get("validationRatio", 0.08))
    valid_count = max(1, int(len(examples) * validation_ratio)) if examples else 0
    valid_examples = examples[:valid_count]
    train_examples = examples[valid_count:]

    train_file.parent.mkdir(parents=True, exist_ok=True)
    valid_file.parent.mkdir(parents=True, exist_ok=True)
    train_file.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in train_examples) + ("\n" if train_examples else ""), encoding="utf-8")
    valid_file.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in valid_examples) + ("\n" if valid_examples else ""), encoding="utf-8")

    quarantine = official_quarantine + homebrew_quarantine
    report = {
        "trainExamples": len(train_examples),
        "validExamples": len(valid_examples),
        "officialExamples": len(official_examples),
        "homebrewExamples": len(homebrew_examples),
        "quarantined": len(quarantine),
        "quarantineFile": str(output_dir / "dataset_quarantine.json"),
    }
    (output_dir / "dataset_quarantine.json").write_text(json.dumps(quarantine, indent=2), encoding="utf-8")
    (output_dir / "dataset_prepare_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {len(train_examples)} train examples to {train_file}")
    print(f"Wrote {len(valid_examples)} validation examples to {valid_file}")
    print(f"Quarantined {len(quarantine)} unusable records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
