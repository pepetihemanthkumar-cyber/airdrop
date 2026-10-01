/**
 * NearShare Transport Context
 *
 * Exposes the unified TransportManager and PlatformAdapter APIs to the application
 * without coupling React UI components or screens to concrete mock or native classes.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { TransportManager } from '../core/transport/TransportManager';
import { PlatformRegistry } from '../core/platform/PlatformRegistry';
import type { PlatformAdapter } from '../core/platform/PlatformAdapter';
import type {
  TransportDevice,
  TransportConnection,
  TransportCapability,
  TransportMode,
  TransportState,
} from '../core/transport/types';
import type { TransferPayload } from '../core/transfer/types';
import type { TransportEventListener } from '../core/transport/events';

interface TransportContextType {
  manager: TransportManager;
  platformAdapter: PlatformAdapter;
  discover: (mode?: TransportMode) => Promise<TransportDevice[]>;
  connect: (device: TransportDevice, mode?: TransportMode) => Promise<TransportConnection>;
  disconnect: (connectionId: string) => Promise<void>;
  send: (payload: TransferPayload, connection?: TransportConnection) => Promise<void>;
  pause: (transferId: string, mode?: TransportMode) => Promise<void>;
  resume: (transferId: string, mode?: TransportMode) => Promise<void>;
  cancel: (transferId: string, mode?: TransportMode) => Promise<void>;
  getCapabilities: (mode?: TransportMode) => TransportCapability;
  getConnectionState: (connectionId?: string, mode?: TransportMode) => TransportState;
  subscribe: (listener: TransportEventListener) => () => void;
}

const TransportContext = createContext<TransportContextType | undefined>(undefined);

export const TransportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => TransportManager.getInstance(), []);
  const platformAdapter = useMemo(() => PlatformRegistry.getInstance().getAdapter(), []);

  const value: TransportContextType = useMemo(
    () => ({
      manager,
      platformAdapter,
      discover: (mode?: TransportMode) => manager.discover(mode),
      connect: (device: TransportDevice, mode?: TransportMode) => manager.connect(device, mode),
      disconnect: (connectionId: string) => manager.disconnect(connectionId),
      send: (payload: TransferPayload, connection?: TransportConnection) =>
        manager.send(payload, connection),
      pause: (transferId: string, mode?: TransportMode) => manager.pause(transferId, mode),
      resume: (transferId: string, mode?: TransportMode) => manager.resume(transferId, mode),
      cancel: (transferId: string, mode?: TransportMode) => manager.cancel(transferId, mode),
      getCapabilities: (mode?: TransportMode) => manager.getCapabilities(mode),
      getConnectionState: (connectionId?: string, mode?: TransportMode) =>
        manager.getConnectionState(connectionId, mode),
      subscribe: (listener: TransportEventListener) => manager.subscribe(listener),
    }),
    [manager, platformAdapter]
  );

  return <TransportContext.Provider value={value}>{children}</TransportContext.Provider>;
};

export const useTransport = () => {
  const context = useContext(TransportContext);
  if (!context) {
    throw new Error('useTransport must be used within a TransportProvider');
  }
  return context;
};
