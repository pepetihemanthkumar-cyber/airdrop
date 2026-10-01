/**
 * NearShare Native Receive Destination & FileEngine Writer Integration Adapter
 *
 * Connects the native destination file creation and random-access chunk writing (Step 34)
 * to NearShare's FileEngine and TransferFileManager contracts.
 *
 * ARCHITECTURAL BOUNDARY RULES:
 * 1. Logical transfer identities (transferFileId) are decoupled from local native handles (nativeReferenceId).
 * 2. Native destination handles remain local-only and are never exposed over protocol messages.
 * 3. Chunk writes are strictly bounded to DEFAULT_CHUNK_SIZE (4 MiB).
 * 4. Supports out-of-order writes, arbitrary offsets, zero-byte files, and duplicate write suppression.
 * 5. Written byte ranges are tracked via interval merging to ensure completion accuracy without double-counting.
 * 6. Absolute paths and host details are strictly private to the Rust platform host.
 */

import { DEFAULT_CHUNK_SIZE, type FileManifestEntry } from '../protocol/messageTypes';
import type { FileSource, FileWriteHandle, FileTransferResult } from './types';
import type { FileWriter } from './FileWriter';
import { createFileError, FileException } from './errors';
import { isSafeRelativePath, normalizeSafeRelativePath } from '../filesystem/PathSafety';
import { FileSystemManager } from '../filesystem/FileSystemManager';
import type { FileReference, DestinationLocation, FileMetadata } from '../filesystem/types';

export interface ByteRange {
  offset: number;
  length: number;
}

export interface ReceiveFileDestinationItem {
  transferFileId: string;       // Logical protocol/transfer file identity (e.g. "tr_file_...")
  nativeReferenceId: string;    // Local-only native destination handle (e.g. "native-UUID")
  relativePath: string;         // Safe normalized relative path
  name: string;                 // Sanitized filename
  expectedSize: number;         // Total expected bytes
  bytesWritten: number;         // Unique bytes covered by written ranges
  writtenRanges: ByteRange[];   // Merged non-overlapping intervals
  status: 'pending' | 'in-progress' | 'completed' | 'aborted';
  mimeType?: string;
  createdAt: number;
  isReleased: boolean;
}

export interface ReceiveChunkWriteResult {
  transferFileId: string;
  offset: number;
  bytesWritten: number;
  totalUniqueBytesWritten: number;
  expectedSize: number;
  isDuplicate: boolean;
  missingRanges: ByteRange[];
  isComplete: boolean;
  durationMs: number;
}

/**
 * Merges a list of byte ranges into disjoint, sorted, non-overlapping intervals.
 */
export function mergeByteRanges(ranges: ByteRange[]): ByteRange[] {
  if (ranges.length === 0) return [];

  // Sort by offset ascending, then by length descending
  const sorted = [...ranges]
    .filter((r) => r.length > 0 && r.offset >= 0)
    .sort((a, b) => a.offset - b.offset || b.length - a.length);

  if (sorted.length === 0) return [];

  const merged: ByteRange[] = [{ offset: sorted[0].offset, length: sorted[0].length }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = merged[merged.length - 1];

    const prevEnd = prev.offset + prev.length;
    const currentEnd = current.offset + current.length;

    if (current.offset <= prevEnd) {
      // Overlapping or contiguous interval -> extend previous
      if (currentEnd > prevEnd) {
        prev.length = currentEnd - prev.offset;
      }
    } else {
      // Disjoint interval -> push as new range
      merged.push({ offset: current.offset, length: current.length });
    }
  }

  return merged;
}

/**
 * Calculates total unique byte coverage across byte ranges.
 * Merges ranges first if they contain overlaps.
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

  const mergedRanges = mergeByteRanges(ranges);
  const missing: ByteRange[] = [];
  let currentOffset = 0;

  for (const range of mergedRanges) {
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
 * Checks if all expected byte ranges have been completely written.
 * Accepts either a ReceiveFileDestinationItem or an array of ByteRanges + expectedSize.
 */
