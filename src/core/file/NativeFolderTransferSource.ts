/**
 * NearShare Native Folder Transfer Source & FileEngine Integration Adapter
 *
 * Connects the native macOS folder scanner (Step 35) to the NearShare FileEngine
 * and TransferFileManager architecture.
 *
 * ARCHITECTURAL BOUNDARY RULES:
 * 1. Opaque native handles (native-UUID) remain local-only for native I/O.
 * 2. Logical transfer identifiers (transfer-file-UUID) are used for protocol manifests and UI.
 * 3. File metadata and relative paths are registered without loading full file bodies into memory.
 * 4. Chunk reads are bounded to DEFAULT_CHUNK_SIZE (4 MiB) through FileEngine/FileReader.
 * 5. Absolute paths, home paths, and host usernames are never exposed.
 */

import { DEFAULT_CHUNK_SIZE, type FileManifestEntry, type FileManifestPayload } from '../protocol/messageTypes';
import type { FileSource, FileReadHandle } from './types';
import type { FileReader } from './FileReader';
import { createFileError, FileException } from './errors';
import { isSafeRelativePath, normalizeSafeRelativePath } from '../filesystem/PathSafety';
import { FileSystemManager } from '../filesystem/FileSystemManager';
import type { FileReference } from '../filesystem/types';
import type { NativeFolderScanResult } from '../native/tauri/TauriIpc';

export interface TransferFileSourceItem {
  transferFileId: string;
  localNativeReferenceId: string; // Opaque handle for local FileSystemManager / NativeBridge
  relativePath: string;
  name: string;
  size: number;
  kind: 'file';
  mimeType?: string;
  extension?: string;
  modifiedAt?: number;
}

export interface TransferFolderSource {
  sourceId: string;
  folderReferenceId: string; // Opaque folder handle (native-folder-UUID)
  folderName: string;
  fileCount: number;
  totalBytes: number;
  files: TransferFileSourceItem[];
  fileMap: Map<string, TransferFileSourceItem>; // transferFileId -> item
  createdAt: number;
  isReleased: boolean;
}

export interface TransferFileChunkResult {
  transferFileId: string;
  relativePath: string;
  offset: number;
  requestedLength: number;
  actualLength: number;
  isEof: boolean;
  bytes: Uint8Array;
  durationMs?: number;
}

/**
 * Native File Reader implementation that reads bounded chunks through FileSystemManager.
 */
export class NativeFileReader implements FileReader {
  readonly source: FileSource;
  readonly handle: FileReadHandle;
  readonly fileReference: FileReference;
  private fileSystemManager: FileSystemManager;
  private isClosed = false;

  constructor(
    source: FileSource,
    handle: FileReadHandle,
    fileReference: FileReference,
    fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
  ) {
    this.source = source;
    this.handle = handle;
    this.fileReference = fileReference;
    this.fileSystemManager = fileSystemManager;
  }

  async open(): Promise<void> {
    if (this.isClosed) {
      throw new FileException(
        createFileError('FILE_READ_FAILED', `NativeFileReader for '${this.source.name}' is closed`)
      );
    }
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (this.isClosed) {
      throw new FileException(
        createFileError('FILE_READ_FAILED', `NativeFileReader for '${this.source.name}' is closed`)
      );
    }

    if (offset < 0) {
      throw new FileException(
        createFileError('INVALID_CHUNK', `Offset cannot be negative: ${offset}`)
      );
    }

    if (length < 0) {
      throw new FileException(
        createFileError('INVALID_CHUNK', `Requested length cannot be negative: ${length}`)
      );
    }

    if (length > DEFAULT_CHUNK_SIZE) {
      throw new FileException(
        createFileError('INVALID_CHUNK', `Requested length exceeds maximum chunk size of 4 MiB: ${length}`)
      );
    }

    // 0-byte file edge case
    if (this.source.size === 0 || length === 0) {
      return new Uint8Array(0);
    }

    try {
      return await this.fileSystemManager.read(this.fileReference, offset, length);
    } catch (err) {
      throw new FileException(
        createFileError('FILE_READ_FAILED', err instanceof Error ? err.message : String(err))
      );
    }
  }

  async close(): Promise<void> {
    this.isClosed = true;
  }

  getSize(): number {
    return this.source.size;
  }
}

/**
 * Creates and registers a TransferFolderSource from a native folder scan result.
 * Validates relative paths and separates logical transferFileId from local opaque native reference.
 */
