/**
 * NearShare File Assembler
 *
 * Reassembles incoming chunks into complete files through a FileWriter.
 * Supports out-of-order chunks, prevents duplicate chunk writes, updates checkpoints,
 * and verifies final output integrity.
 */

import type { FileSource, FileChunk, FileTransferResult } from './types';
import type { FileWriter } from './FileWriter';
import { ChunkManager } from './ChunkManager';
import { ResumeManager } from './ResumeManager';
import { type FileError, createFileError } from './errors';
import { verifyChecksum } from './Integrity';

export type ChunkAssemblyStatus =
  | { status: 'accepted'; chunkIndex: number; bytesWritten: number; totalReceivedBytes: number }
  | { status: 'duplicate'; chunkIndex: number; message: string }
  | { status: 'error'; error: FileError };

export class FileAssembler {
  readonly file: FileSource;
  readonly writer: FileWriter;
  readonly chunkManager: ChunkManager;
  readonly resumeManager: ResumeManager;
  private readonly transferId: string;
  private receivedChunkIndexes = new Set<number>();
  private totalBytesReceived = 0;
  private isFinalized = false;

  constructor(
    transferId: string,
    file: FileSource,
    writer: FileWriter,
    chunkManager: ChunkManager = new ChunkManager(),
    resumeManager: ResumeManager = new ResumeManager()
  ) {
    this.transferId = transferId;
    this.file = file;
    this.writer = writer;
    this.chunkManager = chunkManager;
    this.resumeManager = resumeManager;
  }

  /**
   * Initializes the assembler and writer.
   */
  async initialize(): Promise<void> {
    await this.writer.open();

    // Check if resume checkpoint exists
    const checkpoint = this.resumeManager.getCheckpoint(this.transferId, this.file.fileId);
    if (checkpoint) {
      this.totalBytesReceived = checkpoint.bytesReceived;
    }
  }

  /**
   * Accepts and processes an incoming FileChunk.
   */
  async processChunk(chunk: FileChunk): Promise<ChunkAssemblyStatus> {
    if (this.isFinalized) {
      return {
        status: 'error',
        error: createFileError('INVALID_CHUNK', `File '${this.file.name}' is already finalized`),
      };
    }

    // 1. Validate chunk structure against file bounds
    const validation = this.chunkManager.validateChunk(chunk, this.file.size);
    if (!validation.valid) {
      return {
        status: 'error',
        error: validation.error,
      };
    }

    // 2. Duplicate chunk guard
    if (this.receivedChunkIndexes.has(chunk.chunkIndex)) {
      return {
        status: 'duplicate',
        chunkIndex: chunk.chunkIndex,
        message: `Chunk ${chunk.chunkIndex} already received; ignored duplicate without corruption.`,
      };
    }

    // 3. Optional chunk-level checksum verification
    if (chunk.checksum) {
      const validChecksum = await verifyChecksum(chunk.data, chunk.checksum);
      if (!validChecksum) {
        return {
          status: 'error',
          error: createFileError('CHECKSUM_FAILED', `Checksum verification failed for chunk ${chunk.chunkIndex}`),
        };
      }
    }

    // 4. Write data to writer at chunk offset
    try {
      const written = await this.writer.write(chunk.offset, chunk.data);
      this.receivedChunkIndexes.add(chunk.chunkIndex);
      this.totalBytesReceived += written;

      // 5. Update checkpoint
      const nextMissing = this.resumeManager
        .getMissingChunks(chunk.totalChunks, this.receivedChunkIndexes)
        .shift();
      const nextIndex = nextMissing !== undefined ? nextMissing : chunk.totalChunks;

      this.resumeManager.updateCheckpoint({
        transferId: this.transferId,
        fileId: this.file.fileId,
        nextChunkIndex: nextIndex,
        bytesReceived: this.totalBytesReceived,
        updatedAt: Date.now(),
      });

      return {
        status: 'accepted',
        chunkIndex: chunk.chunkIndex,
        bytesWritten: written,
        totalReceivedBytes: this.totalBytesReceived,
      };
    } catch (err) {
      return {
        status: 'error',
        error: createFileError(
          'FILE_WRITE_FAILED',
          `Failed writing chunk ${chunk.chunkIndex}: ${err instanceof Error ? err.message : String(err)}`
        ),
      };
    }
  }

  /**
   * Finalizes the assembled file and verifies complete integrity.
   */
  async finalize(expectedChecksum?: string): Promise<FileTransferResult> {
    if (this.isFinalized) {
      throw new Error(`File '${this.file.name}' is already finalized`);
    }

    const totalChunks = this.chunkManager.calculateChunkCount(this.file.size);

    // 0-byte file check
    if (this.file.size === 0) {
      const result = await this.writer.finalize();
      this.isFinalized = true;
      this.resumeManager.clearCheckpoint(this.transferId, this.file.fileId);
      return result;
    }

    // Check for missing chunks before finalizing
    const missing = this.resumeManager.getMissingChunks(totalChunks, this.receivedChunkIndexes);
    if (missing.length > 0) {
      throw new Error(`Cannot finalize file '${this.file.name}': missing ${missing.length} chunks (${missing.slice(0, 5).join(', ')}...)`);
    }

    const result = await this.writer.finalize();

    // Verify final checksum if provided
    let verified = true;
    if (expectedChecksum && result.checksum) {
      verified = expectedChecksum.toLowerCase() === result.checksum.toLowerCase();
    }

    this.isFinalized = true;
    this.resumeManager.clearCheckpoint(this.transferId, this.file.fileId);

    return {
      ...result,
      verified,
    };
  }

  /**
   * Aborts assembly and cleans up.
   */
  async abort(): Promise<void> {
    await this.writer.abort();
    this.resumeManager.clearCheckpoint(this.transferId, this.file.fileId);
  }

  getReceivedChunkIndexes(): number[] {
    return Array.from(this.receivedChunkIndexes).sort((a, b) => a - b);
  }

  getMissingChunkIndexes(): number[] {
    const totalChunks = this.chunkManager.calculateChunkCount(this.file.size);
    return this.resumeManager.getMissingChunks(totalChunks, this.receivedChunkIndexes);
  }
}
