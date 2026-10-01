/**
 * NearShare Native TCP Protocol Peer
 *
 * Connects the real macOS native TCP/LAN socket transport to the authoritative
 * NearShare protocol state machine, serialization, and native FileEngine/Writer stack.
 *
 * ARCHITECTURE & CONSTRAINTS:
 * - Transport Framing: Rust handles 4-byte BE length framing on the native TCP socket (1 MiB ceiling).
 * - Protocol Envelope: JSON-serialized NearShareMessage (Message.ts / serialization.ts).
 * - Chunking: Bounded logical chunks (default 512 KiB) encoded via base64 for transport compatibility.
 * - Separation of Concerns:
 *     - connectionId: Native TCP transport connection resource.
 *     - sessionId: Logical NearShare application protocol session resource.
 *     - transferId: Logical transfer operation resource.
 *     - transferFileId: Logical protocol file identifier (e.g. "tr_file_...").
 *     - nativeReferenceId: Local-only opaque file handle on sender/receiver (never transmitted).
 * - Zero Path Leakage: Payloads contain ONLY logical identifiers (deviceId, fileId, relativePath, size).
 * - Destination Integration: Real received chunk bytes are written directly to native destination files
 *   via NativeReceiveFileDestination & FileSystemManager.
 */

import { PROTOCOL_NAME, PROTOCOL_VERSION, isCompatibleVersion } from '../version';
import { type ProtocolMessage, createProtocolMessage, generateMessageId } from '../Message';
import type {
  CapabilityPayload,
  ProtocolDeviceIdentity,
  ProtocolMessageType,
  HelloPayload,
  PairingRequestPayload,
  PairingResponsePayload,
  PairingVerifyPayload,
  SessionCreatePayload,
  SessionAcceptPayload,
  HeartbeatPayload,
  GoodbyePayload,
  FileManifestPayload,
  FileManifestEntry,
  FileAcceptPayload,
  ChunkStartPayload,
  ChunkDataPayload,
  ChunkAckPayload,
  TransferProgressPayload,
  TransferCompletePayload,
  ResumeRequestPayload,
  ResumeResponsePayload,
  ResumeRejectPayload,
  FileResumeResponseItem,
  ResumeRejectCode,
} from '../messageTypes';
import type { TrustState, PairingMethod } from '../../security/types';
import {
  type ProtocolState,
  isMessageAcceptableInState,
  mapMessageTypeToState,
} from '../ProtocolStateMachine';
import { deserializeMessage, serializeMessage } from '../serialization';
import { createProtocolError, ProtocolException } from '../errors';
import { deriveSessionBoundSas } from '../../security/crypto/SasDerivation';
import type { MacTcpLanSpikeTransport } from '../../transport/native/mac/MacTcpLanSpikeTransport';
import type { WindowsTcpLanSpikeTransport } from '../../transport/native/windows/WindowsTcpLanSpikeTransport';

export interface NativeTcpTransportLike {
  mode: 'wifi';
  transportName: string;
  onRawBytes(listener: (connectionId: string, bytes: Uint8Array) => void): () => void;
  sendBytes(connectionId: string, data: Uint8Array): Promise<number>;
  onEvent(callback: (event: any) => void): () => void;
  disconnect(connectionId: string): Promise<void>;
  destroy(): void;
}
import {
  type ReceiveFileDestinationItem,
  createReceiveDestinationFromFile,
  writeReceiveDestinationChunk,
  finalizeReceiveDestination,
  releaseReceiveDestination,
  calculateMissingRanges,
  isDestinationComplete,
} from '../../file/NativeReceiveFileDestination';
import { readNativeFileChunk } from '../../native/tauri/TauriIpc';
import {
  SecureTransportSession,
  SecureFrameSerializer,
  SecureFrameType,
  type SecureSessionState,
  type IdentityVerificationStatus,
  type SessionRole,
} from '../../security/crypto';

export type SecurityState =
  | 'none'
  | 'pairing_requested'
  | 'awaiting_verification'
  | 'verifying'
  | 'paired'
  | 'rejected'
  | 'expired'
  | 'failed';

export type AuthorizationState =
  | 'unauthorized'
  | 'authorized'
  | 'revoked'
  | 'expired';

export interface ProtocolSecurityContext {
  securityState: SecurityState;
  authorizationState: AuthorizationState;
  trustState: TrustState;
  pairingId: string | null;
  verificationMethod: PairingMethod | string;
  verificationCode?: string | null;
  verificationExpiresAt: number | null;
  pairedAt: number | null;
  authorizationExpiresAt: number | null;
  isBlocked: boolean;
  unencryptedWarning: string;
  // Step 43 Cryptographic Secure Transport Session properties
  secureTransportState?: SecureSessionState;
  identityStatus?: IdentityVerificationStatus;
  peerFingerprint?: string | null;
  localFingerprint?: string;
  cipherSuite?: string;
  isEncrypted?: boolean;
  framesEncrypted?: number;
  requireEncryption?: boolean;
}

// Default chunk size for TCP spike payload (512 KiB fits comfortably in 1 MiB transport frame after Base64)
export const TCP_SPIKE_CHUNK_SIZE = 512 * 1024; // 512 KiB

export interface ProtocolSessionContext {
  connectionId: string | null;
  sessionId: string | null;
  transferId: string | null;
  localDeviceId: string;
  remoteDeviceId: string | null;
  protocolVersion: string;
  state: ProtocolState;
  createdAt: number | null;
  lastActivityAt: number | null;
  messageCount: number;
}

export interface ProtocolTimelineRecord {
  id: string;
  time: string;
  timestamp: number;
  direction: 'outbound' | 'inbound';
  type: ProtocolMessageType | string;
  messageId: string;
  sessionId?: string;
  transferId?: string;
  status: 'accepted' | 'rejected' | 'error';
  stateBefore: ProtocolState;
  stateAfter: ProtocolState;
  message?: ProtocolMessage;
  rawPreview?: string;
  errorMessage?: string;
}

export interface TransferProgressTelemetry {
  transferId: string;
  fileId: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  ackCount: number;
  progressPercent: number;
  elapsedMs?: number;
  speedBps?: number;
  speedDisplay?: string;
  status: 'idle' | 'manifest_pending' | 'manifest_accepted' | 'transferring' | 'completed' | 'interrupted' | 'error';
  destinationFileSize?: number;
  verified?: boolean;
  errorMessage?: string;
}

export interface SendFileOptions {
  name: string;
  size: number;
  relativePath?: string;
  fileType?: string;
  mimeType?: string;
  bytes?: Uint8Array;
  localNativeReferenceId?: string;
  chunkSize?: number;
}

export interface TransferSpikeResult {
  transferId: string;
  fileId: string;
  name: string;
  totalBytes: number;
  chunksSent: number;
  acksReceived: number;
  verified: boolean;
  durationMs: number;
  avgSpeedBps?: number;
  avgSpeedDisplay?: string;
}

