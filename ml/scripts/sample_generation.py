#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import requests

sys.path.append(str(Path(__file__).resolve().parents[1]))
from spellcrafter_schema import load_config, normalize_spell, repo_root, resolve_path, strip_json_from_text, validate_spell


def ask_ollama(base_url: str, model: str, prompt: str, system: str) -> str:
    response = requests.post(
        f"{base_url.rstrip('/')}/api/chat",
        json={
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "options": {"temperature": 0.8, "top_p": 0.9},
        },
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["message"]["content"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    output_dir = resolve_path(config.get("outputDir", "./ml/output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    system = (repo_root() / "ml" / "prompts" / "spellcrafter_system_prompt.txt").read_text(encoding="utf-8").strip()
    base_url = config.get("ollamaBaseUrl") or "http://127.0.0.1:11434"
    model = config.get("ollamaModelName", "spellcrafter")

    results = []
    for index in range(5):
        prompt = f"Generate original SpellCrafter spell #{index + 1}. Vary level, school, and tactical purpose."
        try:
            text = ask_ollama(base_url, model, prompt, system)
            parsed = strip_json_from_text(text)
            if not parsed:
                results.append({"ok": False, "error": "response did not contain parseable JSON", "raw": text})
                continue
            spell = normalize_spell(parsed)
            errors = validate_spell(spell)
            results.append({"ok": not errors, "errors": errors, "spell": spell, "raw": text})
        except Exception as error:
            results.append({"ok": False, "error": str(error)})

    out_path = output_dir / "sample_generations.json"
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    passed = sum(1 for item in results if item.get("ok"))
    print(f"Sample generation passed {passed}/5")
    print(f"Wrote {out_path}")
    return 0 if passed == 5 else 1


if __name__ == "__main__":
    raise SystemExit(main())
