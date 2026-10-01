/**
 * NearShare Transfer Resume Checkpoint Model
 *
 * Defines the persistent, safe metadata checkpoint model for resuming interrupted
 * transfers without re-transmitting already committed byte ranges.
 *
 * ARCHITECTURAL CONSTRAINTS:
 * 1. Safe Metadata Only: Stores strictly transferId, transferFileId, name, sizes, written byte ranges,
 *    and timestamps. NEVER stores private keys, session keys, pairing PINs, tokens, or socket handles.
 * 2. Receiver Authoritative: The receiver's committed byte ranges define true progress.
 * 3. Range Merging: Supports sequential and out-of-order chunks without duplicate byte counting.
 * 4. Zero Path Leakage: File identifiers are logical (transferFileId), not host filesystem paths.
 */

export const CHECKPOINT_CURRENT_VERSION = 1;

export interface ByteRange {
  offset: number;
  length: number;
}

export interface FileCheckpoint {
  transferFileId: string;
  name: string;
  fileSize: number;
  chunkSize: number;
  receivedRanges: ByteRange[];
  receivedBytes: number;
  lastConfirmedOffset: number;
  isComplete: boolean;
  checksum?: string;
  checksumAlgorithm?: 'sha256' | 'other';
  updatedAt: number;
}

export type TransferRecoveryState =
  | 'active'
  | 'interrupted'
  | 'reconnecting'
  | 'resuming'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface TransferResumeCheckpoint {
  checkpointVersion?: number;
  transferId: string;
  sourceDeviceId: string;
  destinationDeviceId: string;
  files: Record<string, FileCheckpoint>;
  totalFiles: number;
  totalBytes: number;
  totalReceivedBytes: number;
  status: TransferRecoveryState;
  createdAt: number;
  updatedAt: number;
}

/**
 * Merges byte ranges into disjoint, sorted, non-overlapping intervals.
 */
export function mergeByteRanges(ranges: ByteRange[]): ByteRange[] {
  if (!ranges || ranges.length === 0) return [];

  const valid = ranges
    .filter((r) => r.length > 0 && r.offset >= 0)
    .sort((a, b) => a.offset - b.offset || b.length - a.length);

  if (valid.length === 0) return [];

  const merged: ByteRange[] = [{ offset: valid[0].offset, length: valid[0].length }];

  for (let i = 1; i < valid.length; i++) {
    const curr = valid[i];
    const prev = merged[merged.length - 1];

    const prevEnd = prev.offset + prev.length;
    const currEnd = curr.offset + curr.length;

    if (curr.offset <= prevEnd) {
      if (currEnd > prevEnd) {
        prev.length = currEnd - prev.offset;
      }
    } else {
      merged.push({ offset: curr.offset, length: curr.length });
    }
  }

  return merged;
}

/**
 * Calculates total unique byte coverage across byte ranges.
 */
export function calculateUniqueBytes(ranges: ByteRange[]): number {
  const merged = mergeByteRanges(ranges);
  return merged.reduce((acc, r) => acc + r.length, 0);
}

/**
 * Calculates missing/unwritten byte intervals against expected file size.
 */
export function calculateMissingRanges(ranges: ByteRange[], expectedSize: number): ByteRange[] {
  if (expectedSize <= 0) return [];

  const merged = mergeByteRanges(ranges);
  const missing: ByteRange[] = [];
  let currentOffset = 0;

  for (const range of merged) {
    if (range.offset > currentOffset) {
      missing.push({
        offset: currentOffset,
        length: Math.min(range.offset - currentOffset, expectedSize - currentOffset),
      });
    }
    currentOffset = Math.max(currentOffset, range.offset + range.length);
    if (currentOffset >= expectedSize) break;
  }

  if (currentOffset < expectedSize) {
    missing.push({
      offset: currentOffset,
      length: expectedSize - currentOffset,
    });
  }

  return missing;
}

/**
 * Checks if a file checkpoint has completely received all expected bytes.
 */
export function isFileCheckpointComplete(checkpoint: FileCheckpoint): boolean {
  if (checkpoint.fileSize === 0) return true;
  const merged = mergeByteRanges(checkpoint.receivedRanges);
  if (merged.length !== 1) return false;
  return merged[0].offset === 0 && merged[0].length >= checkpoint.fileSize;
}

/**
 * Validates that a checkpoint contains no forbidden secret fields or invalid ranges.
 */
export function validateCheckpointSafety(checkpoint: TransferResumeCheckpoint): { valid: boolean; error?: string } {
  if (!checkpoint) {
    return { valid: false, error: 'NULL_CHECKPOINT' };
  }
  if (checkpoint.checkpointVersion !== undefined && checkpoint.checkpointVersion !== CHECKPOINT_CURRENT_VERSION) {
    return { valid: false, error: `UNSUPPORTED_CHECKPOINT_VERSION: ${checkpoint.checkpointVersion}` };
  }
  if (!checkpoint.transferId || typeof checkpoint.transferId !== 'string' || checkpoint.transferId.trim().length === 0) {
    return { valid: false, error: 'MISSING_TRANSFER_ID' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(checkpoint.transferId) || checkpoint.transferId.length > 64) {
    return { valid: false, error: 'MALFORMED_TRANSFER_ID' };
  }
  if (!checkpoint.sourceDeviceId || !checkpoint.destinationDeviceId) {
    return { valid: false, error: 'MISSING_DEVICE_IDENTITIES' };
  }
  if (!checkpoint.files || typeof checkpoint.files !== 'object') {
    return { valid: false, error: 'MISSING_FILES_MAP' };
  }

  const rawJson = JSON.stringify(checkpoint);
  if (rawJson.length > 512 * 1024) {
    return { valid: false, error: 'OVERSIZED_CHECKPOINT_PAYLOAD' };
  }

  const forbidden = ['privateKey', 'token', 'pin', 'sessionKey', 'aesKey', 'password', 'secret', '/Users/', 'C:\\'];
  for (const word of forbidden) {
    if (rawJson.includes(word)) {
      return { valid: false, error: `FORBIDDEN_FIELD_IN_CHECKPOINT: ${word}` };
    }
  }

  for (const [fileId, file] of Object.entries(checkpoint.files)) {
    if (!file || file.fileSize < 0 || file.receivedBytes < 0) {
      return { valid: false, error: `INVALID_FILE_SIZES: ${fileId}` };
    }
    if (file.fileSize > 0 && file.receivedBytes > file.fileSize) {
      return { valid: false, error: `RECEIVED_BYTES_EXCEEDS_FILE_SIZE: ${fileId}` };
    }
    for (const r of file.receivedRanges) {
      if (r.offset < 0 || r.length <= 0) {
        return { valid: false, error: `INVALID_RANGE: ${fileId}` };
      }
      if (file.fileSize > 0 && r.offset + r.length > file.fileSize) {
        return { valid: false, error: `RANGE_EXCEEDS_FILE_SIZE: ${fileId}` };
      }
    }
  }

  return { valid: true };
}
