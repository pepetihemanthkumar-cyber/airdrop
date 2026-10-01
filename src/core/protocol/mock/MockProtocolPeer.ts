/**
 * NearShare Mock Protocol Peer
 *
 * Implements an entirely in-memory protocol loopback harness to test and validate
 * protocol messages, state transitions, negotiation, and chunk sequencing
 * without physical network or filesystem dependencies.
 */

import { PROTOCOL_VERSION } from '../version';
import { type ProtocolMessage, createProtocolMessage } from '../Message';
import type {
  CapabilityPayload,
  FileManifestEntry,
  NegotiatedCapabilities,
  ProtocolDeviceIdentity,
  ProtocolMessageType,
} from '../messageTypes';
import { DEFAULT_CHUNK_SIZE } from '../messageTypes';
import {
  type ProtocolState,
  isMessageAcceptableInState,
  mapMessageTypeToState,
} from '../ProtocolStateMachine';
import { validateProtocolMessage } from '../MessageValidator';
import { serializeMessage, deserializeMessage } from '../serialization';
import { type ProtocolError, createProtocolError } from '../errors';

export interface ExchangedProtocolRecord {
  id: string;
  senderId: string;
  receiverId: string;
  message: ProtocolMessage;
  direction: 'outbound' | 'inbound';
  stateBefore: ProtocolState;
  stateAfter: ProtocolState;
  timestamp: number;
}

export class MockProtocolPeer {
  readonly identity: ProtocolDeviceIdentity;
  readonly capabilities: CapabilityPayload;
  private state: ProtocolState = 'IDLE';
  private remotePeer: MockProtocolPeer | null = null;
  private activeSessionId: string | null = null;
  private activeTransferId: string | null = null;
  private negotiatedCapabilities: NegotiatedCapabilities | null = null;
  private readonly history: ExchangedProtocolRecord[] = [];
  private onMessageListeners: ((record: ExchangedProtocolRecord) => void)[] = [];

  constructor(identity: ProtocolDeviceIdentity, capabilities?: Partial<CapabilityPayload>) {
    this.identity = identity;
    this.capabilities = {
      modes: ['direct', 'wifi'],
      discovery: true,
      pairing: true,
      transfer: true,
      fileSupport: true,
      maxChunkSize: DEFAULT_CHUNK_SIZE,
      maxConcurrentTransfers: 3,
      resumeSupport: true,
      folderSupport: true,
      ...capabilities,
    };
  }

  connectPeer(peer: MockProtocolPeer): void {
    this.remotePeer = peer;
  }

  getState(): ProtocolState {
    return this.state;
  }

  getHistory(): ExchangedProtocolRecord[] {
    return [...this.history];
  }

  getNegotiatedCapabilities(): NegotiatedCapabilities | null {
    return this.negotiatedCapabilities;
  }

