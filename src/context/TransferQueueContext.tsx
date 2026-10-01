import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from './SettingsContext';
import { useTransferHistory, type TransferHistoryItem } from './TransferHistoryContext';
import { useTransport } from './TransportContext';
import {
  formatBytes,
  calculateDynamicSpeed,
  calculateEta,
  type TransferStatus,
  type MockFileItem,
  type DeviceInfo,
} from '../services/mockTransferEngine';
import type { TransferMode } from '../components/FloatingNavPill';
import {
  TransferSessionRecoveryManager,
} from '../core/transfer/recovery/TransferSessionRecoveryManager';
import {
  TransferCheckpointStore,
} from '../core/transfer/checkpoint/TransferCheckpointStore';
import {
  TauriNativeCheckpointPersistence,
} from '../core/transfer/checkpoint/TransferCheckpointPersistence';
import type { TransferResumeCheckpoint } from '../core/transfer/checkpoint/ResumeCheckpoint';

export type { TransferStatus };
export type TransferFile = MockFileItem;

export interface TransferQueueItem {
  id: string;
  direction: 'send' | 'receive';
  mode: TransferMode;
  destinationDevice: DeviceInfo;
  sourceDevice: DeviceInfo;
  files: TransferFile[];
  totalSize: number;
  totalSizeFormatted: string;
  transferredSize: number;
  progress: number;
  speed: number; // in MB/s
  eta: string;
  etaSeconds: number;
  durationSeconds: number;
  status: TransferStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  isReconnecting?: boolean;
  reconnectAttempt?: number;
}

export interface TransferToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface TransferQueueContextType {
  transfers: TransferQueueItem[];
  selectedTransferId: string | null;
  selectedTransfer: TransferQueueItem | null;
  activeTransfer: TransferQueueItem | null;
  queuedTransfers: TransferQueueItem[];
  completedTransfers: TransferQueueItem[];
  failedTransfers: TransferQueueItem[];
  activeToast: TransferToast | null;
  dismissToast: () => void;
  addTransfer: (
    item: Omit<
      TransferQueueItem,
      'id' | 'createdAt' | 'transferredSize' | 'progress' | 'speed' | 'eta' | 'etaSeconds' | 'durationSeconds' | 'totalSizeFormatted'
    > & { id?: string; initialProgress?: number }
  ) => string;
  removeTransfer: (id: string) => void;
  pauseTransfer: (id: string) => void;
  resumeTransfer: (id: string) => void;
  cancelTransfer: (id: string) => void;
  retryTransfer: (id: string) => void;
  recoverTransfer: (id: string) => Promise<void>;
  listRecoverableTransfers: () => Promise<TransferResumeCheckpoint[]>;
  moveTransferUp: (id: string) => void;
  moveTransferDown: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  selectTransfer: (id: string | null) => void;
  getActiveTransfers: () => TransferQueueItem[];
  getQueuedTransfers: () => TransferQueueItem[];
  getCompletedTransfers: () => TransferQueueItem[];
  getFailedTransfers: () => TransferQueueItem[];
  resetQueue: () => void;
  triggerInterruptionSimulation: (id: string) => void;
  recoveryManager: TransferSessionRecoveryManager;
}

