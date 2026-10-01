/**
 * NearShare Security Context
 *
 * Exposes the PairingManager and TransferSession operations to the application.
 *
 * NOTE: DeviceTrustContext remains the source of truth for persistent trust/favorite/block rules.
 * SecurityContext manages the transient pairing and transfer-session lifecycles.
 *
 * PRODUCTION:
 * - SAS codes are derived dynamically per session by ProductionPairingAdapter.
 * - The active SAS for a pairing session is surfaced via getActiveSas(pairingId).
 * - No hardcoded PIN is used or displayed.
 */

import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react';
import { PairingManager } from '../core/security/PairingManager';
import { useDeviceTrust } from './DeviceTrustContext';
import type {
  PairingSession,
  PairingState,
} from '../core/security/types';
import type { SecurityState } from '../core/security/SecurityState';
import type { SecurityEventListener } from '../core/security/events';
import type { TransferSession } from '../core/security/TransferSession';

/** Active SAS for a pairing session (displayCode = "XXX YYY") */
export interface ActiveSasInfo {
  pairingId: string;
  displayCode: string;
  expiresAt: number;
}

interface SecurityContextType {
  manager: PairingManager;
  requestPairing: (device: {
    id: string;
    deviceName?: string;
    name?: string;
    profileId?: string;
  }) => Promise<PairingSession>;
  acceptPairing: (pairingId: string) => Promise<PairingSession>;
  rejectPairing: (pairingId: string, reason?: string) => Promise<void>;
  verifyPairing: (
    pairingId: string,
    verification: { pin?: string; qrPayload?: string }
  ) => Promise<boolean>;
  cancelPairing: (pairingId: string) => Promise<void>;
  getPairingState: (deviceId: string) => PairingState;
  getSecurityState: (deviceId: string) => SecurityState;
  canEstablishSession: (deviceId: string) => boolean;
  getActiveSession: (deviceId: string) => TransferSession | undefined;
  closeSession: (deviceId: string) => void;
  subscribe: (listener: SecurityEventListener) => () => void;
  /** Returns the active SAS display code for a pairing session, if available */
  getActiveSas: (pairingId: string) => ActiveSasInfo | undefined;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => PairingManager.getInstance(), []);
  const { isDeviceTrusted, isDeviceBlocked, getRelationship } = useDeviceTrust();

  // Track active SAS codes keyed by pairingId
  const [activeSasMap, setActiveSasMap] = useState<Map<string, ActiveSasInfo>>(new Map());

  // Subscribe to pairing events to capture live SAS codes
  useEffect(() => {
    const unsub = manager.subscribe((event) => {
      if (event.type === 'verificationRequired' && event.pairingId) {
        const { pairingId, request } = event as { pairingId: string; request: { displayCode?: string; expiresAt: number } };
        if (request.displayCode) {
          setActiveSasMap((prev) => {
            const next = new Map(prev);
            next.set(pairingId, {
              pairingId,
              displayCode: request.displayCode!,
              expiresAt: request.expiresAt,
            });
            return next;
          });
        }
      } else if (
        event.type === 'pairingCompleted' ||
        event.type === 'pairingRejected' ||
        event.type === 'pairingExpired' ||
        event.type === 'pairingFailed'
      ) {
        if (event.pairingId) {
          setActiveSasMap((prev) => {
            const next = new Map(prev);
            next.delete(event.pairingId!);
            return next;
          });
        }
      }
    });
    return unsub;
  }, [manager]);

  const getActiveSas = useCallback(
    (pairingId: string): ActiveSasInfo | undefined => activeSasMap.get(pairingId),
    [activeSasMap]
  );

  const getSecurityState = useCallback(
    (deviceId: string): SecurityState => {
      const isTrusted = isDeviceTrusted(deviceId);
      const isBlocked = isDeviceBlocked(deviceId);
      const isFavorite = !!getRelationship(deviceId)?.favorite;
      return manager.getSecurityState(deviceId, { isTrusted, isBlocked, isFavorite });
    },
    [manager, isDeviceTrusted, isDeviceBlocked, getRelationship]
  );

  const canEstablishSession = useCallback(
    (deviceId: string): boolean => {
      const isTrusted = isDeviceTrusted(deviceId);
      const isBlocked = isDeviceBlocked(deviceId);
      return manager.canEstablishSession({ id: deviceId, isTrusted, isBlocked });
    },
    [manager, isDeviceTrusted, isDeviceBlocked]
  );

  const value: SecurityContextType = useMemo(
    () => ({
      manager,
      requestPairing: (device) => manager.requestPairing(device),
      acceptPairing: (pairingId) => manager.acceptPairing(pairingId),
      rejectPairing: (pairingId, reason) => manager.rejectPairing(pairingId, reason),
      verifyPairing: (pairingId, verification) => manager.verifyPairing(pairingId, verification),
      cancelPairing: (pairingId) => manager.cancelPairing(pairingId),
      getPairingState: (deviceId) => manager.getPairingState(deviceId),
      getSecurityState,
      canEstablishSession,
      getActiveSession: (deviceId) => manager.getActiveSession(deviceId),
      closeSession: (deviceId) => manager.closeSession(deviceId),
      subscribe: (listener) => manager.subscribe(listener),
      getActiveSas,
    }),
    [manager, getSecurityState, canEstablishSession, getActiveSas]
  );

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
