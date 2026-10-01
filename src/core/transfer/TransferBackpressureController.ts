/**
 * NearShare Transfer Backpressure Controller
 *
 * Implements cooperative producer-consumer flow control to prevent the file reader
 * from loading chunks into memory faster than the network transport and receiver
 * can transmit and acknowledge them.
 */

import { type ResourceLimits, DEFAULT_RESOURCE_LIMITS } from './ResourceLimits';

export interface InFlightStats {
  readonly inFlightCount: number;
  readonly inFlightBytes: number;
  readonly waitingRequestsCount: number;
  readonly isPaused: boolean;
  readonly isDrained: boolean;
}

interface WaitingPermit {
  readonly chunkSizeBytes: number;
  readonly resolve: () => void;
  readonly reject: (err: Error) => void;
}

export class TransferBackpressureController {
  private readonly limits: ResourceLimits;
  private currentInFlightCount = 0;
  private currentInFlightBytes = 0;
  private waitingQueue: WaitingPermit[] = [];
  private paused = false;
  private cancelled = false;

  constructor(limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS) {
    this.limits = limits;
  }

  /**
   * Acquires a permit to read and dispatch the next chunk.
   * If in-flight limits are exceeded or the transfer is paused, blocks until capacity is restored.
   */
  public async acquireChunkPermit(chunkSizeBytes: number): Promise<void> {
    if (this.cancelled) {
      throw new Error('Transfer is cancelled; permit acquisition rejected');
    }

    const safeSize = Math.max(0, chunkSizeBytes);

    // If within limits and not paused, grant immediately
    if (!this.paused && this.canAdmit(safeSize)) {
      this.currentInFlightCount += 1;
      this.currentInFlightBytes += safeSize;
      return;
    }

    // Otherwise enqueue waiter
    return new Promise<void>((resolve, reject) => {
      this.waitingQueue.push({
        chunkSizeBytes: safeSize,
        resolve,
        reject,
      });
    });
  }

  /**
   * Releases an in-flight chunk permit upon receiving transport ACK or failure.
   */
  public releaseChunkPermit(chunkSizeBytes: number): void {
    const safeSize = Math.max(0, chunkSizeBytes);

    this.currentInFlightCount = Math.max(0, this.currentInFlightCount - 1);
    this.currentInFlightBytes = Math.max(0, this.currentInFlightBytes - safeSize);

    this.drainNext();
  }

  /**
   * Pauses the chunk generation loop (e.g. user requested pause).
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * Resumes the chunk generation loop.
   */
  public resume(): void {
    this.paused = false;
    this.drainNext();
  }

  /**
   * Cancels all pending permits and rejects waiting promises.
   */
  public cancel(reason = 'Transfer cancelled'): void {
    this.cancelled = true;
    this.paused = false;

    const error = new Error(reason);
    const pending = [...this.waitingQueue];
    this.waitingQueue = [];

    for (const w of pending) {
      try {
        w.reject(error);
      } catch {
        // Ignored
      }
    }

    this.currentInFlightCount = 0;
    this.currentInFlightBytes = 0;
  }

  /**
   * Resets controller state for a clean session.
   */
  public reset(): void {
    this.cancelled = false;
    this.paused = false;
    this.waitingQueue = [];
    this.currentInFlightCount = 0;
    this.currentInFlightBytes = 0;
  }

  /**
   * Gets current in-flight queue statistics.
   */
  public getStats(): InFlightStats {
    return {
      inFlightCount: this.currentInFlightCount,
      inFlightBytes: this.currentInFlightBytes,
      waitingRequestsCount: this.waitingQueue.length,
      isPaused: this.paused,
      isDrained: this.currentInFlightCount === 0 && this.waitingQueue.length === 0,
    };
  }

  private canAdmit(chunkSizeBytes: number): boolean {
    if (this.currentInFlightCount >= this.limits.maxInFlightChunks) {
      return false;
    }
    if (this.currentInFlightBytes + chunkSizeBytes > this.limits.maxChunkBufferBytes && this.currentInFlightCount > 0) {
      return false;
    }
    return true;
  }

  private drainNext(): void {
    if (this.paused || this.cancelled) return;

    while (this.waitingQueue.length > 0) {
      const next = this.waitingQueue[0];
      if (this.canAdmit(next.chunkSizeBytes)) {
        this.waitingQueue.shift();
        this.currentInFlightCount += 1;
        this.currentInFlightBytes += next.chunkSizeBytes;
        next.resolve();
      } else {
        break;
      }
    }
  }
}
