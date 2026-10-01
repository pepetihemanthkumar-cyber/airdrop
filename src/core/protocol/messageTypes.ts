/**
 * NearShare Protocol Message Types & Payload Contracts
 *
 * Defines the complete set of protocol message types and strongly-typed payload schemas.
 *
 * DESIGN CONSTRAINTS:
 * - Platform-neutral: macOS, Windows, Android, iOS.
 * - Transport-agnostic: Carried by Direct Wi-Fi, BLE, Multipeer, Sockets, etc.
 * - Security-isolated: Cryptography and key exchange handled by the security layer.
 * - Storage-isolated: Filesystem read/write handled by the file engine layer.
 * - No local filesystem absolute paths or credentials in payloads.
 */

import type { ProtocolErrorCode } from './errors';

export type ProtocolMessageType =
  | 'HELLO'
  | 'CAPABILITIES'
  | 'PAIRING_REQUEST'
  | 'PAIRING_RESPONSE'
  | 'PAIRING_VERIFY'
  | 'SESSION_CREATE'
  | 'SESSION_ACCEPT'
  | 'SESSION_CLOSE'
  | 'TRANSFER_REQUEST'
  | 'TRANSFER_ACCEPT'
  | 'TRANSFER_REJECT'
  | 'FILE_MANIFEST'
  | 'FILE_ACCEPT'
  | 'FILE_REJECT'
  | 'CHUNK_START'
  | 'CHUNK_DATA'
  | 'CHUNK_ACK'
  | 'TRANSFER_PAUSE'
  | 'TRANSFER_RESUME'
  | 'TRANSFER_CANCEL'
  | 'TRANSFER_PROGRESS'
  | 'TRANSFER_COMPLETE'
  | 'TRANSFER_ERROR'
  | 'HEARTBEAT'
  | 'GOODBYE'
  | 'RESUME_REQUEST'
  | 'RESUME_RESPONSE'
  | 'RESUME_REJECT';

/**
 * Platform Identifier
 */
export type ProtocolPlatform = 'macOS' | 'Windows' | 'Android' | 'iOS' | 'Web' | 'Linux' | string;

/**
 * Protocol Device Identity
 *
 * Identifies a peer logically without coupling to physical transport addresses (MAC/IP/BLE).
 */
export interface ProtocolDeviceIdentity {
  deviceId: string;
  profileId: string;
  deviceName: string;
  username: string;
  platform: ProtocolPlatform;
}

/**
 * Capabilities descriptor declared by a peer
 */
export interface CapabilityPayload {
  modes: ('direct' | 'wifi')[];
  discovery: boolean;
  pairing: boolean;
  transfer: boolean;
  fileSupport: boolean;
  maxChunkSize: number; // in bytes, e.g. 4194304 (4 MiB)
  maxConcurrentTransfers: number;
  resumeSupport: boolean;
  folderSupport: boolean;
}

/**
 * Negotiated capabilities mutually agreed upon by both peers for a session
 */
export interface NegotiatedCapabilities {
  mode: 'direct' | 'wifi';
  chunkSize: number;
  resumeSupport: boolean;
  folderSupport: boolean;
  maxConcurrentTransfers: number;
  streamingSupported: boolean;
}

/**
 * 1. HELLO Message Payload
 * Discovery & Identity Exchange (No passwords, tokens, secrets, or filesystem paths)
 */
export interface HelloPayload {
  deviceId: string;
  profileId: string;
  deviceName: string;
  username: string;
  platform: ProtocolPlatform;
  appVersion: string;
  protocolVersion: string;
  supportedModes: ('direct' | 'wifi')[];
  capabilities: CapabilityPayload;
}

/**
 * 2. PAIRING PROTOCOL Payloads
 */
export interface PairingRequestPayload {
  pairingId: string;
  pairingRequestId?: string;
  method: 'pin' | 'qr' | 'numeric_comparison' | 'out_of_band' | string;
  expiresAt: number; // Unix epoch ms
  expiresInMs?: number;
}

export interface PairingResponsePayload {
  pairingId: string;
  pairingRequestId?: string;
  accepted: boolean;
  reason?: string;
  rejectionReason?: string;
}

export interface PairingVerifyPayload {
  pairingId: string;
  pairingRequestId?: string;
  verificationType: 'pin' | 'numeric_comparison' | 'confirmation' | string;
  verificationPayload: string; // e.g. "482910"
}

/**
 * 3. SESSION HANDSHAKE Payloads
 */
export interface SessionCreatePayload {
  sessionId: string;
  pairingId?: string;
  mode: 'direct' | 'wifi';
  capabilities: CapabilityPayload;
}

export interface SessionAcceptPayload {
  sessionId: string;
  accepted: boolean;
  negotiatedCapabilities?: NegotiatedCapabilities;
  reason?: string;
}

export interface SessionClosePayload {
  sessionId: string;
  reason: 'normal' | 'user_cancelled' | 'error' | 'timeout' | 'shutdown' | string;
}

/**
 * 4. TRANSFER NEGOTIATION Payloads
 */
export interface TransferRequestPayload {
  transferId: string;
  direction: 'send' | 'receive';
  totalFiles: number;
  totalBytes: number;
  mode: 'direct' | 'wifi';
}

export interface TransferAcceptPayload {
  transferId: string;
  accepted: boolean;
}

export interface TransferRejectPayload {
  transferId: string;
  reason: string;
}

/**
 * 5. FILE MANIFEST & ACCEPTANCE Payloads
 */
export interface FileManifestEntry {
  fileId: string;
  name: string;
  relativePath?: string; // For folders, e.g. "Project/src/App.tsx", never absolute path
  size: number;
  mimeType?: string;
  fileType: string;
  modifiedAt?: number;
}

