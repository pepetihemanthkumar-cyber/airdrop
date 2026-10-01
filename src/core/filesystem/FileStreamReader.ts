/**
 * NearShare File Stream Reader
 *
 * Reads discrete binary chunks from an underlying FileSystemAdapter using ChunkManager.
 */

import type { FileReference, FileMetadata } from './types';
import type { FileSystemAdapter } from './FileSystemAdapter';
import type { FileChunk } from '../file/types';
import { ChunkManager } from '../file/ChunkManager';
import { calculateChecksum } from '../file/Integrity';
import { FileSystemException, createFileSystemError } from './errors';

export class FileStreamReader {
  readonly reference: FileReference;
  private adapter: FileSystemAdapter;
  private chunkManager: ChunkManager;
  private metadata: FileMetadata | null = null;
  private isOpen = false;

  constructor(
    reference: FileReference,
    adapter: FileSystemAdapter,
    chunkManager: ChunkManager = new ChunkManager()
  ) {
    this.reference = reference;
    this.adapter = adapter;
    this.chunkManager = chunkManager;
  }

  async open(): Promise<FileMetadata> {
    this.metadata = await this.adapter.getFileMetadata(this.reference);
    this.isOpen = true;
    return this.metadata;
  }

  async readChunk(
    chunkIndex: number,
    transferId: string,
    chunkSize?: number
  ): Promise<FileChunk> {
    if (!this.isOpen || !this.metadata) {
      throw new FileSystemException(
        createFileSystemError('READ_FAILED', `Reader not open for file '${this.reference.name}'`)
      );
    }

    const effectiveChunkSize = chunkSize ?? this.chunkManager.defaultChunkSize;
    const totalSize = this.metadata.size;
    const totalChunks = this.chunkManager.calculateChunkCount(totalSize, effectiveChunkSize);

    // 0-byte file edge case
    if (totalSize === 0) {
      return {
        transferId,
        fileId: this.reference.id,
        chunkIndex: 0,
        offset: 0,
        length: 0,
        totalChunks: 0,
        data: new Uint8Array(0),
        checksum: (await calculateChecksum(new Uint8Array(0))).value,
      };
    }

    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new FileSystemException(
        createFileSystemError(
          'INVALID_OFFSET',
          `Chunk index ${chunkIndex} out of bounds for total chunks ${totalChunks}`
        )
      );
    }

    const offset = this.chunkManager.getChunkOffset(chunkIndex, effectiveChunkSize);
    const length = this.chunkManager.getChunkLength(totalSize, chunkIndex, effectiveChunkSize);

    const data = await this.adapter.read(this.reference, offset, length);
    const checksum = await calculateChecksum(data);

    return {
      transferId,
      fileId: this.reference.id,
      chunkIndex,
      offset,
      length: data.byteLength,
      totalChunks,
      data,
      checksum: checksum.value,
    };
  }

  async close(): Promise<void> {
    if (this.isOpen) {
      await this.adapter.release(this.reference);
      this.isOpen = false;
    }
  }

  getMetadata(): FileMetadata | null {
    return this.metadata;
  }
}