export function createTransferSourceFromFolder(scanResult: NativeFolderScanResult): TransferFolderSource {
  if (!scanResult || typeof scanResult !== 'object') {
    throw new FileException(
      createFileError('UNSUPPORTED_FILE', 'Invalid or null folder scan result')
    );
  }

  const sourceId = `src_folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const fileMap = new Map<string, TransferFileSourceItem>();
  const files: TransferFileSourceItem[] = [];

  for (let i = 0; i < scanResult.entries.length; i++) {
    const entry = scanResult.entries[i];

    // Safety check: validate relative path
    if (!isSafeRelativePath(entry.relativePath)) {
      throw new FileException(
        createFileError('UNSUPPORTED_FILE', `Unsafe relative path in manifest entry: '${entry.relativePath}'`)
      );
    }

    const safeRelativePath = normalizeSafeRelativePath(entry.relativePath);
    const transferFileId = `tr_file_${i + 1}_${Math.random().toString(36).slice(2, 8)}`;

    const item: TransferFileSourceItem = {
      transferFileId,
      localNativeReferenceId: entry.id, // Opaque handle for local native I/O only
      relativePath: safeRelativePath,
      name: entry.name,
      size: entry.size,
      kind: 'file',
      mimeType: entry.mimeType,
      extension: entry.extension,
      modifiedAt: entry.modifiedAt,
    };

    files.push(item);
    fileMap.set(transferFileId, item);
  }

  return {
    sourceId,
    folderReferenceId: scanResult.folderReferenceId,
    folderName: scanResult.folderName,
    fileCount: scanResult.fileCount,
    totalBytes: scanResult.totalBytes,
    files,
    fileMap,
    createdAt: Date.now(),
    isReleased: false,
  };
}

/**
 * Constructs a protocol-compliant FileManifestPayload from a TransferFolderSource.
 * Uses logical transferFileId and safe relative paths. Never exposes local native handles or absolute paths.
 */
export function createProtocolManifestFromFolderSource(
  source: TransferFolderSource,
  transferId?: string
): FileManifestPayload {
  const effectiveTransferId =
    transferId ?? `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const manifestEntries: FileManifestEntry[] = source.files.map((f) => ({
    fileId: f.transferFileId,
    name: f.name,
    relativePath: f.relativePath,
    size: f.size,
    mimeType: f.mimeType,
    fileType: f.extension || 'file',
    modifiedAt: f.modifiedAt,
  }));

  return {
    transferId: effectiveTransferId,
    files: manifestEntries,
    totalBytes: source.totalBytes,
  };
}

/**
 * Reads a single bounded chunk (up to 4 MiB) for a file in a TransferFolderSource
 * through the FileEngine/FileReader/FileSystemManager abstraction.
 */
export async function readTransferFileChunk(
  source: TransferFolderSource,
  transferFileId: string,
  offset: number,
  length: number,
  fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
): Promise<TransferFileChunkResult> {
  const startTime = Date.now();

  if (source.isReleased) {
    throw new FileException(
      createFileError('FILE_NOT_FOUND', `Transfer source '${source.sourceId}' has already been released`)
    );
  }

  const item = source.fileMap.get(transferFileId);
  if (!item) {
    throw new FileException(
      createFileError('FILE_NOT_FOUND', `File '${transferFileId}' not found in transfer source`)
    );
  }

  if (offset < 0) {
    throw new FileException(
      createFileError('INVALID_CHUNK', `Offset cannot be negative: ${offset}`)
    );
  }

  if (length < 0) {
    throw new FileException(
      createFileError('INVALID_CHUNK', `Length cannot be negative: ${length}`)
    );
  }

  if (length > DEFAULT_CHUNK_SIZE) {
    throw new FileException(
      createFileError('INVALID_CHUNK', `Requested length exceeds maximum chunk size of 4 MiB: ${length}`)
    );
  }

  // 0-byte file handling
  if (item.size === 0) {
    return {
      transferFileId,
      relativePath: item.relativePath,
      offset: 0,
      requestedLength: length,
      actualLength: 0,
      isEof: true,
      bytes: new Uint8Array(0),
      durationMs: Date.now() - startTime,
    };
  }

  // FileEngine / FileReader abstraction
  const fileSource: FileSource = {
    fileId: item.transferFileId,
    name: item.name,
    size: item.size,
    type: item.extension || 'file',
    mimeType: item.mimeType,
    relativePath: item.relativePath,
    modifiedAt: item.modifiedAt,
  };

  const fileReadHandle: FileReadHandle = {
    fileId: item.transferFileId,
    size: item.size,
    position: offset,
    source: fileSource,
    openedAt: Date.now(),
  };

  const fileReference: FileReference = {
    id: item.localNativeReferenceId,
    name: item.name,
    kind: 'file',
    size: item.size,
    mimeType: item.mimeType,
    modifiedAt: item.modifiedAt,
  };

  const reader = new NativeFileReader(fileSource, fileReadHandle, fileReference, fileSystemManager);
  await reader.open();

  try {
    const bytes = await reader.read(offset, length);
    const actualLength = bytes.byteLength;
    const isEof = offset + actualLength >= item.size;

    return {
      transferFileId,
      relativePath: item.relativePath,
      offset,
      requestedLength: length,
      actualLength,
      isEof,
      bytes,
      durationMs: Date.now() - startTime,
    };
  } finally {
    await reader.close();
  }
}

/**
 * Releases all native references associated with a TransferFolderSource.
 */
export async function releaseTransferFolderSource(
  source: TransferFolderSource,
  fileSystemManager: FileSystemManager = FileSystemManager.getInstance()
): Promise<void> {
  if (source.isReleased) return;

  // Release each file reference
  for (const item of source.files) {
    try {
      await fileSystemManager.release({
        id: item.localNativeReferenceId,
        name: item.name,
        kind: 'file',
      });
    } catch {
      // Best-effort release
    }
  }

  // Release folder reference
  if (source.folderReferenceId) {
    try {
      await fileSystemManager.release({
        id: source.folderReferenceId,
        name: source.folderName,
        kind: 'folder',
      });
    } catch {
      // Best-effort release
    }
  }

  source.isReleased = true;
  source.fileMap.clear();
}
