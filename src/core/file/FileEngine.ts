/**
 * NearShare File Engine Interface Contract
 *
 * Defines the core abstraction for file I/O, chunk streaming, resume checkpointing,
 * and transfer staging across all native and simulated platforms.
 */

import type {
  FileSource,
  FileReadHandle,
  FileWriteHandle,
  FileChunk,
  ResumeCheckpoint,
  FileTransferResult,
} from './types';
import type { ChunkAssemblyStatus } from './FileAssembler';

export interface FileEngine {
  /**
   * Inspects and retrieves normalized metadata for a file source.
   */
  getMetadata(source: FileSource): Promise<FileSource>;

  /**
   * Opens a file for chunk reading.
   */
  openRead(source: FileSource): Promise<FileReadHandle>;

  /**
   * Reads a single chunk at chunkIndex for the opened read handle.
   */
  readChunk(
    handle: FileReadHandle,
    chunkIndex: number,
    transferId: string,
    chunkSize?: number
  ): Promise<FileChunk>;

  /**
   * Closes an active read handle.
   */
  closeRead(handle: FileReadHandle): Promise<void>;

  /**
   * Allocates staging and initializes a write handle for an incoming file.
   */
  createWrite(
    transferId: string,
    file: FileSource,
    destinationPath?: string
  ): Promise<FileWriteHandle>;

  /**
   * Writes a chunk into the staging area for the specified write handle.
   */
  writeChunk(handle: FileWriteHandle, chunk: FileChunk): Promise<ChunkAssemblyStatus>;

  /**
   * Finalizes the file write, validates checksum, and moves file to destination.
   */
  finalizeWrite(handle: FileWriteHandle, expectedChecksum?: string): Promise<FileTransferResult>;

  /**
   * Aborts writing and purges incomplete fragments for the handle.
   */
  abortWrite(handle: FileWriteHandle): Promise<void>;

  /**
   * Retrieves an active resume checkpoint.
   */
  getCheckpoint(transferId: string, fileId: string): ResumeCheckpoint | null;

  /**
   * Stores or updates a resume checkpoint.
   */
  saveCheckpoint(checkpoint: ResumeCheckpoint): void;

  /**
   * Clears a checkpoint upon completion.
   */
  clearCheckpoint(transferId: string, fileId: string): void;

  /**
   * Validates integrity for a finalized file.
   */
  verifyFile(file: FileSource, checksum?: string): Promise<boolean>;

  /**
   * Cleans up all staged data and temporary files for a completed or aborted transfer.
   */
  cleanupTransfer(transferId: string): Promise<void>;
}
