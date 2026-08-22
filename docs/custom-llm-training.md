# Custom Local LLM Training for SpellCrafter

This workflow builds a practical local fine-tuning lane for the SpellCrafter **Generate New Spell** button. It does not train a giant model from scratch. It prepares your existing spell JSON corpus, fine-tunes a small instruct model with LoRA/QLoRA, helps create an Ollama model, and keeps the existing offline generator as the guaranteed fallback.

## What This Adds

- Corpus inspection for official and homebrew JSON folders.
- Dataset preparation into chat JSONL.
- Dataset validation against the SpellCrafter schema.
- A configurable LoRA/QLoRA training script.
- Ollama Modelfile export support.
- A server provider that routes generation through Ollama, optional OpenAI, or offline local generation.

Official spell data is used for balance and structure only. The dataset maker transforms official examples by renaming and rewriting outputs so the model is not trained to reproduce official spell names or descriptions.

## Folders

```text
ml/
  config.example.json
  prepare_dataset.py
  validate_dataset.py
  train_lora.py
  export_to_ollama.py
  prompts/
  scripts/
  output/
docs/custom-llm-training.md
server/providers/customLocalModelProvider.js
```

Large generated artifacts in `ml/output/` are ignored by git, except `.gitkeep`.

## Setup

Create your config:

```bash
cp ml/config.example.json ml/config.json
```

Edit `ml/config.json` so these point at your actual corpus folders:

```json
{
  "officialCorpusDir": "./data/official-spells/json",
  "homebrewCorpusDir": "./data/homebrew"
}
```

Relative paths are resolved from the project root. You can also use environment variables:

```bash
SPELLCRAFTER_OFFICIAL_CORPUS_DIR=/path/to/official
SPELLCRAFTER_HOMEBREW_CORPUS_DIR=/path/to/homebrew
SPELLCRAFTER_MODEL_BASE=Qwen/Qwen2.5-7B-Instruct
```

Install Python dependencies in a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
```

On macOS, `bitsandbytes` is skipped by the requirements marker. Training can still be tested, but serious CPU training will be very slow. A Linux box with an NVIDIA GPU is the practical route for QLoRA.

## Inspect The Corpus

```bash
python3 ml/scripts/inspect_corpus.py --config ml/config.json
```

or:

```bash
npm run llm:inspect
```

This writes:

```text
ml/output/corpus_report.json
```

The report includes JSON counts, malformed files, field coverage, duplicate names, schools, levels, classes, damage dice, saves, ranges, and durations.

## Prepare Training JSONL

```bash
python3 ml/prepare_dataset.py --config ml/config.json
```

or:

```bash
npm run llm:prepare
```

Outputs:

```text
ml/output/spellcrafter_train.jsonl
ml/output/spellcrafter_valid.jsonl
ml/output/dataset_quarantine.json
ml/output/dataset_prepare_report.json
```

Each line is chat JSONL:

```json
{"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"{...spell JSON...}"}]}
```

Example types include full generation, constrained generation, spell repair, balance revision, and field completion.

## Validate The Dataset

```bash
python3 ml/validate_dataset.py --config ml/config.json
```

or:

```bash
npm run llm:validate
```

This checks JSONL structure, assistant JSON parsing, required fields, enum values, exactly three effects, class presence, material consistency, damage dice consistency, area/target consistency, and suspicious official-name or official-description reuse.

Output:

```text
ml/output/dataset_validation_report.json
```

## Train A LoRA Adapter

Choose a base model in `ml/config.json`. Good starting points:

- `mistralai/Mistral-7B-Instruct-v0.3`
- `Qwen/Qwen2.5-7B-Instruct`
- `meta-llama/Llama-3.1-8B-Instruct`
- `meta-llama/Llama-3.2-3B-Instruct` for lower-end hardware

Then run:

```bash
python3 ml/train_lora.py --config ml/config.json
```

The script tries Unsloth first when available, then falls back to Hugging Face Transformers + PEFT. Conservative defaults are in `ml/config.example.json`:

```json
{
  "epochs": 2,
  "learningRate": 0.0002,
  "batchSize": 1,
  "gradientAccumulation": 8,
  "maxSequenceLength": 2048,
  "quantization": "4bit"
}
```

Output:

```text
ml/output/spellcrafter-lora
```

CPU training is possible only for tiny smoke tests. For real training, use a GPU. If memory is tight, reduce `maxSequenceLength`, use Llama 3.2 3B, or reduce examples while testing.

## Create An Ollama Model

Generate a Modelfile:

```bash
python3 ml/export_to_ollama.py --config ml/config.json
```

This writes:

```text
ml/output/Modelfile.spellcrafter
ml/output/ollama_export_notes.json
```

Create the Ollama model:

```bash
ollama create spellcrafter -f ml/output/Modelfile.spellcrafter
```

Important: Ollama does not directly load Hugging Face LoRA adapters. To use the actual fine-tune in Ollama, merge the LoRA adapter into the base model, export/quantize to GGUF with llama.cpp, set `ollama.ggufPath` in `ml/config.json`, rerun `export_to_ollama.py`, then run `ollama create` again.

Until you do that, the generated Modelfile is still useful: it creates a prompt-steered `spellcrafter` model using your selected Ollama base model and the SpellCrafter system prompt.

## Test Sample Generation

Make sure Ollama is running and has the model:

```bash
ollama list
ollama run spellcrafter
```

Then:

```bash
python3 ml/scripts/sample_generation.py --config ml/config.json
```

or:

```bash
npm run llm:sample
```

This asks for 5 spells, validates them, and writes:

```text
ml/output/sample_generations.json
```

## Configure SpellCrafter

Copy `.env.example` to `.env` and set:

```bash
SPELLCRAFTER_GENERATOR_PROVIDER=auto
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=spellcrafter
ENABLE_OPENAI_FALLBACK=false
```

Provider behavior:

- `ollama`: call Ollama using `OLLAMA_MODEL`.
- `openai`: call OpenAI only.
- `local`: use the offline procedural generator.
- `auto`: try Ollama, then OpenAI if enabled/configured, then offline procedural generation.

For Docker, if Ollama is running on the host, use:

```bash
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

The Compose file includes `host.docker.internal:host-gateway` for Linux hosts.

## Optional OpenAI Fallback

Set:

```bash
ENABLE_OPENAI_FALLBACK=true
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

Do not commit `.env`. It is ignored by git.

## Offline Fallback

The offline procedural generator remains built in. If Ollama is down and OpenAI is disabled, the **Generate New Spell** button still works.

To force offline mode:

```bash
SPELLCRAFTER_GENERATOR_PROVIDER=local
```

## Troubleshooting

`ml/config.json not found`
: Copy `ml/config.example.json` to `ml/config.json`.

`Ollama failed`
: Confirm Ollama is running with `ollama list`, confirm the model name, and check `OLLAMA_BASE_URL`.

`Dataset validation warns about official names`
: Official examples should be transformed. Inspect `dataset_validation_report.json` and quarantine or fix suspicious rows before training.

`CUDA out of memory`
: Lower `maxSequenceLength`, use a smaller model, lower LoRA rank, or train on fewer examples while testing.

`CPU training is too slow`
: That is expected. Use CPU only to verify the script path, not for a serious full run.

`sample_generation.py fails validation`
: The model is not following the JSON schema tightly enough. Recreate the Ollama model after checking the system prompt, reduce temperature, or train longer on validated examples.
