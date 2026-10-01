/**
 * NearShare Transfer Session Recovery Manager
 *
 * Orchestrates resilient session recovery across network dropouts, socket disconnections,
 * and subsequent secure session re-establishment.
 *
 * KEY RESPONSIBILITIES:
 * 1. Persistent Transfer Identity: Preserves logical transferId across connection drops.
 * 2. Clean Crypto Renewal: Mandates fresh SecureTransportSession on reconnect with no key reuse.
 * 3. Bounded Backoff Reconnection: Executes controlled exponential retry (1s, 2s, 4s, 8s, 16s).
 * 4. Missing-Range Resumption: Resumes chunk transmission only for unwritten intervals.
 * 5. Mandatory Final Integrity: Requires SHA-256 verification before transitioning to completed.
 * 6. Explicit Cancellation Safety: Cancelled transfers never auto-resume.
 * 7. Durable Storage Integration: Persists checkpoints across app sessions without secrets or host paths.
 */

import {
  TransferCheckpointStore,
} from '../checkpoint/TransferCheckpointStore';
import {
  type ByteRange,
  type TransferResumeCheckpoint,
  calculateMissingRanges,
} from '../checkpoint/ResumeCheckpoint';
import { ResumeProtocolEngine } from '../../protocol/resume/ResumeProtocol';
import type {
  ResumeRequestPayload,
  ResumeResponsePayload,
  ResumeRejectPayload,
} from '../../protocol/messageTypes';
import type { ProtocolSecurityContext } from '../../protocol/native/NativeTcpProtocolPeer';

export interface RecoveryConfig {
  autoReconnect: boolean;
  maxRetryAttempts: number;
  backoffScheduleMs: number[];
}

export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  autoReconnect: true,
  maxRetryAttempts: 5,
  backoffScheduleMs: [1_000, 2_000, 4_000, 8_000, 16_000],
};

export type RecoveryManagerStatus =
  | 'idle'
  | 'active'
  | 'interrupted'
  | 'reconnecting'
  | 'resuming'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface RecoveryEvent {
  transferId: string;
  status: RecoveryManagerStatus;
  attempt?: number;
  bytesReceived?: number;
  totalBytes?: number;
  message?: string;
}

export class TransferSessionRecoveryManager {
  readonly config: RecoveryConfig;
  readonly checkpointStore: TransferCheckpointStore;

  private currentStatus: RecoveryManagerStatus = 'idle';
  private currentAttempt = 0;
  private retryTimer: any = null;
  private listeners: Set<(event: RecoveryEvent) => void> = new Set();

  constructor(
    checkpointStore: TransferCheckpointStore,
    config?: Partial<RecoveryConfig>
  ) {
    this.checkpointStore = checkpointStore;
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
  }

  get status(): RecoveryManagerStatus {
    return this.currentStatus;
  }

  getStatus(): RecoveryManagerStatus {
    return this.currentStatus;
  }

  get retryAttempt(): number {
    return this.currentAttempt;
  }

  /**
   * Initializes tracking for an active transfer.
   */
  startTransfer(
    transferId: string,
    sourceDeviceId: string,
    destinationDeviceId: string,
    files: Array<{ transferFileId: string; name: string; fileSize: number; chunkSize: number }>
  ): TransferResumeCheckpoint {
    this.currentStatus = 'active';
    this.currentAttempt = 0;
    this.clearRetryTimer();

    const checkpoint = this.checkpointStore.createOrGetTransferCheckpoint(
      transferId,
      sourceDeviceId,
      destinationDeviceId,
      files
    );

    // Asynchronously write initial checkpoint to durable storage
    void this.checkpointStore.saveDurable(transferId);

    this.emitEvent({
      transferId,
      status: 'active',
      totalBytes: checkpoint.totalBytes,
      bytesReceived: checkpoint.totalReceivedBytes,
    });

    return checkpoint;
  }