export function isDestinationComplete(
  rangesOrDest: ByteRange[] | ReceiveFileDestinationItem,
  expectedSize?: number
): boolean {
  if (Array.isArray(rangesOrDest)) {
    const size = expectedSize ?? 0;
    if (size === 0) return true;
    const merged = mergeByteRanges(rangesOrDest);
    if (merged.length !== 1) return false;
    return merged[0].offset === 0 && merged[0].length >= size;
  } else {
    const size = rangesOrDest.expectedSize;
    if (size === 0) return true;
    const merged = mergeByteRanges(rangesOrDest.writtenRanges);
    if (merged.length !== 1) return false;
    return merged[0].offset === 0 && merged[0].length >= size;
  }
}

/**
 * Sanitizes a remote filename to ensure safe destination creation.
 */
export function sanitizeDestinationFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return 'unnamed_file';
  // Strip any leading directory path segments first
  const base = filename.replace(/^.*[/\\]/, '');
  return base
    .trim()
    .replace(/[/\\]/g, '_')
    .replace(/\0/g, '')
    .replace(/\.\./g, '_')
    .replace(/^[.~]/, '_')
    .replace(/[:*?"<>|]/g, '_') || 'unnamed_file';
}

/**
 * Native File Writer implementation conforming to the NearShare FileWriter interface.
 */
export class NativeFileWriter implements FileWriter {
  readonly file: FileSource;
  readonly handle: FileWriteHandle;
  readonly destinationItem: ReceiveFileDestinationItem;
  private fileSystemManager: FileSystemManager;
  private isClosed = false;

  constructor(
    file: FileSource,
    handle: FileWriteHandle,
    destinationItem: ReceiveFileDestinationItem,
    fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
  ) {
    this.file = file;
    this.handle = handle;
    this.destinationItem = destinationItem;
    this.fileSystemManager = fileSystemManager;
  }

  async open(): Promise<void> {
    if (this.isClosed || !this.destinationItem || this.destinationItem.isReleased) {
      throw new FileException(
        createFileError('FILE_WRITE_FAILED', `NativeFileWriter for '${this.file?.name || 'unknown'}' is closed or released`)
      );
    }
    this.destinationItem.status = 'in-progress';
  }

  async write(offset: number, data: Uint8Array | string): Promise<number> {
    if (this.isClosed || !this.destinationItem || this.destinationItem.isReleased) {
      throw new FileException(
        createFileError('FILE_WRITE_FAILED', `NativeFileWriter for '${this.file?.name || 'unknown'}' is closed or released`)
      );
    }

    if (typeof offset !== 'number' || offset < 0) {
      throw new FileException(
        createFileError('INVALID_CHUNK', `Write offset cannot be negative: ${offset}`)
      );
    }

    if (!data) {
      throw new FileException(
        createFileError('INVALID_CHUNK', 'Invalid or missing data payload for write')
      );
    }

    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    if (dataBytes.length > DEFAULT_CHUNK_SIZE) {
      throw new FileException(
        createFileError('INVALID_CHUNK', `Write payload exceeds maximum chunk size of 4 MiB: ${dataBytes.length}`)
      );
    }

    if (dataBytes.length === 0) {
      return 0;
    }

    const fileRef: FileReference = {
      id: this.destinationItem.nativeReferenceId,
      name: this.destinationItem.name,
      kind: 'file',
      size: this.destinationItem.expectedSize,
    };

    try {
      const bytesWritten = await this.fileSystemManager.write(fileRef, offset, dataBytes);

      // Track range interval
      this.destinationItem.writtenRanges = mergeByteRanges([
        ...this.destinationItem.writtenRanges,
        { offset, length: bytesWritten },
      ]);
      this.destinationItem.bytesWritten = calculateUniqueBytes(this.destinationItem.writtenRanges);

      return bytesWritten;
    } catch (err) {
      throw new FileException(
        createFileError('FILE_WRITE_FAILED', err instanceof Error ? err.message : String(err))
      );
    }
  }

  async finalize(): Promise<FileTransferResult> {
    if (this.isClosed || this.destinationItem.isReleased) {
      throw new FileException(
        createFileError('FILE_FINALIZE_FAILED', 'Cannot finalize closed or released destination writer')
      );
    }

    const missing = calculateMissingRanges(this.destinationItem.writtenRanges, this.destinationItem.expectedSize);
    if (missing.length > 0 && this.destinationItem.expectedSize > 0) {
      throw new FileException(
        createFileError(
          'FILE_FINALIZE_FAILED',
          `Cannot finalize incomplete file '${this.destinationItem.name}': missing ${missing.reduce((acc, m) => acc + m.length, 0)} bytes`
        )
      );
    }

    const fileRef: FileReference = {
      id: this.destinationItem.nativeReferenceId,
      name: this.destinationItem.name,
      kind: 'file',
      size: this.destinationItem.expectedSize,
    };

    try {
      await this.fileSystemManager.finalizeFile(fileRef);
      this.destinationItem.status = 'completed';

      return {
        transferId: this.handle.temporaryId || 'tr_local',
        fileId: this.destinationItem.transferFileId,
        bytesProcessed: this.destinationItem.bytesWritten,
        verified: true,
      };
    } catch (err) {
      throw new FileException(
        createFileError('FILE_FINALIZE_FAILED', err instanceof Error ? err.message : String(err))
      );
    }
  }

  async abort(): Promise<void> {
    this.destinationItem.status = 'aborted';
    this.isClosed = true;

    try {
      await this.fileSystemManager.deleteTemporary({
        id: this.destinationItem.nativeReferenceId,
        name: this.destinationItem.name,
        kind: 'file',
      });
      await this.fileSystemManager.release({
        id: this.destinationItem.nativeReferenceId,
        name: this.destinationItem.name,
        kind: 'file',
      });
    } catch {
      // Best-effort abort cleanup
    }
  }

  getBytesWritten(): number {
    return this.destinationItem.bytesWritten;
  }
}

export type ReceiveDestinationInput =
  | FileManifestEntry
  | FileSource
  | {
      fileId: string;
      name: string;
      relativePath?: string;
      size: number;
      mimeType?: string;
      fileType?: string;
      modifiedAt?: number;
    };

/**
 * Creates a native receive destination file through FileSystemManager.
 * Enforces filename and path safety without leaking absolute paths.
 */
export async function createReceiveDestinationFromFile(
  manifestEntry: ReceiveDestinationInput,
  fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
): Promise<ReceiveFileDestinationItem> {
  const transferFileId = manifestEntry.fileId;
  const rawPath = manifestEntry.relativePath || manifestEntry.name;

  if (manifestEntry.relativePath && !isSafeRelativePath(manifestEntry.relativePath)) {
    throw new FileException(
      createFileError('INVALID_CHUNK', `Unsafe relative path rejected in receive destination: '${manifestEntry.relativePath}'`)
    );
  }

  const safeRelativePath = manifestEntry.relativePath ? normalizeSafeRelativePath(manifestEntry.relativePath) : rawPath;
  const safeFilename = sanitizeDestinationFilename(manifestEntry.name || 'unnamed_file');
  const expectedSize = manifestEntry.size >= 0 ? manifestEntry.size : 0;

  const destLocation: DestinationLocation = {
    id: 'dest_downloads',
    kind: 'downloads',
    name: safeFilename,
  };

  const fileMetadata: FileMetadata = {
    name: safeFilename,
    kind: 'file',
    size: expectedSize,
    mimeType: manifestEntry.mimeType,
    relativePath: safeRelativePath,
    modifiedAt: manifestEntry.modifiedAt || Date.now(),
  };

  try {
    const createdRef = await fileSystemManager.createFile(destLocation, fileMetadata);

    return {
      transferFileId,
      nativeReferenceId: createdRef.id, // Local-only opaque destination reference
      relativePath: safeRelativePath,
      name: safeFilename,
      expectedSize,
      bytesWritten: 0,
      writtenRanges: [],
      status: 'pending',
      mimeType: manifestEntry.mimeType,
      createdAt: Date.now(),
      isReleased: false,
    };
  } catch (err) {
    throw new FileException(
      createFileError('FILE_WRITE_FAILED', err instanceof Error ? err.message : String(err))
    );
  }
}

/**
 * Writes a bounded chunk to a ReceiveFileDestinationItem through FileSystemManager.
 */
export async function writeReceiveDestinationChunk(
  destination: ReceiveFileDestinationItem,
  offset: number,
  data: Uint8Array,
  fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
): Promise<ReceiveChunkWriteResult> {
  const startTime = Date.now();

  if (!destination || typeof destination !== 'object') {
    throw new FileException(
      createFileError('INVALID_CHUNK', 'Invalid or null receive destination item')
    );
  }

  if (destination.isReleased) {
    throw new FileException(
      createFileError('FILE_NOT_FOUND', `Receive destination '${destination.transferFileId}' has already been released`)
    );
  }

  if (destination.status === 'completed') {
    throw new FileException(
      createFileError('FILE_WRITE_FAILED', `Receive destination '${destination.transferFileId}' is already finalized`)
    );
  }

  if (typeof offset !== 'number' || offset < 0) {
    throw new FileException(
      createFileError('INVALID_CHUNK', `Write offset cannot be negative: ${offset}`)
    );
  }

  if (!data || data.length === undefined) {
    throw new FileException(
      createFileError('INVALID_CHUNK', 'Invalid or missing data payload for write')
    );
  }

  if (data.length > DEFAULT_CHUNK_SIZE) {
    throw new FileException(
      createFileError('INVALID_CHUNK', `Write payload exceeds maximum chunk size of 4 MiB: ${data.length}`)
    );
  }

  const prevUnique = destination.bytesWritten;

  const fileRef: FileReference = {
    id: destination.nativeReferenceId,
    name: destination.name,
    kind: 'file',
    size: destination.expectedSize,
  };

  try {
    const written = await fileSystemManager.write(fileRef, offset, data);

    // Merge range and recompute unique bytes
    destination.writtenRanges = mergeByteRanges([
      ...destination.writtenRanges,
      { offset, length: written },
    ]);
    destination.bytesWritten = calculateUniqueBytes(destination.writtenRanges);
    destination.status = 'in-progress';

    const isDuplicate = destination.bytesWritten === prevUnique && written > 0;
    const missingRanges = calculateMissingRanges(destination.writtenRanges, destination.expectedSize);
    const isComplete = isDestinationComplete(destination.writtenRanges, destination.expectedSize);

    return {
      transferFileId: destination.transferFileId,
      offset,
      bytesWritten: written,
      totalUniqueBytesWritten: destination.bytesWritten,
      expectedSize: destination.expectedSize,
      isDuplicate,
      missingRanges,
      isComplete,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    throw new FileException(
      createFileError('FILE_WRITE_FAILED', err instanceof Error ? err.message : String(err))
    );
  }
}

/**
 * Finalizes a ReceiveFileDestinationItem, verifying full byte range completion.
 */
export async function finalizeReceiveDestination(
  destination: ReceiveFileDestinationItem,
  fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
): Promise<FileTransferResult> {
  if (destination.isReleased) {
    throw new FileException(
      createFileError('FILE_FINALIZE_FAILED', `Receive destination '${destination.transferFileId}' is released`)
    );
  }

  const missing = calculateMissingRanges(destination.writtenRanges, destination.expectedSize);
  if (missing.length > 0 && destination.expectedSize > 0) {
    throw new FileException(
      createFileError(
        'FILE_FINALIZE_FAILED',
        `Cannot finalize '${destination.name}': missing ${missing.reduce((acc, m) => acc + m.length, 0)} bytes`
      )
    );
  }

  const fileRef: FileReference = {
    id: destination.nativeReferenceId,
    name: destination.name,
    kind: 'file',
    size: destination.expectedSize,
  };

  try {
    await fileSystemManager.finalizeFile(fileRef);
    destination.status = 'completed';

    return {
      transferId: 'tr_receive',
      fileId: destination.transferFileId,
      bytesProcessed: destination.bytesWritten,
      verified: true,
    };
  } catch (err) {
    throw new FileException(
      createFileError('FILE_FINALIZE_FAILED', err instanceof Error ? err.message : String(err))
    );
  }
}

/**
 * Releases native destination reference handle and closes the session.
 */
export async function releaseReceiveDestination(
  destination: ReceiveFileDestinationItem,
  fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
): Promise<void> {
  if (destination.isReleased) return;

  try {
    await fileSystemManager.release({
      id: destination.nativeReferenceId,
      name: destination.name,
      kind: 'file',
    });
  } catch {
    // Best-effort release
  }

  destination.isReleased = true;
}