  onMessage(listener: (record: ExchangedProtocolRecord) => void): () => void {
    this.onMessageListeners.push(listener);
    return () => {
      this.onMessageListeners = this.onMessageListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Sends a protocol message to the connected remote peer via logical serialization.
   */
  sendMessage<K extends ProtocolMessageType>(
    type: K,
    payload: any,
    options?: { transferId?: string; sessionId?: string }
  ): { success: boolean; messageId?: string; error?: ProtocolError } {
    if (!this.remotePeer) {
      return {
        success: false,
        error: createProtocolError('INVALID_STATE', 'No remote peer connected to mock harness'),
      };
    }

    const sessionId = options?.sessionId ?? this.activeSessionId ?? undefined;
    const transferId = options?.transferId ?? this.activeTransferId ?? undefined;

    const msg = createProtocolMessage(type, payload, {
      sessionId,
      transferId,
      deviceId: this.identity.deviceId,
    });

    // Validate locally before dispatch
    const validation = validateProtocolMessage(msg);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const stateCheck = isMessageAcceptableInState(this.state, type);
    if (!stateCheck.acceptable) {
      return {
        success: false,
        error: createProtocolError('INVALID_STATE', stateCheck.reason ?? 'Illegal state for message dispatch'),
      };
    }

    const stateBefore = this.state;
    const nextState = mapMessageTypeToState(type);
    if (nextState) {
      this.state = nextState;
    }

    // Serialize to simulate boundary transport
    const serialized = serializeMessage(msg);

    const record: ExchangedProtocolRecord = {
      id: msg.messageId,
      senderId: this.identity.deviceId,
      receiverId: this.remotePeer.identity.deviceId,
      message: msg,
      direction: 'outbound',
      stateBefore,
      stateAfter: this.state,
      timestamp: msg.timestamp,
    };

    this.history.push(record);
    this.notifyListeners(record);

    // Deliver to remote peer
    this.remotePeer.receiveSerialized(serialized, this.identity.deviceId);

    return { success: true, messageId: msg.messageId };
  }

  /**
   * Receives and processes a serialized message payload.
   */
  receiveSerialized(serialized: string, fromDeviceId: string): void {
    const deserialized = deserializeMessage(serialized);
    if (!deserialized.success) {
      this.handleError(deserialized.error);
      return;
    }

    const msg = deserialized.message;
    const stateBefore = this.state;

    const stateCheck = isMessageAcceptableInState(this.state, msg.type);
    if (!stateCheck.acceptable) {
      this.handleError(
        createProtocolError('INVALID_STATE', stateCheck.reason ?? 'Illegal state for message receipt')
      );
      return;
    }

    const nextState = mapMessageTypeToState(msg.type);
    if (nextState) {
      this.state = nextState;
    }

    const record: ExchangedProtocolRecord = {
      id: msg.messageId,
      senderId: fromDeviceId,
      receiverId: this.identity.deviceId,
      message: msg,
      direction: 'inbound',
      stateBefore,
      stateAfter: this.state,
      timestamp: msg.timestamp,
    };

    this.history.push(record);
    this.notifyListeners(record);

    // Process protocol message semantics
    this.processInboundMessage(msg);
  }

  private processInboundMessage(msg: ProtocolMessage): void {
    switch (msg.type) {
      case 'HELLO': {
        // Base peer discovery handshake received
        break;
      }
      case 'SESSION_CREATE': {
        const payload = msg.payload as any;
        this.activeSessionId = payload.sessionId;
        this.negotiatedCapabilities = {
          mode: payload.mode,
          chunkSize: Math.min(this.capabilities.maxChunkSize, payload.capabilities?.maxChunkSize ?? DEFAULT_CHUNK_SIZE),
          resumeSupport: this.capabilities.resumeSupport && (payload.capabilities?.resumeSupport ?? false),
          folderSupport: this.capabilities.folderSupport && (payload.capabilities?.folderSupport ?? false),
          maxConcurrentTransfers: Math.min(
            this.capabilities.maxConcurrentTransfers,
            payload.capabilities?.maxConcurrentTransfers ?? 1
          ),
          streamingSupported: true,
        };
        break;
      }
      case 'SESSION_ACCEPT': {
        const payload = msg.payload as any;
        this.activeSessionId = payload.sessionId;
        if (payload.negotiatedCapabilities) {
          this.negotiatedCapabilities = payload.negotiatedCapabilities;
        }
        break;
      }
      case 'TRANSFER_REQUEST': {
        const payload = msg.payload as any;
        this.activeTransferId = payload.transferId;
        break;
      }
      case 'FILE_MANIFEST': {
        const payload = msg.payload as any;
        this.activeTransferId = payload.transferId;
        break;
      }
      case 'SESSION_CLOSE': {
        this.activeSessionId = null;
        this.activeTransferId = null;
        this.state = 'CLOSED';
        break;
      }
    }
  }

  private handleError(error: ProtocolError): void {
    const errorRecord: ExchangedProtocolRecord = {
      id: `err_${Date.now()}`,
      senderId: 'SYSTEM',
      receiverId: this.identity.deviceId,
      message: createProtocolMessage('TRANSFER_ERROR', {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        recoverable: error.recoverable,
        details: error.details,
      }),
      direction: 'inbound',
      stateBefore: this.state,
      stateAfter: 'TRANSFER_FAILED',
      timestamp: Date.now(),
    };
    this.state = 'TRANSFER_FAILED';
    this.history.push(errorRecord);
    this.notifyListeners(errorRecord);
  }

  private notifyListeners(record: ExchangedProtocolRecord): void {
    for (const listener of this.onMessageListeners) {
      try {
        listener(record);
      } catch (err) {
        console.error('[MockProtocolPeer] Listener error:', err);
      }
    }
  }

  /**
   * Executes a full simulation roundtrip between this peer and connected peer.
   */
  async runDemonstrationExchange(sampleFiles?: FileManifestEntry[]): Promise<ExchangedProtocolRecord[]> {
    if (!this.remotePeer) {
      throw new Error('Remote peer must be connected first');
    }

    const target = this.remotePeer;
    const sessionId = `sess_${Date.now().toString(36)}`;
    const transferId = `xfer_${Date.now().toString(36)}`;
    const files: FileManifestEntry[] = sampleFiles ?? [
      {
        fileId: 'file_001',
        name: 'SyntraDesignSystem.pdf',
        relativePath: 'Documents/SyntraDesignSystem.pdf',
        size: 8388608, // 8 MiB (2 chunks)
        mimeType: 'application/pdf',
        fileType: 'pdf',
        modifiedAt: Date.now() - 3600000,
      },
      {
        fileId: 'file_002',
        name: 'BenchmarkReport.json',
        relativePath: 'Data/BenchmarkReport.json',
        size: 1048576, // 1 MiB (1 chunk)
        mimeType: 'application/json',
        fileType: 'json',
        modifiedAt: Date.now() - 1800000,
      },
    ];

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

    // 1. Peer A -> Peer B: HELLO
    this.sendMessage('HELLO', {
      deviceId: this.identity.deviceId,
      profileId: this.identity.profileId,
      deviceName: this.identity.deviceName,
      username: this.identity.username,
      platform: this.identity.platform,
      appVersion: '1.0.0',
      protocolVersion: PROTOCOL_VERSION,
      supportedModes: ['direct', 'wifi'],
      capabilities: this.capabilities,
    });

    // 2. Peer B -> Peer A: HELLO
    target.sendMessage('HELLO', {
      deviceId: target.identity.deviceId,
      profileId: target.identity.profileId,
      deviceName: target.identity.deviceName,
      username: target.identity.username,
      platform: target.identity.platform,
      appVersion: '1.0.0',
      protocolVersion: PROTOCOL_VERSION,
      supportedModes: ['direct', 'wifi'],
      capabilities: target.capabilities,
    });

    // 3. Peer A -> Peer B: CAPABILITIES
    this.sendMessage('CAPABILITIES', this.capabilities);

    // 4. Peer B -> Peer A: CAPABILITIES
    target.sendMessage('CAPABILITIES', target.capabilities);

    // 5. Peer A -> Peer B: SESSION_CREATE
    this.sendMessage('SESSION_CREATE', {
      sessionId,
      mode: 'direct',
      capabilities: this.capabilities,
    });

    // 6. Peer B -> Peer A: SESSION_ACCEPT
    target.sendMessage(
      'SESSION_ACCEPT',
      {
        sessionId,
        accepted: true,
        negotiatedCapabilities: {
          mode: 'direct',
          chunkSize: DEFAULT_CHUNK_SIZE,
          resumeSupport: true,
          folderSupport: true,
          maxConcurrentTransfers: 2,
          streamingSupported: true,
        },
      },
      { sessionId }
    );

    // 7. Peer A -> Peer B: TRANSFER_REQUEST
    this.sendMessage(
      'TRANSFER_REQUEST',
      {
        transferId,
        direction: 'send',
        totalFiles: files.length,
        totalBytes,
        mode: 'direct',
      },
      { sessionId, transferId }
    );

    // 8. Peer B -> Peer A: TRANSFER_ACCEPT
    target.sendMessage(
      'TRANSFER_ACCEPT',
      {
        transferId,
        accepted: true,
      },
      { sessionId, transferId }
    );

    // 9. Peer A -> Peer B: FILE_MANIFEST
    this.sendMessage(
      'FILE_MANIFEST',
      {
        transferId,
        files,
        totalBytes,
      },
      { sessionId, transferId }
    );

    // 10. Peer B -> Peer A: FILE_ACCEPT
    target.sendMessage(
      'FILE_ACCEPT',
      {
        transferId,
        acceptedFileIds: files.map((f) => f.fileId),
        destinationPolicy: 'default',
      },
      { sessionId, transferId }
    );

    // 11. Chunk loop simulation for file 1 (8 MiB = 2 chunks of 4 MiB)
    const chunkSize = DEFAULT_CHUNK_SIZE;
    const f1 = files[0];
    const totalChunks = Math.ceil(f1.size / chunkSize);

    for (let c = 0; c < totalChunks; c++) {
      const offset = c * chunkSize;
      const length = Math.min(chunkSize, f1.size - offset);

      this.sendMessage(
        'CHUNK_START',
        {
          descriptor: {
            transferId,
            fileId: f1.fileId,
            chunkIndex: c,
            offset,
            length,
            totalChunks,
            checksumAlgorithm: 'sha256',
          },
        },
        { sessionId, transferId }
      );

      this.sendMessage(
        'CHUNK_DATA',
        {
          descriptor: {
            transferId,
            fileId: f1.fileId,
            chunkIndex: c,
            offset,
            length,
            totalChunks,
            checksumAlgorithm: 'sha256',
          },
          dataLength: length,
        },
        { sessionId, transferId }
      );

      target.sendMessage(
        'CHUNK_ACK',
        {
          transferId,
          fileId: f1.fileId,
          chunkIndex: c,
          receivedLength: length,
          checksumVerified: true,
        },
        { sessionId, transferId }
      );
    }

    // 12. Peer A -> Peer B: TRANSFER_PROGRESS
    this.sendMessage(
      'TRANSFER_PROGRESS',
      {
        transferId,
        bytesTransferred: totalBytes,
        totalBytes,
        speedBytesPerSecond: 45000000,
        etaSeconds: 0,
      },
      { sessionId, transferId }
    );

    // 13. Peer A -> Peer B: TRANSFER_COMPLETE
    this.sendMessage(
      'TRANSFER_COMPLETE',
      {
        transferId,
        totalBytes,
        fileCount: files.length,
        completedAt: Date.now(),
        verificationStatus: 'verified',
      },
      { sessionId, transferId }
    );

    // 14. Peer A -> Peer B: SESSION_CLOSE
    this.sendMessage(
      'SESSION_CLOSE',
      {
        sessionId,
        reason: 'normal',
      },
      { sessionId }
    );

    return this.getHistory();
  }
}