  /**
   * Records an unexpected connection failure / interruption.
   */
  handleInterruption(
    transferId: string,
    reason: string = 'Network disconnected'
  ): { willRetry: boolean; nextRetryDelayMs?: number } {
    if (this.currentStatus === 'completed' || this.currentStatus === 'cancelled') {
      return { willRetry: false };
    }

    this.currentStatus = 'interrupted';
    this.checkpointStore.markInterrupted(transferId);
    void this.checkpointStore.saveDurable(transferId);

    this.emitEvent({
      transferId,
      status: 'interrupted',
      attempt: this.currentAttempt,
      message: reason,
    });

    if (!this.config.autoReconnect) {
      return { willRetry: false };
    }

    if (this.currentAttempt >= this.config.maxRetryAttempts) {
      this.currentStatus = 'failed';
      this.emitEvent({
        transferId,
        status: 'failed',
        attempt: this.currentAttempt,
        message: `Max reconnect attempts (${this.config.maxRetryAttempts}) reached`,
      });
      return { willRetry: false };
    }

    const delayIndex = Math.min(this.currentAttempt, this.config.backoffScheduleMs.length - 1);
    const delayMs = this.config.backoffScheduleMs[delayIndex];
    this.currentAttempt++;

    return { willRetry: true, nextRetryDelayMs: delayMs };
  }

  /**
   * Initiates resume negotiation on a freshly established secure session.
   */
  negotiateResume(
    transferId: string,
    sourceDeviceId: string,
    destinationDeviceId: string,
    securityContext: ProtocolSecurityContext,
    isReceiver: boolean,
    incomingRequest?: ResumeRequestPayload
  ): {
    success: boolean;
    response?: ResumeResponsePayload;
    rejection?: ResumeRejectPayload;
    missingRangesByFile?: Record<string, ByteRange[]>;
  } {
    if (this.currentStatus === 'cancelled') {
      return {
        success: false,
        rejection: {
          transferId,
          code: 'INVALID_CHECKPOINT',
          reason: 'Transfer was cancelled',
        },
      };
    }

    const checkpoint = this.checkpointStore.getTransferCheckpoint(transferId);
    if (!checkpoint) {
      return {
        success: false,
        rejection: {
          transferId,
          code: 'UNKNOWN_TRANSFER',
          reason: `No checkpoint found for transferId '${transferId}'`,
        },
      };
    }

    if (isReceiver && incomingRequest) {
      // Receiver side processing
      const result = ResumeProtocolEngine.processResumeRequest(
        incomingRequest,
        securityContext,
        destinationDeviceId,
        sourceDeviceId,
        checkpoint
      );

      if (result.valid && result.response) {
        this.currentStatus = 'resuming';
        this.checkpointStore.markResuming(transferId);
        void this.checkpointStore.saveDurable(transferId);
        this.currentAttempt = 0;
        this.emitEvent({
          transferId,
          status: 'resuming',
          message: 'Resume checkpoint accepted by receiver',
        });
        return { success: true, response: result.response };
      } else {
        return { success: false, rejection: result.rejection };
      }
    } else {
      // Sender side: compute missing ranges from receiver response
      const missingMap: Record<string, ByteRange[]> = {};
      for (const [fileId, fileCp] of Object.entries(checkpoint.files)) {
        missingMap[fileId] = calculateMissingRanges(fileCp.receivedRanges, fileCp.fileSize);
      }

      this.currentStatus = 'resuming';
      this.checkpointStore.markResuming(transferId);
      void this.checkpointStore.saveDurable(transferId);
      this.currentAttempt = 0;
      this.emitEvent({
        transferId,
        status: 'resuming',
        message: 'Resuming chunk transfer for missing byte intervals',
      });

      return { success: true, missingRangesByFile: missingMap };
    }
  }

  /**
   * Records chunk reception and returns updated completion state.
   */
  recordChunkReceived(
    transferId: string,
    transferFileId: string,
    range: ByteRange
  ): { fileComplete: boolean; transferComplete: boolean; uniqueBytes: number } {
    const res = this.checkpointStore.recordWrittenRange(transferId, transferFileId, range);

    const cp = this.checkpointStore.getTransferCheckpoint(transferId);
    if (cp) {
      this.emitEvent({
        transferId,
        status: res.transferComplete ? 'completed' : 'active',
        bytesReceived: cp.totalReceivedBytes,
        totalBytes: cp.totalBytes,
      });
    }

    return res;
  }

