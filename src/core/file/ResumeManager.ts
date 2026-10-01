/**
 * NearShare Resume Manager
 *
 * Tracks granular transfer checkpoints per file and computes missing chunks
 * to enable seamless resumption without restarting transfers from zero.
 */

import type { ResumeCheckpoint } from './types';

export class ResumeManager {
  // Key format: `${transferId}:${fileId}`
  private checkpoints = new Map<string, ResumeCheckpoint>();

  private getKey(transferId: string, fileId: string): string {
    return `${transferId}:${fileId}`;
  }

  /**
   * Creates a new checkpoint record for a specific file transfer.
   */
  createCheckpoint(
    transferId: string,
    fileId: string,
    nextChunkIndex: number,
    bytesReceived: number
  ): ResumeCheckpoint {
    const checkpoint: ResumeCheckpoint = {
      transferId,
      fileId,
      nextChunkIndex: Math.max(0, nextChunkIndex),
      bytesReceived: Math.max(0, bytesReceived),
      updatedAt: Date.now(),
    };
    this.checkpoints.set(this.getKey(transferId, fileId), checkpoint);
    return checkpoint;
  }

  /**
   * Updates an existing checkpoint record.
   */
  updateCheckpoint(checkpoint: ResumeCheckpoint): void {
    const key = this.getKey(checkpoint.transferId, checkpoint.fileId);
    this.checkpoints.set(key, {
      ...checkpoint,
      updatedAt: Date.now(),
    });
  }

  /**
   * Retrieves the active checkpoint for a file in a transfer.
   */
  getCheckpoint(transferId: string, fileId: string): ResumeCheckpoint | null {
    return this.checkpoints.get(this.getKey(transferId, fileId)) ?? null;
  }

  /**
   * Clears the checkpoint after successful completion or permanent cancellation.
   */
  clearCheckpoint(transferId: string, fileId: string): void {
    this.checkpoints.delete(this.getKey(transferId, fileId));
  }

  /**
   * Purges all checkpoints associated with a transfer.
   */
  clearTransferCheckpoints(transferId: string): void {
    const prefix = `${transferId}:`;
    for (const key of Array.from(this.checkpoints.keys())) {
      if (key.startsWith(prefix)) {
        this.checkpoints.delete(key);
      }
    }
  }

  /**
   * Computes the list of missing chunk indexes given the total chunk count and received indexes.
   */
  getMissingChunks(totalChunks: number, receivedChunkIndexes: Iterable<number>): number[] {
    if (totalChunks <= 0) return [];
    const receivedSet = new Set<number>(receivedChunkIndexes);
    const missing: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (!receivedSet.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }
}
