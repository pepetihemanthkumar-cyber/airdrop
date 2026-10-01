/**
 * NearShare Desktop Lifecycle & System Tray Manager
 *
 * Coordinates native window visibility, system tray status, background transfer
 * execution, safe application termination, and privacy-preserving desktop notifications.
 *
 * INVARIANTS:
 * 1. Single Source of Truth: Derives state strictly from TransferQueueContext; no transfer state duplication.
 * 2. Background Boundary: "Background transfer" means the Tauri app remains running while the window is hidden.
 * 3. Safe Shutdown: Quitting with active transfers requires checkpoint flushing before process termination.
 * 4. Privacy: Desktop notifications and tray tooltips never expose keys, tokens, PINs, or absolute paths.
 */

import {
  showMainWindow,
  hideMainWindow,
  updateTrayStatusIpc,
  sendDesktopNotificationIpc,
  quitApplicationIpc,
  onTrayNavigate,
  onAppQuitRequested,
  type TrayStatusKind,
} from '../native/tauri/TauriIpc';
import type { TransferQueueItem } from '../../context/TransferQueueContext';
import type { TransferCheckpointStore } from '../transfer/checkpoint';

export interface DesktopLifecycleConfig {
  runInBackground: boolean;
  showTrayIcon: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
  notifyOnIncoming: boolean;
}

export const DEFAULT_LIFECYCLE_CONFIG: DesktopLifecycleConfig = {
  runInBackground: true,
  showTrayIcon: true,
  notifyOnComplete: true,
  notifyOnFailure: true,
  notifyOnIncoming: true,
};

export interface SafeTransferSummary {
  activeCount: number;
  receivingCount: number;
  interruptedCount: number;
  failedCount: number;
  completedCount: number;
  overallProgress: number;
  statusLabel: TrayStatusKind;
}

export class DesktopLifecycleManager {
  private config: DesktopLifecycleConfig;
  private checkpointStore?: TransferCheckpointStore;
  private isWindowHidden: boolean = false;
  private cleanupListeners: Array<() => void> = [];

  constructor(
    config: Partial<DesktopLifecycleConfig> = {},
    checkpointStore?: TransferCheckpointStore
  ) {
    this.config = { ...DEFAULT_LIFECYCLE_CONFIG, ...config };
    this.checkpointStore = checkpointStore;
  }

  /**
   * Initializes native tray listeners and window event subscriptions.
   */
  initialize(
    onNavigate: (target: 'home' | 'new_transfer' | 'queue' | 'settings') => void,
    onShowQuitModal?: (activeCount: number) => void
  ): () => void {
    const unlistenNav = onTrayNavigate((target) => {
      this.isWindowHidden = false;
      onNavigate(target);
    });

    const unlistenQuit = onAppQuitRequested(async () => {
      const summary = this.lastSummary;
      const totalActive = (summary?.activeCount ?? 0) + (summary?.receivingCount ?? 0);
      if (totalActive > 0) {
        if (onShowQuitModal) {
          // Surface quit confirmation modal to user
          this.isWindowHidden = false;
          onShowQuitModal(totalActive);
          void showMainWindow();
        } else {
          // Fallback: Safe shutdown with checkpoint flush
          await this.executeSafeShutdown(true);
        }
      } else {
        await this.executeSafeShutdown(false);
      }
    });

    this.cleanupListeners.push(unlistenNav, unlistenQuit);

    return () => {
      this.destroy();
    };
  }

  private lastSummary?: SafeTransferSummary;

