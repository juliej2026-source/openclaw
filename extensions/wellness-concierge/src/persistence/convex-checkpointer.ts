import type { RunnableConfig } from "@langchain/core/runnables";
import type {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
} from "@langchain/langgraph-checkpoint";

// ---------------------------------------------------------------------------
// Convex Checkpoint Saver — LangGraph BaseCheckpointSaver for Convex
//
// This implements the checkpointer interface for LangGraph, persisting
// graph state to Convex tables. For now this is an in-memory stub that
// follows the interface. In production, it would use the Convex client
// to persist to the checkpoints table.
// ---------------------------------------------------------------------------

type StoredCheckpoint = {
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  config: RunnableConfig;
  parentConfig?: RunnableConfig;
};

/**
 * Convex-backed checkpoint saver for LangGraph.
 * Currently uses in-memory storage as a stub.
 */
export class ConvexCheckpointSaver implements Partial<BaseCheckpointSaver> {
  private store = new Map<string, StoredCheckpoint>();

  private getKey(config: RunnableConfig): string {
    const threadId = (config.configurable?.thread_id as string) ?? "default";
    const checkpointId = (config.configurable?.checkpoint_id as string) ?? "latest";
    return `${threadId}:${checkpointId}`;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const key = this.getKey(config);
    const stored = this.store.get(key);
    if (!stored) return undefined;

    return {
      config: stored.config,
      checkpoint: stored.checkpoint,
      metadata: stored.metadata,
      parentConfig: stored.parentConfig,
    };
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const key = this.getKey(config);
    this.store.set(key, {
      checkpoint,
      metadata,
      config,
    });
    return config;
  }

  async *list(
    config: RunnableConfig,
    _options?: {
      limit?: number;
      before?: RunnableConfig;
    },
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = (config.configurable?.thread_id as string) ?? "default";
    for (const [key, stored] of this.store.entries()) {
      if (key.startsWith(`${threadId}:`)) {
        yield {
          config: stored.config,
          checkpoint: stored.checkpoint,
          metadata: stored.metadata,
          parentConfig: stored.parentConfig,
        };
      }
    }
  }

  /**
   * Clear all stored checkpoints (for testing).
   */
  clear(): void {
    this.store.clear();
  }
}
