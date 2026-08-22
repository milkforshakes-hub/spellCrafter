#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))
from spellcrafter_schema import load_config, repo_root, resolve_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    output_dir = resolve_path(config.get("outputDir", "./ml/output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    ollama = config.get("ollama", {})
    gguf = ollama.get("ggufPath") or ""
    base_model = ollama.get("baseModel") or "mistral"
    from_line = gguf if gguf else base_model
    system_prompt = (repo_root() / "ml" / "prompts" / "spellcrafter_system_prompt.txt").read_text(encoding="utf-8").strip()

    modelfile = f'''FROM {from_line}

PARAMETER temperature {ollama.get("temperature", 0.8)}
PARAMETER top_p {ollama.get("topP", 0.9)}
PARAMETER num_ctx {ollama.get("numCtx", 4096)}
PARAMETER stop "```"

SYSTEM """{system_prompt}"""
'''
    out_path = output_dir / "Modelfile.spellcrafter"
    out_path.write_text(modelfile, encoding="utf-8")
    notes = {
        "ollamaModelName": config.get("ollamaModelName", "spellcrafter"),
        "modelfile": str(out_path),
        "createCommand": f"ollama create {config.get('ollamaModelName', 'spellcrafter')} -f {out_path}",
        "adapterNote": "Ollama does not load Hugging Face LoRA adapters directly. Merge the adapter into the base model and quantize/export to GGUF with llama.cpp, then set ollama.ggufPath in config.json and rerun this script. Until then, this Modelfile creates a prompt-tuned fallback model from ollama.baseModel.",
    }
    (output_dir / "ollama_export_notes.json").write_text(json.dumps(notes, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(notes["adapterNote"])
    print(notes["createCommand"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
