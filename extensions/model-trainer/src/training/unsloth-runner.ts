import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { TrainingJobConfig, TrainingProgress } from "../types.js";
import * as jobManager from "./job-manager.js";

function trainerDir(): string {
  return path.join(process.env.HOME ?? "~", ".openclaw", "model-trainer");
}

/**
 * Generate a Python training script for unsloth QLoRA fine-tuning.
 */
function generateTrainingScript(config: TrainingJobConfig, datasetPath: string): string {
  const hp = config.hyperparams ?? {};
  const epochs = hp.epochs ?? 3;
  const batchSize = hp.batchSize ?? 2;
  const lr = hp.learningRate ?? 2e-4;
  const loraRank = hp.loraRank ?? 16;
  const loraAlpha = hp.loraAlpha ?? 32;
  const maxSeqLength = hp.maxSeqLength ?? 4096;
  const warmupSteps = hp.warmupSteps ?? 10;
  const gradAccum = hp.gradientAccumulationSteps ?? 4;
  const outputDir = path.join(trainerDir(), "adapters", config.outputName);

  return `
#!/usr/bin/env python3
"""Auto-generated QLoRA fine-tuning script via OpenClaw model-trainer."""

from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments
import json, os

# ── Configuration ──────────────────────────────────────────────────────
MODEL_NAME = "${config.baseModel}"
DATASET_PATH = "${datasetPath}"
OUTPUT_DIR = "${outputDir}"
MAX_SEQ_LENGTH = ${maxSeqLength}
LORA_RANK = ${loraRank}
LORA_ALPHA = ${loraAlpha}
EPOCHS = ${epochs}
BATCH_SIZE = ${batchSize}
LEARNING_RATE = ${lr}
WARMUP_STEPS = ${warmupSteps}
GRAD_ACCUM = ${gradAccum}

# ── Load model ─────────────────────────────────────────────────────────
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,  # Auto-detect
    load_in_4bit=True,
)

# ── Apply LoRA ─────────────────────────────────────────────────────────
model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_RANK,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
)

# ── Load dataset ───────────────────────────────────────────────────────
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

def format_conversation(example):
    text = ""
    for msg in example.get("conversations", []):
        role = msg.get("from", "")
        value = msg.get("value", "")
        if role == "system":
            text += f"<|system|>\\n{value}<|end|>\\n"
        elif role in ("human", "user"):
            text += f"<|user|>\\n{value}<|end|>\\n"
        elif role in ("gpt", "assistant"):
            text += f"<|assistant|>\\n{value}<|end|>\\n"
    return {"text": text}

dataset = dataset.map(format_conversation)

# ── Train ──────────────────────────────────────────────────────────────
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    args=TrainingArguments(
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        warmup_steps=WARMUP_STEPS,
        num_train_epochs=EPOCHS,
        learning_rate=LEARNING_RATE,
        fp16=True,
        logging_steps=1,
        output_dir=OUTPUT_DIR,
        save_strategy="epoch",
    ),
)

print("TRAINING_START")
trainer_stats = trainer.train()
print(f"TRAINING_COMPLETE loss={trainer_stats.training_loss:.4f}")

# ── Save adapter ───────────────────────────────────────────────────────
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"ADAPTER_SAVED path={OUTPUT_DIR}")
`.trim();
}

/** Parse training progress from a log line. */
function parseProgressLine(line: string): Partial<TrainingProgress> | null {
  // Match trl/transformers progress output
  const stepMatch = line.match(/\{'loss': ([\d.]+).*'epoch': ([\d.]+)/);
  if (stepMatch) {
    return {
      loss: Number(stepMatch[1]),
      currentEpoch: Math.floor(Number(stepMatch[2])),
    };
  }
  return null;
}

/**
 * Run unsloth QLoRA fine-tuning as a subprocess.
 *
 * Requires: Python 3.10+, unsloth, torch, CUDA GPU.
 * Generates a training script, spawns python, monitors progress via stdout.
 */
export async function trainWithUnsloth(jobId: string, config: TrainingJobConfig): Promise<void> {
  jobManager.updateJob(jobId, {
    status: "preparing",
    startedAt: new Date().toISOString(),
  });

  // Find dataset
  const datasetsDir = path.join(trainerDir(), "datasets");
  const datasetFiles = fs.existsSync(datasetsDir)
    ? fs.readdirSync(datasetsDir).filter((f) => f.startsWith(config.datasetId))
    : [];
  const datasetFile = datasetFiles[0];
  if (!datasetFile) {
    jobManager.updateJob(jobId, {
      status: "failed",
      error: `Dataset ${config.datasetId} not found`,
      completedAt: new Date().toISOString(),
    });
    return;
  }
  const datasetPath = path.join(datasetsDir, datasetFile);

  // Generate training script
  const scriptsDir = path.join(trainerDir(), "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  const scriptPath = path.join(scriptsDir, `${jobId}.py`);
  fs.writeFileSync(scriptPath, generateTrainingScript(config, datasetPath));

  // Create log file
  const logDir = path.join(trainerDir(), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${jobId}.log`);
  const logStream = fs.createWriteStream(logPath);

  jobManager.updateJob(jobId, { status: "training", logPath });

  return new Promise<void>((resolve) => {
    const proc = spawn("python3", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      logStream.write(text);

      // Check for completion signal
      if (text.includes("TRAINING_COMPLETE")) {
        jobManager.updateJob(jobId, { status: "merging" });
      }
      if (text.includes("ADAPTER_SAVED")) {
        const pathMatch = text.match(/path=(.+)/);
        if (pathMatch) {
          jobManager.updateJob(jobId, { outputPath: pathMatch[1].trim() });
        }
      }

      // Parse progress
      for (const line of text.split("\n")) {
        const progress = parseProgressLine(line);
        if (progress) {
          jobManager.updateJob(jobId, {
            progress: {
              currentEpoch: progress.currentEpoch ?? 0,
              totalEpochs: config.hyperparams?.epochs ?? 3,
              currentStep: 0,
              totalSteps: 0,
              loss: progress.loss,
            },
          });
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      logStream.write(chunk.toString());
    });

    proc.on("close", (code) => {
      logStream.end();
      if (code === 0) {
        jobManager.updateJob(jobId, {
          status: "completed",
          completedAt: new Date().toISOString(),
        });
      } else {
        jobManager.updateJob(jobId, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: `Process exited with code ${code}. Check log at ${logPath}`,
        });
      }
      resolve();
    });

    proc.on("error", (err) => {
      logStream.end();
      jobManager.updateJob(jobId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: err.message,
      });
      resolve();
    });
  });
}
