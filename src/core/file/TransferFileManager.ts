/**
 * NearShare Transfer File Manager
 *
 * Coordinates file lifecycle operations between the transfer queue,
 * protocol manifest contracts, and the underlying FileEngine.
 */

import type { FileSource } from './types';
import type { FileManifestEntry, FileManifestPayload } from '../protocol/messageTypes';
import type { FileEngine } from './FileEngine';
import type { NativeFolderScanResult } from '../native/tauri/TauriIpc';
import {
  type TransferFolderSource,
  type TransferFileChunkResult,
  createTransferSourceFromFolder,
  createProtocolManifestFromFolderSource,
  readTransferFileChunk,
  releaseTransferFolderSource,
} from './NativeFolderTransferSource';
import {
  type ReceiveFileDestinationItem,
  type ReceiveChunkWriteResult,
  createReceiveDestinationFromFile,
  writeReceiveDestinationChunk,
  finalizeReceiveDestination,
  releaseReceiveDestination,
} from './NativeReceiveFileDestination';
import type { FileTransferResult } from './types';
import { FileSystemManager } from '../filesystem/FileSystemManager';

export interface OutgoingTransferPreparation {
  transferId: string;
  files: FileSource[];
  manifest: FileManifestPayload;
  totalBytes: number;
  totalFiles: number;
}

export interface IncomingTransferPreparation {
  transferId: string;
  files: FileSource[];
  totalBytes: number;
  totalFiles: number;
  destinationPath?: string;
}

export class TransferFileManager {
  private fileEngine: FileEngine;

  constructor(fileEngine: FileEngine) {
    this.fileEngine = fileEngine;
  }

  /**
   * Prepares an outgoing transfer by validating sources and generating a protocol-compliant manifest.
   */
  async prepareOutgoingTransfer(
    files: FileSource[],
    options?: { transferId?: string }
  ): Promise<OutgoingTransferPreparation> {
    const transferId = options?.transferId ?? `tr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const normalizedFiles: FileSource[] = [];

    for (const f of files) {
      const meta = await this.fileEngine.getMetadata(f);
      normalizedFiles.push(meta);
    }

    const manifest = this.createManifest(transferId, normalizedFiles);
    const totalBytes = normalizedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

    return {
      transferId,
      files: normalizedFiles,
      manifest,
      totalBytes,
      totalFiles: normalizedFiles.length,
    };
  }

  /**
   * Prepares an incoming transfer from a protocol manifest, creating staged write handles.
   */
  async prepareIncomingTransfer(
    manifest: FileManifestPayload,
    options?: { destinationPath?: string }
  ): Promise<IncomingTransferPreparation> {
    const files: FileSource[] = manifest.files.map((entry) => ({
      fileId: entry.fileId,
      name: entry.name,
      size: entry.size,
      type: entry.fileType,
      mimeType: entry.mimeType,
      relativePath: entry.relativePath,
      modifiedAt: entry.modifiedAt,
    }));

    return {
      transferId: manifest.transferId,
      files,
      totalBytes: manifest.totalBytes,
      totalFiles: files.length,
      destinationPath: options?.destinationPath,
    };
  }

  /**
   * Constructs a protocol-compliant FileManifestPayload from FileSource descriptors.
   * Preserves relative paths for folders without leaking absolute local paths.
   */
  createManifest(transferId: string, files: FileSource[]): FileManifestPayload {
    const manifestEntries: FileManifestEntry[] = files.map((f) => ({
      fileId: f.fileId,
      name: f.name,
      relativePath: f.relativePath,
      size: f.size,
      mimeType: f.mimeType,
      fileType: f.type,
      modifiedAt: f.modifiedAt,
    }));

    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

    return {
      transferId,
      files: manifestEntries,
      totalBytes,
    };
  }

  /**
   * Creates a TransferFolderSource from a native folder scan result.
   */
  createFolderTransferSource(scanResult: NativeFolderScanResult): TransferFolderSource {
    return createTransferSourceFromFolder(scanResult);
  }

  /**
   * Creates a protocol manifest from a TransferFolderSource.
   */
  createProtocolManifestFromFolder(source: TransferFolderSource, transferId?: string): FileManifestPayload {
    return createProtocolManifestFromFolderSource(source, transferId);
  }

  /**
   * Reads a bounded chunk from a file in a TransferFolderSource through FileEngine.
   */
  async readFolderFileChunk(
    source: TransferFolderSource,
    transferFileId: string,
    offset: number,
    length: number,
    fileSystemManager?: FileSystemManager
  ): Promise<TransferFileChunkResult> {
    return readTransferFileChunk(source, transferFileId, offset, length, fileSystemManager);
  }

  /**
   * Releases all references associated with a TransferFolderSource.
   */
  async releaseFolderTransferSource(
    source: TransferFolderSource,
    fileSystemManager?: FileSystemManager
  ): Promise<void> {
    return releaseTransferFolderSource(source, fileSystemManager);
  }

  /**
   * Creates a native receive file destination from a manifest entry through FileEngine.
   */
  async createReceiveDestination(
    manifestEntry: FileManifestEntry | FileSource,
    fileSystemManager?: FileSystemManager
  ): Promise<ReceiveFileDestinationItem> {
    return createReceiveDestinationFromFile(manifestEntry, fileSystemManager);
  }

  /**
   * Writes a bounded chunk to a ReceiveFileDestinationItem through FileEngine.
   */
  async writeReceiveChunk(
    destination: ReceiveFileDestinationItem,
    offset: number,
    data: Uint8Array,
    fileSystemManager?: FileSystemManager
  ): Promise<ReceiveChunkWriteResult> {
    return writeReceiveDestinationChunk(destination, offset, data, fileSystemManager);
  }

  /**
   * Finalizes a ReceiveFileDestinationItem, verifying complete byte coverage.
   */
  async finalizeReceiveDestination(
    destination: ReceiveFileDestinationItem,
    fileSystemManager?: FileSystemManager
  ): Promise<FileTransferResult> {
    return finalizeReceiveDestination(destination, fileSystemManager);
  }

  /**
   * Releases a ReceiveFileDestinationItem and closes native destination handle.
   */
  async releaseReceiveDestination(
    destination: ReceiveFileDestinationItem,
    fileSystemManager?: FileSystemManager
  ): Promise<void> {
    return releaseReceiveDestination(destination, fileSystemManager);
  }

  /**
   * Cleans up all resources associated with a completed or cancelled transfer.
   */
  async cleanupTransfer(transferId: string): Promise<void> {
    await this.fileEngine.cleanupTransfer(transferId);
  }
}
