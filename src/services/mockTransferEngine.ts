// Mock Transfer Engine for NearShare Frontend
// Simulates realistic file transfer progression, speed fluctuations, ETA calculations,
// pause/resume state management, auto-reconnect simulations, and sequential queue progression.
// NOTE: Frontend simulation only. No real networking, sockets, native APIs, or actual file streaming.

export interface MockFileItem {
  id: string;
  name: string;
  type: 'video' | 'document' | 'image' | 'archive' | 'audio' | 'apk' | 'other' | 'folder' | 'code';
  typeLabel: string;
  sizeBytes: number;
  sizeFormatted: string;
  status: 'queued' | 'preparing' | 'connecting' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  progress: number;
}

export type TransferStatus =
  | 'queued'
  | 'preparing'
  | 'connecting'
  | 'transferring'
  | 'paused'
  | 'interrupted'
  | 'reconnecting'
  | 'resuming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DeviceInfo {
  id: string;
  userName: string;
  userHandle?: string;
  deviceName: string;
  platform: string;
}

export interface EngineTransfer {
  id: string;
  direction: 'send' | 'receive';
  mode: 'direct' | 'wifi';
  sourceDevice: DeviceInfo;
  destinationDevice: DeviceInfo;
  files: MockFileItem[];
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

export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) return '0s';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

/**
 * Computes realistic dynamic transfer speed (35 - 65 MB/s) with subtle organic fluctuations
 */
export function calculateDynamicSpeed(currentSpeed: number, baseSpeed: number = 44.0): number {
  const fluctuation = (Math.random() - 0.48) * 3.5;
  const newSpeed = Math.max(35.0, Math.min(65.0, (currentSpeed || baseSpeed) + fluctuation));
  return Math.round(newSpeed * 10) / 10;
}

/**
 * Calculates remaining ETA based on remaining bytes and current MB/s speed
 */
export function calculateEta(remainingBytes: number, speedMBps: number): { etaSeconds: number; etaFormatted: string } {
  if (remainingBytes <= 0) {
    return { etaSeconds: 0, etaFormatted: 'Complete' };
  }
  const speedBytesPerSec = Math.max(1, speedMBps) * 1024 * 1024;
  const etaSeconds = Math.max(1, Math.round(remainingBytes / speedBytesPerSec));
  return {
    etaSeconds,
    etaFormatted: formatEta(etaSeconds),
  };
}
