/**
 * NearShare Native Transport Context
 *
 * Exposes NativeTransportManager and transport bridge diagnostic capabilities
 * to React components without coupling UI to concrete mock or native sockets.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { NativeTransportManager } from '../core/transport/native/NativeTransportManager';
import type { NativeTransportBridge } from '../core/transport/native/NativeTransportBridge';
import type { TransportMode } from '../core/transport/types';
import type {
  NativeDiscoveryDevice,
  NativeConnection,
  NativeConnectionMetrics,
} from '../core/transport/native/NativeTransportTypes';
import type { NativeTransportCapabilities } from '../core/transport/native/NativeTransportCapabilities';
import {
  runMockNativeTransportTestSuite,
  type TransportTestSuiteSummary,
} from '../core/transport/native/mock/mockNativeTransportTestSuite';

interface NativeTransportContextType {
  manager: NativeTransportManager;
  bridge: NativeTransportBridge;
  capabilities: NativeTransportCapabilities;
  startDiscovery: (mode: TransportMode) => Promise<NativeDiscoveryDevice[]>;
  stopDiscovery: () => Promise<void>;
  connect: (device: NativeDiscoveryDevice) => Promise<NativeConnection>;
  disconnect: (connection: NativeConnection) => Promise<void>;
  getConnectionMetrics: (connection: NativeConnection) => Promise<NativeConnectionMetrics>;
  runTestSuite: () => Promise<TransportTestSuiteSummary>;
}

const NativeTransportContext = createContext<NativeTransportContextType | undefined>(undefined);

export const NativeTransportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => NativeTransportManager.getInstance(), []);
  const bridge = useMemo(() => manager.getBridge(), [manager]);
  const capabilities = useMemo(() => manager.getCapabilities(), [manager]);

  const startDiscovery = useCallback((mode: TransportMode) => manager.startDiscovery(mode), [manager]);
  const stopDiscovery = useCallback(() => manager.stopDiscovery(), [manager]);
  const connect = useCallback((device: NativeDiscoveryDevice) => manager.connect(device), [manager]);
  const disconnect = useCallback((connection: NativeConnection) => manager.disconnect(connection), [manager]);
  const getConnectionMetrics = useCallback(
    (connection: NativeConnection) => manager.getConnectionMetrics(connection),
    [manager]
  );
  const runTestSuite = useCallback(() => runMockNativeTransportTestSuite(), []);

  const value: NativeTransportContextType = useMemo(
    () => ({
      manager,
      bridge,
      capabilities,
      startDiscovery,
      stopDiscovery,
      connect,
      disconnect,
      getConnectionMetrics,
      runTestSuite,
    }),
    [
      manager,
      bridge,
      capabilities,
      startDiscovery,
      stopDiscovery,
      connect,
      disconnect,
      getConnectionMetrics,
      runTestSuite,
    ]
  );

  return <NativeTransportContext.Provider value={value}>{children}</NativeTransportContext.Provider>;
};

export const useNativeTransport = () => {
  const context = useContext(NativeTransportContext);
  if (!context) {
    throw new Error('useNativeTransport must be used within a NativeTransportProvider');
  }
  return context;
};
