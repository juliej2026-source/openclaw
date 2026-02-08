import type { Command } from "commander";
import type { TrainingMethod } from "../types.js";
import { isAdapterOnDisk } from "../adapters/adapter-merge.js";
import { listAdapters } from "../adapters/adapter-store.js";
import { collectTrainingData } from "../dataset/collector.js";
import { exportDataset, listDatasets } from "../dataset/formatter.js";
import { validateDataset } from "../dataset/validator.js";
import { evaluateModel } from "../eval/evaluator.js";
import * as jobManager from "../training/job-manager.js";
import { trainWithOllamaModelfile } from "../training/ollama-trainer.js";
import { trainWithUnsloth } from "../training/unsloth-runner.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Register `train` CLI subcommands.
 */
export function registerTrainerCli(program: Command): void {
  const cmd = program
    .command("train")
    .description("Fine-tuning: collect data, train models, manage adapters, evaluate");

  // ── data ────────────────────────────────────────────────────────────────
  cmd
    .command("data")
    .description("Collect training data from session transcripts")
    .requiredOption("--output <name>", "Dataset name")
    .option("--agent <agentId>", "Filter to a specific agent")
    .option("--format <fmt>", "Output format: sharegpt, alpaca, chatml", "sharegpt")
    .option("--max-pairs <n>", "Max pairs to collect", "10000")
    .option("--base-model <model>", "Tag dataset with a target base model")
    .action(
      async (opts: {
        output: string;
        agent?: string;
        format: string;
        maxPairs: string;
        baseModel?: string;
      }) => {
        console.log("Collecting training data...");

        const rawPairs = await collectTrainingData({
          agentId: opts.agent,
          maxPairs: Number(opts.maxPairs),
        });

        if (rawPairs.length === 0) {
          console.log(
            "No training data found. Ensure sessions exist in ~/.openclaw/agents/*/sessions/.",
          );
          return;
        }

        console.log(`Found ${rawPairs.length} raw conversation pairs`);

        const validation = validateDataset(rawPairs);
        console.log(`Validated: ${validation.valid.length} valid, ${validation.removed} removed`);

        if (Object.keys(validation.reasons).length > 0) {
          console.log("Removal reasons:");
          for (const [reason, count] of Object.entries(validation.reasons)) {
            console.log(`  ${reason}: ${count}`);
          }
        }

        const dataset = exportDataset({
          pairs: validation.valid,
          name: opts.output,
          format: opts.format as "sharegpt" | "alpaca" | "chatml",
          baseModel: opts.baseModel,
        });

        console.log(`\nDataset exported:`);
        console.log(`  ID:     ${dataset.id}`);
        console.log(`  Pairs:  ${dataset.pairCount}`);
        console.log(`  Format: ${dataset.format}`);
        console.log(`  Path:   ${dataset.filePath}`);
      },
    );

  // ── start ───────────────────────────────────────────────────────────────
  cmd
    .command("start")
    .description("Start a fine-tuning job")
    .requiredOption("--base <model>", "Base model (e.g. qwen3:14b)")
    .requiredOption("--dataset <id>", "Dataset ID")
    .requiredOption("--output <name>", "Output model/adapter name")
    .option("--method <m>", "Training method: ollama-modelfile, unsloth-qlora", "ollama-modelfile")
    .option("--epochs <n>", "Training epochs", "3")
    .option("--batch-size <n>", "Batch size", "2")
    .option("--lr <rate>", "Learning rate", "0.0002")
    .option("--lora-rank <r>", "LoRA rank", "16")
    .option("--lora-alpha <a>", "LoRA alpha", "32")
    .action(
      async (opts: {
        base: string;
        dataset: string;
        output: string;
        method: string;
        epochs: string;
        batchSize: string;
        lr: string;
        loraRank: string;
        loraAlpha: string;
      }) => {
        const method = opts.method as TrainingMethod;
        const config = {
          baseModel: opts.base,
          datasetId: opts.dataset,
          method,
          outputName: opts.output,
          hyperparams: {
            epochs: Number(opts.epochs),
            batchSize: Number(opts.batchSize),
            learningRate: Number(opts.lr),
            loraRank: Number(opts.loraRank),
            loraAlpha: Number(opts.loraAlpha),
          },
        };

        const job = jobManager.createJob(config);
        console.log(`Created training job: ${job.id}`);
        console.log(`  Method: ${method}`);
        console.log(`  Base:   ${opts.base}`);
        console.log(`  Output: ${opts.output}`);

        if (method === "ollama-modelfile") {
          console.log("\nStarting Ollama Modelfile creation...");
          await trainWithOllamaModelfile(job.id, config);
        } else {
          console.log("\nStarting unsloth QLoRA fine-tuning...");
          await trainWithUnsloth(job.id, config);
        }

        const final = jobManager.getJob(job.id);
        if (final?.status === "completed") {
          console.log(`\nTraining completed successfully!`);
          if (final.outputPath) {
            console.log(`  Output: ${final.outputPath}`);
          }
        } else {
          console.log(`\nTraining ended with status: ${final?.status}`);
          if (final?.error) {
            console.log(`  Error: ${final.error}`);
          }
        }
      },
    );

  // ── status ──────────────────────────────────────────────────────────────
  cmd
    .command("status")
    .description("Show training job status")
    .option("--job <id>", "Specific job ID")
    .option("--filter <status>", "Filter by status")
    .action(async (opts: { job?: string; filter?: string }) => {
      if (opts.job) {
        const job = jobManager.getJob(opts.job);
        if (!job) {
          console.error(`Job ${opts.job} not found`);
          process.exitCode = 1;
          return;
        }
        console.log(JSON.stringify(job, null, 2));
        return;
      }

      const statusFilter = opts.filter as import("../types.js").TrainingJobStatus | undefined;
      const jobs = jobManager.listJobs(statusFilter);

      if (jobs.length === 0) {
        console.log("No training jobs found.");
        return;
      }

      console.log(`\nTraining Jobs (${jobs.length}):\n`);
      for (const j of jobs) {
        const line = [
          j.id.padEnd(30),
          j.status.padEnd(12),
          j.config.method.padEnd(18),
          j.config.baseModel,
        ].join(" ");
        console.log(`  ${line}`);
        if (j.error) {
          console.log(`    Error: ${j.error}`);
        }
      }
    });

  // ── adapters ────────────────────────────────────────────────────────────
  cmd
    .command("adapters")
    .description("List LoRA adapters")
    .action(async () => {
      const adapters = listAdapters();

      if (adapters.length === 0) {
        console.log("No adapters found. Train a model first with `openclaw train start`.");
        return;
      }

      console.log(`\nLoRA Adapters (${adapters.length}):\n`);
      for (const a of adapters) {
        const onDisk = isAdapterOnDisk(a) ? "on disk" : "missing";
        const score =
          a.evalScore !== undefined ? `score: ${a.evalScore.toFixed(3)}` : "not evaluated";
        console.log(
          `  ${a.name.padEnd(25)} ${a.baseModel.padEnd(20)} ${formatBytes(a.sizeBytes).padEnd(10)} ${score} (${onDisk})`,
        );
      }
    });

  // ── datasets ────────────────────────────────────────────────────────────
  cmd
    .command("datasets")
    .description("List exported training datasets")
    .action(async () => {
      const datasets = listDatasets();

      if (datasets.length === 0) {
        console.log("No datasets found. Collect data with `openclaw train data`.");
        return;
      }

      console.log(`\nTraining Datasets (${datasets.length}):\n`);
      for (const d of datasets) {
        console.log(
          `  ${d.name.padEnd(25)} ${String(d.pairCount).padEnd(8)} pairs  ${d.format.padEnd(10)} ${d.createdAt}`,
        );
      }
    });

  // ── eval ────────────────────────────────────────────────────────────────
  cmd
    .command("eval")
    .description("Evaluate a model against test cases from a dataset")
    .requiredOption("--model <id>", "Model to evaluate")
    .option("--base <id>", "Base model to compare against")
    .option("--dataset <id>", "Dataset ID for test cases")
    .option("--max-cases <n>", "Max test cases", "20")
    .action(async (opts: { model: string; base?: string; dataset?: string; maxCases: string }) => {
      // Find dataset
      const datasets = listDatasets();
      let datasetPath: string | undefined;

      if (opts.dataset) {
        const ds = datasets.find((d) => d.id === opts.dataset);
        if (!ds) {
          console.error(`Dataset "${opts.dataset}" not found`);
          process.exitCode = 1;
          return;
        }
        datasetPath = ds.filePath;
      } else if (datasets.length > 0) {
        datasetPath = datasets[datasets.length - 1]?.filePath;
        console.log(`Using most recent dataset: ${datasets[datasets.length - 1]?.id}`);
      }

      if (!datasetPath) {
        console.error("No datasets found. Collect data first.");
        process.exitCode = 1;
        return;
      }

      console.log(`Evaluating ${opts.model}...`);
      if (opts.base) {
        console.log(`Comparing against base: ${opts.base}`);
      }

      const result = await evaluateModel({
        modelId: opts.model,
        datasetPath,
        baseModelId: opts.base,
        maxCases: Number(opts.maxCases),
      });

      console.log(`\nEvaluation Results:`);
      console.log(`  Model:     ${result.modelId}`);
      console.log(`  Cases:     ${result.testCases}`);
      console.log(`  Overall:   ${result.scores.overall}`);
      if (result.scores.accuracy !== undefined) {
        console.log(`  Accuracy:  ${result.scores.accuracy}`);
      }
      if (result.scores.fluency !== undefined) {
        console.log(`  Fluency:   ${result.scores.fluency}`);
      }

      if (result.comparisonToBase) {
        console.log(`\n  Base Score:   ${result.comparisonToBase.baseScore}`);
        const sign = result.comparisonToBase.improvement >= 0 ? "+" : "";
        console.log(`  Improvement:  ${sign}${result.comparisonToBase.improvement}`);
      }
    });
}
