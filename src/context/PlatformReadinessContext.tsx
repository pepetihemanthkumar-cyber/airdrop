import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  type PlatformPermission,
  type PlatformReadiness,
  type PlatformType,
  type PermissionState,
  type StorageState,
  INITIAL_PERMISSIONS,
  DEFAULT_STORAGE_BYTES,
} from '../services/platformReadiness';

interface StorageCheckResult {
  ready: boolean;
  storageState: StorageState;
  availableBytes: number;
  remainingAfterBytes: number;
  requiredBytes: number;
  message?: string;
}

interface ModeReadinessResult {
  ready: boolean;
  missingPermissions: PlatformPermission[];
}

interface PlatformReadinessContextType {
  permissions: PlatformPermission[];
  platform: PlatformType;
  availableStorageBytes: number;
  readiness: PlatformReadiness;
  isReadinessScreenOpen: boolean;
  activePermissionDetail: PlatformPermission | null;
  requestPermission: (id: string) => void;
  setPermissionState: (id: string, state: PermissionState) => void;
  resetPermissions: () => void;
  refreshReadiness: () => void;
  openReadinessScreen: (onDismiss?: () => void) => void;
  closeReadinessScreen: () => void;
  openPermissionDetail: (permission: PlatformPermission) => void;
  closePermissionDetail: () => void;
  checkModeReadiness: (mode: 'direct' | 'wifi') => ModeReadinessResult;
  checkStorageReadiness: (requiredBytes: number) => StorageCheckResult;
  setAvailableStorageBytes: (bytes: number) => void;
  simulateLowStorage: (low: boolean) => void;
  simulateInsufficientStorage: (insufficient: boolean) => void;
}

const PlatformReadinessContext = createContext<PlatformReadinessContextType | undefined>(undefined);

export const PlatformReadinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [platform] = useState<PlatformType>('macos');
  const [permissions, setPermissions] = useState<PlatformPermission[]>(INITIAL_PERMISSIONS);
  const [availableStorageBytes, setAvailableStorageBytes] = useState<number>(DEFAULT_STORAGE_BYTES);
  const [isReadinessScreenOpen, setIsReadinessScreenOpen] = useState(false);
  const [activePermissionDetail, setActivePermissionDetail] = useState<PlatformPermission | null>(null);
  const [onDismissCallback, setOnDismissCallback] = useState<(() => void) | null>(null);

  const requestPermission = useCallback((id: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, state: 'granted' } : p))
    );
  }, []);

  const setPermissionState = useCallback((id: string, state: PermissionState) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, state } : p))
    );
  }, []);

  const resetPermissions = useCallback(() => {
    setPermissions(INITIAL_PERMISSIONS);
    setAvailableStorageBytes(DEFAULT_STORAGE_BYTES);
  }, []);

  const refreshReadiness = useCallback(() => {
    // Re-evaluates readiness states
  }, []);

  const openReadinessScreen = useCallback((onDismiss?: () => void) => {
    if (onDismiss) {
      setOnDismissCallback(() => onDismiss);
    } else {
      setOnDismissCallback(null);
    }
    setIsReadinessScreenOpen(true);
  }, []);

  const closeReadinessScreen = useCallback(() => {
    setIsReadinessScreenOpen(false);
    if (onDismissCallback) {
      onDismissCallback();
      setOnDismissCallback(null);
    }
  }, [onDismissCallback]);

  const openPermissionDetail = useCallback((permission: PlatformPermission) => {
    setActivePermissionDetail(permission);
  }, []);

  const closePermissionDetail = useCallback(() => {
    setActivePermissionDetail(null);
  }, []);

  const checkModeReadiness = useCallback(
    (mode: 'direct' | 'wifi'): ModeReadinessResult => {
      const missing = permissions.filter((p) => {
        if (p.id === 'file-access' && p.state !== 'granted') return true;
        if (mode === 'direct' && p.id === 'nearby-devices' && p.state !== 'granted') return true;
        if (mode === 'wifi' && p.id === 'local-network' && p.state !== 'granted') return true;
        return false;
      });

      return {
        ready: missing.length === 0,
        missingPermissions: missing,
      };
    },
    [permissions]
  );

  const checkStorageReadiness = useCallback(
    (requiredBytes: number): StorageCheckResult => {
      const remainingAfterBytes = availableStorageBytes - requiredBytes;

      if (availableStorageBytes < requiredBytes) {
        return {
          ready: false,
          storageState: 'insufficient',
          availableBytes: availableStorageBytes,
          remainingAfterBytes,
          requiredBytes,
          message: 'Not enough storage to receive this transfer.',
        };
      }

      // If remaining storage after transfer is less than 500 MB, mark as low
      if (remainingAfterBytes < 500 * 1024 * 1024) {
        return {
          ready: true,
          storageState: 'low',
          availableBytes: availableStorageBytes,
          remainingAfterBytes,
          requiredBytes,
          message: 'Low disk space warning.',
        };
      }

      return {
        ready: true,
        storageState: 'healthy',
        availableBytes: availableStorageBytes,
        remainingAfterBytes,
        requiredBytes,
      };
    },
    [availableStorageBytes]
  );

  const simulateLowStorage = useCallback((low: boolean) => {
    if (low) {
      setAvailableStorageBytes(600 * 1024 * 1024); // 600 MB
    } else {
      setAvailableStorageBytes(DEFAULT_STORAGE_BYTES);
    }
  }, []);

  const simulateInsufficientStorage = useCallback((insufficient: boolean) => {
    if (insufficient) {
      setAvailableStorageBytes(100 * 1024 * 1024); // 100 MB (less than typical 2.4 GB transfer)
    } else {
      setAvailableStorageBytes(DEFAULT_STORAGE_BYTES);
    }
  }, []);

  const readiness: PlatformReadiness = useMemo(() => {
    const fileAccess = permissions.find((p) => p.id === 'file-access')?.state || 'granted';
    const nearbyDevices = permissions.find((p) => p.id === 'nearby-devices')?.state || 'granted';
    const localNetwork = permissions.find((p) => p.id === 'local-network')?.state || 'granted';
    const notifications = permissions.find((p) => p.id === 'notifications')?.state || 'granted';
    const backgroundTransfer = permissions.find((p) => p.id === 'background-transfer')?.state || 'granted';
    const storageAccess = fileAccess;

    const overallReady = fileAccess === 'granted' && (nearbyDevices === 'granted' || localNetwork === 'granted');

    return {
      platform,
      fileAccess,
      nearbyDevices,
      localNetwork,
      notifications,
      backgroundTransfer,
      storageAccess,
      availableStorageBytes,
      overallReady,
    };
  }, [permissions, platform, availableStorageBytes]);

  return (
    <PlatformReadinessContext.Provider
      value={{
        permissions,
        platform,
        availableStorageBytes,
        readiness,
        isReadinessScreenOpen,
        activePermissionDetail,
        requestPermission,
        setPermissionState,
        resetPermissions,
        refreshReadiness,
        openReadinessScreen,
        closeReadinessScreen,
        openPermissionDetail,
        closePermissionDetail,
        checkModeReadiness,
        checkStorageReadiness,
        setAvailableStorageBytes,
        simulateLowStorage,
        simulateInsufficientStorage,
      }}
    >
      {children}
    </PlatformReadinessContext.Provider>
  );
};

export const usePlatformReadiness = () => {
  const context = useContext(PlatformReadinessContext);
  if (!context) {
    throw new Error('usePlatformReadiness must be used within a PlatformReadinessProvider');
  }
  return context;
};
