export type ConnectionMode = 'direct' | 'wifi';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'stable'
  | 'unstable'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type ConnectionQuality = 'excellent' | 'good' | 'weak' | 'poor';

export type EncryptionState = 'verified' | 'pairing-required' | 'native-security';

export interface ConnectionGraphPoint {
  id: string;
  timestamp: number;
  speedMBps: number;
  stabilityPercent: number;
  latencyMs: number;
}

export interface ConnectionHealth {
  deviceId: string;
  deviceName: string;
  profileName: string;
  username: string;
  platform: 'macOS' | 'Android' | 'iOS' | 'Windows' | 'Linux';
  mode: ConnectionMode;
  state: ConnectionState;
  quality: ConnectionQuality;
  distanceMeters?: number;
  latencyMs: number;
  signalPercent: number;
  currentSpeedMBps: number;
  averageSpeedMBps: number;
  peakSpeedMBps: number;
  stabilityPercent: number;
  bytesTransferred?: number;
  totalBytes?: number;
  reconnectAttempts: number;
  lastStableAt: string;
  encryptionState: EncryptionState;
  updatedAt: string;
}

export const INITIAL_CONNECTION_HEALTH: ConnectionHealth = {
  deviceId: 'dev-mac-01',
  deviceName: "Hemanth's MacBook Air",
  profileName: 'Hemanth',
  username: '@hemanth',
  platform: 'macOS',
  mode: 'direct',
  state: 'connected',
  quality: 'excellent',
  distanceMeters: 8,
  latencyMs: 14,
  signalPercent: 96,
  currentSpeedMBps: 42.8,
  averageSpeedMBps: 38.4,
  peakSpeedMBps: 54.2,
  stabilityPercent: 98,
  bytesTransferred: 1.84 * 1024 * 1024 * 1024,
  totalBytes: 3.26 * 1024 * 1024 * 1024,
  reconnectAttempts: 0,
  lastStableAt: 'Just now',
  encryptionState: 'verified',
  updatedAt: 'Just now',
};

// Generate initial mock telemetry history for the live graph
export const generateInitialGraphPoints = (count: number = 20): ConnectionGraphPoint[] => {
  const points: ConnectionGraphPoint[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * 1500;
    const baseSpeed = 38;
    const variation = Math.sin(i * 0.5) * 6 + (Math.random() * 4 - 2);
    points.push({
      id: `pt-${time}`,
      timestamp: time,
      speedMBps: Math.max(12, Math.round((baseSpeed + variation) * 10) / 10),
      stabilityPercent: Math.min(100, Math.max(85, Math.round(96 + Math.cos(i) * 3))),
      latencyMs: Math.max(8, Math.round(14 + Math.sin(i * 0.8) * 3)),
    });
  }
  return points;
};

// Speed range generator by connection quality
export const getSpeedRangeByQuality = (quality: ConnectionQuality, mode: ConnectionMode) => {
  const modeFactor = mode === 'direct' ? 1.0 : 0.65;
  switch (quality) {
    case 'excellent':
      return { min: 35 * modeFactor, max: 62 * modeFactor, latency: 12, signal: 96 };
    case 'good':
      return { min: 18 * modeFactor, max: 38 * modeFactor, latency: 22, signal: 78 };
    case 'weak':
      return { min: 6 * modeFactor, max: 18 * modeFactor, latency: 45, signal: 45 };
    case 'poor':
      return { min: 1 * modeFactor, max: 8 * modeFactor, latency: 95, signal: 24 };
  }
};

// Format distance string respecting mode
export const formatDistanceDisplay = (distanceMeters?: number, mode?: ConnectionMode): string => {
  if (mode === 'wifi') return 'Local network';
  if (distanceMeters === undefined || distanceMeters === null) return 'Nearby';
  return `${distanceMeters} m`;
};
