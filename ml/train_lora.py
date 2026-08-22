#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))
from spellcrafter_schema import load_config, resolve_path


def format_chat(example: dict, tokenizer) -> str:
    messages = example["messages"]
    if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
    return (
        f"<s>[SYSTEM]\n{messages[0]['content']}\n[/SYSTEM]\n"
        f"[USER]\n{messages[1]['content']}\n[/USER]\n"
        f"[ASSISTANT]\n{messages[2]['content']}\n[/ASSISTANT]</s>"
    )


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def train_with_unsloth(config: dict, train_file: Path, valid_file: Path, training: dict) -> bool:
    try:
        from unsloth import FastLanguageModel
        from datasets import Dataset
        from trl import SFTTrainer
        from transformers import TrainingArguments
    except Exception:
        return False

    model_name = config["modelBase"]
    max_seq = int(training.get("maxSequenceLength", 2048))
    load_4bit = str(training.get("quantization", "4bit")).lower() == "4bit"
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq,
        load_in_4bit=load_4bit,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=int(training.get("loraRank", 16)),
        target_modules=training.get("targetModules", ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]),
        lora_alpha=int(training.get("loraAlpha", 16)),
        lora_dropout=float(training.get("loraDropout", 0.05)),
        bias="none",
        use_gradient_checkpointing=True,
        random_state=int(config.get("randomSeed", 1337)),
    )

    train_rows = [{"text": format_chat(row, tokenizer)} for row in load_jsonl(train_file)]
    valid_rows = [{"text": format_chat(row, tokenizer)} for row in load_jsonl(valid_file)]
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=Dataset.from_list(train_rows),
        eval_dataset=Dataset.from_list(valid_rows) if valid_rows else None,
        dataset_text_field="text",
        max_seq_length=max_seq,
        args=TrainingArguments(
            output_dir=str(resolve_path(training.get("outputDir", "./ml/output/spellcrafter-lora"))),
            per_device_train_batch_size=int(training.get("batchSize", 1)),
            gradient_accumulation_steps=int(training.get("gradientAccumulation", 8)),
            num_train_epochs=float(training.get("epochs", 2)),
            learning_rate=float(training.get("learningRate", 2e-4)),
            logging_steps=int(training.get("loggingSteps", 10)),
            save_steps=int(training.get("saveSteps", 100)),
            eval_strategy="steps" if valid_rows else "no",
            fp16=True,
            report_to="none",
        ),
    )
    trainer.train()
    trainer.save_model()
    tokenizer.save_pretrained(resolve_path(training.get("outputDir", "./ml/output/spellcrafter-lora")))
    return True


def train_with_peft(config: dict, train_file: Path, valid_file: Path, training: dict) -> None:
    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
    from trl import SFTTrainer

    model_name = config["modelBase"]
    max_seq = int(training.get("maxSequenceLength", 2048))
    quantization = str(training.get("quantization", "4bit")).lower()
    quant_config = None
    if quantization == "4bit" and torch.cuda.is_available():
        quant_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)

    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=quant_config,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    if quant_config:
        model = prepare_model_for_kbit_training(model)
    lora_config = LoraConfig(
        r=int(training.get("loraRank", 16)),
        lora_alpha=int(training.get("loraAlpha", 16)),
        lora_dropout=float(training.get("loraDropout", 0.05)),
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=training.get("targetModules", ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]),
    )
    model = get_peft_model(model, lora_config)

    train_rows = [{"text": format_chat(row, tokenizer)} for row in load_jsonl(train_file)]
    valid_rows = [{"text": format_chat(row, tokenizer)} for row in load_jsonl(valid_file)]
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=Dataset.from_list(train_rows),
        eval_dataset=Dataset.from_list(valid_rows) if valid_rows else None,
        dataset_text_field="text",
        max_seq_length=max_seq,
        args=TrainingArguments(
            output_dir=str(resolve_path(training.get("outputDir", "./ml/output/spellcrafter-lora"))),
            per_device_train_batch_size=int(training.get("batchSize", 1)),
            gradient_accumulation_steps=int(training.get("gradientAccumulation", 8)),
            num_train_epochs=float(training.get("epochs", 2)),
            learning_rate=float(training.get("learningRate", 2e-4)),
            logging_steps=int(training.get("loggingSteps", 10)),
            save_steps=int(training.get("saveSteps", 100)),
            eval_strategy="steps" if valid_rows else "no",
            bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
            fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
            report_to="none",
        ),
    )
    trainer.train()
    out_dir = resolve_path(training.get("outputDir", "./ml/output/spellcrafter-lora"))
    trainer.save_model(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    training = config.get("training", {})
    train_file = resolve_path(config.get("trainFile", "./ml/output/spellcrafter_train.jsonl"))
    valid_file = resolve_path(config.get("validFile", "./ml/output/spellcrafter_valid.jsonl"))

    if not train_file.exists():
        raise SystemExit(f"Train file not found: {train_file}. Run ml/prepare_dataset.py first.")

    print("Starting LoRA fine-tune.")
    print("Unsloth will be used if installed; otherwise the Hugging Face PEFT path is used.")
    print("CPU training can work for smoke tests, but real training will be very slow without a GPU.")
    if not train_with_unsloth(config, train_file, valid_file, training):
        train_with_peft(config, train_file, valid_file, training)
    print(f"Saved adapter to {resolve_path(training.get('outputDir', './ml/output/spellcrafter-lora'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