const INITIAL_QUEUE_TRANSFERS: TransferQueueItem[] = [
  {
    id: 'tr-active-1',
    direction: 'send',
    mode: 'direct',
    sourceDevice: {
      id: 'local-mac',
      userName: 'Hemanth',
      userHandle: '@hemanth',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    destinationDevice: {
      id: 'dev-mac-01',
      userName: 'Hemanth',
      userHandle: '@hemanth',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    files: [
      {
        id: 'f-cine-1',
        name: 'Cinematic_Cut.mp4',
        type: 'video',
        typeLabel: 'Video',
        sizeBytes: 2.4 * 1024 * 1024 * 1024,
        sizeFormatted: '2.4 GB',
        status: 'transferring',
        progress: 62,
      },
    ],
    totalSize: 2.4 * 1024 * 1024 * 1024,
    totalSizeFormatted: '2.4 GB',
    transferredSize: 1.488 * 1024 * 1024 * 1024,
    progress: 62,
    speed: 42.4,
    eta: '58 sec',
    etaSeconds: 58,
    durationSeconds: 34,
    status: 'transferring',
    createdAt: '2 mins ago',
    startedAt: '1 min ago',
  },
  {
    id: 'tr-queued-2',
    direction: 'send',
    mode: 'direct',
    sourceDevice: {
      id: 'local-mac',
      userName: 'Hemanth',
      userHandle: '@hemanth',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    destinationDevice: {
      id: 'dev-poco-01',
      userName: 'Hemanth',
      userHandle: '@hemanth',
      deviceName: 'Poco F7',
      platform: 'Android',
    },
    files: [
      {
        id: 'f-proj-1',
        name: 'Project_Source.zip',
        type: 'archive',
        typeLabel: 'Archive',
        sizeBytes: 846 * 1024 * 1024,
        sizeFormatted: '846 MB',
        status: 'queued',
        progress: 0,
      },
    ],
    totalSize: 846 * 1024 * 1024,
    totalSizeFormatted: '846 MB',
    transferredSize: 0,
    progress: 0,
    speed: 0,
    eta: '--',
    etaSeconds: 0,
    durationSeconds: 0,
    status: 'queued',
    createdAt: 'Just now',
  },
  {
    id: 'tr-complete-3',
    direction: 'send',
    mode: 'wifi',
    sourceDevice: {
      id: 'local-mac',
      userName: 'Hemanth',
      userHandle: '@hemanth',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    destinationDevice: {
      id: 'dev-iphone-01',
      userName: 'Hemanth',
      userHandle: '@hemanth',
      deviceName: 'iPhone',
      platform: 'iOS',
    },
    files: [
      {
        id: 'f-pres-1',
        name: 'Presentation.pdf',
        type: 'document',
        typeLabel: 'Document',
        sizeBytes: 12.4 * 1024 * 1024,
        sizeFormatted: '12.4 MB',
        status: 'completed',
        progress: 100,
      },
    ],
    totalSize: 12.4 * 1024 * 1024,
    totalSizeFormatted: '12.4 MB',
    transferredSize: 12.4 * 1024 * 1024,
    progress: 100,
    speed: 45.0,
    eta: 'Complete',
    etaSeconds: 0,
    durationSeconds: 72,
    status: 'completed',
    createdAt: '15 mins ago',
    startedAt: '15 mins ago',
    completedAt: '14 mins ago',
  },
];

const TransferQueueContext = createContext<TransferQueueContextType | undefined>(undefined);

export const TransferQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const { addHistoryItem } = useTransferHistory();
  const transport = useTransport();
  const [transfers, setTransfers] = useState<TransferQueueItem[]>(INITIAL_QUEUE_TRANSFERS);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<TransferToast | null>(null);

  const toastTimeoutRef = useRef<number | null>(null);

  const syncQueueItemToHistory = useCallback(
    (
      queueItem: TransferQueueItem,
      status: 'completed' | 'failed' | 'cancelled' | 'interrupted',
      errorReason?: string
    ) => {
      const isSent = queueItem.direction === 'send';
      const historyItem: TransferHistoryItem = {
        id: queueItem.id,
        direction: isSent ? 'sent' : 'received',
        status,
        fileCount: queueItem.files.length,
        files: queueItem.files.map((f) => ({
          id: f.id,
          name: f.name,
          sizeBytes: f.sizeBytes,
          sizeFormatted: f.sizeFormatted,
          type: f.type,
          typeLabel: f.typeLabel,
        })),
        totalBytes: queueItem.totalSize,
        totalSizeFormatted: queueItem.totalSizeFormatted,
        startedAt: queueItem.startedAt || 'Today, just now',
        completedAt: 'Today, just now',
        durationMs: (queueItem.durationSeconds || 1) * 1000,
        averageSpeedMBps: Math.round((queueItem.speed || 42.0) * 10) / 10,
        peakSpeedMBps: Math.round(((queueItem.speed || 42.0) + 6.4) * 10) / 10,
        mode: queueItem.mode,
        sender: {
          profileId: queueItem.sourceDevice.id,
          name: queueItem.sourceDevice.userName,
          username: queueItem.sourceDevice.userHandle || `@${queueItem.sourceDevice.userName.toLowerCase()}`,
          avatar: queueItem.sourceDevice.userName[0]?.toUpperCase() || 'U',
          deviceId: queueItem.sourceDevice.id,
          deviceName: queueItem.sourceDevice.deviceName,
          platform: queueItem.sourceDevice.platform,
        },
        receiver: {
          profileId: queueItem.destinationDevice.id,
          name: queueItem.destinationDevice.userName,
          username: queueItem.destinationDevice.userHandle || `@${queueItem.destinationDevice.userName.toLowerCase()}`,
          avatar: queueItem.destinationDevice.userName[0]?.toUpperCase() || 'U',
          deviceId: queueItem.destinationDevice.id,
          deviceName: queueItem.destinationDevice.deviceName,
          platform: queueItem.destinationDevice.platform,
        },
        securityState: 'Verified channel stream',
        retryable: status !== 'completed',
        destination: settings.downloadLocation || 'Downloads',
        errorReason: errorReason || queueItem.error,
        createdAt: new Date().toISOString(),
        connectionQuality: 'Excellent',
        relativeDate: 'Today',
      };
      addHistoryItem(historyItem);
    },
    [addHistoryItem, settings.downloadLocation]
  );

  const triggerToast = useCallback(
    (title: string, message: string, type: TransferToast['type'] = 'info') => {
      if (!settings.notifications) return;
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      setActiveToast({
        id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        title,
        message,
        type,
        timestamp: Date.now(),
      });
      toastTimeoutRef.current = window.setTimeout(() => {
        setActiveToast(null);
      }, 3500);
    },
    [settings.notifications]
  );

  const dismissToast = () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(null);
  };

  // Find currently active transfer (transferring, preparing, connecting, or paused active)
  const activeTransfer =
    transfers.find(
      (t) =>
        t.status === 'transferring' ||
        t.status === 'preparing' ||
        t.status === 'connecting' ||
        t.status === 'paused'
    ) || null;

  const queuedTransfers = transfers.filter((t) => t.status === 'queued');
  const completedTransfers = transfers.filter((t) => t.status === 'completed');
  const failedTransfers = transfers.filter((t) => t.status === 'failed' || t.status === 'cancelled');

  const selectedTransfer = transfers.find((t) => t.id === selectedTransferId) || null;

  // Add transfer
  const addTransfer = (
    item: Omit<
      TransferQueueItem,
      'id' | 'createdAt' | 'transferredSize' | 'progress' | 'speed' | 'eta' | 'etaSeconds' | 'durationSeconds' | 'totalSizeFormatted'
    > & { id?: string; initialProgress?: number }
  ): string => {
    const id = item.id || `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const totalSize = item.files.reduce((acc, f) => acc + f.sizeBytes, 0);

    // If there is no currently transferring item, we can start right away (preparing/transferring), otherwise queued
    const hasActive = transfers.some(
      (t) =>
        t.status === 'transferring' ||
        t.status === 'preparing' ||
        t.status === 'connecting'
    );

    const initialStatus: TransferStatus = item.status
      ? item.status
      : hasActive
      ? 'queued'
      : 'preparing';

    const startProgress = item.initialProgress || 0;
    const transferredSize = Math.round((startProgress / 100) * totalSize);

    const newTransfer: TransferQueueItem = {
      ...item,
      id,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      transferredSize,
      progress: startProgress,
      speed: initialStatus === 'queued' ? 0 : 42.0,
      eta: initialStatus === 'queued' ? '--' : 'Calculating...',
      etaSeconds: initialStatus === 'queued' ? 0 : 30,
      durationSeconds: 0,
      status: initialStatus,
      createdAt: 'Just now',
      startedAt: initialStatus !== 'queued' ? 'Just now' : undefined,
    };

    setTransfers((prev) => [newTransfer, ...prev]);

    // Forward through Transport layer contract
    transport
      .send({
        transferId: id,
        files: newTransfer.files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.sizeBytes,
          type: f.type,
        })),
        totalBytes: newTransfer.totalSize,
        direction: newTransfer.direction,
        sourceDevice: newTransfer.sourceDevice,
        destinationDevice: newTransfer.destinationDevice,
        mode: newTransfer.mode,
      })
      .catch(() => {});

    const primaryFileName = newTransfer.files[0]?.name || 'Payload';
    triggerToast('Transfer added', `${primaryFileName} added to queue`, 'info');

    return id;
  };

  const removeTransfer = (id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    if (selectedTransferId === id) setSelectedTransferId(null);
  };

  const pauseTransfer = (id: string) => {
    transport.pause(id).catch(() => {});
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === id && (t.status === 'transferring' || t.status === 'connecting' || t.status === 'preparing')) {
          triggerToast('Transfer paused', `${t.files[0]?.name || 'Transfer'} paused`, 'info');
          return { ...t, status: 'paused', speed: 0 };
        }
        return t;
      })
    );
  };

  const resumeTransfer = (id: string) => {
    transport.resume(id).catch(() => {});
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === id && t.status === 'paused') {
          triggerToast('Transfer resumed', `${t.files[0]?.name || 'Transfer'} resumed`, 'info');
          return { ...t, status: 'transferring', speed: 42.5 };
        }
        return t;
      })
    );
  };

  const cancelTransfer = (id: string) => {
    transport.cancel(id).catch(() => {});
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          triggerToast('Transfer cancelled', `${t.files[0]?.name || 'Transfer'} cancelled`, 'warning');
          syncQueueItemToHistory(t, 'cancelled', 'User cancelled');
          return { ...t, status: 'cancelled', speed: 0, eta: 'Cancelled', error: 'User cancelled' };
        }
        return t;
      })
    );
  };

  const retryTransfer = (id: string) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const hasActive = prev.some(
            (other) =>
              other.id !== id &&
              (other.status === 'transferring' ||
                other.status === 'preparing' ||
                other.status === 'connecting')
          );
          triggerToast('Transfer retried', `${t.files[0]?.name || 'Transfer'} queued for retry`, 'info');
          return {
            ...t,
            status: hasActive ? 'queued' : 'preparing',
            progress: 0,
            transferredSize: 0,
            speed: hasActive ? 0 : 42.0,
            eta: hasActive ? '--' : 'Calculating...',
            error: undefined,
            isReconnecting: false,
          };
        }
        return t;
      })
    );
  };

  const clearCompleted = () => {
    setTransfers((prev) => prev.filter((t) => t.status !== 'completed'));
    triggerToast('Queue cleared', 'Completed transfers cleared from active view', 'info');
  };

  const clearAll = () => {
    setTransfers((prev) => prev.filter((t) => t.status === 'transferring'));
    triggerToast('Queue cleared', 'Inactive transfers cleared', 'info');
  };

  const pauseAll = () => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.status === 'transferring' || t.status === 'connecting' || t.status === 'preparing'
          ? { ...t, status: 'paused', speed: 0 }
          : t
      )
    );
    triggerToast('All transfers paused', 'Active transfers paused', 'info');
  };

  const resumeAll = () => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.status === 'paused' ? { ...t, status: 'transferring', speed: 43.0 } : t
      )
    );
    triggerToast('Transfers resumed', 'Paused transfers resumed', 'info');
  };

  const moveTransferUp = (id: string) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx <= 0) return prev;
      const target = prev[idx];
      if (target.status !== 'queued') return prev;

      // Find the previous queued item to swap with
      let swapIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (prev[i].status === 'queued') {
          swapIdx = i;
          break;
        }
      }
      if (swapIdx === -1) return prev;
      const nextArr = [...prev];
      nextArr[idx] = nextArr[swapIdx];
      nextArr[swapIdx] = target;
      return nextArr;
    });
  };

  const moveTransferDown = (id: string) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const target = prev[idx];
      if (target.status !== 'queued') return prev;

      // Find the next queued item to swap with
      let swapIdx = -1;
      for (let i = idx + 1; i < prev.length; i++) {
        if (prev[i].status === 'queued') {
          swapIdx = i;
          break;
        }
      }
      if (swapIdx === -1) return prev;
      const nextArr = [...prev];
      nextArr[idx] = nextArr[swapIdx];
      nextArr[swapIdx] = target;
      return nextArr;
    });
  };

  const selectTransfer = (id: string | null) => {
    setSelectedTransferId(id);
  };

  const getActiveTransfers = () =>
    transfers.filter(
      (t) =>
        t.status === 'transferring' ||
        t.status === 'preparing' ||
        t.status === 'connecting' ||
        t.status === 'paused'
    );

  const getQueuedTransfers = () => transfers.filter((t) => t.status === 'queued');

  const getCompletedTransfers = () => transfers.filter((t) => t.status === 'completed');

  const getFailedTransfers = () =>
    transfers.filter((t) => t.status === 'failed' || t.status === 'cancelled');

  const resetQueue = () => {
    setTransfers(INITIAL_QUEUE_TRANSFERS);
    setSelectedTransferId(null);
  };

  const checkpointStore = React.useMemo(
    () => new TransferCheckpointStore(new TauriNativeCheckpointPersistence()),
    []
  );
  const recoveryManager = React.useMemo(
    () =>
      new TransferSessionRecoveryManager(checkpointStore, {
        autoReconnect: settings.autoReconnect,
      }),
    [checkpointStore, settings.autoReconnect]
  );
  const recoveryManagerRef = useRef<TransferSessionRecoveryManager>(recoveryManager);
  useEffect(() => {
    recoveryManagerRef.current = recoveryManager;
  }, [recoveryManager]);

  const recoverTransfer = useCallback(async (id: string) => {
    const recoveryRes = await recoveryManagerRef.current.recoverTransfer(id);
    if (recoveryRes.success) {
      setTransfers((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            triggerToast('Reconnecting...', 'Resuming from saved checkpoint', 'info');
            return {
              ...t,
              status: 'reconnecting' as TransferStatus,
              isReconnecting: true,
              reconnectAttempt: 1,
              speed: 0,
              eta: 'Reconnecting...',
              error: undefined,
            };
          }
          return t;
        })
      );
    } else {
      triggerToast('Recovery failed', recoveryRes.error || 'Cannot resume transfer', 'error');
    }
  }, [triggerToast]);

  const listRecoverableTransfers = useCallback(async (): Promise<TransferResumeCheckpoint[]> => {
    return recoveryManagerRef.current.listRecoverableTransfers();
  }, []);

  // Trigger artificial connection interruption simulation
  const triggerInterruptionSimulation = (id: string) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === id && (t.status === 'transferring' || t.status === 'resuming')) {
          const res = recoveryManagerRef.current.handleInterruption(id, 'Network connection interrupted');
          if (settings.autoReconnect && res.willRetry) {
            triggerToast('Connection interrupted', 'Reconnecting to peer...', 'warning');
            return { ...t, isReconnecting: true, reconnectAttempt: 1, speed: 0, eta: 'Reconnecting...' };
          } else {
            triggerToast('Connection interrupted', 'Transfer interrupted. Tap to resume.', 'error');
            syncQueueItemToHistory(t, 'interrupted', 'Connection interrupted.');
            return {
              ...t,
              status: 'interrupted' as TransferStatus,
              isReconnecting: false,
              speed: 0,
              eta: 'Interrupted',
              error: 'Connection interrupted.',
            };
          }
        }
        return t;
      })
    );
  };

  // Mock Engine Loop: handles progress interpolation, speed fluctuation, phase progression, auto-promote next queued
  useEffect(() => {
    const interval = setInterval(() => {
      setTransfers((currentTransfers) => {
        let hasActive = false;
        let activeFinishedId: string | null = null;

        const updated = currentTransfers.map((item) => {
          // If in preparing -> transition to connecting -> then transferring
          if (item.status === 'preparing') {
            hasActive = true;
            return {
              ...item,
              status: 'connecting' as TransferStatus,
              speed: 12.0,
              eta: 'Connecting...',
            };
          }

          if (item.status === 'connecting') {
            hasActive = true;
            return {
              ...item,
              status: 'transferring' as TransferStatus,
              speed: 42.0,
              eta: 'Starting...',
            };
          }

          // Handle auto-reconnect simulation recovery
          if (item.isReconnecting && (item.status === 'transferring' || item.status === 'reconnecting' || item.status === 'resuming')) {
            hasActive = true;
            const attempt = (item.reconnectAttempt || 0) + 1;
            if (attempt === 2) {
              return {
                ...item,
                status: 'resuming' as TransferStatus,
                reconnectAttempt: attempt,
                eta: `Resuming • ${Math.round(item.progress)}%`,
                speed: 18.0,
              };
            }
            if (attempt >= 3) {
              triggerToast('Connection restored', `Stream resumed at ${Math.round(item.progress)}%`, 'info');
              return {
                ...item,
                status: 'transferring' as TransferStatus,
                isReconnecting: false,
                reconnectAttempt: 0,
                speed: 43.5,
                eta: 'Resuming...',
              };
            }
            return {
              ...item,
              status: 'reconnecting' as TransferStatus,
              reconnectAttempt: attempt,
              eta: 'Reconnecting...',
            };
          }

          if (item.status === 'transferring') {
            hasActive = true;
            // Realistic dynamic speed (35-65 MB/s)
            const dynamicSpeed = calculateDynamicSpeed(item.speed);

            // Increment progress smoothly (~1.2% - 2.4% per tick)
            const increment = 1.2 + Math.random() * 1.2;
            const nextProgress = Math.min(100, item.progress + increment);

            const transferredSize = Math.round((nextProgress / 100) * item.totalSize);
            const remainingBytes = Math.max(0, item.totalSize - transferredSize);
            const { etaSeconds, etaFormatted } = calculateEta(remainingBytes, dynamicSpeed);

            // Update individual files inside the transfer
            const updatedFiles = item.files.map((file, fIdx) => {
              const fileShare = 100 / Math.max(1, item.files.length);
              const fileStartPct = fIdx * fileShare;
              const fileEndPct = (fIdx + 1) * fileShare;

              let fProgress = 0;
              let fStatus: TransferFile['status'] = 'queued';

              if (nextProgress >= fileEndPct) {
                fProgress = 100;
                fStatus = 'completed';
              } else if (nextProgress > fileStartPct) {
                fProgress = Math.round(((nextProgress - fileStartPct) / fileShare) * 100);
                fStatus = 'transferring';
              } else {
                fProgress = 0;
                fStatus = 'queued';
              }

              return {
                ...file,
                progress: fProgress,
                status: fStatus,
              };
            });

            if (nextProgress >= 100) {
              activeFinishedId = item.id;
              const completedItem = {
                ...item,
                files: updatedFiles.map((f) => ({ ...f, progress: 100, status: 'completed' as const })),
                progress: 100,
                transferredSize: item.totalSize,
                speed: dynamicSpeed,
                eta: 'Complete',
                etaSeconds: 0,
                durationSeconds: item.durationSeconds + 1,
                status: 'completed' as TransferStatus,
                completedAt: 'Just now',
              };
              syncQueueItemToHistory(completedItem, 'completed');
              return completedItem;
            }

            return {
              ...item,
              files: updatedFiles,
              progress: Math.round(nextProgress * 10) / 10,
              transferredSize,
              speed: dynamicSpeed,
              eta: etaFormatted,
              etaSeconds,
              durationSeconds: item.durationSeconds + 1,
            };
          }

          return item;
        });

        if (activeFinishedId) {
          const finishedItem = currentTransfers.find((t) => t.id === activeFinishedId);
          if (finishedItem) {
            triggerToast(
              'Transfer complete',
              `${finishedItem.files[0]?.name || 'Payload'} transferred successfully`,
              'success'
            );
          }
        }

        // If no transfer is active and there are queued transfers, promote the first queued transfer!
        if (!hasActive) {
          const nextQueuedIndex = updated.findIndex((t) => t.status === 'queued');
          if (nextQueuedIndex !== -1) {
            updated[nextQueuedIndex] = {
              ...updated[nextQueuedIndex],
              status: 'preparing',
              speed: 40.0,
              eta: 'Preparing...',
              startedAt: 'Just now',
            };
            const promoted = updated[nextQueuedIndex];
            triggerToast(
              'Transfer started',
              `Now transferring ${promoted.files[0]?.name || 'Payload'}`,
              'info'
            );
          }
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [triggerToast, settings.autoReconnect, syncQueueItemToHistory]);

  return (
    <TransferQueueContext.Provider
      value={{
        transfers,
        selectedTransferId,
        selectedTransfer,
        activeTransfer,
        queuedTransfers,
        completedTransfers,
        failedTransfers,
        activeToast,
        dismissToast,
        addTransfer,
        removeTransfer,
        pauseTransfer,
        resumeTransfer,
        cancelTransfer,
        retryTransfer,
        recoverTransfer,
        listRecoverableTransfers,
        moveTransferUp,
        moveTransferDown,
        clearCompleted,
        clearAll,
        pauseAll,
        resumeAll,
        selectTransfer,
        getActiveTransfers,
        getQueuedTransfers,
        getCompletedTransfers,
        getFailedTransfers,
        resetQueue,
        triggerInterruptionSimulation,
        recoveryManager,
      }}
    >
      {children}
    </TransferQueueContext.Provider>
  );
};

export const useTransferQueue = () => {
  const context = useContext(TransferQueueContext);
  if (!context) {
    throw new Error('useTransferQueue must be used within a TransferQueueProvider');
  }
  return context;
};
