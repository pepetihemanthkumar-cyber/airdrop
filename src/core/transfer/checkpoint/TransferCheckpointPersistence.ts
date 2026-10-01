/**
 * NearShare Transfer Checkpoint Persistence Abstraction
 *
 * Provides a clean boundary separating memory-only transfer checkpoint stores
 * from durable persistent storage backends (Tauri app data directory, SQLite, or Memory mock).
 *
 * SECURITY & PRIVACY INVARIANTS:
 * 1. Safe Metadata Only: Never stores private keys, session keys, pairing PINs, or auth tokens.
 * 2. Zero Host Path Leakage: Native filesystem storage paths are never returned to the frontend.
 * 3. Validation on Load & Save: Every checkpoint is validated against schema and version rules.
 */

import {
  type TransferResumeCheckpoint,
  CHECKPOINT_CURRENT_VERSION,
  validateCheckpointSafety,
} from './ResumeCheckpoint';
import {
  isTauriRuntime,
  saveTransferCheckpointIpc,
  loadTransferCheckpointIpc,
  listIncompleteCheckpointsIpc,
  deleteTransferCheckpointIpc,
} from '../../native/tauri/TauriIpc';

export interface TransferCheckpointPersistence {
  /**
   * Durably saves a transfer checkpoint.
   */
  save(checkpoint: TransferResumeCheckpoint): Promise<boolean>;

  /**
   * Loads a specific checkpoint by transfer ID.
   */
  load(transferId: string): Promise<TransferResumeCheckpoint | null>;

  /**
   * Deletes a checkpoint from durable storage.
   */
  delete(transferId: string): Promise<boolean>;

  /**
   * Lists all incomplete / recoverable checkpoints discovered in durable storage.
   */
  listIncomplete(): Promise<TransferResumeCheckpoint[]>;

  /**
   * Purges all cancelled checkpoints.
   */
  clearCancelled(): Promise<number>;
}

/**
 * Memory-backed checkpoint persistence for unit tests and browser fallback.
 */
export class MemoryCheckpointPersistence implements TransferCheckpointPersistence {
  private store = new Map<string, string>();

  async save(checkpoint: TransferResumeCheckpoint): Promise<boolean> {
    const safety = validateCheckpointSafety(checkpoint);
    if (!safety.valid) {
      throw new Error(`INVALID_CHECKPOINT: ${safety.error}`);
    }

    const versioned: TransferResumeCheckpoint = {
      ...checkpoint,
      checkpointVersion: checkpoint.checkpointVersion ?? CHECKPOINT_CURRENT_VERSION,
    };

    this.store.set(checkpoint.transferId, JSON.stringify(versioned));
    return true;
  }

  async load(transferId: string): Promise<TransferResumeCheckpoint | null> {
    if (!transferId || !/^[a-zA-Z0-9_\-]+$/.test(transferId)) {
      return null;
    }
    const raw = this.store.get(transferId);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as TransferResumeCheckpoint;
      const safety = validateCheckpointSafety(parsed);
      if (!safety.valid) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async delete(transferId: string): Promise<boolean> {
    return this.store.delete(transferId);
  }

  async listIncomplete(): Promise<TransferResumeCheckpoint[]> {
    const list: TransferResumeCheckpoint[] = [];
    for (const raw of this.store.values()) {
      try {
        const parsed = JSON.parse(raw) as TransferResumeCheckpoint;
        if (parsed.status !== 'completed' && parsed.status !== 'cancelled') {
          const safety = validateCheckpointSafety(parsed);
          if (safety.valid) {
            list.push(parsed);
          }
        }
      } catch {
        // Skip corrupted entries
      }
    }
    return list;
  }

  async clearCancelled(): Promise<number> {
    let cleared = 0;
    for (const [id, raw] of this.store.entries()) {
      try {
        const parsed = JSON.parse(raw) as TransferResumeCheckpoint;
        if (parsed.status === 'cancelled') {
          this.store.delete(id);
          cleared++;
        }
      } catch {
        this.store.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Tauri native app-data persistent checkpoint backend.
 * Falls back to MemoryCheckpointPersistence when running outside Tauri desktop runtime.
 */
export class TauriNativeCheckpointPersistence implements TransferCheckpointPersistence {
  private fallbackMemory = new MemoryCheckpointPersistence();

  async save(checkpoint: TransferResumeCheckpoint): Promise<boolean> {
    const safety = validateCheckpointSafety(checkpoint);
    if (!safety.valid) {
      throw new Error(`INVALID_CHECKPOINT: ${safety.error}`);
    }

    const versioned: TransferResumeCheckpoint = {
      ...checkpoint,
      checkpointVersion: checkpoint.checkpointVersion ?? CHECKPOINT_CURRENT_VERSION,
    };

    if (!isTauriRuntime()) {
      return this.fallbackMemory.save(versioned);
    }

    try {
      const jsonStr = JSON.stringify(versioned);
      return await saveTransferCheckpointIpc(jsonStr);
    } catch (err) {
      console.warn('[TauriNativeCheckpointPersistence] save failed, falling back to memory:', err);
      return this.fallbackMemory.save(versioned);
    }
  }

  async load(transferId: string): Promise<TransferResumeCheckpoint | null> {
    if (!transferId || !/^[a-zA-Z0-9_\-]+$/.test(transferId)) {
      return null;
    }

    if (!isTauriRuntime()) {
      return this.fallbackMemory.load(transferId);
    }

    try {
      const raw = await loadTransferCheckpointIpc(transferId);
      if (!raw) {
        return this.fallbackMemory.load(transferId);
      }
      const parsed = JSON.parse(raw) as TransferResumeCheckpoint;
      const safety = validateCheckpointSafety(parsed);
      if (!safety.valid) {
        return null;
      }
      return parsed;
    } catch {
      return this.fallbackMemory.load(transferId);
    }
  }

  async delete(transferId: string): Promise<boolean> {
    if (!transferId || !/^[a-zA-Z0-9_\-]+$/.test(transferId)) {
      return false;
    }

    let memoryDeleted = false;
    try {
      memoryDeleted = await this.fallbackMemory.delete(transferId);
    } catch {
      // Ignore
    }

    if (!isTauriRuntime()) {
      return memoryDeleted;
    }

    try {
      return await deleteTransferCheckpointIpc(transferId);
    } catch {
      return memoryDeleted;
    }
  }

  async listIncomplete(): Promise<TransferResumeCheckpoint[]> {
    if (!isTauriRuntime()) {
      return this.fallbackMemory.listIncomplete();
    }

    try {
      const rawList = await listIncompleteCheckpointsIpc();
      const list: TransferResumeCheckpoint[] = [];
      for (const raw of rawList) {
        try {
          const parsed = JSON.parse(raw) as TransferResumeCheckpoint;
          if (parsed.status !== 'completed' && parsed.status !== 'cancelled') {
            const safety = validateCheckpointSafety(parsed);
            if (safety.valid) {
              list.push(parsed);
            }
          }
        } catch {
          // Skip malformed
        }
      }
      return list;
    } catch {
      return this.fallbackMemory.listIncomplete();
    }
  }

  async clearCancelled(): Promise<number> {
    return this.fallbackMemory.clearCancelled();
  }
}
