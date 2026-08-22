#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))
from spellcrafter_schema import counters_to_dict, json_files, load_config, load_json_file, normalize_spell, resolve_path, token


def inspect_dir(label: str, root: Path) -> dict:
    files = json_files(root)
    malformed = []
    field_coverage = Counter()
    names = Counter()
    schools = Counter()
    levels = Counter()
    classes = Counter()
    dice = Counter()
    saves = Counter()
    ranges = Counter()
    durations = Counter()

    for path in files:
        spell, error = load_json_file(path)
        if error:
            malformed.append({"file": str(path), "error": error})
            continue
        for field in spell.keys():
            field_coverage[field] += 1
        normalized = normalize_spell(spell)
        names[token(normalized["name"])] += 1
        schools[normalized["school"]] += 1
        levels[str(normalized["level"])] += 1
        for cls in normalized["classes"]:
            classes[cls] += 1
        dice[normalized["diceValue"]] += 1
        saves[normalized["attackSave"]] += 1
        ranges[normalized["range"]] += 1
        durations[normalized["duration"]] += 1

    duplicates = [{"name": name, "count": count} for name, count in names.items() if count > 1]
    return {
        "label": label,
        "root": str(root),
        "jsonFiles": len(files),
        "loaded": len(files) - len(malformed),
        "malformed": malformed,
        "fieldCoverage": {field: {"count": count, "percent": round(count / max(1, len(files)) * 100, 2)} for field, count in field_coverage.most_common()},
        "likelyDuplicateNames": duplicates[:200],
        "commonSchools": counters_to_dict(schools),
        "commonLevels": counters_to_dict(levels),
        "commonClasses": counters_to_dict(classes),
        "commonDamageDice": counters_to_dict(dice),
        "commonSaves": counters_to_dict(saves),
        "commonRanges": counters_to_dict(ranges),
        "commonDurations": counters_to_dict(durations),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    output_dir = resolve_path(config.get("outputDir", "./ml/output"))
    output_dir.mkdir(parents=True, exist_ok=True)

    official_root = resolve_path(config["officialCorpusDir"])
    homebrew_root = resolve_path(config["homebrewCorpusDir"])
    report = {
        "official": inspect_dir("official", official_root),
        "homebrew": inspect_dir("homebrew", homebrew_root),
    }
    report["totals"] = {
        "jsonFiles": report["official"]["jsonFiles"] + report["homebrew"]["jsonFiles"],
        "loaded": report["official"]["loaded"] + report["homebrew"]["loaded"],
        "malformed": len(report["official"]["malformed"]) + len(report["homebrew"]["malformed"]),
    }

    out_path = output_dir / "corpus_report.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Official JSON files: {report['official']['jsonFiles']}")
    print(f"Homebrew JSON files: {report['homebrew']['jsonFiles']}")
    print(f"Malformed files: {report['totals']['malformed']}")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
