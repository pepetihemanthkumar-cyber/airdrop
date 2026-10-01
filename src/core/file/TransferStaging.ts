/**
 * NearShare Transfer Staging Area
 *
 * Manages in-flight temporary file staging, memory buffers, and cleanup
 * of abandoned or completed transfers.
 */

import type { FileSource, FileTransferResult } from './types';

export interface StagedFile {
  file: FileSource;
  temporaryId: string;
  bytesWritten: number;
  completed: boolean;
  result?: FileTransferResult;
  stagedAt: number;
  lastUpdatedAt: number;
}

export interface StagedTransfer {
  transferId: string;
  files: Map<string, StagedFile>;
  createdAt: number;
  lastUpdatedAt: number;
  status: 'staging' | 'finalized' | 'aborted';
}

export class TransferStagingArea {
  private transfers = new Map<string, StagedTransfer>();

  /**
   * Initializes a staging container for a new transfer session.
   */
  createTransferStaging(transferId: string): StagedTransfer {
    const existing = this.transfers.get(transferId);
    if (existing) return existing;

    const staging: StagedTransfer = {
      transferId,
      files: new Map(),
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      status: 'staging',
    };
    this.transfers.set(transferId, staging);
    return staging;
  }

  /**
   * Registers a file inside the transfer staging container.
   */
  stageFile(transferId: string, file: FileSource): StagedFile {
    const staging = this.createTransferStaging(transferId);
    const temporaryId = `tmp_${transferId}_${file.fileId}_${Date.now().toString(36)}`;

    const staged: StagedFile = {
      file,
      temporaryId,
      bytesWritten: 0,
      completed: false,
      stagedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };

    staging.files.set(file.fileId, staged);
    staging.lastUpdatedAt = Date.now();
    return staged;
  }

  /**
   * Retrieves a staged file reference.
   */
  getStagedFile(transferId: string, fileId: string): StagedFile | null {
    const staging = this.transfers.get(transferId);
    return staging?.files.get(fileId) ?? null;
  }

  /**
   * Updates byte progression for a staged file.
   */
  recordStagedBytes(transferId: string, fileId: string, bytes: number): void {
    const file = this.getStagedFile(transferId, fileId);
    if (file) {
      file.bytesWritten = bytes;
      file.lastUpdatedAt = Date.now();
      const staging = this.transfers.get(transferId);
      if (staging) staging.lastUpdatedAt = Date.now();
    }
  }

  /**
   * Marks a file as finalized in staging.
   */
  markFileComplete(transferId: string, fileId: string, result: FileTransferResult): void {
    const file = this.getStagedFile(transferId, fileId);
    if (file) {
      file.completed = true;
      file.result = result;
      file.lastUpdatedAt = Date.now();
    }
  }

  /**
   * Finalizes the entire transfer container.
   */
  finalizeTransfer(transferId: string): StagedTransfer | null {
    const staging = this.transfers.get(transferId);
    if (staging) {
      staging.status = 'finalized';
      staging.lastUpdatedAt = Date.now();
      return staging;
    }
    return null;
  }

  /**
   * Removes and purges a staging container.
   */
  removeTransfer(transferId: string): void {
    this.transfers.delete(transferId);
  }

  /**
   * Cleans up transfers that have remained inactive beyond maxAgeMs (default: 1 hour).
   */
  cleanupAbandoned(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let purgedCount = 0;
    for (const [id, staging] of Array.from(this.transfers.entries())) {
      if (now - staging.lastUpdatedAt > maxAgeMs) {
        this.transfers.delete(id);
        purgedCount++;
      }
    }
    return purgedCount;
  }
}
