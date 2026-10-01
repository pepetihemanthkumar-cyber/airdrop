/**
 * NearShare Native Bridge Context
 *
 * Provides React components and services with access to the active NativeBridge,
 * platform detection, capability matrices, and permission requests.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { NativeBridgeManager } from '../core/native/NativeBridgeManager';
import type { NativeBridge } from '../core/native/NativeBridge';
import type {
  NativePlatform,
  PermissionKind,
  PermissionResult,
  FilePickerOptions,
  FolderPickerOptions,
  PickerResult,
} from '../core/native/types';
import type { NativeBridgeCapabilities } from '../core/native/NativeBridgeCapabilities';
import {
  runMockNativeBridgeTestSuite,
  type BridgeTestSuiteSummary,
} from '../core/native/mock/mockNativeBridgeTestSuite';

interface NativeBridgeContextType {
  manager: NativeBridgeManager;
  bridge: NativeBridge;
  platform: NativePlatform;
  capabilities: NativeBridgeCapabilities;
  isAvailable: boolean;
  requestPermission: (permission: PermissionKind) => Promise<PermissionResult>;
  pickFiles: (options?: FilePickerOptions) => Promise<PickerResult>;
  pickFolder: (options?: FolderPickerOptions) => Promise<PickerResult>;
  runTestSuite: () => Promise<BridgeTestSuiteSummary>;
}

const NativeBridgeContext = createContext<NativeBridgeContextType | undefined>(undefined);

export const NativeBridgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => NativeBridgeManager.getInstance(), []);
  const bridge = useMemo(() => manager.getBridge(), [manager]);
  const platform = useMemo(() => manager.getPlatform(), [manager]);
  const capabilities = useMemo(() => manager.getCapabilities(), [manager]);
  const isAvailable = useMemo(() => manager.isAvailable(), [manager]);

  const requestPermission = useCallback(
    (permission: PermissionKind) => manager.requestPermission(permission),
    [manager]
  );

  const pickFiles = useCallback(
    (options?: FilePickerOptions) => manager.pickFiles(options),
    [manager]
  );

  const pickFolder = useCallback(
    (options?: FolderPickerOptions) => manager.pickFolder(options),
    [manager]
  );

  const runTestSuite = useCallback(() => runMockNativeBridgeTestSuite(), []);

  const value: NativeBridgeContextType = useMemo(
    () => ({
      manager,
      bridge,
      platform,
      capabilities,
      isAvailable,
      requestPermission,
      pickFiles,
      pickFolder,
      runTestSuite,
    }),
    [
      manager,
      bridge,
      platform,
      capabilities,
      isAvailable,
      requestPermission,
      pickFiles,
      pickFolder,
      runTestSuite,
    ]
  );

  return <NativeBridgeContext.Provider value={value}>{children}</NativeBridgeContext.Provider>;
};

export const useNativeBridge = () => {
  const context = useContext(NativeBridgeContext);
  if (!context) {
    throw new Error('useNativeBridge must be used within a NativeBridgeProvider');
  }
  return context;
};
