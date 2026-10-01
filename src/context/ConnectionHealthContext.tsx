import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from './SettingsContext';
import { useTransferQueue } from './TransferQueueContext';
import { useDeviceTrust } from './DeviceTrustContext';
import { useTransport } from './TransportContext';
import {
  type ConnectionHealth,
  type ConnectionState,
  type ConnectionQuality,
  type ConnectionMode,
  type ConnectionGraphPoint,
  INITIAL_CONNECTION_HEALTH,
  generateInitialGraphPoints,
} from '../services/mockConnectionHealth';
import { TelemetryManager } from '../core/telemetry/TelemetryManager';
import type {
  TransferTelemetrySnapshot,
  ConnectionStabilityStatus,
} from '../core/telemetry/TelemetryTypes';

export type { ConnectionHealth, ConnectionState, ConnectionQuality, ConnectionMode, ConnectionGraphPoint };

interface ConnectionHealthContextType {
  health: ConnectionHealth;
  graphPoints: ConnectionGraphPoint[];
  isPanelOpen: boolean;
  isDiagnosticsModalOpen: boolean;
  setConnection: (device: { id: string; name: string; ownerName?: string; userHandle?: string; platform: any }, mode?: ConnectionMode) => void;
  updateHealth: (partial: Partial<ConnectionHealth>) => void;
  setState: (state: ConnectionState) => void;
  simulateInstability: () => void;
  simulateReconnect: () => void;
  manualReconnect: () => void;
  resetConnection: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  openDiagnosticsModal: () => void;
  closeDiagnosticsModal: () => void;

  // STEP 59: Telemetry API Integration
  getTelemetry: (connectionId: string) => TransferTelemetrySnapshot | null;
  getTransferTelemetry: (transferId: string) => TransferTelemetrySnapshot | null;
  getCurrentSpeed: () => number;
  getAverageSpeed: () => number;
  getPeakSpeed: () => number;
  getLatency: () => number | null;
  getStability: () => ConnectionStabilityStatus;
  getReconnectCount: () => number;
  getETA: () => number | null;
}

const ConnectionHealthContext = createContext<ConnectionHealthContextType | undefined>(undefined);

