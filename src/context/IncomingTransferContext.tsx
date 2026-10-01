import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSettings } from './SettingsContext';
import { useProfileDevice } from './ProfileDeviceContext';
import { useTransferQueue } from './TransferQueueContext';
import {
  createMockIncomingRequest,
  type IncomingTransferRequest,
} from '../services/mockIncomingTransfer';

export type { IncomingTransferRequest };

export type IncomingRequestFlowState =
  | 'idle'
  | 'requesting'
  | 'review'
  | 'pairing'
  | 'connecting'
  | 'accepted'
  | 'rejected'
  | 'queued'
  | 'completed'
  | 'failed';

interface IncomingTransferContextType {
  incomingRequests: IncomingTransferRequest[];
  currentRequest: IncomingTransferRequest | null;
  activeRequestIndex: number;
  pendingCount: number;
  flowState: IncomingRequestFlowState;
  pairingRequestId: string | null;
  autoAcceptedNotice: string | null;
  simulateIncomingRequest: (preset?: 'trusted' | 'unknown' | 'multi_file' | 'large_file') => void;
  acceptIncomingRequest: (requestId: string, fromPairing?: boolean) => void;
  rejectIncomingRequest: (requestId: string) => void;
  dismissRequest: (requestId: string) => void;
  nextRequest: () => void;
  prevRequest: () => void;
  selectRequest: (index: number) => void;
  openRequestModal: (requestId?: string) => void;
  closeRequestModal: () => void;
  isModalOpen: boolean;
  completePairingAndAccept: () => void;
  cancelPairing: () => void;
}

const IncomingTransferContext = createContext<IncomingTransferContextType | undefined>(undefined);

