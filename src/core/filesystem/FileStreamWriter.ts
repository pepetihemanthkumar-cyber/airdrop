/**
 * NearShare File Stream Writer
 *
 * Writes incoming chunks to target destination storage via FileSystemAdapter.
 * Handles out-of-order chunks, duplicate suppression, checkpoint updates, and integrity verification.
 */

import type { FileReference, FileMetadata, DestinationLocation } from './types';
import type { FileSystemAdapter } from './FileSystemAdapter';
import type { FileChunk } from '../file/types';
import { ChunkManager } from '../file/ChunkManager';
import { verifyChecksum } from '../file/Integrity';
import { FileSystemException, createFileSystemError } from './errors';

export interface ChunkWriteResult {
  status: 'written' | 'duplicate';
  chunkIndex: number;
  bytesWritten: number;
  totalBytesWritten: number;
}

export class FileStreamWriter {
  readonly destination: DestinationLocation;
  readonly metadata: FileMetadata;
  private adapter: FileSystemAdapter;
  private chunkManager: ChunkManager;
  private fileReference: FileReference | null = null;
  private receivedChunkIndexes = new Set<number>();
  private totalBytesWritten = 0;
  private isFinalized = false;
  private isOpen = false;

  constructor(
    destination: DestinationLocation,
    metadata: FileMetadata,
    adapter: FileSystemAdapter,
    chunkManager: ChunkManager = new ChunkManager()
  ) {
    this.destination = destination;
    this.metadata = metadata;
    this.adapter = adapter;
    this.chunkManager = chunkManager;
  }

  async open(): Promise<FileReference> {
    this.fileReference = await this.adapter.createFile(this.destination, this.metadata);
    this.isOpen = true;
    return this.fileReference;
  }

  async writeChunk(chunk: FileChunk): Promise<ChunkWriteResult> {
    if (!this.isOpen || !this.fileReference) {
      throw new FileSystemException(
        createFileSystemError('WRITE_FAILED', `Writer not open for file '${this.metadata.name}'`)
      );
    }

    if (this.isFinalized) {
      throw new FileSystemException(
        createFileSystemError('WRITE_FAILED', `File '${this.metadata.name}' already finalized`)
      );
    }

    // Duplicate check
    if (this.receivedChunkIndexes.has(chunk.chunkIndex)) {
      return {
        status: 'duplicate',
        chunkIndex: chunk.chunkIndex,
        bytesWritten: 0,
        totalBytesWritten: this.totalBytesWritten,
      };
    }

    // Checksum verification if provided
    if (chunk.checksum) {
      const valid = await verifyChecksum(chunk.data, chunk.checksum);
      if (!valid) {
        throw new FileSystemException(
          createFileSystemError(
            'WRITE_FAILED',
            `Checksum verification failed for chunk index ${chunk.chunkIndex}`
          )
        );
      }
    }

    // Convert string or Uint8Array data
    const dataBytes =
      typeof chunk.data === 'string'
        ? new TextEncoder().encode(chunk.data)
        : chunk.data;

    const written = await this.adapter.write(this.fileReference, chunk.offset, dataBytes);
    this.receivedChunkIndexes.add(chunk.chunkIndex);
    this.totalBytesWritten += written;

    return {
      status: 'written',
      chunkIndex: chunk.chunkIndex,
      bytesWritten: written,
      totalBytesWritten: this.totalBytesWritten,
    };
  }

  async finalize(_expectedChecksum?: string): Promise<FileMetadata> {
    if (!this.isOpen || !this.fileReference) {
      throw new FileSystemException(
        createFileSystemError('WRITE_FAILED', 'Writer not open')
      );
    }

    const totalExpectedChunks = this.chunkManager.calculateChunkCount(this.metadata.size);

    // 0-byte file check
    if (this.metadata.size === 0) {
      const finalMeta = await this.adapter.finalizeFile(this.fileReference);
      this.isFinalized = true;
      return finalMeta;
    }

    // Missing chunks check
    if (this.receivedChunkIndexes.size < totalExpectedChunks) {
      throw new FileSystemException(
        createFileSystemError(
          'WRITE_FAILED',
          `Cannot finalize '${this.metadata.name}': received ${this.receivedChunkIndexes.size}/${totalExpectedChunks} chunks`
        )
      );
    }

    const finalMeta = await this.adapter.finalizeFile(this.fileReference);
    this.isFinalized = true;
    return finalMeta;
  }

  async abort(): Promise<void> {
    if (this.fileReference) {
      await this.adapter.deleteTemporary(this.fileReference);
      await this.adapter.release(this.fileReference);
      this.fileReference = null;
      this.isOpen = false;
    }
  }

  getReceivedChunkIndexes(): number[] {
    return Array.from(this.receivedChunkIndexes).sort((a, b) => a - b);
  }

  getTotalBytesWritten(): number {
    return this.totalBytesWritten;
  }
}
