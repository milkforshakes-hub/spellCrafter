#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from difflib import SequenceMatcher
import re
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))
from spellcrafter_schema import json_files, load_config, load_json_file, strip_json_from_text, token, validate_spell, resolve_path


def words(value: str) -> set[str]:
    return {word for word in re.findall(r"[a-z]{4,}", (value or "").lower()) if word not in {"that", "with", "from", "this", "their", "when", "your", "spell"}}


def shingles(value: str, width: int = 7) -> set[str]:
    parts = re.findall(r"[a-z0-9]+", (value or "").lower())
    return {" ".join(parts[index:index + width]) for index in range(0, max(0, len(parts) - width + 1))}


def official_references(root: Path) -> tuple[set[str], list[dict]]:
    names = set()
    descriptions = []
    for path in json_files(root):
        spell, error = load_json_file(path)
        if error or not spell:
            continue
        names.add(token(spell.get("name")))
        desc = str(spell.get("description") or "").strip()
        if len(desc) > 80:
            text = desc[:1200]
            descriptions.append({"text": text, "words": words(text), "shingles": shingles(text)})
    return names, descriptions


def similar_to_official(description: str, official_descriptions: list[dict]) -> float:
    if len(description or "") < 80:
        return 0.0
    sample = description[:1200]
    sample_words = words(sample)
    sample_shingles = shingles(sample)
    if not sample_words:
        return 0.0
    best = 0.0
    candidates = []
    for official in official_descriptions:
        if sample_shingles and sample_shingles & official["shingles"]:
            candidates.append((999, official["text"]))
            continue
        overlap = len(sample_words & official["words"])
        if overlap >= 16:
            candidates.append((overlap, official["text"]))
    for _overlap, official in sorted(candidates, reverse=True)[:40]:
        ratio = SequenceMatcher(None, sample, official).ratio()
        if ratio > best:
            best = ratio
        if best >= 0.92:
            break
    return best


def validate_file(path: Path, official_names: set[str], official_descriptions: list[str]) -> dict:
    errors = []
    warnings = []
    records = 0
    if not path.exists():
        return {"file": str(path), "records": 0, "errors": [{"line": 0, "error": "file does not exist"}], "warnings": []}

    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            records += 1
            try:
                record = json.loads(line)
            except Exception as error:
                errors.append({"line": line_number, "error": f"invalid JSONL row: {error}"})
                continue
            messages = record.get("messages")
            if not isinstance(messages, list) or len(messages) != 3:
                errors.append({"line": line_number, "error": "record must contain exactly three messages"})
                continue
            roles = [message.get("role") for message in messages if isinstance(message, dict)]
            if roles != ["system", "user", "assistant"]:
                errors.append({"line": line_number, "error": f"invalid message roles: {roles}"})
                continue
            assistant_content = messages[2].get("content")
            if not isinstance(assistant_content, str):
                errors.append({"line": line_number, "error": "assistant content must be a JSON string"})
                continue
            spell = strip_json_from_text(assistant_content)
            if not spell:
                errors.append({"line": line_number, "error": "assistant content is not parseable spell JSON"})
                continue
            spell_errors = validate_spell(spell, official_names=official_names)
            for error in spell_errors:
                target = warnings if "official spell name" in error else errors
                target.append({"line": line_number, "spell": spell.get("name"), "error": error})
            similarity = similar_to_official(str(spell.get("description") or ""), official_descriptions)
            if similarity >= 0.9:
                warnings.append({"line": line_number, "spell": spell.get("name"), "warning": "description is suspiciously similar to an official description", "similarity": round(similarity, 3)})
    return {"file": str(path), "records": records, "errors": errors, "warnings": warnings}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    output_dir = resolve_path(config.get("outputDir", "./ml/output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    official_names, official_descriptions = official_references(resolve_path(config["officialCorpusDir"]))

    reports = [
        validate_file(resolve_path(config.get("trainFile", "./ml/output/spellcrafter_train.jsonl")), official_names, official_descriptions),
        validate_file(resolve_path(config.get("validFile", "./ml/output/spellcrafter_valid.jsonl")), official_names, official_descriptions),
    ]
    summary = {
        "files": reports,
        "totalRecords": sum(item["records"] for item in reports),
        "totalErrors": sum(len(item["errors"]) for item in reports),
        "totalWarnings": sum(len(item["warnings"]) for item in reports),
    }
    out_path = output_dir / "dataset_validation_report.json"
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Validated {summary['totalRecords']} records")
    print(f"Errors: {summary['totalErrors']}")
    print(f"Warnings: {summary['totalWarnings']}")
    print(f"Wrote {out_path}")
    return 1 if summary["totalErrors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
