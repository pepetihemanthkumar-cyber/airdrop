import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useProfileDevice } from './ProfileDeviceContext';

export type DeviceRelationshipStatus =
  | 'discovered'
  | 'connecting'
  | 'connected'
  | 'offline'
  | 'blocked';

export type DeviceTrustState = 'unknown' | 'paired' | 'trusted';

export type ConnectionMode = 'direct' | 'wifi' | 'auto';

export type PairingMethod = 'qr' | 'pin';

export interface PairingHistoryEntry {
  id: string;
  date: string;
  description: string;
  method?: PairingMethod;
}

export interface DeviceRelationship {
  deviceId: string;
  profileId: string;
  deviceName: string;
  ownerName: string;
  ownerUsername: string;
  avatar?: string;
  platform: 'macOS' | 'Android' | 'iOS' | 'Windows' | 'Linux';
  status: DeviceRelationshipStatus;
  trustState: DeviceTrustState;
  favorite: boolean;
  blocked: boolean;
  firstPairedAt?: string;
  lastSeenAt: string;
  lastTransferAt?: string;
  totalTransfers: number;
  totalBytes: number;
  totalBytesFormatted: string;
  connectionMode: ConnectionMode;
  pairingMethod: PairingMethod;
  pairingHistory: PairingHistoryEntry[];
  distance?: string;
}

interface DeviceTrustContextType {
  deviceRelationships: DeviceRelationship[];
  getRelationship: (deviceId: string) => DeviceRelationship | undefined;
  isDeviceBlocked: (deviceId: string) => boolean;
  isDeviceTrusted: (deviceId: string) => boolean;
  isDevicePaired: (deviceId: string) => boolean;
  renameDevice: (deviceId: string, newName: string) => boolean;
  setTrustState: (deviceId: string, trustState: DeviceTrustState) => void;
  toggleFavorite: (deviceId: string) => void;
  blockDevice: (deviceId: string) => void;
  unblockDevice: (deviceId: string) => void;
  removeDevice: (deviceId: string) => void;
  setPreferredConnectionMode: (deviceId: string, mode: ConnectionMode) => void;
  completePairing: (deviceId: string, method: PairingMethod, trustImmediately?: boolean) => void;
  recordTransferActivity: (deviceId: string, bytes: number) => void;
}

