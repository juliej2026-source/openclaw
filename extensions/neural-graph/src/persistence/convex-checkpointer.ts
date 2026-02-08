import type { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
  type SerializerProtocol,
  type PendingWrite,
  type CheckpointListOptions,
} from "@langchain/langgraph-checkpoint";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "./convex-client.js";

// ---------------------------------------------------------------------------
// Convex-backed checkpoint saver for LangGraph
// Stores thread state in the Convex `checkpoints` table for persistence
// across restarts and cross-station replication.
// ---------------------------------------------------------------------------

export class ConvexCheckpointer extends BaseCheckpointSaver {
  private serde: SerializerProtocol;

  constructor(serde?: SerializerProtocol) {
    super(serde);
    this.serde = serde ?? this.serde;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string;
    if (!threadId) return undefined;

    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    const client = getConvexClient();

    const row = await client.query(api.checkpoints.get, {
      threadId,
      checkpointId,
    });

    if (!row) return undefined;

    const checkpoint: Checkpoint = JSON.parse(row.channelValues);
    const metadata: CheckpointMetadata = JSON.parse(row.channelVersions);

    return {
      config: {
        configurable: {
          thread_id: row.threadId,
          checkpoint_id: row.checkpointId,
        },
      },
      checkpoint,
      metadata,
      parentConfig: row.parentCheckpointId
        ? {
            configurable: {
              thread_id: row.threadId,
              checkpoint_id: row.parentCheckpointId,
            },
          }
        : undefined,
    };
  }

  async *list(
    config: RunnableConfig,
    _options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string;
    if (!threadId) return;

    const client = getConvexClient();
    const rows = await client.query(api.checkpoints.listByThread, { threadId });

    // Sort newest first
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    for (const row of rows) {
      const checkpoint: Checkpoint = JSON.parse(row.channelValues);
      const metadata: CheckpointMetadata = JSON.parse(row.channelVersions);

      yield {
        config: {
          configurable: {
            thread_id: row.threadId,
            checkpoint_id: row.checkpointId,
          },
        },
        checkpoint,
        metadata,
        parentConfig: row.parentCheckpointId
          ? {
              configurable: {
                thread_id: row.threadId,
                checkpoint_id: row.parentCheckpointId,
              },
            }
          : undefined,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    const parentCheckpointId = config.configurable?.checkpoint_id as string | undefined;
    const checkpointId = checkpoint.id;

    const client = getConvexClient();

    await client.mutation(api.checkpoints.put, {
      threadId,
      checkpointId,
      parentCheckpointId,
      channelValues: JSON.stringify(checkpoint),
      channelVersions: JSON.stringify(metadata),
      createdAt: new Date().toISOString(),
    });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpointId,
      },
    };
  }

  async putWrites(
    _config: RunnableConfig,
    _writes: PendingWrite[],
    _taskId: string,
  ): Promise<void> {
    // Pending writes are stored in-memory during a single graph invocation.
    // For cross-station replication, the full checkpoint is persisted via put().
  }
}