export const IncomingTransferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const { userProfile, devices } = useProfileDevice();
  const { addTransfer, activeToast: _activeToast } = useTransferQueue();

  const [incomingRequests, setIncomingRequests] = useState<IncomingTransferRequest[]>([]);
  const [activeRequestIndex, setActiveRequestIndex] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [flowState, setFlowState] = useState<IncomingRequestFlowState>('idle');
  const [pairingRequestId, setPairingRequestId] = useState<string | null>(null);
  const [autoAcceptedNotice, setAutoAcceptedNotice] = useState<string | null>(null);

  const localMacDevice = devices.find((d) => d.platform === 'macOS') || devices[0];

  const pendingRequests = incomingRequests.filter((r) => r.status === 'pending' || r.status === 'verifying');
  const currentRequest = pendingRequests[activeRequestIndex] || null;

  // Next / Prev request navigation
  const nextRequest = useCallback(() => {
    setActiveRequestIndex((prev) => (prev + 1 < pendingRequests.length ? prev + 1 : 0));
  }, [pendingRequests.length]);

  const prevRequest = useCallback(() => {
    setActiveRequestIndex((prev) => (prev - 1 >= 0 ? prev - 1 : pendingRequests.length - 1));
  }, [pendingRequests.length]);

  const selectRequest = useCallback((index: number) => {
    if (index >= 0 && index < pendingRequests.length) {
      setActiveRequestIndex(index);
    }
  }, [pendingRequests.length]);

  const openRequestModal = useCallback((requestId?: string) => {
    if (requestId) {
      const idx = pendingRequests.findIndex((r) => r.id === requestId);
      if (idx !== -1) setActiveRequestIndex(idx);
    }
    setIsModalOpen(true);
    setFlowState('requesting');
  }, [pendingRequests]);

  const closeRequestModal = useCallback(() => {
    setIsModalOpen(false);
    setFlowState('idle');
  }, []);

  // Expiration Countdown Timer (Tick every second)
  useEffect(() => {
    if (incomingRequests.length === 0) return;

    const interval = setInterval(() => {
      setIncomingRequests((prev) =>
        prev.map((req) => {
          if (req.status !== 'pending') return req;
          const nextExpires = req.expiresInSeconds - 1;
          if (nextExpires <= 0) {
            return {
              ...req,
              expiresInSeconds: 0,
              status: 'expired',
            };
          }
          return {
            ...req,
            expiresInSeconds: nextExpires,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingRequests.length]);

  // Reject an incoming request
  const rejectIncomingRequest = useCallback(
    (requestId: string) => {
      setIncomingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected' as const } : r))
      );
      setFlowState('rejected');

      setTimeout(() => {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (pendingRequests.length <= 1) {
          setIsModalOpen(false);
          setFlowState('idle');
        } else {
          setActiveRequestIndex(0);
          setFlowState('requesting');
        }
      }, 500);
    },
    [pendingRequests.length]
  );

  // Accept an incoming request
  const acceptIncomingRequest = useCallback(
    (requestId: string, fromPairing: boolean = false) => {
      const target = incomingRequests.find((r) => r.id === requestId);
      if (!target) return;

      // Check if unknown device protection requires pairing
      if (!fromPairing && !target.isTrustedSender && settings.unknownDeviceProtection) {
        setPairingRequestId(requestId);
        setFlowState('pairing');
        return;
      }

      setFlowState('connecting');

      // Subtle simulated connection phase (650ms) before adding to Transfer Queue
      setTimeout(() => {
        // Build the receive transfer item for TransferQueueContext
        addTransfer({
          direction: 'receive',
          mode: target.mode,
          sourceDevice: {
            id: target.senderProfile.id,
            userName: target.senderProfile.name,
            userHandle: target.senderProfile.username,
            deviceName: target.senderProfile.deviceName,
            platform: target.senderProfile.platform,
          },
          destinationDevice: {
            id: localMacDevice.id,
            userName: userProfile.name,
            userHandle: userProfile.username,
            deviceName: localMacDevice.name,
            platform: localMacDevice.platform,
          },
          files: target.files.map((f) => ({
            ...f,
            status: 'queued',
            progress: 0,
          })),
          totalSize: target.totalSize,
          status: 'preparing',
        });

        // Mark request accepted and remove
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setPairingRequestId(null);
        setFlowState('accepted');

        setTimeout(() => {
          setIsModalOpen(false);
          setFlowState('idle');
        }, 400);
      }, 650);
    },
    [
      incomingRequests,
      settings.unknownDeviceProtection,
      addTransfer,
      localMacDevice,
      userProfile.name,
      userProfile.username,
    ]
  );

  // Complete pairing and accept
  const completePairingAndAccept = useCallback(() => {
    if (pairingRequestId) {
      acceptIncomingRequest(pairingRequestId, true);
    }
  }, [pairingRequestId, acceptIncomingRequest]);

  const cancelPairing = useCallback(() => {
    setPairingRequestId(null);
    setFlowState('requesting');
  }, []);

  const dismissRequest = useCallback(
    (requestId: string) => {
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (pendingRequests.length <= 1) {
        setIsModalOpen(false);
        setFlowState('idle');
      }
    },
    [pendingRequests.length]
  );

  // Simulate Incoming Request Trigger
  const simulateIncomingRequest = useCallback(
    (preset: 'trusted' | 'unknown' | 'multi_file' | 'large_file' = 'trusted') => {
      const newRequest = createMockIncomingRequest(preset);

      // Check auto-accept settings
      const shouldAutoAcceptTrusted = settings.autoAcceptTrusted && newRequest.isTrustedSender;
      const shouldAutoAcceptAny = !settings.incomingApproval;

      setIncomingRequests((prev) => [newRequest, ...prev]);
      setActiveRequestIndex(0);
      setIsModalOpen(true);
      setFlowState('requesting');

      if (shouldAutoAcceptTrusted) {
        setAutoAcceptedNotice('Trusted device recognized • Approving transfer...');
        setTimeout(() => {
          setAutoAcceptedNotice(null);
          acceptIncomingRequest(newRequest.id, true);
        }, 1200);
      } else if (shouldAutoAcceptAny) {
        setAutoAcceptedNotice('Incoming transfer automatically approved...');
        setTimeout(() => {
          setAutoAcceptedNotice(null);
          acceptIncomingRequest(newRequest.id, true);
        }, 1200);
      }
    },
    [settings.autoAcceptTrusted, settings.incomingApproval, acceptIncomingRequest]
  );

  return (
    <IncomingTransferContext.Provider
      value={{
        incomingRequests,
        currentRequest,
        activeRequestIndex,
        pendingCount: pendingRequests.length,
        flowState,
        pairingRequestId,
        autoAcceptedNotice,
        simulateIncomingRequest,
        acceptIncomingRequest,
        rejectIncomingRequest,
        dismissRequest,
        nextRequest,
        prevRequest,
        selectRequest,
        openRequestModal,
        closeRequestModal,
        isModalOpen,
        completePairingAndAccept,
        cancelPairing,
      }}
    >
      {children}
    </IncomingTransferContext.Provider>
  );
};

export const useIncomingTransfer = () => {
  const context = useContext(IncomingTransferContext);
  if (!context) {
    throw new Error('useIncomingTransfer must be used within an IncomingTransferProvider');
  }
  return context;
};
