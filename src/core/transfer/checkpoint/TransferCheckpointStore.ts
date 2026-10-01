/**
 * NearShare Transfer Checkpoint Store
 *
 * In-memory and development persistent store for managing transfer resume checkpoints.
 * Decoupled from transport sessions, physical TCP connections, and cryptographic sessions.
 * Integrates optional durable persistence backend (Tauri app data / SQLite / Memory mock).
 */

import {
  type TransferResumeCheckpoint,
  type FileCheckpoint,
  type ByteRange,
  CHECKPOINT_CURRENT_VERSION,
  mergeByteRanges,
  calculateUniqueBytes,
  isFileCheckpointComplete,
  validateCheckpointSafety,
} from './ResumeCheckpoint';
import {
  type TransferCheckpointPersistence,
  TauriNativeCheckpointPersistence,
} from './TransferCheckpointPersistence';

export class TransferCheckpointStore {
  private checkpoints = new Map<string, TransferResumeCheckpoint>();
  private persistence?: TransferCheckpointPersistence;

  constructor(persistence?: TransferCheckpointPersistence) {
    this.persistence = persistence ?? new TauriNativeCheckpointPersistence();
  }

  getPersistence(): TransferCheckpointPersistence | undefined {
    return this.persistence;
  }

  /**
   * Initializes or updates a transfer checkpoint.
   */
  createOrGetTransferCheckpoint(
    transferId: string,
    sourceDeviceId: string,
    destinationDeviceId: string,
    files: Array<{ transferFileId: string; name: string; fileSize: number; chunkSize: number }>
  ): TransferResumeCheckpoint {
    const existing = this.checkpoints.get(transferId);
    if (existing) {
      existing.sourceDeviceId = sourceDeviceId;
      existing.destinationDeviceId = destinationDeviceId;
      existing.updatedAt = Date.now();
      return existing;
    }

    const fileMap: Record<string, FileCheckpoint> = {};
    let totalBytes = 0;

    for (const f of files) {
      if (f.fileSize < 0) {
        throw new Error(`INVALID_CHECKPOINT: INVALID_FILE_SIZES: ${f.transferFileId}`);
      }
      if (f.chunkSize <= 0) {
        throw new Error(`INVALID_CHECKPOINT: INVALID_CHUNK_SIZE: ${f.transferFileId}`);
      }
      totalBytes += f.fileSize;
      fileMap[f.transferFileId] = {
        transferFileId: f.transferFileId,
        name: f.name,
        fileSize: f.fileSize,
        chunkSize: f.chunkSize,
        receivedRanges: [],
        receivedBytes: 0,
        lastConfirmedOffset: 0,
        isComplete: f.fileSize === 0,
        updatedAt: Date.now(),
      };
    }

    const checkpoint: TransferResumeCheckpoint = {
      checkpointVersion: CHECKPOINT_CURRENT_VERSION,
      transferId,
      sourceDeviceId,
      destinationDeviceId,
      files: fileMap,
      totalFiles: files.length,
      totalBytes,
      totalReceivedBytes: 0,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const safety = validateCheckpointSafety(checkpoint);
    if (!safety.valid) {
      throw new Error(`INVALID_CHECKPOINT: ${safety.error}`);
    }

    this.checkpoints.set(transferId, checkpoint);
    return checkpoint;
  }

  /**
   * Directly registers an existing/loaded checkpoint into the active cache.
   */
  registerCheckpoint(checkpoint: TransferResumeCheckpoint): void {
    const safety = validateCheckpointSafety(checkpoint);
    if (!safety.valid) {
      throw new Error(`INVALID_CHECKPOINT: ${safety.error}`);
    }
    this.checkpoints.set(checkpoint.transferId, checkpoint);
  }

  /**
   * Records a committed byte range write for a specific file.
   */
  recordWrittenRange(
    transferId: string,
    transferFileId: string,
    range: ByteRange
  ): { fileComplete: boolean; transferComplete: boolean; uniqueBytes: number } {
    const cp = this.checkpoints.get(transferId);
    if (!cp) {
      throw new Error(`UNKNOWN_TRANSFER_CHECKPOINT: ${transferId}`);
    }

    const fileCp = cp.files[transferFileId];
    if (!fileCp) {
      throw new Error(`UNKNOWN_FILE_CHECKPOINT: ${transferFileId}`);
    }

    if (range.length > 0 && range.offset >= 0) {
      fileCp.receivedRanges.push({ offset: range.offset, length: range.length });
      fileCp.receivedRanges = mergeByteRanges(fileCp.receivedRanges);
      fileCp.receivedBytes = calculateUniqueBytes(fileCp.receivedRanges);
      fileCp.lastConfirmedOffset = Math.max(fileCp.lastConfirmedOffset, range.offset + range.length);
      fileCp.isComplete = isFileCheckpointComplete(fileCp);
      fileCp.updatedAt = Date.now();
    }

    // Recalculate total transfer received bytes
    let sum = 0;
    let allFilesComplete = true;
    for (const f of Object.values(cp.files)) {
      sum += f.receivedBytes;
      if (!f.isComplete) {
        allFilesComplete = false;
      }
    }
    cp.totalReceivedBytes = sum;
    cp.updatedAt = Date.now();

    if (allFilesComplete) {
      cp.status = 'completed';
    }

    return {
      fileComplete: fileCp.isComplete,
      transferComplete: allFilesComplete,
      uniqueBytes: fileCp.receivedBytes,
    };
  }

  /**
   * Retrieves a transfer checkpoint from in-memory cache.
   */
  getTransferCheckpoint(transferId: string): TransferResumeCheckpoint | null {
    return this.checkpoints.get(transferId) ?? null;
  }

  /**
   * Retrieves a specific file checkpoint.
   */
  getFileCheckpoint(transferId: string, transferFileId: string): FileCheckpoint | null {
    const cp = this.checkpoints.get(transferId);
    if (!cp) return null;
    return cp.files[transferFileId] ?? null;
  }

  /**
   * Transitions transfer checkpoint state to interrupted.
   */
  markInterrupted(transferId: string): void {
    const cp = this.checkpoints.get(transferId);
    if (cp && cp.status !== 'completed' && cp.status !== 'cancelled') {
      cp.status = 'interrupted';
      cp.updatedAt = Date.now();
    }
  }

  /**
   * Transitions transfer checkpoint state to resuming.
   */
  markResuming(transferId: string): void {
    const cp = this.checkpoints.get(transferId);
    if (cp && cp.status === 'interrupted') {
      cp.status = 'resuming';
      cp.updatedAt = Date.now();
    }
  }

  /**
   * Transitions transfer checkpoint state to completed.
   */
  markCompleted(transferId: string): void {
    const cp = this.checkpoints.get(transferId);
    if (cp) {
      cp.status = 'completed';
      for (const f of Object.values(cp.files)) {
        f.isComplete = true;
      }
      cp.updatedAt = Date.now();
    }
  }

  /**
   * Permanently cancels / invalidates a transfer checkpoint.
   */
  invalidateCheckpoint(transferId: string): void {
    const cp = this.checkpoints.get(transferId);
    if (cp) {
      cp.status = 'cancelled';
      cp.updatedAt = Date.now();
    }
  }

  /**
   * Deletes a checkpoint completely from in-memory storage.
   */
  purgeCheckpoint(transferId: string): void {
    this.checkpoints.delete(transferId);
  }

  /**
   * Clears all in-memory stored checkpoints.
   */
  clear(): void {
    this.checkpoints.clear();
  }

  /**
   * Lists all incomplete / uncompleted transfer checkpoints in memory.
   */
  listIncomplete(): TransferResumeCheckpoint[] {
    return Array.from(this.checkpoints.values()).filter(
      (cp) => cp.status !== 'completed' && cp.status !== 'cancelled'
    );
  }

  // ---------------------------------------------------------------------------
  // Asynchronous Durable Persistence Operations
  // ---------------------------------------------------------------------------

  /**
   * Flushes an active checkpoint to durable storage.
   */
  async saveDurable(transferId: string): Promise<boolean> {
    if (!this.persistence) return false;
    const cp = this.checkpoints.get(transferId);
    if (!cp) return false;
    return this.persistence.save(cp);
  }

  /**
   * Loads a checkpoint from durable storage into memory cache.
   */
  async loadDurable(transferId: string): Promise<TransferResumeCheckpoint | null> {
    if (!this.persistence) return null;
    const cp = await this.persistence.load(transferId);
    if (cp) {
      this.checkpoints.set(cp.transferId, cp);
    }
    return cp;
  }

  /**
   * Lists all incomplete checkpoints discovered in durable storage.
   */
  async listIncompleteDurable(): Promise<TransferResumeCheckpoint[]> {
    if (!this.persistence) return [];
    return this.persistence.listIncomplete();
  }

  /**
   * Deletes a checkpoint from durable storage and in-memory cache.
   */
  async deleteDurable(transferId: string): Promise<boolean> {
    this.purgeCheckpoint(transferId);
    if (!this.persistence) return true;
    return this.persistence.delete(transferId);
  }
}