  /**
   * Evaluates active transfer queue items and synchronizes native tray status.
   */
  syncTransferQueueState(queueItems: TransferQueueItem[]): SafeTransferSummary {
    let activeCount = 0;
    let receivingCount = 0;
    let interruptedCount = 0;
    let failedCount = 0;
    let completedCount = 0;
    let totalBytes = 0;
    let transferredBytes = 0;

    for (const item of queueItems) {
      if (item.status === 'transferring' || item.status === 'resuming' || (item.status as any) === 'receiving') {
        if (item.direction === 'receive' || (item.status as any) === 'receiving') {
          receivingCount++;
        } else {
          activeCount++;
        }
        totalBytes += item.totalSize;
        transferredBytes += item.transferredSize;
      } else if (item.status === 'interrupted' || item.status === 'reconnecting') {
        interruptedCount++;
      } else if (item.status === 'failed') {
        failedCount++;
      } else if (item.status === 'completed') {
        completedCount++;
      }
    }

    let statusLabel: TrayStatusKind = 'Idle';
    if (activeCount > 0) {
      statusLabel = 'Transferring';
    } else if (receivingCount > 0) {
      statusLabel = 'Receiving';
    } else if (interruptedCount > 0) {
      statusLabel = 'Interrupted';
    } else if (failedCount > 0) {
      statusLabel = 'Failed';
    } else if (completedCount > 0 && queueItems.length === completedCount) {
      statusLabel = 'Completed';
    }

    const overallProgress = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;
    const totalActive = activeCount + receivingCount;

    let tooltip = 'NearShare - Fast, Local-First File Transfer';
    if (totalActive > 1) {
      tooltip = `NearShare - ${totalActive} active transfers (${overallProgress}%)`;
    } else if (totalActive === 1) {
      tooltip = `NearShare - ${statusLabel} (${overallProgress}%)`;
    } else if (interruptedCount > 0) {
      tooltip = `NearShare - ${interruptedCount} transfers interrupted`;
    }

    const summary: SafeTransferSummary = {
      activeCount,
      receivingCount,
      interruptedCount,
      failedCount,
      completedCount,
      overallProgress,
      statusLabel,
    };

    this.lastSummary = summary;

    // Update native tray status without throwing
    void updateTrayStatusIpc(statusLabel, totalActive, tooltip);

    return summary;
  }

  /**
   * Dispatches a desktop notification when a transfer completes.
   */
  async notifyTransferComplete(_fileName: string, totalBytes: number, peerName?: string): Promise<void> {
    if (!this.config.notifyOnComplete) return;

    const formattedSize = this.formatBytes(totalBytes);
    const peerInfo = peerName ? ` with ${peerName}` : '';
    const safeTitle = 'Transfer Complete';
    const safeBody = `Successfully transferred ${formattedSize}${peerInfo}.`;

    await sendDesktopNotificationIpc(safeTitle, safeBody);
  }

  /**
   * Dispatches a desktop notification when a transfer fails.
   */
  async notifyTransferFailed(_fileName: string, _reason?: string, peerName?: string): Promise<void> {
    if (!this.config.notifyOnFailure) return;

    const peerInfo = peerName ? ` with ${peerName}` : '';
    const safeTitle = 'Transfer Interrupted';
    const safeBody = `Transfer${peerInfo} failed. Checkpoint saved for resumption.`;

    await sendDesktopNotificationIpc(safeTitle, safeBody);
  }

  /**
   * Dispatches a desktop notification when an incoming transfer request arrives while hidden.
   */
  async notifyIncomingRequest(senderName: string, fileCount: number, totalBytes: number): Promise<void> {
    if (!this.config.notifyOnIncoming) return;

    const formattedSize = this.formatBytes(totalBytes);
    const safeTitle = 'Incoming Transfer Request';
    const safeBody = `${senderName} wants to send ${fileCount} ${fileCount === 1 ? 'file' : 'files'} (${formattedSize}).`;

    await sendDesktopNotificationIpc(safeTitle, safeBody);
  }

  /**
   * Executes safe application shutdown, flushing all durable checkpoints first.
   */
  async executeSafeShutdown(saveCheckpointsFirst: boolean = true): Promise<void> {
    if (saveCheckpointsFirst && this.checkpointStore) {
      try {
        // Allow checkpoint storage to finalize pending atomic writes
        const incomplete = this.checkpointStore.listIncomplete();
        for (const cp of incomplete) {
          await this.checkpointStore.saveDurable(cp.transferId);
        }
      } catch (err) {
        console.warn('[DesktopLifecycleManager] Failed to flush checkpoints before quit:', err);
      }
    }

    await quitApplicationIpc();
  }

  /**
   * Hides the window to the tray if runInBackground is enabled, or executes safe quit.
   */
  async handleWindowCloseRequested(activeTransferCount: number): Promise<{ didHide: boolean }> {
    if (this.config.runInBackground) {
      await hideMainWindow();
      this.isWindowHidden = true;
      return { didHide: true };
    }

    if (activeTransferCount === 0) {
      await this.executeSafeShutdown(false);
      return { didHide: false };
    }

    return { didHide: false };
  }

  async restoreMainWindow(): Promise<void> {
    await showMainWindow();
    this.isWindowHidden = false;
  }

  getIsWindowHidden(): boolean {
    return this.isWindowHidden;
  }

  updateConfig(updates: Partial<DesktopLifecycleConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): DesktopLifecycleConfig {
    return { ...this.config };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  destroy(): void {
    for (const unlisten of this.cleanupListeners) {
      try {
        unlisten();
      } catch {}
    }
    this.cleanupListeners = [];
  }
}