const INITIAL_RELATIONSHIPS: DeviceRelationship[] = [
  {
    deviceId: 'dev-mac-01',
    profileId: 'NS-DEV-MAC-8491',
    deviceName: "Hemanth's MacBook Air",
    ownerName: 'Hemanth',
    ownerUsername: '@hemanth',
    avatar: 'H',
    platform: 'macOS',
    status: 'connected',
    trustState: 'trusted',
    favorite: true,
    blocked: false,
    firstPairedAt: 'Sep 12, 2026',
    lastSeenAt: 'Just now',
    lastTransferAt: '10 min ago',
    totalTransfers: 24,
    totalBytes: 18.4 * 1024 * 1024 * 1024,
    totalBytesFormatted: '18.4 GB',
    connectionMode: 'direct',
    pairingMethod: 'qr',
    pairingHistory: [
      { id: 'ph-1', date: 'Sep 28, 2026', description: 'Direct Nearby session verified' },
      { id: 'ph-2', date: 'Sep 20, 2026', description: 'Trusted device auto-reconnection' },
      { id: 'ph-3', date: 'Sep 12, 2026', description: 'Paired using QR Code' },
    ],
    distance: '8 m',
  },
  {
    deviceId: 'dev-android-01',
    profileId: 'NS-DEV-AND-4210',
    deviceName: "Hemanth's Android",
    ownerName: 'Hemanth',
    ownerUsername: '@hemanth',
    avatar: 'H',
    platform: 'Android',
    status: 'connected',
    trustState: 'trusted',
    favorite: true,
    blocked: false,
    firstPairedAt: 'Sep 15, 2026',
    lastSeenAt: '2 min ago',
    lastTransferAt: '1 hour ago',
    totalTransfers: 19,
    totalBytes: 14.2 * 1024 * 1024 * 1024,
    totalBytesFormatted: '14.2 GB',
    connectionMode: 'direct',
    pairingMethod: 'pin',
    pairingHistory: [
      { id: 'ph-4', date: 'Sep 27, 2026', description: 'Quick Direct beam completed' },
      { id: 'ph-5', date: 'Sep 15, 2026', description: 'Paired using Secure PIN' },
    ],
    distance: '14 m',
  },
  {
    deviceId: 'dev-iphone-01',
    profileId: 'NS-DEV-IOS-9932',
    deviceName: 'Personal iPhone',
    ownerName: 'Elena Rostova',
    ownerUsername: '@elena',
    avatar: 'E',
    platform: 'iOS',
    status: 'connected',
    trustState: 'paired',
    favorite: false,
    blocked: false,
    firstPairedAt: 'Sep 18, 2026',
    lastSeenAt: '1 min ago',
    lastTransferAt: 'Yesterday',
    totalTransfers: 8,
    totalBytes: 4.8 * 1024 * 1024 * 1024,
    totalBytesFormatted: '4.8 GB',
    connectionMode: 'wifi',
    pairingMethod: 'qr',
    pairingHistory: [
      { id: 'ph-6', date: 'Sep 24, 2026', description: 'Wi-Fi mesh transfer completed' },
      { id: 'ph-7', date: 'Sep 18, 2026', description: 'Paired using QR Code' },
    ],
    distance: '22 m',
  },
  {
    deviceId: 'dev-unknown-01',
    profileId: 'NS-DEV-UNK-7712',
    deviceName: 'Alex Turner (Poco F7)',
    ownerName: 'Alex Turner',
    ownerUsername: '@alex_t',
    avatar: 'A',
    platform: 'Android',
    status: 'discovered',
    trustState: 'unknown',
    favorite: false,
    blocked: false,
    lastSeenAt: 'Just now',
    totalTransfers: 0,
    totalBytes: 0,
    totalBytesFormatted: '0 B',
    connectionMode: 'auto',
    pairingMethod: 'pin',
    pairingHistory: [],
    distance: '28 m',
  },
  {
    deviceId: 'dev-win-01',
    profileId: 'NS-DEV-WIN-1029',
    deviceName: 'Workstation PC',
    ownerName: 'Studio Workstation',
    ownerUsername: '@studio',
    avatar: 'S',
    platform: 'Windows',
    status: 'offline',
    trustState: 'paired',
    favorite: false,
    blocked: false,
    firstPairedAt: 'Sep 05, 2026',
    lastSeenAt: '3 days ago',
    lastTransferAt: 'Sep 22, 2026',
    totalTransfers: 3,
    totalBytes: 2.1 * 1024 * 1024 * 1024,
    totalBytesFormatted: '2.1 GB',
    connectionMode: 'wifi',
    pairingMethod: 'pin',
    pairingHistory: [
      { id: 'ph-8', date: 'Sep 05, 2026', description: 'Paired using Studio PIN' },
    ],
    distance: '30 m',
  },
  {
    deviceId: 'dev-blocked-01',
    profileId: 'NS-DEV-AND-0082',
    deviceName: 'Unknown Android-92',
    ownerName: 'Unknown Sender',
    ownerUsername: '@nearby_user',
    avatar: 'U',
    platform: 'Android',
    status: 'blocked',
    trustState: 'unknown',
    favorite: false,
    blocked: true,
    lastSeenAt: 'Sep 20',
    totalTransfers: 0,
    totalBytes: 0,
    totalBytesFormatted: '0 B',
    connectionMode: 'auto',
    pairingMethod: 'pin',
    pairingHistory: [
      { id: 'ph-9', date: 'Sep 20, 2026', description: 'Device blocked by user' },
    ],
    distance: '12 m',
  },
];

const DeviceTrustContext = createContext<DeviceTrustContextType | undefined>(undefined);

