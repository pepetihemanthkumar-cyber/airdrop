/**
 * NearShare Native Shell Context
 *
 * Exposes the active NativeShell, lifecycle state, system notifications,
 * and clipboard APIs to the React application without coupling components to mock classes.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { ShellManager } from '../core/shell/ShellManager';
import type { NativeShell } from '../core/shell/NativeShell';
import type {
  NativeShellPlatform,
  ShellLifecycle,
  ShellNotificationOptions,
} from '../core/shell/types';
import type { ShellCapabilities } from '../core/shell/ShellCapabilities';
import { runMockShellTestSuite, type ShellTestSuiteSummary } from '../core/shell/mock/mockShellTestSuite';

interface NativeShellContextType {
  manager: ShellManager;
  shell: NativeShell;
  platform: NativeShellPlatform;
  capabilities: ShellCapabilities;
  lifecycle: ShellLifecycle;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  showNotification: (title: string, body: string, options?: ShellNotificationOptions) => Promise<void>;
  getClipboard: () => Promise<string>;
  setClipboard: (text: string) => Promise<void>;
  openExternal: (url: string) => Promise<boolean>;
  runTestSuite: () => Promise<ShellTestSuiteSummary>;
}

const NativeShellContext = createContext<NativeShellContextType | undefined>(undefined);

export const NativeShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => ShellManager.getInstance(), []);
  const shell = useMemo(() => manager.getShell(), [manager]);
  const platform = useMemo(() => manager.getPlatform(), [manager]);
  const capabilities = useMemo(() => manager.getCapabilities(), [manager]);
  const lifecycle = useMemo(() => manager.getLifecycleState(), [manager]);

  const start = useCallback(() => manager.start(), [manager]);
  const stop = useCallback(() => manager.stop(), [manager]);
  const showNotification = useCallback(
    (title: string, body: string, options?: ShellNotificationOptions) =>
      manager.showNotification(title, body, options),
    [manager]
  );
  const getClipboard = useCallback(() => manager.getClipboard(), [manager]);
  const setClipboard = useCallback((text: string) => manager.setClipboard(text), [manager]);
  const openExternal = useCallback((url: string) => manager.openExternal(url), [manager]);
  const runTestSuite = useCallback(() => runMockShellTestSuite(), []);

  const value: NativeShellContextType = useMemo(
    () => ({
      manager,
      shell,
      platform,
      capabilities,
      lifecycle,
      start,
      stop,
      showNotification,
      getClipboard,
      setClipboard,
      openExternal,
      runTestSuite,
    }),
    [
      manager,
      shell,
      platform,
      capabilities,
      lifecycle,
      start,
      stop,
      showNotification,
      getClipboard,
      setClipboard,
      openExternal,
      runTestSuite,
    ]
  );

  return <NativeShellContext.Provider value={value}>{children}</NativeShellContext.Provider>;
};

export const useNativeShell = () => {
  const context = useContext(NativeShellContext);
  if (!context) {
    throw new Error('useNativeShell must be used within a NativeShellProvider');
  }
  return context;
};
