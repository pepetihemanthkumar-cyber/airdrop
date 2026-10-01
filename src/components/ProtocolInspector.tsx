/**
 * NearShare Protocol Inspector (Development Only)
 *
 * Diagnostic viewport for inspecting NearShare protocol frames, serialization,
 * message validation, and real file manifest + chunk transfers across both:
 * 1. Native macOS TCP/LAN Socket Transport (Step 40 Real File Transfer Spike)
 * 2. In-Memory Mock Loopback Harness
 *
 * PALETTE CONSTRAINTS:
 * STRICT MONOCHROME: #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 * Absolutely NO vibrant colors (no blue, green, red, purple, orange, cyan, yellow).
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Terminal,
  Play,
  RotateCcw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Copy,
  Check,
  Layers,
  Network,
  Radio,
  AlertCircle,
  FileText,
  UploadCloud,
  CheckCircle2,
  Shield,
  Lock,
} from 'lucide-react';
import { MockProtocolPeer, type ExchangedProtocolRecord } from '../core/protocol/mock/MockProtocolPeer';
import {
  NativeTcpProtocolPeer,
  type ProtocolTimelineRecord,
  type ProtocolSessionContext,
  type ProtocolSecurityContext,
  type TransferProgressTelemetry,
  TCP_SPIKE_CHUNK_SIZE,
} from '../core/protocol/native/NativeTcpProtocolPeer';
import { DeviceIdentityManager } from '../core/security/crypto';
import { MacTcpLanSpikeTransport } from '../core/transport/native/mac/MacTcpLanSpikeTransport';
import { TauriNativeBridge } from '../core/native/tauri/TauriNativeBridge';
import { pickFiles, type TcpServerInfo } from '../core/native/tauri/TauriIpc';
import { PROTOCOL_NAME, PROTOCOL_VERSION } from '../core/protocol/version';
import { GlassCloseButton } from './common/GlassCloseButton';

type PresetPayloadOption = 'zero_byte' | 'small_16k' | 'multi_1mib' | 'multi_2mib' | 'native_file';

export const ProtocolInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const isTauri = TauriNativeBridge.isTauriDetected();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'native_tcp' | 'mock_loopback'>(isTauri ? 'native_tcp' : 'mock_loopback');

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter & UI State
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'outbound' | 'inbound'>('ALL');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mock Loopback Harness
  const [mockRecords, setMockRecords] = useState<ExchangedProtocolRecord[]>([]);
  const [isMockSimulating, setIsMockSimulating] = useState(false);

  // Native TCP Protocol Harness
  const transportRef = useRef<MacTcpLanSpikeTransport | null>(null);
  const nativePeerRef = useRef<NativeTcpProtocolPeer | null>(null);

  const [tcpServer, setTcpServer] = useState<TcpServerInfo | null>(null);
  const [bindLan, setBindLan] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [tcpConnectHost, setTcpConnectHost] = useState('127.0.0.1');
  const [tcpConnectPort, setTcpConnectPort] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const [nativeRecords, setNativeRecords] = useState<ProtocolTimelineRecord[]>([]);
  const [nativeSessionContext, setNativeSessionContext] = useState<ProtocolSessionContext | null>(null);
  const [securityContext, setSecurityContext] = useState<ProtocolSecurityContext | null>(null);
  const [transferTelemetry, setTransferTelemetry] = useState<TransferProgressTelemetry>({
    transferId: '',
    fileId: '',
    fileName: '',
    bytesTransferred: 0,
    totalBytes: 0,
    currentChunk: 0,
    totalChunks: 0,
    ackCount: 0,
    progressPercent: 0,
    status: 'idle',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [localFingerprint, setLocalFingerprint] = useState<string>('Loading...');

  useEffect(() => {
    DeviceIdentityManager.getInstance().getLocalFingerprint().then((fp) => {
      setLocalFingerprint(fp);
    });
  }, []);

  // File Transfer Test Payload State
  const [selectedPayloadType, setSelectedPayloadType] = useState<PresetPayloadOption>('small_16k');
  const [pickedNativeFile, setPickedNativeFile] = useState<{ id: string; name: string; size: number } | null>(null);
  const [isTransferringFile, setIsTransferringFile] = useState(false);

  // Initialize Native TCP Transport & Protocol Peer
  useEffect(() => {
    if (!isDev) return;
    const transport = new MacTcpLanSpikeTransport();
    transportRef.current = transport;

    const peer = new NativeTcpProtocolPeer(transport, {
      deviceId: 'dev_mac_local_01',
      deviceName: 'Syntra Studio (Host)',
      username: 'Primary Node',
      platform: 'macOS',
    });
    nativePeerRef.current = peer;
    setSecurityContext(peer.getSecurityContext());

    const unsubTimeline = peer.onTimelineRecord((rec) => {
      setNativeRecords((prev) => [...prev, rec]);
      setNativeSessionContext(peer.getSessionContext());
      setSecurityContext(peer.getSecurityContext());
    });

    const unsubTelemetry = peer.onTelemetry((telem) => {
      setTransferTelemetry(telem);
    });

    const unsubSecurity = peer.onSecurityContext((sec) => {
      setSecurityContext(sec);
    });

    return () => {
      unsubTimeline();
      unsubTelemetry();
      unsubSecurity();
      peer.destroy();
      transport.destroy();
    };
  }, [isDev]);

  // Initialize Mock Peer Harness
  const peerA = useMemo(() => {
    if (!isDev) return null;
    const a = new MockProtocolPeer({
      deviceId: 'dev_mac_host_01',
      profileId: 'prof_local_01',
      deviceName: 'Syntra Studio (Mac)',
      username: 'Primary Node',
      platform: 'macOS',
    });

    const b = new MockProtocolPeer({
      deviceId: 'dev_droid_client_02',
      profileId: 'prof_remote_02',
      deviceName: 'Pixel 9 Pro (Android)',
      username: 'Secondary Node',
      platform: 'Android',
    });

    a.connectPeer(b);
    b.connectPeer(a);

    return a;
  }, [isDev]);

  useEffect(() => {
    if (!peerA) return;
    const unsubA = peerA.onMessage((rec) => {
      setMockRecords((prev) => [...prev, rec]);
    });
    return () => {
      unsubA();
    };
  }, [peerA]);

  // ==========================================================
  // NATIVE TCP ACTIONS
  // ==========================================================

  const handleStartTcpServer = async () => {
    if (!transportRef.current) return;
    setActionError(null);
    setIsStartingServer(true);
    try {
      const server = await transportRef.current.startServer(0, bindLan);
      setTcpServer(server);
      setTcpConnectPort(server.port);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to start TCP server');
    } finally {
      setIsStartingServer(false);
    }
  };

  const handleStopTcpServer = async () => {
    if (!transportRef.current) return;
    setActionError(null);
    try {
      await transportRef.current.stopServer();
      setTcpServer(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to stop TCP server');
    }
  };

  const handleConnectTcp = async () => {
    if (!transportRef.current || !nativePeerRef.current || !tcpConnectPort) return;
    setActionError(null);
    setIsConnecting(true);
    try {
      const res = await transportRef.current.connectToHost(tcpConnectHost, tcpConnectPort);
      setActiveConnectionId(res.connectionId);
      nativePeerRef.current.attachConnection(res.connectionId);
      setNativeSessionContext(nativePeerRef.current.getSessionContext());
    } catch (err: any) {
      setActionError(err?.message || 'Failed to connect TCP client');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectTcp = async () => {
    if (!transportRef.current || !activeConnectionId || !nativePeerRef.current) return;
    setActionError(null);
    try {
      await transportRef.current.disconnect(activeConnectionId);
      nativePeerRef.current.detachConnection();
      setActiveConnectionId(null);
      setNativeSessionContext(nativePeerRef.current.getSessionContext());
    } catch (err: any) {
      setActionError(err?.message || 'Failed to disconnect TCP');
    }
  };

  const handleRunAutoHandshake = async () => {
    if (!nativePeerRef.current) return;
    setActionError(null);
    setIsExecutingAction(true);
    try {
      // 1. Auto connect if server running but not connected
      if (!activeConnectionId && tcpServer) {
        const res = await transportRef.current!.connectToHost('127.0.0.1', tcpServer.port);
        setActiveConnectionId(res.connectionId);
        nativePeerRef.current.attachConnection(res.connectionId);
      }

      // 2. HELLO
      await nativePeerRef.current.sendHello();
      await new Promise((r) => setTimeout(r, 60));

      // 3. CAPABILITIES
      await nativePeerRef.current.sendCapabilities();
      await new Promise((r) => setTimeout(r, 60));

      // 4. SESSION_CREATE
      await nativePeerRef.current.createSession();
      await new Promise((r) => setTimeout(r, 60));

      // 5. SESSION_ACCEPT
      await nativePeerRef.current.acceptSession();
      await new Promise((r) => setTimeout(r, 60));

      setNativeSessionContext(nativePeerRef.current.getSessionContext());
    } catch (err: any) {
      setActionError(err?.message || 'Handshake failed');
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleSendHeartbeat = async () => {
    if (!nativePeerRef.current) return;
    setActionError(null);
    try {
      await nativePeerRef.current.sendHeartbeat();
      setNativeSessionContext(nativePeerRef.current.getSessionContext());
    } catch (err: any) {
      setActionError(err?.message || 'Failed to send HEARTBEAT');
    }
  };

  const handleSendGoodbye = async () => {
    if (!nativePeerRef.current) return;
    setActionError(null);
    try {
      await nativePeerRef.current.sendGoodbye('user_requested');
      setNativeSessionContext(nativePeerRef.current.getSessionContext());
      setActiveConnectionId(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to send GOODBYE');
    }
  };

  const handlePickNativeFile = async () => {
    setActionError(null);
    try {
      const files = await pickFiles();
      if (files && files.length > 0) {
        setPickedNativeFile(files[0]);
        setSelectedPayloadType('native_file');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Native file picker failed');
    }
  };

  const handleSendFileSpike = async () => {
    if (!nativePeerRef.current || !activeConnectionId) {
      setActionError('TCP connection must be established before sending file');
      return;
    }

    setActionError(null);
    setIsTransferringFile(true);

    try {
      let fileName = 'test_payload.bin';
      let fileSize = 0;
      let fileBytes: Uint8Array | undefined = undefined;
      let nativeRefId: string | undefined = undefined;

      if (selectedPayloadType === 'zero_byte') {
        fileName = 'empty_zero_byte.txt';
        fileSize = 0;
        fileBytes = new Uint8Array(0);
      } else if (selectedPayloadType === 'small_16k') {
        fileName = 'payload_16k.bin';
        fileSize = 16 * 1024;
        fileBytes = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) fileBytes[i] = i % 251;
      } else if (selectedPayloadType === 'multi_1mib') {
        fileName = 'sample_1mib.bin';
        fileSize = 1024 * 1024; // 1 MiB (2 chunks of 512 KiB)
        fileBytes = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) fileBytes[i] = (i * 7) % 251;
      } else if (selectedPayloadType === 'multi_2mib') {
        fileName = 'sample_2mib.bin';
        fileSize = 2 * 1024 * 1024; // 2 MiB (4 chunks of 512 KiB)
        fileBytes = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) fileBytes[i] = (i * 13) % 251;
      } else if (selectedPayloadType === 'native_file') {
        if (!pickedNativeFile) throw new Error('No native file selected');
        fileName = pickedNativeFile.name;
        fileSize = pickedNativeFile.size;
        nativeRefId = pickedNativeFile.id;
      }

      await nativePeerRef.current.transferRealFile({
        name: fileName,
        size: fileSize,
        bytes: fileBytes,
        localNativeReferenceId: nativeRefId,
        chunkSize: TCP_SPIKE_CHUNK_SIZE,
      });
    } catch (err: any) {
      setActionError(err?.message || 'File transfer spike failed');
    } finally {
      setIsTransferringFile(false);
    }
  };

  const handleAcceptIncomingManifest = async () => {
    if (!nativePeerRef.current) return;
    setActionError(null);
    try {
      const manifest = nativePeerRef.current.getIncomingManifest();
      if (!manifest) throw new Error('No incoming manifest to accept');
      await nativePeerRef.current.acceptFileManifest(
        manifest.transferId,
        manifest.files.map((f) => f.fileId)
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to accept manifest');
    }
  };

  // Security & Authorization Actions (Step 42)
  const handleRequestPairing = async () => {
    if (!nativePeerRef.current || !activeConnectionId) {
      setActionError('TCP connection required to initiate pairing');
      return;
    }
    setActionError(null);
    try {
      await nativePeerRef.current.requestPairing();
    } catch (err: any) {
      setActionError(err?.message || 'Pairing request failed');
    }
  };

  const handleVerifyPairing = async () => {
    if (!nativePeerRef.current) return;
    setActionError(null);
    try {
      const code = securityContext?.verificationCode || '482917';
      await nativePeerRef.current.verifyPairing(code);
    } catch (err: any) {
      setActionError(err?.message || 'Verification failed');
    }
  };

  const handleAuthorizeSession = () => {
    if (!nativePeerRef.current) return;
    nativePeerRef.current.authorizeSession();
  };

  const handleRevokeAuthorization = () => {
    if (!nativePeerRef.current) return;
    nativePeerRef.current.revokeAuthorization();
  };

  const handleToggleBlock = () => {
    if (!nativePeerRef.current) return;
    nativePeerRef.current.setBlocked(!securityContext?.isBlocked);
  };

  const handleToggleTrust = () => {
    if (!nativePeerRef.current) return;
    nativePeerRef.current.setTrustState(securityContext?.trustState === 'trusted' ? 'unknown' : 'trusted');
  };

  const handleEstablishSecureSession = async () => {
    if (!nativePeerRef.current || !activeConnectionId) {
      setActionError('Active TCP connection required to establish secure session');
      return;
    }
    setActionError(null);
    try {
      await nativePeerRef.current.establishSecureSession('initiator');
    } catch (err: any) {
      setActionError(err?.message || 'Secure session establishment failed');
    }
  };

  const handleToggleRequireEncryption = () => {
    if (!nativePeerRef.current) return;
    nativePeerRef.current.setRequireEncryption(!securityContext?.requireEncryption);
  };

  // Mock Handshake
  const handleRunMockSimulation = async () => {
    if (!peerA) return;
    setIsMockSimulating(true);
    try {
      await peerA.runDemonstrationExchange();
    } catch (err) {
      console.error('[ProtocolInspector] Simulation failed:', err);
    } finally {
      setIsMockSimulating(false);
    }
  };

  const handleClear = () => {
    if (activeTab === 'native_tcp') {
      setNativeRecords([]);
    } else {
      setMockRecords([]);
    }
    setSelectedRecordId(null);
  };

  // Records for current active tab
  const records = useMemo(() => {
    if (activeTab === 'native_tcp') {
      return nativeRecords.map((r) => ({
        id: r.id,
        direction: r.direction,
        timestamp: r.timestamp,
        type: r.type,
        message: r.message ?? {
          protocol: PROTOCOL_NAME,
          version: PROTOCOL_VERSION,
          messageId: r.messageId,
          type: r.type as any,
          timestamp: r.timestamp,
          sessionId: r.sessionId,
          transferId: r.transferId,
          payload: r.rawPreview ? { raw: r.rawPreview } : {},
        },
        stateBefore: r.stateBefore,
        stateAfter: r.stateAfter,
        status: r.status,
        errorMessage: r.errorMessage,
      }));
    }
    return mockRecords.map((r) => ({
      id: r.id,
      direction: r.direction,
      timestamp: r.timestamp,
      type: r.message.type,
      message: r.message,
      stateBefore: r.stateBefore,
      stateAfter: r.stateAfter,
      status: 'accepted' as const,
      errorMessage: undefined,
    }));
  }, [activeTab, nativeRecords, mockRecords]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterType !== 'ALL' && r.type !== filterType) return false;
      if (filterDirection !== 'ALL' && r.direction !== filterDirection) return false;
      return true;
    });
  }, [records, filterType, filterDirection]);

  const selectedRecord = useMemo(() => {
    return records.find((r) => r.id === selectedRecordId) ?? filteredRecords[filteredRecords.length - 1] ?? null;
  }, [records, selectedRecordId, filteredRecords]);

  if (!isDev) {
    return null;
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const sanitizePayload = (payload: unknown): Record<string, unknown> => {
    if (!payload || typeof payload !== 'object') return {};
    const sanitized = JSON.parse(JSON.stringify(payload));
    const redactKeys = ['token', 'password', 'secret', 'privateKey', 'authKey'];
    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (redactKeys.some((k) => key.toLowerCase().includes(k))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          traverse(obj[key]);
        }
      }
    };
    traverse(sanitized);
    return sanitized;
  };

  return (
    <>
      {/* Floating Trigger Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-[#101114]/90 hover:bg-[#17191D] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-full text-xs font-mono backdrop-blur-md shadow-2xl transition-all duration-200 cursor-pointer pointer-events-auto"
        title="Open NearShare Protocol Inspector (Dev Only)"
      >
        <Terminal className="w-3.5 h-3.5 text-[#F5F5F5]" />
        <span>PROTOCOL v{PROTOCOL_VERSION}</span>
        {records.length > 0 && (
          <span className="px-1.5 py-0.2 bg-white/10 text-[#F5F5F5] rounded-full text-[10px]">
            {records.length}
          </span>
        )}
      </button>

      {/* Full Modal Viewer */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20 sm:pt-24 bg-black/80 backdrop-blur-md font-mono pointer-events-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl h-[92vh] bg-[#08090B] border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden text-[#F5F5F5]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-[#101114] border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                  <Activity className="w-4 h-4 text-[#F5F5F5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-wide text-[#F5F5F5]">
                      {PROTOCOL_NAME} Protocol Inspector
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] bg-white/10 text-[#A6A8AD] border border-white/10 rounded">
                      SPEC v{PROTOCOL_VERSION}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-white/5 text-[#686B72] border border-white/5 rounded">
                      STEP 41 LAN SPIKE
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A6A8AD]">
                    Monochromatic envelope frame tracer & physical LAN TCP socket file transfer validation
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  disabled={records.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs text-[#A6A8AD] border border-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Clear Captured Protocol Records"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
                <GlassCloseButton onClose={() => setIsOpen(false)} ariaLabel="Close Protocol Inspector" />
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between px-6 py-2 bg-[#101114]/80 border-b border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('native_tcp')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                    activeTab === 'native_tcp'
                      ? 'bg-white/10 text-[#F5F5F5] border-white/20 font-semibold'
                      : 'bg-transparent text-[#686B72] hover:text-[#A6A8AD] border-transparent'
                  }`}
                >
                  <Network className="w-3.5 h-3.5 text-[#F5F5F5]" />
                  <span>Native TCP Transport (Real Sockets & LAN File Transfer)</span>
                </button>
                <button
                  onClick={() => setActiveTab('mock_loopback')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                    activeTab === 'mock_loopback'
                      ? 'bg-white/10 text-[#F5F5F5] border-white/20 font-semibold'
                      : 'bg-transparent text-[#686B72] hover:text-[#A6A8AD] border-transparent'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-[#A6A8AD]" />
                  <span>In-Memory Mock Loopback</span>
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-3 text-[11px] text-[#A6A8AD]">
                {activeTab === 'native_tcp' ? (
                  <>
                    <span>
                      Server: <strong className="text-[#F5F5F5]">{tcpServer ? `${tcpServer.hostDisplay}:${tcpServer.port}` : 'OFF'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      TCP Socket:{' '}
                      <strong className={activeConnectionId ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                        {activeConnectionId ? 'CONNECTED' : 'DISCONNECTED'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Protocol:{' '}
                      <strong className="text-[#F5F5F5]">
                        {nativeSessionContext?.state ?? 'IDLE'}
                      </strong>
                    </span>
                  </>
                ) : (
                  <span>Mock Peer Loopback Ready</span>
                )}
              </div>
            </div>

            {/* Native TCP Control Deck */}
            {activeTab === 'native_tcp' && (
              <div className="px-6 py-2.5 bg-[#08090B] border-b border-white/10 space-y-2">
                {/* Top Row: Transport Setup & Handshake */}
                <div className="grid grid-cols-4 gap-2.5 text-xs">
                  {/* TCP Server Controls */}
                  <div className="p-2 bg-[#101114] border border-white/10 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider">
                      <span>1. Native TCP Server</span>
                      <span className={tcpServer ? 'text-[#F5F5F5] font-semibold' : 'text-[#686B72]'}>
                        {tcpServer ? 'LISTENING' : 'STOPPED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!tcpServer ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          <button
                            onClick={handleStartTcpServer}
                            disabled={isStartingServer}
                            className="w-full py-1 px-2.5 bg-white/10 hover:bg-white/15 text-[#F5F5F5] border border-white/15 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                          >
                            {isStartingServer ? 'Starting...' : 'Start Server'}
                          </button>
                          <label className="flex items-center gap-1.5 text-[10px] text-[#A6A8AD] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bindLan}
                              onChange={(e) => setBindLan(e.target.checked)}
                              className="rounded bg-[#08090B] border-white/20 text-[#F5F5F5]"
                            />
                            <span>Bind LAN (0.0.0.0)</span>
                          </label>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-[#A6A8AD] font-mono">
                            {tcpServer.hostDisplay}:{tcpServer.port}
                          </span>
                          <button
                            onClick={handleStopTcpServer}
                            className="py-0.5 px-2 bg-white/5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded text-[10px]"
                          >
                            Stop
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TCP Client Connect Controls */}
                  <div className="p-2 bg-[#101114] border border-white/10 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider">
                      <span>2. Socket Connection</span>
                      <span className={activeConnectionId ? 'text-[#F5F5F5] font-semibold' : 'text-[#686B72]'}>
                        {activeConnectionId ? 'ATTACHED' : 'IDLE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tcpConnectHost}
                        onChange={(e) => setTcpConnectHost(e.target.value)}
                        placeholder="Host (e.g. 192.168.x.x)"
                        className="px-1.5 py-0.5 bg-[#08090B] border border-white/10 rounded text-xs text-[#F5F5F5] w-24 font-mono"
                      />
                      <input
                        type="number"
                        value={tcpConnectPort || ''}
                        onChange={(e) => setTcpConnectPort(parseInt(e.target.value) || 0)}
                        placeholder="Port"
                        className="px-1.5 py-0.5 bg-[#08090B] border border-white/10 rounded text-xs text-[#F5F5F5] w-14 font-mono"
                      />
                      {!activeConnectionId ? (
                        <button
                          onClick={handleConnectTcp}
                          disabled={isConnecting || !tcpConnectPort}
                          className="py-0.5 px-2 bg-white/10 hover:bg-white/15 text-[#F5F5F5] border border-white/15 rounded text-[10px] font-medium transition-colors disabled:opacity-50"
                        >
                          Connect
                        </button>
                      ) : (
                        <button
                          onClick={handleDisconnectTcp}
                          className="py-0.5 px-2 bg-white/5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded text-[10px]"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Protocol Handshake Deck */}
                  <div className="p-2 bg-[#101114] border border-white/10 rounded-lg space-y-1.5 col-span-2">
                    <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider">
                      <span>3. Handshake & Session</span>
                      <span className="text-[#A6A8AD] truncate">
                        Session: {nativeSessionContext?.sessionId ?? 'None'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={handleRunAutoHandshake}
                        disabled={isExecutingAction || (!activeConnectionId && !tcpServer)}
                        className="py-1 px-2.5 bg-white/15 hover:bg-white/20 text-[#F5F5F5] border border-white/20 rounded text-[11px] font-semibold transition-colors disabled:opacity-40"
                      >
                        ⚡ Handshake
                      </button>
                      <button
                        onClick={handleSendHeartbeat}
                        disabled={!nativeSessionContext?.sessionId}
                        className="py-1 px-2 bg-[#17191D] hover:bg-white/10 text-[#F5F5F5] border border-white/10 rounded text-[10px] transition-colors disabled:opacity-40"
                      >
                        HEARTBEAT
                      </button>
                      <button
                        onClick={handleSendGoodbye}
                        disabled={!activeConnectionId}
                        className="py-1 px-2 bg-white/5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded text-[10px] transition-colors disabled:opacity-40"
                      >
                        GOODBYE
                      </button>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Step 42 Security Session & Authorization Deck */}
                <div className="p-3 bg-[#101114] border border-white/15 rounded-lg space-y-2.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-[#F5F5F5]" />
                      <span className="font-semibold text-[#F5F5F5]">Security Session & Authorization (Step 42)</span>
                      <span className="px-1.5 py-0.2 bg-white/10 text-[#A6A8AD] rounded text-[10px] uppercase font-mono">
                        Pairing: {securityContext?.securityState ?? 'NONE'}
                      </span>
                      <span className="px-1.5 py-0.2 bg-white/10 text-[#A6A8AD] rounded text-[10px] uppercase font-mono">
                        Auth: {securityContext?.authorizationState ?? 'UNAUTHORIZED'}
                      </span>
                      <span className="text-[10px] text-[#686B72]">
                        (Development pairing only — transport remains unencrypted)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#A6A8AD]">
                      <span>Trust: <strong className="text-[#F5F5F5]">{securityContext?.trustState ?? 'none'}</strong></span>
                      <span>•</span>
                      <span>Blocked: <strong className={securityContext?.isBlocked ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>{securityContext?.isBlocked ? 'YES' : 'NO'}</strong></span>
                    </div>
                  </div>

                  {/* Security Metrics & Controls */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {/* Dev Verification Code Box */}
                    <div className="p-2 bg-[#08090B] border border-white/10 rounded flex flex-col justify-between">
                      <div className="text-[10px] text-[#686B72] uppercase tracking-wider">
                        Development Verification Code
                      </div>
                      <div className="text-sm font-mono font-bold tracking-widest text-[#F5F5F5] py-0.5">
                        {securityContext?.verificationCode
                          ? `${securityContext.verificationCode.slice(0, 3)} ${securityContext.verificationCode.slice(3)}`
                          : '482 917'}
                      </div>
                      <div className="text-[9px] text-[#686B72]">
                        Method: {securityContext?.verificationMethod ?? 'numeric_pin'} (60s expiry)
                      </div>
                    </div>

                    {/* Authorization Status */}
                    <div className="p-2 bg-[#08090B] border border-white/10 rounded flex flex-col justify-between">
                      <div className="text-[10px] text-[#686B72] uppercase tracking-wider">
                        Transfer Authorization Gate
                      </div>
                      <div className="text-xs font-mono font-semibold text-[#F5F5F5] flex items-center gap-1.5 py-0.5">
                        <span className={`w-2 h-2 rounded-full ${securityContext?.authorizationState === 'authorized' ? 'bg-[#F5F5F5]' : 'bg-[#686B72]'}`} />
                        <span>{securityContext?.authorizationState === 'authorized' ? 'ALLOWED' : 'LOCKED (BLOCKED)'}</span>
                      </div>
                      <div className="text-[9px] text-[#686B72]">
                        FILE_MANIFEST requires authorization
                      </div>
                    </div>

                    {/* Pairing Actions */}
                    <div className="p-2 bg-[#08090B] border border-white/10 rounded col-span-2 flex flex-col justify-between">
                      <div className="text-[10px] text-[#686B72] uppercase tracking-wider">
                        Security Actions
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          onClick={handleRequestPairing}
                          disabled={!activeConnectionId}
                          className="py-1 px-2 bg-white/10 hover:bg-white/15 text-[#F5F5F5] border border-white/15 rounded text-[10px] font-medium transition-colors disabled:opacity-40"
                        >
                          Request Pairing
                        </button>
                        <button
                          onClick={handleVerifyPairing}
                          disabled={!activeConnectionId || (securityContext?.securityState !== 'awaiting_verification' && securityContext?.securityState !== 'pairing_requested')}
                          className="py-1 px-2 bg-white/10 hover:bg-white/15 text-[#F5F5F5] border border-white/15 rounded text-[10px] font-medium transition-colors disabled:opacity-40"
                        >
                          Verify (482 917)
                        </button>
                        <button
                          onClick={handleAuthorizeSession}
                          className="py-1 px-2 bg-white/10 hover:bg-white/15 text-[#F5F5F5] border border-white/15 rounded text-[10px] font-medium transition-colors"
                        >
                          Authorize
                        </button>
                        <button
                          onClick={handleRevokeAuthorization}
                          className="py-1 px-2 bg-white/5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded text-[10px] transition-colors"
                        >
                          Revoke Session
                        </button>
                        <button
                          onClick={handleToggleBlock}
                          className={`py-1 px-2 border rounded text-[10px] transition-colors ${
                            securityContext?.isBlocked
                              ? 'bg-white/20 text-[#F5F5F5] border-white/30 font-semibold'
                              : 'bg-white/5 text-[#A6A8AD] hover:text-[#F5F5F5] border-white/10'
                          }`}
                        >
                          {securityContext?.isBlocked ? 'Unblock Peer' : 'Block Peer'}
                        </button>
                        <button
                          onClick={handleToggleTrust}
                          className={`py-1 px-2 border rounded text-[10px] transition-colors ${
                            securityContext?.trustState === 'trusted'
                              ? 'bg-white/20 text-[#F5F5F5] border-white/30 font-semibold'
                              : 'bg-white/5 text-[#A6A8AD] hover:text-[#F5F5F5] border-white/10'
                          }`}
                        >
                          {securityContext?.trustState === 'trusted' ? 'Untrust' : 'Trust Peer'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 43 Cryptographic Secure Transport Session Deck */}
                <div className="p-3 bg-[#101114] border border-white/15 rounded-lg space-y-2.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-[#F5F5F5]" />
                      <span className="font-semibold text-[#F5F5F5]">Secure Transport Session (Step 43)</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-mono ${
                        securityContext?.isEncrypted ? 'bg-white/20 text-[#F5F5F5] font-semibold' : 'bg-white/10 text-[#686B72]'
                      }`}>
                        Transport: {securityContext?.isEncrypted ? 'ENCRYPTED (AES-256-GCM)' : 'UNENCRYPTED TCP'}
                      </span>
                      <span className="px-1.5 py-0.2 bg-white/10 text-[#A6A8AD] rounded text-[10px] uppercase font-mono">
                        Session: {securityContext?.secureTransportState ?? 'NONE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#A6A8AD]">
                      <span>Identity: <strong className="text-[#F5F5F5]">{securityContext?.identityStatus ?? 'unknown'}</strong></span>
                      <span>•</span>
                      <span>Enforced: <strong className={securityContext?.requireEncryption ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>{securityContext?.requireEncryption ? 'YES' : 'NO'}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {/* Peer & Local Fingerprint Box */}
                    <div className="p-2 bg-[#08090B] border border-white/10 rounded col-span-2 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider">
                        <span>Device Identity Fingerprints (SHA-256)</span>
                        <span className="text-[#A6A8AD]">ECDSA P-256</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-[11px] font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-[#686B72]">Local:</span>
                          <span className="text-[#F5F5F5] truncate ml-2" title={localFingerprint}>
                            {localFingerprint.slice(0, 23)}...
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#686B72]">Peer:</span>
                          <span className={securityContext?.peerFingerprint ? 'text-[#F5F5F5] truncate ml-2' : 'text-[#686B72] ml-2'} title={securityContext?.peerFingerprint || 'None'}>
                            {securityContext?.peerFingerprint ? `${securityContext.peerFingerprint.slice(0, 23)}...` : 'Not connected / Unverified'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cipher Suite & Protocol */}
                    <div className="p-2 bg-[#08090B] border border-white/10 rounded space-y-1">
                      <div className="text-[10px] text-[#686B72] uppercase tracking-wider">
                        Cipher Suite
                      </div>
                      <div className="text-[11px] font-mono text-[#F5F5F5]">
                        AES-256-GCM
                      </div>
                      <div className="text-[9px] text-[#686B72]">
                        ECDH-P256 + HKDF-SHA256
                      </div>
                    </div>

                    {/* Cryptographic Actions */}
                    <div className="p-2 bg-[#08090B] border border-white/10 rounded flex flex-col justify-between">
                      <div className="text-[10px] text-[#686B72] uppercase tracking-wider">
                        Crypto Session Controls
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          onClick={handleEstablishSecureSession}
                          disabled={!activeConnectionId || securityContext?.isEncrypted}
                          className="py-1 px-2 bg-white/15 hover:bg-white/20 text-[#F5F5F5] border border-white/20 rounded text-[10px] font-semibold transition-colors disabled:opacity-40"
                        >
                          Establish Crypto
                        </button>
                        <button
                          onClick={handleToggleRequireEncryption}
                          className={`py-1 px-2 border rounded text-[10px] transition-colors ${
                            securityContext?.requireEncryption
                              ? 'bg-white/20 text-[#F5F5F5] border-white/30 font-semibold'
                              : 'bg-white/5 text-[#A6A8AD] hover:text-[#F5F5F5] border-white/10'
                          }`}
                        >
                          {securityContext?.requireEncryption ? 'Enforce: ON' : 'Enforce: OFF'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Step 41 Real File Transfer Spike Deck */}
                <div className="p-3 bg-[#101114] border border-white/15 rounded-lg space-y-2.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <div className="flex items-center gap-2">
                      <UploadCloud className="w-3.5 h-3.5 text-[#F5F5F5]" />
                      <span className="font-semibold text-[#F5F5F5]">Physical LAN File Transfer Spike (Step 41)</span>
                      <span className="px-1.5 py-0.2 bg-white/10 text-[#A6A8AD] rounded text-[10px]">
                        Chunk: 512 KiB
                      </span>
                      <span className="text-[10px] text-[#686B72]">
                        (Development LAN spike measurement — unencrypted)
                      </span>
                    </div>
                    <span className="text-[10px] text-[#A6A8AD] uppercase font-mono">
                      Status: {transferTelemetry.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-center">
                    {/* File Selection & Type */}
                    <div className="flex items-center gap-2 text-xs">
                      <select
                        value={selectedPayloadType}
                        onChange={(e) => setSelectedPayloadType(e.target.value as PresetPayloadOption)}
                        className="bg-[#08090B] text-[#F5F5F5] border border-white/15 rounded px-2 py-1 text-xs outline-none font-mono"
                      >
                        <option value="small_16k">Synthetic 16 KiB File (1 Chunk)</option>
                        <option value="multi_1mib">Synthetic 1 MiB File (2 Chunks)</option>
                        <option value="multi_2mib">Synthetic 2 MiB File (4 Chunks)</option>
                        <option value="zero_byte">Synthetic Zero-Byte File (0 Chunks)</option>
                        {pickedNativeFile && (
                          <option value="native_file">Selected: {pickedNativeFile.name} ({(pickedNativeFile.size / 1024).toFixed(1)} KB)</option>
                        )}
                      </select>

                      <button
                        onClick={handlePickNativeFile}
                        className="flex items-center gap-1 py-1 px-2 bg-white/5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded text-[10px] shrink-0"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Pick Native</span>
                      </button>
                    </div>

                    {/* Transfer Action Trigger */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSendFileSpike}
                        disabled={isTransferringFile || !activeConnectionId}
                        className="flex-1 py-1.5 px-3 bg-white/15 hover:bg-white/25 disabled:opacity-40 text-[#F5F5F5] border border-white/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3 h-3 text-[#F5F5F5]" />
                        <span>{isTransferringFile ? 'Transferring Chunks...' : 'Send File Over TCP/LAN'}</span>
                      </button>

                      {transferTelemetry.status === 'manifest_pending' && (
                        <button
                          onClick={handleAcceptIncomingManifest}
                          className="py-1.5 px-2.5 bg-white/10 hover:bg-white/20 text-[#F5F5F5] border border-white/15 rounded-lg text-xs font-medium"
                        >
                          Accept Manifest
                        </button>
                      )}
                    </div>

                    {/* Progress Bar & Live Telemetry */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[#A6A8AD]">
                        <span>
                          {transferTelemetry.bytesTransferred.toLocaleString()} / {transferTelemetry.totalBytes.toLocaleString()} B
                        </span>
                        <span>
                          {transferTelemetry.speedDisplay ?? '0.0 KB/s'} • {((transferTelemetry.elapsedMs ?? 0) / 1000).toFixed(1)}s
                        </span>
                        <span className="font-semibold text-[#F5F5F5]">{transferTelemetry.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#08090B] border border-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#F5F5F5] transition-all duration-150"
                          style={{ width: `${transferTelemetry.progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-[#686B72]">
                        <span>Chunks: {transferTelemetry.currentChunk}/{transferTelemetry.totalChunks}</span>
                        <span>ACKs: {transferTelemetry.ackCount}</span>
                      </div>
                    </div>
                  </div>

                  {transferTelemetry.status === 'completed' && (
                    <div className="p-2 bg-white/5 border border-white/10 rounded text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[#F5F5F5]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span>Transfer Complete & Destination File Finalized</span>
                      </div>
                      <div className="text-[11px] text-[#A6A8AD] font-mono">
                        Source: {transferTelemetry.totalBytes.toLocaleString()} B | Dest: {transferTelemetry.destinationFileSize?.toLocaleString() ?? transferTelemetry.totalBytes.toLocaleString()} B | Verification: <strong className="text-[#F5F5F5]">{transferTelemetry.verified ? 'PASS' : 'FAIL'}</strong>
                      </div>
                    </div>
                  )}

                  {transferTelemetry.status === 'interrupted' && (
                    <div className="p-2 bg-white/5 border border-white/10 rounded text-xs flex items-center justify-between text-[#A6A8AD]">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span>Transfer Interrupted (Destination Unfinalized)</span>
                      </div>
                      <span className="text-[10px] font-mono">{transferTelemetry.errorMessage || 'Connection lost'}</span>
                    </div>
                  )}
                </div>

                {actionError && (
                  <div className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs text-[#A6A8AD] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#F5F5F5] shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}
              </div>
            )}

            {/* In-Memory Mock Loopback Action Deck */}
            {activeTab === 'mock_loopback' && (
              <div className="px-6 py-3 bg-[#08090B] border-b border-white/10 flex items-center justify-between">
                <div className="text-xs text-[#A6A8AD]">
                  Simulates full in-memory protocol lifecycle between two mock peers (macOS ↔ Android).
                </div>
                <button
                  onClick={handleRunMockSimulation}
                  disabled={isMockSimulating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 text-[#F5F5F5]" />
                  <span>{isMockSimulating ? 'Simulating...' : 'Run Mock Handshake'}</span>
                </button>
              </div>
            )}

            {/* Filter Bar */}
            <div className="flex items-center justify-between px-6 py-1.5 bg-[#101114]/60 border-b border-white/10 text-xs text-[#A6A8AD]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#686B72]" />
                  <span>Direction:</span>
                  <select
                    value={filterDirection}
                    onChange={(e) => setFilterDirection(e.target.value as any)}
                    className="bg-[#17191D] text-[#F5F5F5] border border-white/10 rounded px-2 py-0.5 text-xs outline-none"
                  >
                    <option value="ALL">All Directions</option>
                    <option value="outbound">Outbound (Sent)</option>
                    <option value="inbound">Inbound (Received)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>Type:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-[#17191D] text-[#F5F5F5] border border-white/10 rounded px-2 py-0.5 text-xs outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="HELLO">HELLO</option>
                    <option value="CAPABILITIES">CAPABILITIES</option>
                    <option value="SESSION_CREATE">SESSION_CREATE</option>
                    <option value="SESSION_ACCEPT">SESSION_ACCEPT</option>
                    <option value="FILE_MANIFEST">FILE_MANIFEST</option>
                    <option value="FILE_ACCEPT">FILE_ACCEPT</option>
                    <option value="CHUNK_START">CHUNK_START</option>
                    <option value="CHUNK_DATA">CHUNK_DATA</option>
                    <option value="CHUNK_ACK">CHUNK_ACK</option>
                    <option value="TRANSFER_PROGRESS">TRANSFER_PROGRESS</option>
                    <option value="TRANSFER_COMPLETE">TRANSFER_COMPLETE</option>
                    <option value="HEARTBEAT">HEARTBEAT</option>
                    <option value="GOODBYE">GOODBYE</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-[#686B72]">
                Captured Messages: <span className="text-[#F5F5F5] font-semibold">{filteredRecords.length}</span>
              </div>
            </div>

            {/* Split Screen: Message Timeline Log + Frame Payload Detail */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Frame Stream */}
              <div className="w-1/2 border-r border-white/10 flex flex-col bg-[#08090B]">
                <div className="p-2.5 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Protocol Message Timeline</span>
                  <span>State Flow & Status</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                  {filteredRecords.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#686B72]">
                      <Layers className="w-8 h-8 mb-3 opacity-40 text-[#A6A8AD]" />
                      <p className="text-xs text-[#A6A8AD] mb-1">No protocol messages captured yet</p>
                      <p className="text-[11px] max-w-xs">
                        {activeTab === 'native_tcp'
                          ? 'Start server, connect socket, perform handshake, and click "Send File Over TCP".'
                          : 'Click "Run Mock Handshake" to simulate an in-memory exchange.'}
                      </p>
                    </div>
                  ) : (
                    filteredRecords.map((rec) => {
                      const isSelected = selectedRecord?.id === rec.id;
                      return (
                        <div
                          key={rec.id}
                          onClick={() => setSelectedRecordId(rec.id)}
                          className={`p-3 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#17191D] border-l-2 border-white' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5 p-1 bg-white/5 border border-white/10 rounded">
                              {rec.direction === 'outbound' ? (
                                <ArrowUpRight className="w-3.5 h-3.5 text-[#F5F5F5]" />
                              ) : (
                                <ArrowDownLeft className="w-3.5 h-3.5 text-[#A6A8AD]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#F5F5F5]">
                                  {rec.type}
                                </span>
                                <span className="text-[10px] text-[#686B72]">
                                  {new Date(rec.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#A6A8AD] truncate mt-0.5 font-mono">
                                ID: {rec.message.messageId}
                              </div>
                              {rec.message.transferId && (
                                <div className="text-[10px] text-[#686B72] truncate font-mono">
                                  Transfer: {rec.message.transferId}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 space-y-1">
                            <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[#A6A8AD] block">
                              {rec.stateAfter}
                            </span>
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${
                                rec.status === 'accepted'
                                  ? 'text-[#F5F5F5] bg-white/10'
                                  : 'text-[#A6A8AD] bg-white/5'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Panel: Frame Inspector & Envelope Details */}
              <div className="w-1/2 flex flex-col bg-[#101114]/30">
                <div className="p-2.5 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Envelope & Payload Details</span>
                  {selectedRecord && (
                    <button
                      onClick={() =>
                        handleCopy(
                          JSON.stringify(selectedRecord.message, null, 2),
                          selectedRecord.id
                        )
                      }
                      className="flex items-center gap-1 text-[10px] text-[#A6A8AD] hover:text-[#F5F5F5] cursor-pointer"
                    >
                      {copiedId === selectedRecord.id ? (
                        <Check className="w-3 h-3 text-[#F5F5F5]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy JSON</span>
                    </button>
                  )}
                </div>

                {selectedRecord ? (
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Envelope Fields */}
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider text-[#686B72] mb-3">
                        Protocol Envelope
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                          <span className="text-[10px] text-[#686B72] block">Protocol</span>
                          <span className="text-[#F5F5F5] font-semibold">{selectedRecord.message.protocol}</span>
                        </div>
                        <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                          <span className="text-[10px] text-[#686B72] block">Version</span>
                          <span className="text-[#F5F5F5] font-semibold">{selectedRecord.message.version}</span>
                        </div>
                        <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                          <span className="text-[10px] text-[#686B72] block">Type</span>
                          <span className="text-[#F5F5F5] font-semibold">{selectedRecord.message.type}</span>
                        </div>
                        <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                          <span className="text-[10px] text-[#686B72] block">Timestamp</span>
                          <span className="text-[#F5F5F5]">{selectedRecord.message.timestamp}</span>
                        </div>
                        <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg col-span-2">
                          <span className="text-[10px] text-[#686B72] block">Message ID</span>
                          <span className="text-[#A6A8AD] text-[11px] break-all">{selectedRecord.message.messageId}</span>
                        </div>
                        {selectedRecord.message.transferId && (
                          <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg col-span-2">
                            <span className="text-[10px] text-[#686B72] block">Transfer ID</span>
                            <span className="text-[#A6A8AD] text-[11px]">{selectedRecord.message.transferId}</span>
                          </div>
                        )}
                        {selectedRecord.errorMessage && (
                          <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg col-span-2 text-xs text-[#A6A8AD]">
                            <span className="text-[10px] text-[#686B72] block">Error / Rejection Reason</span>
                            <span>{selectedRecord.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* State Lifecycle Shift */}
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider text-[#686B72] mb-3">
                        State Machine Shift
                      </h4>
                      <div className="flex items-center gap-2 text-xs p-3 bg-[#17191D] border border-white/10 rounded-lg text-[#F5F5F5]">
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[#A6A8AD]">
                          {selectedRecord.stateBefore}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#686B72]" />
                        <span className="px-2 py-1 bg-white/15 border border-white/20 rounded font-semibold text-[#F5F5F5]">
                          {selectedRecord.stateAfter}
                        </span>
                      </div>
                    </div>

                    {/* Sanitized Payload Content */}
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider text-[#686B72] mb-3">
                        Message Payload (Sanitized)
                      </h4>
                      <pre className="p-4 bg-[#08090B] border border-white/10 rounded-xl text-xs text-[#A6A8AD] overflow-x-auto leading-relaxed font-mono">
                        {JSON.stringify(sanitizePayload(selectedRecord.message.payload), null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-center text-[#686B72] text-xs">
                    Select a message on the left to inspect its envelope and payload.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Summary */}
            <div className="px-6 py-2.5 bg-[#101114] border-t border-white/10 flex items-center justify-between text-xs text-[#686B72]">
              <div className="flex items-center gap-4">
                <span>Native TCP Socket (Step 40 File Spike)</span>
                <span>•</span>
                <span>Unencrypted Feasibility Transport</span>
                <span>•</span>
                <span>Direct Mode Unimplemented</span>
              </div>
              <div>NearShare Protocol Engine v{PROTOCOL_VERSION}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