export interface FileManifestPayload {
  transferId: string;
  files: FileManifestEntry[];
  totalBytes: number;
}

export interface FileAcceptPayload {
  transferId: string;
  acceptedFileIds: string[];
  destinationPolicy: 'default' | 'user-selected';
}

export interface FileRejectPayload {
  transferId: string;
  rejectedFileIds: string[];
  reason?: string;
}

/**
 * 6. CHUNK PROTOCOL Payloads
 */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB (4,194,304 bytes)

export type ChecksumAlgorithm = 'sha256' | 'other';

export interface ChunkDescriptor {
  transferId: string;
  fileId: string;
  chunkIndex: number; // 0-indexed
  offset: number; // Byte offset in the file
  length: number; // Chunk length in bytes
  totalChunks: number;
  checksum?: string;
  checksumAlgorithm?: ChecksumAlgorithm;
}

export interface ChunkStartPayload {
  descriptor: ChunkDescriptor;
}

export interface ChunkDataPayload {
  descriptor: ChunkDescriptor;
  dataLength: number;
  dataBase64?: string; // Optional representation for non-binary logical simulations
  checksum?: string;
  checksumAlgorithm?: ChecksumAlgorithm;
}

export interface ChunkAckPayload {
  transferId: string;
  fileId: string;
  chunkIndex: number;
  receivedLength: number;
  checksumVerified?: boolean;
}

/**
 * 7. RESUME & PAUSE Payloads
 */
export interface ResumeCheckpoint {
  transferId: string;
  fileId: string;
  nextChunkIndex: number;
  bytesReceived: number;
}

export interface TransferResumePayload {
  transferId: string;
  checkpoints: ResumeCheckpoint[];
}

export interface TransferPausePayload {
  transferId: string;
  reason?: string;
}

export interface TransferCancelPayload {
  transferId: string;
  reason: string;
}

export interface TransferProgressPayload {
  transferId: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBytesPerSecond?: number;
}

export interface TransferCompletePayload {
  transferId: string;
  totalBytes: number;
  filesTransferred?: number;
  fileCount?: number;
  verificationStatus?: string;
  completedAt?: number;
}

export interface TransferErrorPayload {
  transferId?: string;
  code: ProtocolErrorCode;
  message: string;
  recoverable?: boolean;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface HeartbeatPayload {
  timestamp?: number;
  sessionId?: string;
  sequence?: number;
}

export interface GoodbyePayload {
  reason: string;
  deviceId?: string;
}

export interface ResumeByteRange {
  offset: number;
  length: number;
}

export interface FileResumeRequestItem {
  transferFileId: string;
  expectedSize: number;
  chunkSize: number;
  proposedNextOffset?: number;
  proposedNextChunkIndex?: number;
}

export interface ResumeRequestPayload {
  transferId: string;
  sourceDeviceId: string;
  destinationDeviceId: string;
  files: FileResumeRequestItem[];
}

export interface FileResumeResponseItem {
  transferFileId: string;
  accepted: boolean;
  expectedSize: number;
  bytesReceived: number;
  receivedRanges: ResumeByteRange[];
  missingRanges: ResumeByteRange[];
  nextRequiredChunkIndex?: number;
  isComplete: boolean;
  rejectionReason?: string;
}

export interface ResumeResponsePayload {
  transferId: string;
  accepted: boolean;
  files: FileResumeResponseItem[];
  rejectionReason?: string;
}

export type ResumeRejectCode =
  | 'UNKNOWN_TRANSFER'
  | 'IDENTITY_MISMATCH'
  | 'FILE_SIZE_MISMATCH'
  | 'CHUNK_SIZE_MISMATCH'
  | 'UNAUTHORIZED'
  | 'BLOCKED_PEER'
  | 'REVOKED_AUTH'
  | 'EXPIRED_SESSION'
  | 'INVALID_CHECKPOINT'
  | 'INTEGRITY_FAILURE'
  | 'OTHER';

export interface ResumeRejectPayload {
  transferId: string;
  transferFileId?: string;
  code: ResumeRejectCode;
  reason: string;
}

/**
 * Mapping of ProtocolMessageType to its corresponding strongly-typed Payload
 */
export interface ProtocolPayloadMap {
  HELLO: HelloPayload;
  CAPABILITIES: CapabilityPayload;
  PAIRING_REQUEST: PairingRequestPayload;
  PAIRING_RESPONSE: PairingResponsePayload;
  PAIRING_VERIFY: PairingVerifyPayload;
  SESSION_CREATE: SessionCreatePayload;
  SESSION_ACCEPT: SessionAcceptPayload;
  SESSION_CLOSE: SessionClosePayload;
  TRANSFER_REQUEST: TransferRequestPayload;
  TRANSFER_ACCEPT: TransferAcceptPayload;
  TRANSFER_REJECT: TransferRejectPayload;
  FILE_MANIFEST: FileManifestPayload;
  FILE_ACCEPT: FileAcceptPayload;
  FILE_REJECT: FileRejectPayload;
  CHUNK_START: ChunkStartPayload;
  CHUNK_DATA: ChunkDataPayload;
  CHUNK_ACK: ChunkAckPayload;
  TRANSFER_PAUSE: TransferPausePayload;
  TRANSFER_RESUME: TransferResumePayload;
  TRANSFER_CANCEL: TransferCancelPayload;
  TRANSFER_PROGRESS: TransferProgressPayload;
  TRANSFER_COMPLETE: TransferCompletePayload;
  TRANSFER_ERROR: TransferErrorPayload;
  HEARTBEAT: HeartbeatPayload;
  GOODBYE: GoodbyePayload;
  RESUME_REQUEST: ResumeRequestPayload;
  RESUME_RESPONSE: ResumeResponsePayload;
  RESUME_REJECT: ResumeRejectPayload;
}