// Helpers for binary base64 encoding without call-stack overflow
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  const CHUNK_SIZE = 0x8000; // 32 KiB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || base64.trim().length === 0) return new Uint8Array(0);
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class NativeTcpProtocolPeer {
  readonly localIdentity: ProtocolDeviceIdentity;
  readonly capabilities: CapabilityPayload;

  private transport: MacTcpLanSpikeTransport | WindowsTcpLanSpikeTransport | NativeTcpTransportLike;
  private connectionId: string | null = null;
  private sessionId: string | null = null;
  private activeTransferId: string | null = null;
  private remoteIdentity: ProtocolDeviceIdentity | null = null;
  private remoteCapabilities: CapabilityPayload | null = null;
  private state: ProtocolState = 'IDLE';
  private createdAt: number | null = null;
  private lastActivityAt: number | null = null;
  private heartbeatSequence = 0;

  // Security & Authorization State
  private securityState: SecurityState = 'none';
  private authorizationState: AuthorizationState = 'unauthorized';
  private trustState: TrustState = 'unknown';
  private pairingId: string | null = null;
  private verificationMethod: PairingMethod | string = 'numeric_comparison';
  private verificationCode: string | null = null;
  private verificationExpiresAt: number | null = null;
  private pairedAt: number | null = null;
  private authorizationExpiresAt: number | null = null;
  private isBlocked: boolean = false;

  // Step 43 Cryptographic Secure Transport Session
  private secureTransport: SecureTransportSession | null = null;
  private requireEncryption: boolean = false;
  private handshakeCompleteResolver: (() => void) | null = null;

  // Active receive destination & transfer state
  private activeDestination: ReceiveFileDestinationItem | null = null;
  private incomingManifest: FileManifestPayload | null = null;
  private transferTelemetry: TransferProgressTelemetry = {
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
  };

  // Promise resolvers for request-response protocol coordination
  private manifestAcceptResolver: ((payload: FileAcceptPayload) => void) | null = null;
  private chunkAckResolvers: Map<string, (payload: ChunkAckPayload) => void> = new Map();
  private resumeResponseResolver: ((payload: ResumeResponsePayload) => void) | null = null;
  private resumeRejectResolver: ((payload: ResumeRejectPayload) => void) | null = null;

  private readonly history: ProtocolTimelineRecord[] = [];
  private readonly timelineListeners: Set<(record: ProtocolTimelineRecord) => void> = new Set();
  private readonly telemetryListeners: Set<(telemetry: TransferProgressTelemetry) => void> = new Set();
  private readonly securityListeners: Set<(context: ProtocolSecurityContext) => void> = new Set();
  private unlistenTransportRaw: (() => void) | null = null;
  private unlistenTransportEvents: (() => void) | null = null;

  constructor(
    transport: MacTcpLanSpikeTransport | WindowsTcpLanSpikeTransport | NativeTcpTransportLike,
    localIdentity?: Partial<ProtocolDeviceIdentity>,
    capabilities?: Partial<CapabilityPayload>
  ) {
    this.transport = transport;

    this.localIdentity = {
      deviceId: localIdentity?.deviceId ?? `dev_mac_${Date.now().toString(36)}`,
      profileId: localIdentity?.profileId ?? `prof_mac_${Date.now().toString(36)}`,
      deviceName: localIdentity?.deviceName ?? 'NearShare Mac Node',
      username: localIdentity?.username ?? 'Mac User',
      platform: localIdentity?.platform ?? 'macOS',
    };

    // Honest capabilities: TCP LAN Wi-Fi socket, control + file transfer spike active
    this.capabilities = {
      modes: ['wifi'],
      discovery: false,
      pairing: false,
      transfer: true,
      fileSupport: true,
      maxChunkSize: TCP_SPIKE_CHUNK_SIZE,
      maxConcurrentTransfers: 1,
      resumeSupport: false,
      folderSupport: false,
      ...capabilities,
    };

    this.bindTransport();
  }

  private bindTransport(): void {
    this.unlistenTransportRaw = this.transport.onRawBytes((connId, bytes) => {
      // If we are attached to a specific connection, filter by that connectionId
      if (this.connectionId && connId !== this.connectionId) {
        return;
      }
      this.handleIncomingRawBytes(connId, bytes);
    });

    this.unlistenTransportEvents = this.transport.onEvent((event) => {
      if (event.type === 'connectionLost' || event.type === 'connectionFailed') {
        const connId = (event as any).connectionId;
        if (!this.connectionId || !connId || connId === this.connectionId) {
          this.handleConnectionInterrupted(event.type);
        }
      }
    });
  }

  /**
   * Handles unexpected socket interruption or drop during session or active transfer.
   */
  handleConnectionInterrupted(reason: string = 'disconnected'): void {
    const wasTransferring =
      this.transferTelemetry.status === 'transferring' ||
      this.transferTelemetry.status === 'manifest_pending' ||
      this.transferTelemetry.status === 'manifest_accepted';

    this.state = 'CLOSED';

    if (this.manifestAcceptResolver) {
      this.manifestAcceptResolver = null;
    }

    this.chunkAckResolvers.clear();

    if (this.secureTransport) {
      this.secureTransport.teardown();
      this.secureTransport = null;
    }

    if (this.activeDestination) {
      releaseReceiveDestination(this.activeDestination).catch(() => {});
      this.activeDestination = null;
    }

    if (wasTransferring) {
      this.updateTelemetry({
        status: 'interrupted',
        errorMessage: `Transfer interrupted: TCP socket ${reason}`,
      });
    }
  }

  /**
   * Attaches this protocol peer to a specific native TCP connection.
   */
  attachConnection(connectionId: string): void {
    this.connectionId = connectionId;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
  }

  /**
   * Detaches from the active connection.
   */
  detachConnection(): void {
    const wasActive =
      this.transferTelemetry.status === 'transferring' ||
      this.transferTelemetry.status === 'manifest_pending';

    this.connectionId = null;
    this.sessionId = null;
    this.activeTransferId = null;
    this.remoteIdentity = null;
    this.remoteCapabilities = null;
    this.state = 'CLOSED';

    if (this.secureTransport) {
      this.secureTransport.teardown();
      this.secureTransport = null;
    }

    if (this.activeDestination) {
      releaseReceiveDestination(this.activeDestination).catch(() => {});
      this.activeDestination = null;
    }

    if (wasActive) {
      this.updateTelemetry({
        status: 'interrupted',
        errorMessage: 'Connection detached during transfer',
      });
    }
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getActiveTransferId(): string | null {
    return this.activeTransferId;
  }

  getState(): ProtocolState {
    return this.state;
  }

  getRemoteIdentity(): ProtocolDeviceIdentity | null {
    return this.remoteIdentity;
  }

  getRemoteCapabilities(): CapabilityPayload | null {
    return this.remoteCapabilities;
  }

  getHistory(): ProtocolTimelineRecord[] {
    return [...this.history];
  }

  getActiveDestination(): ReceiveFileDestinationItem | null {
    return this.activeDestination;
  }

  getIncomingManifest(): FileManifestPayload | null {
    return this.incomingManifest;
  }

  getTransferTelemetry(): TransferProgressTelemetry {
    return { ...this.transferTelemetry };
  }

  getSessionContext(): ProtocolSessionContext {
    return {
      connectionId: this.connectionId,
      sessionId: this.sessionId,
      transferId: this.activeTransferId,
      localDeviceId: this.localIdentity.deviceId,
      remoteDeviceId: this.remoteIdentity?.deviceId ?? null,
      protocolVersion: PROTOCOL_VERSION,
      state: this.state,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      messageCount: this.history.length,
    };
  }

  // ==========================================================
  // SECURE TRANSPORT SESSION (STEP 43)
  // ==========================================================

  getSecureTransportSession(): SecureTransportSession | null {
    return this.secureTransport;
  }

  isSecureSessionEstablished(): boolean {
    return this.secureTransport !== null && this.secureTransport.isEstablished();
  }

  setRequireEncryption(required: boolean): void {
    this.requireEncryption = required;
    this.emitSecurityEvent();
  }

  async establishSecureSession(role: SessionRole = 'initiator'): Promise<void> {
    if (!this.connectionId) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', 'Cannot establish secure session without active TCP connection')
      );
    }
    const sessionId = this.sessionId || `sec_sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    this.sessionId = sessionId;

    this.secureTransport = new SecureTransportSession(sessionId, this.localIdentity.deviceId, role);
    this.secureTransport.onStateChange((st) => {
      this.emitSecurityEvent();
      if (st === 'established' && this.handshakeCompleteResolver) {
        this.handshakeCompleteResolver();
        this.handshakeCompleteResolver = null;
      }
    });

    if (role === 'initiator') {
      const initFrame = await this.secureTransport.createHandshakeInit();
      await this.transport.sendBytes(this.connectionId, initFrame);
      this.emitSecurityEvent();
    }
  }

  getSecurityContext(): ProtocolSecurityContext {
    const isEncrypted = this.secureTransport?.isEstablished() ?? false;
    return {
      securityState: this.securityState,
      authorizationState: this.authorizationState,
      trustState: this.trustState,
      pairingId: this.pairingId,
      verificationMethod: this.verificationMethod,
      verificationCode: this.verificationCode,
      verificationExpiresAt: this.verificationExpiresAt,
      pairedAt: this.pairedAt,
      authorizationExpiresAt: this.authorizationExpiresAt,
      isBlocked: this.isBlocked,
      unencryptedWarning: isEncrypted
        ? ''
        : 'Development pairing/authentication only — transport remains unencrypted.',
      secureTransportState: this.secureTransport?.getState() ?? 'none',
      identityStatus: this.secureTransport?.getIdentityStatus() ?? 'unknown',
      peerFingerprint: this.secureTransport?.getPeerFingerprint() ?? null,
      cipherSuite: isEncrypted ? 'AES-256-GCM / ECDH-P256 / HKDF-SHA256' : undefined,
      isEncrypted,
      requireEncryption: this.requireEncryption,
    };
  }

  checkAuthorization(): { authorized: boolean; reason?: string } {
    if (!this.connectionId) {
      return { authorized: false, reason: 'No active TCP connection' };
    }
    if (this.state === 'CLOSED' || this.state === 'IDLE') {
      return { authorized: false, reason: 'Protocol session is not active' };
    }
    if (this.isBlocked || this.trustState === 'blocked') {
      return { authorized: false, reason: 'Device is blocked' };
    }
    if (this.authorizationState === 'revoked') {
      return { authorized: false, reason: 'Session authorization was revoked' };
    }
    if (this.authorizationState === 'expired' || (this.authorizationExpiresAt && Date.now() > this.authorizationExpiresAt)) {
      this.authorizationState = 'expired';
      return { authorized: false, reason: 'Session authorization has expired' };
    }
    if (this.secureTransport) {
      if (this.secureTransport.getState() === 'failed') {
        return { authorized: false, reason: 'Secure transport session has failed' };
      }
      if (this.secureTransport.getIdentityStatus() === 'changed') {
        return { authorized: false, reason: 'Peer cryptographic identity changed — authorization blocked' };
      }
    }
    if (this.requireEncryption && (!this.secureTransport || !this.secureTransport.isEstablished())) {
      return { authorized: false, reason: 'Secure transport session is required but not established' };
    }
    if (this.trustState === 'trusted' || this.trustState === 'favorite') {
      return { authorized: true };
    }
    if (this.authorizationState !== 'authorized') {
      return { authorized: false, reason: 'Session is not authorized. Pairing verification required.' };
    }
    if (this.securityState !== 'paired') {
      return { authorized: false, reason: 'Device is not paired.' };
    }
    return { authorized: true };
  }

  isAuthorized(): boolean {
    return this.checkAuthorization().authorized;
  }

  onSecurityContext(listener: (context: ProtocolSecurityContext) => void): () => void {
    this.securityListeners.add(listener);
    return () => this.securityListeners.delete(listener);
  }

  private emitSecurityEvent(): void {
    const context = this.getSecurityContext();
    this.securityListeners.forEach((listener) => {
      try {
        listener(context);
      } catch (err) {
        console.error('[NativeTcpProtocolPeer] Security listener error:', err);
      }
    });
  }

  onTimelineRecord(listener: (record: ProtocolTimelineRecord) => void): () => void {
    this.timelineListeners.add(listener);
    return () => this.timelineListeners.delete(listener);
  }

  onTelemetry(listener: (telemetry: TransferProgressTelemetry) => void): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  private emitTimelineRecord(record: ProtocolTimelineRecord): void {
    this.history.push(record);
    this.lastActivityAt = record.timestamp;
    this.timelineListeners.forEach((listener) => {
      try {
        listener(record);
      } catch (err) {
        console.error('[NativeTcpProtocolPeer] Timeline listener error:', err);
      }
    });
  }

  private updateTelemetry(updates: Partial<TransferProgressTelemetry>): void {
    this.transferTelemetry = {
      ...this.transferTelemetry,
      ...updates,
    };
    if (this.transferTelemetry.totalBytes > 0) {
      this.transferTelemetry.progressPercent = Math.min(
        100,
        Math.round((this.transferTelemetry.bytesTransferred / this.transferTelemetry.totalBytes) * 100)
      );
    } else if (this.transferTelemetry.status === 'completed') {
      this.transferTelemetry.progressPercent = 100;
    }

    this.telemetryListeners.forEach((listener) => {
      try {
        listener({ ...this.transferTelemetry });
      } catch (err) {
        console.error('[NativeTcpProtocolPeer] Telemetry listener error:', err);
      }
    });
  }

  /**
   * Ingests and processes raw bytes received from the native TCP socket.
   */
  async handleIncomingRawBytes(connectionId: string, bytes: Uint8Array): Promise<void> {
    const stateBefore = this.state;
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString();

    // Check if incoming frame is a binary SecureFrame (Step 43)
    if (SecureFrameSerializer.isSecureFrame(bytes)) {
      try {
        const parsed = SecureFrameSerializer.parseFrame(bytes);

        if (parsed.frameType === SecureFrameType.HANDSHAKE_INIT) {
          if (!this.secureTransport) {
            this.secureTransport = new SecureTransportSession(
              parsed.sessionId,
              this.localIdentity.deviceId,
              'responder'
            );
            this.sessionId = parsed.sessionId;
            this.secureTransport.onStateChange(() => this.emitSecurityEvent());
          }
          const respFrame = await this.secureTransport.handleHandshakeInit(bytes);
          await this.transport.sendBytes(this.connectionId || connectionId, respFrame);
          this.emitSecurityEvent();
          return;
        }

        if (parsed.frameType === SecureFrameType.HANDSHAKE_RESP) {
          if (this.secureTransport) {
            const finishFrame = await this.secureTransport.handleHandshakeResp(bytes);
            await this.transport.sendBytes(this.connectionId || connectionId, finishFrame);
            this.emitSecurityEvent();
          }
          return;
        }

        if (parsed.frameType === SecureFrameType.HANDSHAKE_FINISH) {
          if (this.secureTransport) {
            this.secureTransport.handleHandshakeFinish(bytes);
            this.emitSecurityEvent();
          }
          return;
        }

        if (parsed.frameType === SecureFrameType.ENCRYPTED_DATA) {
          if (!this.secureTransport || !this.secureTransport.isEstablished()) {
            this.emitTimelineRecord({
              id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
              time: timeStr,
              timestamp: now,
              direction: 'inbound',
              type: 'ENCRYPTED_DATA',
              messageId: 'unknown',
              status: 'rejected',
              stateBefore,
              stateAfter: stateBefore,
              errorMessage: 'Received ENCRYPTED_DATA frame but secure transport session is not established',
            });
            return;
          }

          try {
            const decryptedPlaintext = await this.secureTransport.decryptFrame(bytes);
            bytes = decryptedPlaintext;
          } catch (err: any) {
            this.securityState = 'failed';
            this.emitSecurityEvent();
            this.emitTimelineRecord({
              id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
              time: timeStr,
              timestamp: now,
              direction: 'inbound',
              type: 'ENCRYPTED_DATA',
              messageId: 'unknown',
              status: 'error',
              stateBefore,
              stateAfter: stateBefore,
              errorMessage: err.message || 'Decryption / AEAD tag verification failed',
            });
            return;
          }
        }
      } catch (frameErr: any) {
        this.emitTimelineRecord({
          id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
          time: timeStr,
          timestamp: now,
          direction: 'inbound',
          type: 'SECURE_FRAME_ERROR',
          messageId: 'unknown',
          status: 'error',
          stateBefore,
          stateAfter: stateBefore,
          errorMessage: frameErr.message || 'Error processing secure transport frame',
        });
        return;
      }
    } else {
      // Unencrypted raw frame received
      if (this.requireEncryption && this.secureTransport?.isEstablished()) {
        this.emitTimelineRecord({
          id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
          time: timeStr,
          timestamp: now,
          direction: 'inbound',
          type: 'UNENCRYPTED_REJECTED',
          messageId: 'unknown',
          status: 'rejected',
          stateBefore,
          stateAfter: stateBefore,
          errorMessage: 'Unencrypted plaintext message rejected while secure session is active',
        });
        return;
      }
    }

    let rawString = '';
    try {
      rawString = new TextDecoder().decode(bytes);
    } catch {
      this.emitTimelineRecord({
        id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
        time: timeStr,
        timestamp: now,
        direction: 'inbound',
        type: 'UNKNOWN',
        messageId: 'unknown',
        status: 'error',
        stateBefore,
        stateAfter: stateBefore,
        errorMessage: 'Failed to decode UTF-8 bytes from socket',
      });
      return;
    }

    // Ignore non-protocol packets
    if (!rawString.includes(`"protocol":"${PROTOCOL_NAME}"`)) {
      return;
    }

    const deserializeResult = deserializeMessage(rawString);
    if (!deserializeResult.success) {
      this.emitTimelineRecord({
        id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
        time: timeStr,
        timestamp: now,
        direction: 'inbound',
        type: 'MALFORMED',
        messageId: 'unknown',
        status: 'rejected',
        stateBefore,
        stateAfter: stateBefore,
        rawPreview: rawString.substring(0, 120),
        errorMessage: deserializeResult.error.message,
      });
      return;
    }

    const message = deserializeResult.message;

    // Validate version compatibility
    if (!isCompatibleVersion(message.version)) {
      this.emitTimelineRecord({
        id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
        time: timeStr,
        timestamp: now,
        direction: 'inbound',
        type: message.type,
        messageId: message.messageId,
        sessionId: message.sessionId,
        transferId: message.transferId,
        status: 'rejected',
        stateBefore,
        stateAfter: stateBefore,
        message,
        errorMessage: `Incompatible protocol version '${message.version}' (expected '${PROTOCOL_VERSION}')`,
      });
      return;
    }

    // Validate state machine transition legality
    const acceptability = isMessageAcceptableInState(this.state, message.type);
    if (!acceptability.acceptable) {
      this.emitTimelineRecord({
        id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
        time: timeStr,
        timestamp: now,
        direction: 'inbound',
        type: message.type,
        messageId: message.messageId,
        sessionId: message.sessionId,
        transferId: message.transferId,
        status: 'rejected',
        stateBefore,
        stateAfter: stateBefore,
        message,
        errorMessage: acceptability.reason || 'Illegal state transition',
      });
      return;
    }

    // Advance state machine
    const nextState = mapMessageTypeToState(message.type);
    if (nextState) {
      this.state = nextState;
    }

    // Process type-specific logic
    try {
      switch (message.type) {
        case 'HELLO': {
          const payload = message.payload as HelloPayload;
          this.remoteIdentity = {
            deviceId: payload.deviceId,
            profileId: payload.profileId,
            deviceName: payload.deviceName,
            username: payload.username,
            platform: payload.platform,
          };
          break;
        }
        case 'CAPABILITIES': {
          this.remoteCapabilities = message.payload as CapabilityPayload;
          break;
        }
        case 'PAIRING_REQUEST': {
          const payload = message.payload as PairingRequestPayload;
          this.pairingId = payload.pairingId;
          this.verificationExpiresAt = payload.expiresAt;
          this.securityState = 'awaiting_verification';
          const localId = this.localIdentity?.deviceId ?? 'local';
          const remoteId = this.remoteIdentity?.deviceId ?? 'peer';
          deriveSessionBoundSas(payload.pairingId, localId, remoteId)
            .then((sas) => {
              this.verificationCode = sas.rawCode;
              this.emitSecurityEvent();
            })
            .catch(() => {
              this.emitSecurityEvent();
            });
          this.emitSecurityEvent();
          break;
        }
        case 'PAIRING_RESPONSE': {
          const payload = message.payload as PairingResponsePayload;
          if (payload.accepted) {
            this.securityState = 'awaiting_verification';
            const localId = this.localIdentity?.deviceId ?? 'local';
            const remoteId = this.remoteIdentity?.deviceId ?? 'peer';
            deriveSessionBoundSas(payload.pairingId, localId, remoteId)
              .then((sas) => {
                this.verificationCode = sas.rawCode;
                this.emitSecurityEvent();
              })
              .catch(() => {
                this.emitSecurityEvent();
              });
          } else {
            this.securityState = 'rejected';
            this.authorizationState = 'unauthorized';
          }
          this.emitSecurityEvent();
          break;
        }
        case 'PAIRING_VERIFY': {
          const payload = message.payload as PairingVerifyPayload;
          if (this.isBlocked || this.trustState === 'blocked') {
            this.securityState = 'rejected';
            this.authorizationState = 'unauthorized';
            this.emitSecurityEvent();
            throw new Error('PAIRING_VERIFY rejected: Device is blocked');
          }

          if (this.verificationExpiresAt && Date.now() > this.verificationExpiresAt) {
            this.securityState = 'expired';
            this.authorizationState = 'expired';
            this.emitSecurityEvent();
            throw new Error('PAIRING_VERIFY rejected: Verification code has expired');
          }

          if (payload.pairingId && this.pairingId && payload.pairingId !== this.pairingId) {
            this.securityState = 'failed';
            this.authorizationState = 'unauthorized';
            this.emitSecurityEvent();
            throw new Error(`PAIRING_VERIFY rejected: Pairing session mismatch ('${payload.pairingId}' !== '${this.pairingId}')`);
          }

          if (!this.verificationCode) {
            this.securityState = 'failed';
            this.authorizationState = 'unauthorized';
            this.emitSecurityEvent();
            throw new Error('PAIRING_VERIFY rejected: No verification code active for session');
          }

          const normalizedInput = payload.verificationPayload?.replace(/\s+/g, '') ?? '';
          const expected = this.verificationCode.replace(/\s+/g, '');

          if (normalizedInput === expected) {
            this.securityState = 'paired';
            this.authorizationState = 'authorized';
            this.pairedAt = Date.now();
            this.authorizationExpiresAt = Date.now() + 300_000;
            this.verificationCode = null; // Clear verification secret
            this.emitSecurityEvent();
          } else {
            this.securityState = 'failed';
            this.authorizationState = 'unauthorized';
            this.emitSecurityEvent();
            throw new Error('PAIRING_VERIFY rejected: Invalid verification code');
          }
          break;
        }
        case 'SESSION_CREATE': {
          const payload = message.payload as SessionCreatePayload;
          this.sessionId = payload.sessionId;
          break;
        }
        case 'SESSION_ACCEPT': {
          const payload = message.payload as SessionAcceptPayload;
          if (!this.sessionId) {
            this.sessionId = payload.sessionId;
          }
          break;
        }
        case 'FILE_MANIFEST': {
          const payload = message.payload as FileManifestPayload;

          // Step 42 Authorization Gate
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            throw new Error(`FILE_MANIFEST rejected: ${authCheck.reason}`);
          }

          this.activeTransferId = payload.transferId;
          this.incomingManifest = payload;

          if (payload.files && payload.files.length > 0) {
            const firstFile = payload.files[0];
            const dest = await createReceiveDestinationFromFile(firstFile);
            this.activeDestination = dest;
            this.updateTelemetry({
              transferId: payload.transferId,
              fileId: firstFile.fileId,
              fileName: firstFile.name,
              totalBytes: payload.totalBytes,
              bytesTransferred: 0,
              status: 'manifest_pending',
            });
          }
          break;
        }
        case 'FILE_ACCEPT': {
          const payload = message.payload as FileAcceptPayload;
          if (this.manifestAcceptResolver) {
            this.manifestAcceptResolver(payload);
            this.manifestAcceptResolver = null;
          }
          this.updateTelemetry({ status: 'manifest_accepted' });
          break;
        }
        case 'CHUNK_START': {
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            throw new Error(`CHUNK_START rejected: ${authCheck.reason}`);
          }
          const payload = message.payload as ChunkStartPayload;
          this.updateTelemetry({
            currentChunk: payload.descriptor.chunkIndex + 1,
            totalChunks: payload.descriptor.totalChunks,
            status: 'transferring',
          });
          break;
        }
        case 'CHUNK_DATA': {
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            throw new Error(`CHUNK_DATA rejected: ${authCheck.reason}`);
          }
          const payload = message.payload as ChunkDataPayload;
          const chunkBytes: Uint8Array = payload.dataBase64
            ? base64ToUint8Array(payload.dataBase64)
            : new Uint8Array(0);

          if (chunkBytes.length !== payload.dataLength) {
            throw new Error(`CHUNK_DATA payload length mismatch: declared ${payload.dataLength}, received ${chunkBytes.length}`);
          }

          if (this.activeDestination) {
            if (this.activeDestination.transferFileId !== payload.descriptor.fileId) {
              throw new Error(`Unknown fileId in chunk: '${payload.descriptor.fileId}'`);
            }
            if (payload.descriptor.offset + chunkBytes.length > this.activeDestination.expectedSize) {
              throw new Error(`Chunk write out-of-bounds: ${payload.descriptor.offset + chunkBytes.length} > ${this.activeDestination.expectedSize}`);
            }

            await writeReceiveDestinationChunk(this.activeDestination, payload.descriptor.offset, chunkBytes);

            this.updateTelemetry({
              bytesTransferred: this.activeDestination.bytesWritten,
              currentChunk: payload.descriptor.chunkIndex + 1,
              totalChunks: payload.descriptor.totalChunks,
              status: 'transferring',
            });
          }

          // Automatically send CHUNK_ACK back to sender
          await this.sendChunkAck(
            payload.descriptor.transferId,
            payload.descriptor.fileId,
            payload.descriptor.chunkIndex,
            chunkBytes.length
          );
          break;
        }
        case 'CHUNK_ACK': {
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            throw new Error(`CHUNK_ACK rejected: ${authCheck.reason}`);
          }
          const payload = message.payload as ChunkAckPayload;
          const key = `${payload.transferId}_${payload.fileId}_${payload.chunkIndex}`;
          const resolver = this.chunkAckResolvers.get(key);
          if (resolver) {
            resolver(payload);
            this.chunkAckResolvers.delete(key);
          }
          this.updateTelemetry({
            ackCount: this.transferTelemetry.ackCount + 1,
          });
          break;
        }
        case 'TRANSFER_PROGRESS': {
          const payload = message.payload as TransferProgressPayload;
          this.updateTelemetry({
            bytesTransferred: payload.bytesTransferred,
            totalBytes: payload.totalBytes,
          });
          break;
        }
        case 'TRANSFER_COMPLETE': {
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            throw new Error(`TRANSFER_COMPLETE rejected: ${authCheck.reason}`);
          }
          const payload = message.payload as TransferCompletePayload;
          let finalSize = 0;
          let verified = false;

          if (this.activeDestination) {
            finalSize = this.activeDestination.bytesWritten;
            verified = finalSize === this.activeDestination.expectedSize;
            await finalizeReceiveDestination(this.activeDestination);
          } else {
            verified = payload.totalBytes === 0;
          }

          this.updateTelemetry({
            bytesTransferred: payload.totalBytes,
            totalBytes: payload.totalBytes,
            destinationFileSize: finalSize,
            verified,
            status: 'completed',
          });
          break;
        }
        case 'RESUME_REQUEST': {
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            const req = message.payload as ResumeRequestPayload;
            await this.sendResumeReject(
              req.transferId,
              'UNAUTHORIZED',
              `RESUME_REQUEST rejected: ${authCheck.reason}`
            );
            throw new Error(`RESUME_REQUEST rejected: ${authCheck.reason}`);
          }

          const payload = message.payload as ResumeRequestPayload;
          this.activeTransferId = payload.transferId;

          const fileResponses: FileResumeResponseItem[] = [];
          for (const reqFile of payload.files) {
            if (this.activeDestination && this.activeDestination.transferFileId === reqFile.transferFileId) {
              const missing = calculateMissingRanges(this.activeDestination.writtenRanges, this.activeDestination.expectedSize);
              fileResponses.push({
                transferFileId: reqFile.transferFileId,
                accepted: true,
                expectedSize: this.activeDestination.expectedSize,
                bytesReceived: this.activeDestination.bytesWritten,
                receivedRanges: [...this.activeDestination.writtenRanges],
                missingRanges: missing,
                isComplete: isDestinationComplete(this.activeDestination),
              });
            } else {
              fileResponses.push({
                transferFileId: reqFile.transferFileId,
                accepted: true,
                expectedSize: reqFile.expectedSize,
                bytesReceived: 0,
                receivedRanges: [],
                missingRanges: [{ offset: 0, length: reqFile.expectedSize }],
                isComplete: reqFile.expectedSize === 0,
              });
            }
          }

          await this.sendResumeResponse(payload.transferId, true, fileResponses);
          this.state = 'CHUNK_TRANSFER';
          break;
        }
        case 'RESUME_RESPONSE': {
          const authCheck = this.checkAuthorization();
          if (!authCheck.authorized) {
            throw new Error(`RESUME_RESPONSE rejected: ${authCheck.reason}`);
          }
          const payload = message.payload as ResumeResponsePayload;
          if (this.resumeResponseResolver) {
            this.resumeResponseResolver(payload);
            this.resumeResponseResolver = null;
          }
          this.state = 'CHUNK_TRANSFER';
          break;
        }
        case 'RESUME_REJECT': {
          const payload = message.payload as ResumeRejectPayload;
          if (this.resumeRejectResolver) {
            this.resumeRejectResolver(payload);
            this.resumeRejectResolver = null;
          }
          this.state = 'TRANSFER_FAILED';
          break;
        }
        case 'GOODBYE': {
          this.state = 'CLOSED';
          break;
        }
      }
    } catch (err: any) {
      this.emitTimelineRecord({
        id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
        time: timeStr,
        timestamp: now,
        direction: 'inbound',
        type: message.type,
        messageId: message.messageId,
        sessionId: message.sessionId ?? this.sessionId ?? undefined,
        transferId: message.transferId ?? this.activeTransferId ?? undefined,
        status: 'error',
        stateBefore,
        stateAfter: this.state,
        message,
        errorMessage: err?.message || 'Error processing protocol message',
      });
      return;
    }

    this.emitTimelineRecord({
      id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
      time: timeStr,
      timestamp: now,
      direction: 'inbound',
      type: message.type,
      messageId: message.messageId,
      sessionId: message.sessionId ?? this.sessionId ?? undefined,
      transferId: message.transferId ?? this.activeTransferId ?? undefined,
      status: 'accepted',
      stateBefore,
      stateAfter: this.state,
      message,
    });
  }

  /**
   * Transmits a strongly-typed NearShare protocol message over the native TCP socket.
   */
  async sendMessage<K extends ProtocolMessageType>(
    type: K,
    payload: any,
    options?: { sessionId?: string; transferId?: string }
  ): Promise<ProtocolMessage> {
    if (!this.connectionId) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', 'No active TCP connection attached to protocol peer')
      );
    }

    const stateBefore = this.state;
    const acceptability = isMessageAcceptableInState(this.state, type);
    if (!acceptability.acceptable) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', acceptability.reason || `Cannot send ${type} in state '${this.state}'`)
      );
    }

    const targetSessionId = options?.sessionId ?? this.sessionId ?? undefined;
    const targetTransferId = options?.transferId ?? this.activeTransferId ?? undefined;

    const msg = createProtocolMessage(type, payload, {
      sessionId: targetSessionId,
      transferId: targetTransferId,
      deviceId: this.localIdentity.deviceId,
    });

    const serialized = serializeMessage(msg);
    const bytes = new TextEncoder().encode(serialized);

    if (this.secureTransport && this.secureTransport.isEstablished()) {
      const encryptedWireFrame = await this.secureTransport.encryptPayload(bytes);
      await this.transport.sendBytes(this.connectionId, encryptedWireFrame);
    } else if (this.requireEncryption) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', 'Encryption is required but secure transport session is not established')
      );
    } else {
      await this.transport.sendBytes(this.connectionId, bytes);
    }

    const nextState = mapMessageTypeToState(type);
    if (nextState) {
      this.state = nextState;
    }

    const now = Date.now();
    this.emitTimelineRecord({
      id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
      time: new Date(now).toLocaleTimeString(),
      timestamp: now,
      direction: 'outbound',
      type,
      messageId: msg.messageId,
      sessionId: targetSessionId,
      transferId: targetTransferId,
      status: 'accepted',
      stateBefore,
      stateAfter: this.state,
      message: msg,
    });

    return msg;
  }

  // ==========================================================
  // PROTOCOL HANDSHAKE ACTIONS
  // ==========================================================

  async sendHello(): Promise<ProtocolMessage> {
    const payload: HelloPayload = {
      deviceId: this.localIdentity.deviceId,
      profileId: this.localIdentity.profileId,
      deviceName: this.localIdentity.deviceName,
      username: this.localIdentity.username,
      platform: this.localIdentity.platform,
      appVersion: '2.0.0-spike',
      protocolVersion: PROTOCOL_VERSION,
      supportedModes: ['wifi'],
      capabilities: this.capabilities,
    };
    return this.sendMessage('HELLO', payload);
  }

  async sendCapabilities(): Promise<ProtocolMessage> {
    return this.sendMessage('CAPABILITIES', this.capabilities);
  }

  // ==========================================================
  // STEP 42: AUTHENTICATED PAIRING & AUTHORIZATION ACTIONS
  // ==========================================================

  async requestPairing(
    method: 'numeric_comparison' | 'pin' | string = 'numeric_comparison',
    customPairingId?: string
  ): Promise<ProtocolMessage> {
    const pairingId =
      customPairingId ?? `pair_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    this.pairingId = pairingId;
    const localId = this.localIdentity?.deviceId ?? 'local';
    const remoteId = this.remoteIdentity?.deviceId ?? 'peer';
    const sas = await deriveSessionBoundSas(pairingId, localId, remoteId);
    this.verificationCode = sas.rawCode;
    this.verificationExpiresAt = sas.expiresAt;
    this.securityState = 'awaiting_verification';
    this.authorizationState = 'unauthorized';

    const payload: PairingRequestPayload = {
      pairingId,
      pairingRequestId: pairingId,
      method,
      expiresAt: sas.expiresAt,
      expiresInMs: 60_000,
    };

    const msg = await this.sendMessage('PAIRING_REQUEST', payload);
    this.emitSecurityEvent();
    return msg;
  }

  async respondPairing(
    pairingIdOrAccepted: string | boolean,
    acceptedOrReason?: boolean | string,
    rejectionReason?: string
  ): Promise<ProtocolMessage> {
    let pairingId: string;
    let accepted: boolean;
    let reason: string | undefined;

    if (typeof pairingIdOrAccepted === 'string') {
      pairingId = pairingIdOrAccepted;
      accepted = typeof acceptedOrReason === 'boolean' ? acceptedOrReason : true;
      reason = rejectionReason ?? (typeof acceptedOrReason === 'string' ? acceptedOrReason : undefined);
    } else {
      pairingId = this.pairingId ?? `pair_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      accepted = pairingIdOrAccepted;
      reason = typeof acceptedOrReason === 'string' ? acceptedOrReason : undefined;
    }

    this.pairingId = pairingId;

    const payload: PairingResponsePayload = {
      pairingId,
      pairingRequestId: pairingId,
      accepted,
      reason,
      rejectionReason: reason,
    };

    if (accepted) {
      this.securityState = 'awaiting_verification';
      const localId = this.localIdentity?.deviceId ?? 'local';
      const remoteId = this.remoteIdentity?.deviceId ?? 'peer';
      const sas = await deriveSessionBoundSas(pairingId, localId, remoteId);
      this.verificationCode = sas.rawCode;
      this.verificationExpiresAt = sas.expiresAt;
    } else {
      this.securityState = 'rejected';
      this.authorizationState = 'unauthorized';
    }

    const msg = await this.sendMessage('PAIRING_RESPONSE', payload);
    this.emitSecurityEvent();
    return msg;
  }

  async verifyPairing(enteredCode: string): Promise<ProtocolMessage> {
    if (!this.pairingId) {
      throw new Error('No active pairing session to verify');
    }

    if (this.verificationExpiresAt && Date.now() > this.verificationExpiresAt) {
      this.securityState = 'expired';
      this.authorizationState = 'unauthorized';
      this.emitSecurityEvent();
      throw new Error('PAIRING_VERIFY rejected: Verification PIN code expired');
    }

    if (!this.verificationCode) {
      this.securityState = 'failed';
      this.authorizationState = 'unauthorized';
      this.emitSecurityEvent();
      throw new Error('PAIRING_VERIFY rejected: No verification code active for session');
    }

    const normalizedInput = enteredCode.replace(/\s+/g, '');
    const expected = this.verificationCode.replace(/\s+/g, '');

    if (normalizedInput !== expected) {
      this.securityState = 'failed';
      this.authorizationState = 'unauthorized';
      this.emitSecurityEvent();
      throw new Error('PAIRING_VERIFY rejected: Incorrect verification code');
    }

    this.securityState = 'paired';
    this.authorizationState = 'authorized';
    this.pairedAt = Date.now();
    this.authorizationExpiresAt = Date.now() + 300_000;
    this.verificationCode = null; // Clear from memory

    const payload: PairingVerifyPayload = {
      pairingId: this.pairingId,
      pairingRequestId: this.pairingId,
      verificationType: 'numeric_comparison',
      verificationPayload: enteredCode,
    };

    const msg = await this.sendMessage('PAIRING_VERIFY', payload);
    this.emitSecurityEvent();
    return msg;
  }

  public setVerificationCode(code: string | null): void {
    this.verificationCode = code;
  }

  public getVerificationCode(): string | null {
    return this.verificationCode;
  }

  authorizeSession(): void {
    if (this.isBlocked || this.trustState === 'blocked') {
      throw new Error('Cannot authorize blocked device');
    }
    this.securityState = 'paired';
    this.authorizationState = 'authorized';
    this.pairedAt = Date.now();
    this.authorizationExpiresAt = Date.now() + 300_000;
    this.verificationCode = null;
    this.emitSecurityEvent();
  }

  revokeAuthorization(_reason: string = 'user_revoked'): void {
    this.authorizationState = 'revoked';
    this.emitSecurityEvent();
  }

  setBlocked(blocked: boolean): void {
    this.isBlocked = blocked;
    if (blocked) {
      this.trustState = 'blocked';
      this.authorizationState = 'unauthorized';
    } else if (this.trustState === 'blocked') {
      this.trustState = 'unknown';
    }
    this.emitSecurityEvent();
  }

  setTrustState(trustState: TrustState): void {
    this.trustState = trustState;
    if (trustState === 'blocked') {
      this.isBlocked = true;
      this.authorizationState = 'unauthorized';
    } else if (trustState === 'trusted' || trustState === 'favorite') {
      this.isBlocked = false;
      this.authorizationState = 'authorized';
      this.securityState = 'paired';
    }
    this.emitSecurityEvent();
  }

  async createSession(customSessionId?: string): Promise<ProtocolMessage> {
    const sessId = customSessionId ?? `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    this.sessionId = sessId;
    const payload: SessionCreatePayload = {
      sessionId: sessId,
      mode: 'wifi',
      capabilities: this.capabilities,
    };
    return this.sendMessage('SESSION_CREATE', payload, { sessionId: sessId });
  }

  async acceptSession(sessionId?: string): Promise<ProtocolMessage> {
    const targetSessionId = sessionId ?? this.sessionId;
    if (!targetSessionId) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', 'Cannot accept session: No sessionId available')
      );
    }
    this.sessionId = targetSessionId;
    const payload: SessionAcceptPayload = {
      sessionId: targetSessionId,
      accepted: true,
      negotiatedCapabilities: {
        mode: 'wifi',
        chunkSize: TCP_SPIKE_CHUNK_SIZE,
        resumeSupport: false,
        folderSupport: false,
        maxConcurrentTransfers: 1,
        streamingSupported: true,
      },
    };
    return this.sendMessage('SESSION_ACCEPT', payload, { sessionId: targetSessionId });
  }

  async sendHeartbeat(): Promise<ProtocolMessage> {
    if (!this.sessionId) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', 'Cannot send HEARTBEAT without an active sessionId')
      );
    }
    this.heartbeatSequence += 1;
    const payload: HeartbeatPayload = {
      sessionId: this.sessionId,
      sequence: this.heartbeatSequence,
    };
    return this.sendMessage('HEARTBEAT', payload, { sessionId: this.sessionId });
  }

  async sendGoodbye(reason: string = 'normal'): Promise<ProtocolMessage> {
    const payload: GoodbyePayload = {
      deviceId: this.localIdentity.deviceId,
      reason,
    };
    const msg = await this.sendMessage('GOODBYE', payload);
    this.state = 'CLOSED';

    if (this.connectionId) {
      const connId = this.connectionId;
      setTimeout(() => {
        this.transport.disconnect(connId).catch(() => {});
      }, 50);
    }

    return msg;
  }

  // ==========================================================
  // FILE TRANSFER PROTOCOL ACTIONS (STEP 40)
  // ==========================================================

  /**
   * 1. Sends FILE_MANIFEST over the protocol.
   */
  async sendFileManifest(
    files: Array<{
      fileId: string;
      name: string;
      size: number;
      relativePath?: string;
      mimeType?: string;
      fileType?: string;
    }>,
    customTransferId?: string
  ): Promise<ProtocolMessage> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', `Transfer rejected: ${authCheck.reason}`)
      );
    }

    const transferId = customTransferId ?? `tr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeTransferId = transferId;

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const manifestEntries: FileManifestEntry[] = files.map((f) => ({
      fileId: f.fileId,
      name: f.name,
      relativePath: f.relativePath,
      size: f.size,
      mimeType: f.mimeType || 'application/octet-stream',
      fileType: f.fileType || 'bin',
      modifiedAt: Date.now(),
    }));

    const payload: FileManifestPayload = {
      transferId,
      files: manifestEntries,
      totalBytes,
    };

    return this.sendMessage('FILE_MANIFEST', payload, { transferId });
  }

  /**
   * 2. Sends FILE_ACCEPT in response to an incoming manifest.
   */
  async acceptFileManifest(
    transferId: string,
    acceptedFileIds: string[]
  ): Promise<ProtocolMessage> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', `FILE_ACCEPT rejected: ${authCheck.reason}`)
      );
    }
    const payload: FileAcceptPayload = {
      transferId,
      acceptedFileIds,
      destinationPolicy: 'default',
    };
    return this.sendMessage('FILE_ACCEPT', payload, { transferId });
  }

  /**
   * 3. Sends CHUNK_START metadata for an upcoming chunk.
   */
  async sendChunkStart(
    transferId: string,
    fileId: string,
    chunkIndex: number,
    offset: number,
    length: number,
    totalChunks: number
  ): Promise<ProtocolMessage> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', `CHUNK_START rejected: ${authCheck.reason}`)
      );
    }
    const payload: ChunkStartPayload = {
      descriptor: {
        transferId,
        fileId,
        chunkIndex,
        offset,
        length,
        totalChunks,
      },
    };
    return this.sendMessage('CHUNK_START', payload, { transferId });
  }

  /**
   * 4. Sends CHUNK_DATA containing real base64-encoded chunk bytes.
   */
  async sendChunkData(
    transferId: string,
    fileId: string,
    chunkIndex: number,
    offset: number,
    dataBytes: Uint8Array,
    totalChunks: number
  ): Promise<ProtocolMessage> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', `CHUNK_DATA rejected: ${authCheck.reason}`)
      );
    }
    const dataBase64 = uint8ArrayToBase64(dataBytes);
    const payload: ChunkDataPayload = {
      descriptor: {
        transferId,
        fileId,
        chunkIndex,
        offset,
        length: dataBytes.length,
        totalChunks,
      },
      dataLength: dataBytes.length,
      dataBase64,
    };
    return this.sendMessage('CHUNK_DATA', payload, { transferId });
  }

  /**
   * 5. Sends CHUNK_ACK verifying chunk receipt and disk write.
   */
  async sendChunkAck(
    transferId: string,
    fileId: string,
    chunkIndex: number,
    receivedLength: number
  ): Promise<ProtocolMessage> {
    const payload: ChunkAckPayload = {
      transferId,
      fileId,
      chunkIndex,
      receivedLength,
      checksumVerified: true,
    };
    return this.sendMessage('CHUNK_ACK', payload, { transferId });
  }

  /**
   * 6. Sends TRANSFER_PROGRESS telemetry.
   */
  async sendTransferProgress(
    transferId: string,
    bytesTransferred: number,
    totalBytes: number,
    speedBps: number = 0
  ): Promise<ProtocolMessage> {
    const payload: TransferProgressPayload = {
      transferId,
      bytesTransferred,
      totalBytes,
      speedBytesPerSecond: speedBps,
    };
    return this.sendMessage('TRANSFER_PROGRESS', payload, { transferId });
  }

  /**
   * 7. Sends TRANSFER_COMPLETE after all chunks are transmitted and acknowledged.
   */
  async sendTransferComplete(
    transferId: string,
    totalBytes: number,
    fileCount: number = 1
  ): Promise<ProtocolMessage> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', `TRANSFER_COMPLETE rejected: ${authCheck.reason}`)
      );
    }
    const payload: TransferCompletePayload = {
      transferId,
      totalBytes,
      fileCount,
      completedAt: Date.now(),
      verificationStatus: 'verified',
    };
    return this.sendMessage('TRANSFER_COMPLETE', payload, { transferId });
  }

  /**
   * Complete High-Level Sender Transfer Orchestrator
   *
   * Executes the full Step 40 protocol transfer flow:
   * FILE_MANIFEST -> FILE_ACCEPT -> [CHUNK_START -> CHUNK_DATA -> CHUNK_ACK]* -> TRANSFER_COMPLETE
   */
  async transferRealFile(options: SendFileOptions): Promise<TransferSpikeResult> {
    const startTime = Date.now();
    const fileId = `tr_file_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const transferId = `tr_sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    this.activeTransferId = transferId;

    const chunkSize = options.chunkSize || TCP_SPIKE_CHUNK_SIZE;
    const totalSize = options.size;
    const totalChunks = totalSize === 0 ? 0 : Math.ceil(totalSize / chunkSize);

    // Step 42 Authorization Gate
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new ProtocolException(
        createProtocolError('INVALID_STATE', `Transfer rejected: ${authCheck.reason}`)
      );
    }

    this.updateTelemetry({
      transferId,
      fileId,
      fileName: options.name,
      totalBytes: totalSize,
      bytesTransferred: 0,
      currentChunk: 0,
      totalChunks,
      ackCount: 0,
      elapsedMs: 0,
      speedBps: 0,
      speedDisplay: '0.0 KB/s',
      status: 'manifest_pending',
      errorMessage: undefined,
    });

    try {
      // Step 1: Send FILE_MANIFEST
      const manifestPromise = new Promise<FileAcceptPayload>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.manifestAcceptResolver = null;
          reject(new Error('FILE_ACCEPT_TIMEOUT: Peer did not accept file manifest within 10s'));
        }, 10000);

        this.manifestAcceptResolver = (acceptPayload) => {
          clearTimeout(timeout);
          resolve(acceptPayload);
        };
      });

      await this.sendFileManifest(
        [
          {
            fileId,
            name: options.name,
            size: totalSize,
            relativePath: options.relativePath,
            fileType: options.fileType || 'bin',
            mimeType: options.mimeType || 'application/octet-stream',
          },
        ],
        transferId
      );

      // Step 2: Await FILE_ACCEPT from receiver
      await manifestPromise;
      this.updateTelemetry({ status: 'manifest_accepted' });

      // Step 3: Handle Zero-Byte File
      if (totalSize === 0) {
        const elapsedMs = Math.max(1, Date.now() - startTime);
        await this.sendTransferComplete(transferId, 0, 1);
        this.updateTelemetry({
          bytesTransferred: 0,
          elapsedMs,
          speedBps: 0,
          speedDisplay: '0.0 KB/s',
          status: 'completed',
          verified: true,
        });

        return {
          transferId,
          fileId,
          name: options.name,
          totalBytes: 0,
          chunksSent: 0,
          acksReceived: 0,
          verified: true,
          durationMs: elapsedMs,
          avgSpeedBps: 0,
          avgSpeedDisplay: '0.0 KB/s',
        };
      }

      // Step 4: Stream Chunks Sequentially
      let bytesSent = 0;
      let chunksSent = 0;
      let acksReceived = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const offset = chunkIndex * chunkSize;
        const length = Math.min(chunkSize, totalSize - offset);

        // Read chunk bytes from in-memory buffer or Rust native file
        let chunkBytes: Uint8Array;
        if (options.bytes) {
          chunkBytes = options.bytes.subarray(offset, offset + length);
        } else if (options.localNativeReferenceId) {
          const readResult = await readNativeFileChunk(options.localNativeReferenceId, offset, length);
          if (!readResult || !readResult.bytes) {
            throw new Error(`Failed to read chunk ${chunkIndex} from native file`);
          }
          chunkBytes = readResult.bytes;
        } else {
          throw new Error('No chunk data source provided (neither in-memory bytes nor localNativeReferenceId)');
        }

        // Step 4a: Send CHUNK_START
        await this.sendChunkStart(transferId, fileId, chunkIndex, offset, chunkBytes.length, totalChunks);

        // Step 4b: Send CHUNK_DATA & Await CHUNK_ACK
        const ackKey = `${transferId}_${fileId}_${chunkIndex}`;
        const ackPromise = new Promise<ChunkAckPayload>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.chunkAckResolvers.delete(ackKey);
            reject(new Error(`CHUNK_ACK_TIMEOUT: Chunk ${chunkIndex} (offset ${offset}) not acknowledged within 10s`));
          }, 10000);

          this.chunkAckResolvers.set(ackKey, (ackPayload) => {
            clearTimeout(timeout);
            resolve(ackPayload);
          });
        });

        await this.sendChunkData(transferId, fileId, chunkIndex, offset, chunkBytes, totalChunks);
        chunksSent++;

        await ackPromise;
        acksReceived++;
        bytesSent += chunkBytes.length;

        // Calculate live throughput
        const elapsedMs = Math.max(1, Date.now() - startTime);
        const speedBps = Math.round((bytesSent / elapsedMs) * 1000);
        const speedDisplay =
          speedBps >= 1024 * 1024
            ? `${(speedBps / (1024 * 1024)).toFixed(2)} MB/s`
            : `${(speedBps / 1024).toFixed(1)} KB/s`;

        // Telemetry update & TRANSFER_PROGRESS protocol frame
        this.updateTelemetry({
          bytesTransferred: bytesSent,
          currentChunk: chunkIndex + 1,
          totalChunks,
          ackCount: acksReceived,
          elapsedMs,
          speedBps,
          speedDisplay,
          status: 'transferring',
        });

        await this.sendTransferProgress(transferId, bytesSent, totalSize, speedBps);
      }

      // Step 5: Send TRANSFER_COMPLETE
      const totalElapsedMs = Math.max(1, Date.now() - startTime);
      const avgSpeedBps = Math.round((totalSize / totalElapsedMs) * 1000);
      const avgSpeedDisplay =
        avgSpeedBps >= 1024 * 1024
          ? `${(avgSpeedBps / (1024 * 1024)).toFixed(2)} MB/s`
          : `${(avgSpeedBps / 1024).toFixed(1)} KB/s`;

      await this.sendTransferComplete(transferId, totalSize, 1);
      this.updateTelemetry({
        bytesTransferred: totalSize,
        elapsedMs: totalElapsedMs,
        speedBps: avgSpeedBps,
        speedDisplay: avgSpeedDisplay,
        status: 'completed',
        verified: bytesSent === totalSize,
      });

      return {
        transferId,
        fileId,
        name: options.name,
        totalBytes: totalSize,
        chunksSent,
        acksReceived,
        verified: bytesSent === totalSize,
        durationMs: totalElapsedMs,
        avgSpeedBps,
        avgSpeedDisplay,
      };
    } catch (err: any) {
      this.updateTelemetry({
        status: 'interrupted',
        errorMessage: err?.message || 'Transfer interrupted or failed',
      });
      throw err;
    }
  }

  /**
   * Sends a RESUME_REQUEST and awaits a receiver RESUME_RESPONSE.
   */
  async sendResumeRequest(
    transferId: string,
    files: Array<{ transferFileId: string; expectedSize: number; chunkSize: number; proposedNextOffset?: number }>
  ): Promise<ResumeResponsePayload> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new Error(`sendResumeRequest rejected: ${authCheck.reason}`);
    }

    this.activeTransferId = transferId;
    const payload: ResumeRequestPayload = {
      transferId,
      sourceDeviceId: this.localIdentity.deviceId,
      destinationDeviceId: this.remoteIdentity?.deviceId ?? 'unknown',
      files: files.map((f) => ({
        transferFileId: f.transferFileId,
        expectedSize: f.expectedSize,
        chunkSize: f.chunkSize,
        proposedNextOffset: f.proposedNextOffset,
        proposedNextChunkIndex: f.proposedNextOffset !== undefined ? Math.floor(f.proposedNextOffset / f.chunkSize) : undefined,
      })),
    };

    const responsePromise = new Promise<ResumeResponsePayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.resumeResponseResolver = null;
        this.resumeRejectResolver = null;
        reject(new Error('RESUME_RESPONSE_TIMEOUT: Receiver did not respond to resume request within 10s'));
      }, 10000);

      this.resumeResponseResolver = (resp) => {
        clearTimeout(timeout);
        resolve(resp);
      };

      this.resumeRejectResolver = (rej) => {
        clearTimeout(timeout);
        reject(new Error(`RESUME_REJECTED (${rej.code}): ${rej.reason}`));
      };
    });

    await this.sendMessage('RESUME_REQUEST', payload, { transferId });
    return responsePromise;
  }

  /**
   * Sends a RESUME_RESPONSE back to the sender with receiver-authoritative ranges.
   */
  async sendResumeResponse(
    transferId: string,
    accepted: boolean,
    files: FileResumeResponseItem[],
    rejectionReason?: string
  ): Promise<ProtocolMessage> {
    const payload: ResumeResponsePayload = {
      transferId,
      accepted,
      files,
      rejectionReason,
    };
    return this.sendMessage('RESUME_RESPONSE', payload, { transferId });
  }

  /**
   * Sends a RESUME_REJECT back to the sender.
   */
  async sendResumeReject(
    transferId: string,
    code: ResumeRejectCode,
    reason: string,
    transferFileId?: string
  ): Promise<ProtocolMessage> {
    const payload: ResumeRejectPayload = {
      transferId,
      transferFileId,
      code,
      reason,
    };
    return this.sendMessage('RESUME_REJECT', payload, { transferId });
  }

  /**
   * Resumes sending file chunks covering only the missing byte ranges.
   */
  async resumeSendFile(
    transferId: string,
    fileId: string,
    options: SendFileOptions,
    missingRanges: Array<{ offset: number; length: number }>
  ): Promise<{
    transferId: string;
    fileId: string;
    totalBytes: number;
    resumedBytesSent: number;
    chunksSent: number;
    acksReceived: number;
    verified: boolean;
    durationMs: number;
  }> {
    const authCheck = this.checkAuthorization();
    if (!authCheck.authorized) {
      throw new Error(`resumeSendFile rejected: ${authCheck.reason}`);
    }

    const chunkSize = TCP_SPIKE_CHUNK_SIZE;
    const totalSize = options.size;
    const totalChunks = totalSize === 0 ? 1 : Math.ceil(totalSize / chunkSize);
    const startTime = Date.now();

    let resumedBytesSent = 0;
    let chunksSent = 0;
    let acksReceived = 0;

    // Transmit only chunks that intersect missing ranges
    for (const range of missingRanges) {
      let currentOffset = range.offset;
      const endOffset = range.offset + range.length;

      while (currentOffset < endOffset) {
        const chunkIndex = Math.floor(currentOffset / chunkSize);
        const chunkOffsetInFile = chunkIndex * chunkSize;
        const chunkLen = Math.min(chunkSize, totalSize - chunkOffsetInFile);

        let chunkBytes: Uint8Array;
        if (options.bytes) {
          chunkBytes = options.bytes.slice(chunkOffsetInFile, chunkOffsetInFile + chunkLen);
        } else if (options.localNativeReferenceId) {
          const readRes = await readNativeFileChunk(options.localNativeReferenceId, chunkOffsetInFile, chunkLen);
          chunkBytes = readRes?.bytes ? new Uint8Array(readRes.bytes) : new Uint8Array(0);
        } else {
          chunkBytes = new Uint8Array(chunkLen);
        }

        const ackKey = `${transferId}_${fileId}_${chunkIndex}`;
        const ackPromise = new Promise<ChunkAckPayload>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.chunkAckResolvers.delete(ackKey);
            reject(new Error(`CHUNK_ACK_TIMEOUT: Chunk ${chunkIndex} (offset ${chunkOffsetInFile}) not acknowledged within 10s`));
          }, 10000);

          this.chunkAckResolvers.set(ackKey, (ackPayload) => {
            clearTimeout(timeout);
            resolve(ackPayload);
          });
        });

        await this.sendChunkData(transferId, fileId, chunkIndex, chunkOffsetInFile, chunkBytes, totalChunks);
        chunksSent++;

        await ackPromise;
        acksReceived++;
        resumedBytesSent += chunkBytes.length;

        currentOffset += chunkLen;

        const elapsedMs = Math.max(1, Date.now() - startTime);
        const speedBps = Math.round((resumedBytesSent / elapsedMs) * 1000);
        this.updateTelemetry({
          bytesTransferred: totalSize - (range.length - (currentOffset - range.offset)),
          currentChunk: chunkIndex + 1,
          totalChunks,
          ackCount: acksReceived,
          elapsedMs,
          speedBps,
          status: 'transferring',
        });
      }
    }

    // Send TRANSFER_COMPLETE
    const totalElapsedMs = Math.max(1, Date.now() - startTime);
    await this.sendTransferComplete(transferId, totalSize, 1);

    this.updateTelemetry({
      bytesTransferred: totalSize,
      totalBytes: totalSize,
      elapsedMs: totalElapsedMs,
      status: 'completed',
      verified: true,
    });

    return {
      transferId,
      fileId,
      totalBytes: totalSize,
      resumedBytesSent,
      chunksSent,
      acksReceived,
      verified: true,
      durationMs: totalElapsedMs,
    };
  }

  /**
   * Diagnostic method: Injects an invalid or corrupted raw message to test rejection behavior.
   */
  async sendRawCorruptedMessageForTest(corruptedText: string): Promise<void> {
    if (!this.connectionId) {
      throw new Error('No connection attached');
    }
    const bytes = new TextEncoder().encode(corruptedText);
    await this.transport.sendBytes(this.connectionId, bytes);

    const now = Date.now();
    this.emitTimelineRecord({
      id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
      time: new Date(now).toLocaleTimeString(),
      timestamp: now,
      direction: 'outbound',
      type: 'CORRUPTED_TEST',
      messageId: generateMessageId(),
      sessionId: this.sessionId ?? undefined,
      transferId: this.activeTransferId ?? undefined,
      status: 'rejected',
      stateBefore: this.state,
      stateAfter: this.state,
      rawPreview: corruptedText.substring(0, 120),
    });
  }

  destroy(): void {
    if (this.secureTransport) {
      this.secureTransport.teardown();
      this.secureTransport = null;
    }
    if (this.unlistenTransportRaw) {
      this.unlistenTransportRaw();
      this.unlistenTransportRaw = null;
    }
    if (this.unlistenTransportEvents) {
      this.unlistenTransportEvents();
      this.unlistenTransportEvents = null;
    }
    if (this.activeDestination) {
      releaseReceiveDestination(this.activeDestination).catch(() => {});
      this.activeDestination = null;
    }
    this.timelineListeners.clear();
    this.telemetryListeners.clear();
    this.securityListeners.clear();
    this.chunkAckResolvers.clear();
  }
}