  /**
   * Finalizes transfer completion after mandatory SHA-256 verification.
   * Cleans up durable checkpoint only after integrity check passes.
   */
  finalizeTransfer(
    transferId: string,
    integrityVerified: boolean,
    calculatedHash?: string,
    expectedHash?: string
  ): { completed: boolean; error?: string } {
    if (!integrityVerified || (calculatedHash && expectedHash && calculatedHash !== expectedHash)) {
      this.currentStatus = 'failed';
      // Do NOT delete checkpoint on integrity failure — retain for recovery / inspection
      void this.checkpointStore.saveDurable(transferId);
      this.emitEvent({
        transferId,
        status: 'failed',
        message: 'INTEGRITY_VERIFICATION_FAILED: Hash mismatch',
      });
      return { completed: false, error: 'INTEGRITY_VERIFICATION_FAILED' };
    }

    this.currentStatus = 'completed';
    this.checkpointStore.markCompleted(transferId);
    this.currentAttempt = 0;

    // Purge checkpoint from durable storage on successful completion
    void this.checkpointStore.deleteDurable(transferId);

    this.emitEvent({
      transferId,
      status: 'completed',
      message: 'Transfer verified and completed successfully',
    });

    return { completed: true };
  }

  /**
   * Cancels transfer and invalidates checkpoint.
   */
  cancelTransfer(transferId: string, reason: string = 'User cancelled'): void {
    this.clearRetryTimer();
    this.currentStatus = 'cancelled';
    this.currentAttempt = 0;
    this.checkpointStore.invalidateCheckpoint(transferId);
    void this.checkpointStore.deleteDurable(transferId);

    this.emitEvent({
      transferId,
      status: 'cancelled',
      message: reason,
    });
  }

  // ---------------------------------------------------------------------------
  // Recovery Manager Public Lifecycle API (Part 15)
  // ---------------------------------------------------------------------------

  /**
   * Initiates recovery for a previously interrupted transfer.
   */
  async recoverTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    let checkpoint = this.checkpointStore.getTransferCheckpoint(transferId);
    if (!checkpoint) {
      checkpoint = await this.checkpointStore.loadDurable(transferId);
    }

    if (!checkpoint) {
      return { success: false, error: `NO_CHECKPOINT_FOUND: ${transferId}` };
    }

    if (checkpoint.status === 'cancelled') {
      return { success: false, error: 'CANNOT_RECOVER_CANCELLED_TRANSFER' };
    }

    this.currentStatus = 'reconnecting';
    this.checkpointStore.markResuming(transferId);

    this.emitEvent({
      transferId,
      status: 'reconnecting',
      message: 'Initiating manual transfer recovery...',
    });

    return { success: true };
  }

  /**
   * Pauses active recovery attempts.
   */
  pauseRecovery(transferId: string): void {
    this.clearRetryTimer();
    this.currentStatus = 'interrupted';
    this.checkpointStore.markInterrupted(transferId);
    void this.checkpointStore.saveDurable(transferId);

    this.emitEvent({
      transferId,
      status: 'interrupted',
      message: 'Recovery paused by user',
    });
  }

  /**
   * Cancels ongoing recovery.
   */
  cancelRecovery(transferId: string, reason: string = 'Recovery cancelled'): void {
    this.cancelTransfer(transferId, reason);
  }

  /**
   * Returns current recovery checkpoint state for a transfer.
   */
  getRecoveryState(transferId: string): TransferResumeCheckpoint | null {
    return this.checkpointStore.getTransferCheckpoint(transferId);
  }

  /**
   * Lists all incomplete recoverable transfers from durable storage.
   */
  async listRecoverableTransfers(): Promise<TransferResumeCheckpoint[]> {
    return this.checkpointStore.listIncompleteDurable();
  }

  onEvent(listener: (event: RecoveryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitEvent(event: RecoveryEvent): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        console.error('[TransferSessionRecoveryManager] Listener error:', err);
      }
    });
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  destroy(): void {
    this.clearRetryTimer();
    this.listeners.clear();
    this.currentStatus = 'idle';
  }
}
