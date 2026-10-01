/**
 * NearShare Chunk Manager
 *
 * Provides deterministic chunk calculations, boundary arithmetic,
 * chunk validation, and chunk creation contracts.
 * Reuses DEFAULT_CHUNK_SIZE from protocol messageTypes.
 */

import { DEFAULT_CHUNK_SIZE } from '../protocol/messageTypes';
import type { FileChunk } from './types';
import { type FileError, createFileError } from './errors';

export class ChunkManager {
  readonly defaultChunkSize: number;

  constructor(chunkSize: number = DEFAULT_CHUNK_SIZE) {
    this.defaultChunkSize = chunkSize > 0 ? chunkSize : DEFAULT_CHUNK_SIZE;
  }

  /**
   * Calculates the exact number of chunks required for a given file size.
   * Handles 0-byte files (0 chunks), exact chunk boundaries, and fractional chunks.
   */
  calculateChunkCount(fileSize: number, chunkSize: number = this.defaultChunkSize): number {
    if (fileSize <= 0) return 0;
    if (chunkSize <= 0) return 1;
    return Math.ceil(fileSize / chunkSize);
  }

  /**
   * Returns the byte offset for a given chunk index.
   */
  getChunkOffset(chunkIndex: number, chunkSize: number = this.defaultChunkSize): number {
    if (chunkIndex < 0) return 0;
    return chunkIndex * chunkSize;
  }

  /**
   * Calculates the byte length for a given chunk index.
   */
  getChunkLength(fileSize: number, chunkIndex: number, chunkSize: number = this.defaultChunkSize): number {
    if (fileSize <= 0 || chunkIndex < 0) return 0;
    const totalChunks = this.calculateChunkCount(fileSize, chunkSize);
    if (chunkIndex >= totalChunks) return 0;

    const offset = this.getChunkOffset(chunkIndex, chunkSize);
    return Math.min(chunkSize, Math.max(0, fileSize - offset));
  }

  /**
   * Validates chunk attributes against declared file bounds and protocol rules.
   */
  validateChunk(chunk: FileChunk, declaredFileSize: number): { valid: true } | { valid: false; error: FileError } {
    if (!chunk || typeof chunk !== 'object') {
      return {
        valid: false,
        error: createFileError('INVALID_CHUNK', 'Chunk descriptor must be a non-null object'),
      };
    }

    if (!chunk.transferId || typeof chunk.transferId !== 'string') {
      return {
        valid: false,
        error: createFileError('INVALID_CHUNK', 'Chunk missing valid transferId'),
      };
    }

    if (!chunk.fileId || typeof chunk.fileId !== 'string') {
      return {
        valid: false,
        error: createFileError('INVALID_CHUNK', 'Chunk missing valid fileId'),
      };
    }

    if (typeof chunk.chunkIndex !== 'number' || chunk.chunkIndex < 0 || isNaN(chunk.chunkIndex)) {
      return {
        valid: false,
        error: createFileError('INVALID_CHUNK', `Invalid chunkIndex: ${chunk.chunkIndex}`),
      };
    }

    if (typeof chunk.offset !== 'number' || chunk.offset < 0 || isNaN(chunk.offset)) {
      return {
        valid: false,
        error: createFileError('INVALID_CHUNK', `Invalid chunk offset: ${chunk.offset}`),
      };
    }

    // 0-byte file special case
    if (declaredFileSize === 0) {
      if (chunk.length !== 0 || chunk.offset !== 0) {
        return {
          valid: false,
          error: createFileError('INVALID_CHUNK', '0-byte file chunk must have length 0 and offset 0'),
        };
      }
      return { valid: true };
    }

    if (typeof chunk.length !== 'number' || chunk.length <= 0 || isNaN(chunk.length)) {
      return {
        valid: false,
        error: createFileError('INVALID_CHUNK', `Invalid chunk length: ${chunk.length}`),
      };
    }

    if (chunk.chunkIndex >= chunk.totalChunks) {
      return {
        valid: false,
        error: createFileError(
          'INVALID_CHUNK',
          `Chunk index ${chunk.chunkIndex} exceeds declared totalChunks ${chunk.totalChunks}`
        ),
      };
    }

    if (chunk.offset + chunk.length > declaredFileSize) {
      return {
        valid: false,
        error: createFileError(
          'INVALID_CHUNK',
          `Chunk span [${chunk.offset}, ${chunk.offset + chunk.length}] exceeds file size ${declaredFileSize}`
        ),
      };
    }

    return { valid: true };
  }

  /**
   * Helper to construct a validated FileChunk descriptor.
   */
  createChunk(
    transferId: string,
    fileId: string,
    chunkIndex: number,
    data: Uint8Array | string,
    declaredFileSize: number,
    chunkSize: number = this.defaultChunkSize,
    checksum?: string
  ): FileChunk {
    const offset = this.getChunkOffset(chunkIndex, chunkSize);
    const length =
      typeof data === 'string'
        ? data.length
        : (data?.byteLength ?? this.getChunkLength(declaredFileSize, chunkIndex, chunkSize));
    const totalChunks = this.calculateChunkCount(declaredFileSize, chunkSize);

    return {
      transferId,
      fileId,
      chunkIndex,
      offset,
      length,
      totalChunks,
      data,
      checksum,
    };
  }
}
