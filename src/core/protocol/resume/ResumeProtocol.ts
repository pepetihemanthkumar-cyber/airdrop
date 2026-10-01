/**
 * NearShare Resume Protocol Negotiation Engine
 *
 * Implements authenticated, receiver-authoritative checkpoint negotiation
 * across newly established secure transport sessions.
 *
 * SECURITY INVARIANTS:
 * 1. Mandatory Secure Session: Resume requests are processed ONLY over an established SecureTransportSession.
 * 2. Identity Binding: Source and destination device IDs must match the authenticated peers.
 * 3. Authorization Verification: Resume is rejected if peer is unauthorized, blocked, or revoked.
 * 4. Receiver Authoritative: The receiver dictates missing ranges based on committed disk/buffer writes.
 * 5. Clean Crypto Boundary: No cryptographic state from previous sessions is reused.
 */

import type {
  ResumeRequestPayload,
  ResumeResponsePayload,
  ResumeRejectPayload,
  FileResumeResponseItem,
  ResumeRejectCode,
} from '../messageTypes';
import {
  type TransferResumeCheckpoint,
  calculateMissingRanges,
} from '../../transfer/checkpoint/ResumeCheckpoint';
import type { ProtocolSecurityContext } from '../native/NativeTcpProtocolPeer';

export interface ResumeValidationResult {
  valid: boolean;
  response?: ResumeResponsePayload;
  rejection?: ResumeRejectPayload;
}

export class ResumeProtocolEngine {
  /**
   * Processes an incoming RESUME_REQUEST on the receiver side.
   */
  static processResumeRequest(
    request: ResumeRequestPayload,
    securityContext: ProtocolSecurityContext,
    localDeviceId: string,
    authenticatedRemoteDeviceId: string,
    existingCheckpoint: TransferResumeCheckpoint | null
  ): ResumeValidationResult {
    // 1. Verify Secure Session Status
    if (
      !securityContext.isEncrypted ||
      securityContext.secureTransportState !== 'established'
    ) {
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code: 'EXPIRED_SESSION',
          reason: 'Secure transport session is not established or has expired',
        },
      };
    }

    // 2. Verify Authorization Status
    if (securityContext.authorizationState !== 'authorized') {
      const code: ResumeRejectCode =
        securityContext.authorizationState === 'revoked'
          ? 'REVOKED_AUTH'
          : securityContext.authorizationState === 'expired'
          ? 'EXPIRED_SESSION'
          : 'UNAUTHORIZED';
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code,
          reason: `Peer authorization state is '${securityContext.authorizationState}'`,
        },
      };
    }

    // 3. Verify Blocked / Trust Status
    if (securityContext.isBlocked || securityContext.trustState === 'blocked') {
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code: 'BLOCKED_PEER',
          reason: 'Peer device is blocked',
        },
      };
    }

    // 4. Verify Identity Binding
    if (
      request.sourceDeviceId !== authenticatedRemoteDeviceId ||
      request.destinationDeviceId !== localDeviceId
    ) {
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code: 'IDENTITY_MISMATCH',
          reason: `Device identity mismatch. Expected source: ${authenticatedRemoteDeviceId}, got: ${request.sourceDeviceId}`,
        },
      };
    }

    // 5. Verify Checkpoint Existence
    if (!existingCheckpoint || existingCheckpoint.transferId !== request.transferId) {
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code: 'UNKNOWN_TRANSFER',
          reason: `No existing transfer checkpoint found for transferId '${request.transferId}'`,
        },
      };
    }

    // 6. Verify Transfer Not Cancelled
    if (existingCheckpoint.status === 'cancelled') {
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code: 'INVALID_CHECKPOINT',
          reason: 'Transfer was cancelled and cannot be resumed',
        },
      };
    }

    // 7. Calculate File-by-File Missing Ranges (Receiver Authoritative)
    const fileResponses: FileResumeResponseItem[] = [];

    for (const reqFile of request.files) {
      const storedFile = existingCheckpoint.files[reqFile.transferFileId];
      if (!storedFile) {
        fileResponses.push({
          transferFileId: reqFile.transferFileId,
          accepted: false,
          expectedSize: reqFile.expectedSize,
          bytesReceived: 0,
          receivedRanges: [],
          missingRanges: [{ offset: 0, length: reqFile.expectedSize }],
          isComplete: false,
          rejectionReason: 'File not present in receiver checkpoint',
        });
        continue;
      }

      // Verify file size parity
      if (storedFile.fileSize !== reqFile.expectedSize) {
        return {
          valid: false,
          rejection: {
            transferId: request.transferId,
            transferFileId: reqFile.transferFileId,
            code: 'FILE_SIZE_MISMATCH',
            reason: `File size mismatch for '${reqFile.transferFileId}'. Checkpoint: ${storedFile.fileSize}, Request: ${reqFile.expectedSize}`,
          },
        };
      }

      const missingRanges = calculateMissingRanges(storedFile.receivedRanges, storedFile.fileSize);
      const isComplete = storedFile.fileSize === 0 || (missingRanges.length === 0 && storedFile.receivedBytes >= storedFile.fileSize);

      fileResponses.push({
        transferFileId: reqFile.transferFileId,
        accepted: true,
        expectedSize: storedFile.fileSize,
        bytesReceived: storedFile.receivedBytes,
        receivedRanges: [...storedFile.receivedRanges],
        missingRanges,
        nextRequiredChunkIndex: missingRanges.length > 0 ? Math.floor(missingRanges[0].offset / storedFile.chunkSize) : undefined,
        isComplete,
      });
    }

    const allAccepted = fileResponses.every((f) => f.accepted);
    if (!allAccepted) {
      return {
        valid: false,
        rejection: {
          transferId: request.transferId,
          code: 'INVALID_CHECKPOINT',
          reason: 'One or more files could not be reconciled against receiver checkpoint',
        },
      };
    }

    return {
      valid: true,
      response: {
        transferId: request.transferId,
        accepted: true,
        files: fileResponses,
      },
    };
  }

  /**
   * Builds a RESUME_REQUEST payload for the sender.
   */
  static buildResumeRequest(
    transferId: string,
    sourceDeviceId: string,
    destinationDeviceId: string,
    files: Array<{ transferFileId: string; expectedSize: number; chunkSize: number; proposedNextOffset?: number }>
  ): ResumeRequestPayload {
    return {
      transferId,
      sourceDeviceId,
      destinationDeviceId,
      files: files.map((f) => ({
        transferFileId: f.transferFileId,
        expectedSize: f.expectedSize,
        chunkSize: f.chunkSize,
        proposedNextOffset: f.proposedNextOffset,
        proposedNextChunkIndex: f.proposedNextOffset !== undefined ? Math.floor(f.proposedNextOffset / f.chunkSize) : undefined,
      })),
    };
  }
}