export const DeviceTrustProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { updateDevice, renameDevice: renameInProfile } = useProfileDevice();
  const [deviceRelationships, setDeviceRelationships] = useState<DeviceRelationship[]>(INITIAL_RELATIONSHIPS);

  // Sync initial relationship state with ProfileDeviceContext where applicable
  useEffect(() => {
    INITIAL_RELATIONSHIPS.forEach((rel) => {
      updateDevice(rel.deviceId, {
        name: rel.deviceName,
        isTrusted: rel.trustState === 'trusted',
        isFavorite: rel.favorite,
        isBlocked: rel.blocked,
        isUnknown: rel.trustState === 'unknown',
        status: rel.blocked ? 'offline' : rel.status === 'connected' ? 'connected' : rel.status === 'offline' ? 'offline' : 'nearby',
        lastSeen: rel.lastSeenAt,
        transfersCount: rel.totalTransfers,
        totalTransferredFormatted: rel.totalBytesFormatted,
      });
    });
  }, [updateDevice]);

  const getRelationship = useCallback((deviceId: string): DeviceRelationship | undefined => {
    return deviceRelationships.find((r) => r.deviceId === deviceId || r.profileId === deviceId);
  }, [deviceRelationships]);

  const isDeviceBlocked = useCallback((deviceId: string): boolean => {
    const rel = deviceRelationships.find((r) => r.deviceId === deviceId || r.profileId === deviceId);
    return rel ? rel.blocked : false;
  }, [deviceRelationships]);

  const isDeviceTrusted = useCallback((deviceId: string): boolean => {
    const rel = deviceRelationships.find((r) => r.deviceId === deviceId || r.profileId === deviceId);
    return rel ? !rel.blocked && rel.trustState === 'trusted' : false;
  }, [deviceRelationships]);

  const isDevicePaired = useCallback((deviceId: string): boolean => {
    const rel = deviceRelationships.find((r) => r.deviceId === deviceId || r.profileId === deviceId);
    return rel ? !rel.blocked && (rel.trustState === 'paired' || rel.trustState === 'trusted') : false;
  }, [deviceRelationships]);

  const renameDevice = useCallback((deviceId: string, newName: string): boolean => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length > 40) return false;

    setDeviceRelationships((prev) =>
      prev.map((r) =>
        r.deviceId === deviceId || r.profileId === deviceId
          ? { ...r, deviceName: trimmed }
          : r
      )
    );

    // Keep ProfileDeviceContext in sync
    renameInProfile(deviceId, trimmed);
    return true;
  }, [renameInProfile]);

  const setTrustState = useCallback((deviceId: string, trustState: DeviceTrustState) => {
    setDeviceRelationships((prev) =>
      prev.map((r) => {
        if (r.deviceId === deviceId || r.profileId === deviceId) {
          const newHistory = [...r.pairingHistory];
          if (trustState === 'trusted' && r.trustState !== 'trusted') {
            newHistory.unshift({
              id: `ph-${Date.now()}`,
              date: 'Today',
              description: 'Device marked as Trusted',
            });
          } else if (trustState === 'paired' && r.trustState === 'trusted') {
            newHistory.unshift({
              id: `ph-${Date.now()}`,
              date: 'Today',
              description: 'Trust removed (paired only)',
            });
          }
          return {
            ...r,
            trustState,
            pairingHistory: newHistory,
          };
        }
        return r;
      })
    );

    updateDevice(deviceId, {
      isTrusted: trustState === 'trusted',
      isUnknown: trustState === 'unknown',
    });
  }, [updateDevice]);

  const toggleFavorite = useCallback((deviceId: string) => {
    setDeviceRelationships((prev) =>
      prev.map((r) => {
        if (r.deviceId === deviceId || r.profileId === deviceId) {
          const nextFav = !r.favorite;
          updateDevice(deviceId, { isFavorite: nextFav });
          return { ...r, favorite: nextFav };
        }
        return r;
      })
    );
  }, [updateDevice]);

  const blockDevice = useCallback((deviceId: string) => {
    setDeviceRelationships((prev) =>
      prev.map((r) => {
        if (r.deviceId === deviceId || r.profileId === deviceId) {
          const history = [
            {
              id: `ph-${Date.now()}`,
              date: 'Today',
              description: 'Device blocked by user',
            },
            ...r.pairingHistory,
          ];
          return {
            ...r,
            blocked: true,
            status: 'blocked',
            pairingHistory: history,
          };
        }
        return r;
      })
    );

    updateDevice(deviceId, { isBlocked: true, status: 'offline' });
  }, [updateDevice]);

  const unblockDevice = useCallback((deviceId: string) => {
    setDeviceRelationships((prev) =>
      prev.map((r) => {
        if (r.deviceId === deviceId || r.profileId === deviceId) {
          const history = [
            {
              id: `ph-${Date.now()}`,
              date: 'Today',
              description: 'Device unblocked',
            },
            ...r.pairingHistory,
          ];
          return {
            ...r,
            blocked: false,
            status: 'discovered',
            pairingHistory: history,
          };
        }
        return r;
      })
    );

    updateDevice(deviceId, { isBlocked: false, status: 'nearby' });
  }, [updateDevice]);

  const removeDevice = useCallback((deviceId: string) => {
    setDeviceRelationships((prev) =>
      prev.filter((r) => r.deviceId !== deviceId && r.profileId !== deviceId)
    );
  }, []);

  const setPreferredConnectionMode = useCallback((deviceId: string, mode: ConnectionMode) => {
    setDeviceRelationships((prev) =>
      prev.map((r) =>
        r.deviceId === deviceId || r.profileId === deviceId
          ? { ...r, connectionMode: mode }
          : r
      )
    );
  }, []);

  const completePairing = useCallback(
    (deviceId: string, method: PairingMethod, trustImmediately: boolean = false) => {
      setDeviceRelationships((prev) => {
        const existing = prev.find((r) => r.deviceId === deviceId || r.profileId === deviceId);
        const newTrustState: DeviceTrustState = trustImmediately ? 'trusted' : 'paired';

        if (existing) {
          const newHistory = [
            {
              id: `ph-${Date.now()}`,
              date: 'Today',
              description: `Paired using ${method === 'qr' ? 'QR Code' : 'Secure PIN'}${trustImmediately ? ' (Trusted)' : ''}`,
              method,
            },
            ...existing.pairingHistory,
          ];
          return prev.map((r) =>
            r.deviceId === deviceId || r.profileId === deviceId
              ? {
                  ...r,
                  trustState: newTrustState,
                  firstPairedAt: r.firstPairedAt || 'Today',
                  lastSeenAt: 'Just now',
                  pairingMethod: method,
                  status: 'connected',
                  blocked: false,
                  pairingHistory: newHistory,
                }
              : r
          );
        }

        // If new device, add relationship
        const newRel: DeviceRelationship = {
          deviceId,
          profileId: `NS-DEV-${Math.floor(1000 + Math.random() * 9000)}`,
          deviceName: 'Nearby Device',
          ownerName: 'Nearby User',
          ownerUsername: '@nearby_user',
          platform: 'Android',
          status: 'connected',
          trustState: newTrustState,
          favorite: false,
          blocked: false,
          firstPairedAt: 'Today',
          lastSeenAt: 'Just now',
          totalTransfers: 0,
          totalBytes: 0,
          totalBytesFormatted: '0 B',
          connectionMode: 'direct',
          pairingMethod: method,
          pairingHistory: [
            {
              id: `ph-${Date.now()}`,
              date: 'Today',
              description: `Paired using ${method === 'qr' ? 'QR Code' : 'Secure PIN'}`,
              method,
            },
          ],
        };
        return [newRel, ...prev];
      });

      updateDevice(deviceId, {
        isTrusted: trustImmediately,
        isUnknown: false,
        isBlocked: false,
        status: 'connected',
        lastSeen: 'Just now',
      });
    },
    [updateDevice]
  );

  const recordTransferActivity = useCallback((deviceId: string, bytes: number) => {
    setDeviceRelationships((prev) =>
      prev.map((r) => {
        if (r.deviceId === deviceId || r.profileId === deviceId) {
          const newTotal = r.totalBytes + bytes;
          const formatted =
            newTotal >= 1024 * 1024 * 1024
              ? `${(newTotal / (1024 * 1024 * 1024)).toFixed(1)} GB`
              : `${(newTotal / (1024 * 1024)).toFixed(1)} MB`;

          return {
            ...r,
            totalTransfers: r.totalTransfers + 1,
            totalBytes: newTotal,
            totalBytesFormatted: formatted,
            lastTransferAt: 'Just now',
            lastSeenAt: 'Just now',
          };
        }
        return r;
      })
    );
  }, []);

  return (
    <DeviceTrustContext.Provider
      value={{
        deviceRelationships,
        getRelationship,
        isDeviceBlocked,
        isDeviceTrusted,
        isDevicePaired,
        renameDevice,
        setTrustState,
        toggleFavorite,
        blockDevice,
        unblockDevice,
        removeDevice,
        setPreferredConnectionMode,
        completePairing,
        recordTransferActivity,
      }}
    >
      {children}
    </DeviceTrustContext.Provider>
  );
};

export const useDeviceTrust = () => {
  const context = useContext(DeviceTrustContext);
  if (!context) {
    throw new Error('useDeviceTrust must be used within a DeviceTrustProvider');
  }
  return context;
};