export const ConnectionHealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const { activeTransfer } = useTransferQueue();
  const { isDeviceTrusted, isDevicePaired } = useDeviceTrust();
  const transport = useTransport();

  const [health, setHealth] = useState<ConnectionHealth>(INITIAL_CONNECTION_HEALTH);
  const [graphPoints, setGraphPoints] = useState<ConnectionGraphPoint[]>(() => generateInitialGraphPoints(24));
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryManager = TelemetryManager.getInstance();

  // Subscribe to transport events
  useEffect(() => {
    const unsub = transport.subscribe((event) => {
      if (event.type === 'connectionEstablished') {
        setHealth((prev) => ({
          ...prev,
          deviceId: event.device.id,
          deviceName: event.device.deviceName,
          profileName: event.device.username.replace('@', ''),
          username: event.device.username,
          mode: event.connection.mode,
          state: 'connected',
        }));
      } else if (event.type === 'connectionLost') {
        setHealth((prev) => ({
          ...prev,
          state: 'disconnected',
        }));
      } else if (event.type === 'reconnecting') {
        setHealth((prev) => ({
          ...prev,
          state: 'reconnecting',
        }));
      } else if (event.type === 'connectionRestored') {
        setHealth((prev) => ({
          ...prev,
          state: 'connected',
        }));
      }
    });
    return unsub;
  }, [transport]);

  // Sync active transfer stats and live telemetry into health state
  useEffect(() => {
    if (activeTransfer && activeTransfer.status === 'transferring') {
      const mode: ConnectionMode = activeTransfer.mode;
      const curSpeed = activeTransfer.speed > 0 ? activeTransfer.speed : telemetryManager.getCurrentSpeed();
      const avgSpeed = telemetryManager.getAverageSpeed();
      const peakSpeed = telemetryManager.getPeakSpeed();
      const latency = telemetryManager.getLatency() ?? 12;
      const stab = telemetryManager.getStability();

      setHealth((prev) => ({
        ...prev,
        deviceId: activeTransfer.destinationDevice.id,
        deviceName: activeTransfer.destinationDevice.deviceName,
        profileName: activeTransfer.destinationDevice.userName,
        username: activeTransfer.destinationDevice.userHandle || `@${activeTransfer.destinationDevice.userName.toLowerCase()}`,
        platform: (activeTransfer.destinationDevice.platform as any) || 'macOS',
        mode,
        currentSpeedMBps: curSpeed,
        averageSpeedMBps: avgSpeed > 0 ? avgSpeed : curSpeed,
        peakSpeedMBps: peakSpeed > 0 ? peakSpeed : curSpeed,
        latencyMs: latency,
        bytesTransferred: activeTransfer.transferredSize,
        totalBytes: activeTransfer.totalSize,
        state: stab === 'reconnecting' ? 'reconnecting' : stab === 'unstable' ? 'unstable' : 'connected',
        updatedAt: 'Just now',
      }));

      // Append real data point to graph
      const newPoint: ConnectionGraphPoint = {
        id: `pt-${Date.now()}`,
        timestamp: Date.now(),
        speedMBps: curSpeed,
        stabilityPercent: stab === 'stable' ? 98 : stab === 'degraded' ? 75 : 45,
        latencyMs: latency,
      };

      setGraphPoints((pts) => [...pts.slice(1), newPoint]);
    }
  }, [activeTransfer, telemetryManager]);

  // Subscribe to raw telemetry events for live UI graph feed
  useEffect(() => {
    const unsub = telemetryManager.onEvent((event) => {
      if (event.type === 'telemetryUpdated') {
        const snap = event.snapshot;
        const curSpeedMBps = Math.round((snap.instantaneousSpeedBps / (1024 * 1024)) * 10) / 10;
        const avgSpeedMBps = Math.round((snap.averageSpeedBps / (1024 * 1024)) * 10) / 10;
        const peakSpeedMBps = Math.round((snap.peakSpeedBps / (1024 * 1024)) * 10) / 10;

        setHealth((prev) => ({
          ...prev,
          currentSpeedMBps: curSpeedMBps,
          averageSpeedMBps: avgSpeedMBps,
          peakSpeedMBps: peakSpeedMBps,
          latencyMs: snap.latestLatencyMs ?? prev.latencyMs,
          stabilityPercent: snap.stabilityScore,
          bytesTransferred: snap.completedBytes,
          totalBytes: snap.totalBytes,
          state: snap.connectionState === 'reconnecting' ? 'reconnecting' : snap.connectionState === 'unstable' ? 'unstable' : 'connected',
          updatedAt: 'Just now',
        }));

        const newPoint: ConnectionGraphPoint = {
          id: `pt-${Date.now()}`,
          timestamp: Date.now(),
          speedMBps: curSpeedMBps,
          stabilityPercent: snap.stabilityScore,
          latencyMs: snap.latestLatencyMs ?? 12,
        };

        setGraphPoints((pts) => [...pts.slice(1), newPoint]);
      }
    });

    return unsub;
  }, [telemetryManager]);

  const setConnection = useCallback(
    (device: { id: string; name: string; ownerName?: string; userHandle?: string; platform: any }, mode: ConnectionMode = 'direct') => {
      const trusted = isDeviceTrusted(device.id);
      const paired = isDevicePaired(device.id);

      setHealth((prev) => ({
        ...prev,
        deviceId: device.id,
        deviceName: device.name,
        profileName: device.ownerName || device.name,
        username: device.userHandle || `@${(device.ownerName || device.name).toLowerCase().replace(/\s+/g, '')}`,
        platform: device.platform,
        mode,
        state: 'connected',
        quality: 'excellent',
        encryptionState: trusted || paired ? 'verified' : 'pairing-required',
        reconnectAttempts: 0,
        lastStableAt: 'Just now',
        updatedAt: 'Just now',
      }));
    },
    [isDeviceTrusted, isDevicePaired]
  );

  const updateHealth = useCallback((partial: Partial<ConnectionHealth>) => {
    setHealth((prev) => ({ ...prev, ...partial, updatedAt: 'Just now' }));
  }, []);

  const setState = useCallback((state: ConnectionState) => {
    setHealth((prev) => ({
      ...prev,
      state,
      updatedAt: 'Just now',
      lastStableAt: state === 'connected' || state === 'stable' ? 'Just now' : prev.lastStableAt,
    }));
  }, []);

  const simulateInstability = useCallback(() => {
    setHealth((prev) => ({
      ...prev,
      state: 'unstable',
      quality: 'weak',
      stabilityPercent: 68,
      latencyMs: 74,
      currentSpeedMBps: 8.4,
    }));

    setTimeout(() => {
      setHealth((prev) => ({
        ...prev,
        state: 'connected',
        quality: 'excellent',
        stabilityPercent: 98,
        latencyMs: 14,
        lastStableAt: 'Just now',
      }));
    }, 4500);
  }, []);

  const simulateReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    setHealth((prev) => ({
      ...prev,
      state: 'reconnecting',
      quality: 'poor',
      reconnectAttempts: 1,
      currentSpeedMBps: 0,
      stabilityPercent: 40,
    }));

    if (!settings.autoReconnect) {
      reconnectTimerRef.current = setTimeout(() => {
        setHealth((prev) => ({
          ...prev,
          state: 'disconnected',
        }));
      }, 1200);
      return;
    }

    reconnectTimerRef.current = setTimeout(() => {
      setHealth((prev) => ({
        ...prev,
        reconnectAttempts: 2,
      }));

      reconnectTimerRef.current = setTimeout(() => {
        setHealth((prev) => ({
          ...prev,
          state: 'connected',
          quality: 'excellent',
          reconnectAttempts: 0,
          currentSpeedMBps: 38.4,
          stabilityPercent: 98,
          lastStableAt: 'Just now',
        }));
      }, 1600);
    }, 1400);
  }, [settings.autoReconnect]);

  const manualReconnect = useCallback(() => {
    simulateReconnect();
  }, [simulateReconnect]);

  const resetConnection = useCallback(() => {
    setHealth(INITIAL_CONNECTION_HEALTH);
    setGraphPoints(generateInitialGraphPoints(24));
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const togglePanel = useCallback(() => setIsPanelOpen((prev) => !prev), []);

  const openDiagnosticsModal = useCallback(() => setIsDiagnosticsModalOpen(true), []);
  const closeDiagnosticsModal = useCallback(() => setIsDiagnosticsModalOpen(false), []);

  // Telemetry query getters
  const getTelemetry = useCallback(
    (connectionId: string) => telemetryManager.getTelemetry(connectionId),
    [telemetryManager]
  );
  const getTransferTelemetry = useCallback(
    (transferId: string) => telemetryManager.getTransferTelemetry(transferId),
    [telemetryManager]
  );
  const getCurrentSpeed = useCallback(() => telemetryManager.getCurrentSpeed(), [telemetryManager]);
  const getAverageSpeed = useCallback(() => telemetryManager.getAverageSpeed(), [telemetryManager]);
  const getPeakSpeed = useCallback(() => telemetryManager.getPeakSpeed(), [telemetryManager]);
  const getLatency = useCallback(() => telemetryManager.getLatency(), [telemetryManager]);
  const getStability = useCallback(() => telemetryManager.getStability(), [telemetryManager]);
  const getReconnectCount = useCallback(() => telemetryManager.getReconnectCount(), [telemetryManager]);
  const getETA = useCallback(() => telemetryManager.getETA(), [telemetryManager]);

  return (
    <ConnectionHealthContext.Provider
      value={{
        health,
        graphPoints,
        isPanelOpen,
        isDiagnosticsModalOpen,
        setConnection,
        updateHealth,
        setState,
        simulateInstability,
        simulateReconnect,
        manualReconnect,
        resetConnection,
        openPanel,
        closePanel,
        togglePanel,
        openDiagnosticsModal,
        closeDiagnosticsModal,
        getTelemetry,
        getTransferTelemetry,
        getCurrentSpeed,
        getAverageSpeed,
        getPeakSpeed,
        getLatency,
        getStability,
        getReconnectCount,
        getETA,
      }}
    >
      {children}
    </ConnectionHealthContext.Provider>
  );
};

export const useConnectionHealth = () => {
  const context = useContext(ConnectionHealthContext);
  if (!context) {
    throw new Error('useConnectionHealth must be used within a ConnectionHealthProvider');
  }
  return context;
};
