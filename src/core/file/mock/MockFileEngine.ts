/**
 * NearShare Mock File Engine
 *
 * Implements an in-memory, deterministic simulation of the FileEngine contract.
 * Generates mock file buffers and processes chunk reads, writes, checkpoints,
 * and assembly without touching native filesystem APIs.
 */

import type {
  FileSource,
  FileReadHandle,
  FileWriteHandle,
  FileChunk,
  ResumeCheckpoint,
  FileTransferResult,
} from '../types';
import type { FileEngine } from '../FileEngine';
import type { FileReader } from '../FileReader';
import type { FileWriter } from '../FileWriter';
import { ChunkManager } from '../ChunkManager';
import { ResumeManager } from '../ResumeManager';
import { TransferStagingArea } from '../TransferStaging';
import { FileAssembler, type ChunkAssemblyStatus } from '../FileAssembler';
import { calculateChecksum } from '../Integrity';
import { createFileError, FileException } from '../errors';

/**
 * In-memory simulated file reader
 */
export class MockFileReader implements FileReader {
  readonly source: FileSource;
  readonly handle: FileReadHandle;
  private buffer: Uint8Array;
  private isClosed = false;

  constructor(source: FileSource, handle: FileReadHandle) {
    this.source = source;
    this.handle = handle;
    this.buffer = generateDeterministicMockBuffer(source.fileId, source.size);
  }

  async open(): Promise<void> {
    this.isClosed = false;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (this.isClosed) {
      throw new FileException(
        createFileError('FILE_READ_FAILED', `MockFileReader for '${this.source.name}' is closed`)
      );
    }
    const end = Math.min(this.buffer.length, offset + length);
    return this.buffer.slice(offset, end);
  }

  async close(): Promise<void> {
    this.isClosed = true;
  }

  getSize(): number {
    return this.source.size;
  }
}

/**
 * In-memory simulated file writer
 */
export class MockFileWriter implements FileWriter {
  readonly file: FileSource;
  readonly handle: FileWriteHandle;
  private buffer: Uint8Array;
  private bytesWritten = 0;
  private isClosed = false;

  constructor(file: FileSource, handle: FileWriteHandle) {
    this.file = file;
    this.handle = handle;
    this.buffer = new Uint8Array(file.size);
  }

  async open(): Promise<void> {
    this.isClosed = false;
  }

  async write(offset: number, data: Uint8Array | string): Promise<number> {
    if (this.isClosed) {
      throw new FileException(
        createFileError('FILE_WRITE_FAILED', `MockFileWriter for '${this.file.name}' is closed`)
      );
    }

    const byteData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const end = Math.min(this.buffer.length, offset + byteData.length);
    this.buffer.set(byteData.subarray(0, end - offset), offset);
    this.bytesWritten = Math.max(this.bytesWritten, end);
    return byteData.length;
  }

  async finalize(): Promise<FileTransferResult> {
    const checksum = await calculateChecksum(this.buffer);
    return {
      transferId: this.handle.temporaryId.split('_')[1] ?? 'unknown',
      fileId: this.file.fileId,
      bytesProcessed: this.bytesWritten,
      verified: true,
      checksum: checksum.value,
    };
  }

  async abort(): Promise<void> {
    this.isClosed = true;
    this.buffer = new Uint8Array(0);
  }

  getBytesWritten(): number {
    return this.bytesWritten;
  }
}

/**
 * Deterministic Mock File Engine Implementation
 */
export class MockFileEngine implements FileEngine {
  private chunkManager: ChunkManager;
  private resumeManager: ResumeManager;
  private stagingArea: TransferStagingArea;
  private readHandles = new Map<string, MockFileReader>();
  private assemblers = new Map<string, FileAssembler>();

  constructor(chunkSize?: number) {
    this.chunkManager = new ChunkManager(chunkSize);
    this.resumeManager = new ResumeManager();
    this.stagingArea = new TransferStagingArea();
  }

  async getMetadata(source: FileSource): Promise<FileSource> {
    return {
      ...source,
      modifiedAt: source.modifiedAt ?? Date.now(),
    };
  }

  async openRead(source: FileSource): Promise<FileReadHandle> {
    const handle: FileReadHandle = {
      fileId: source.fileId,
      size: source.size,
      position: 0,
      source,
      openedAt: Date.now(),
    };
    const reader = new MockFileReader(source, handle);
    await reader.open();
    this.readHandles.set(source.fileId, reader);
    return handle;
  }

  async readChunk(
    handle: FileReadHandle,
    chunkIndex: number,
    transferId: string,
    chunkSize?: number
  ): Promise<FileChunk> {
    const reader = this.readHandles.get(handle.fileId);
    if (!reader) {
      throw new FileException(
        createFileError('FILE_NOT_FOUND', `Read handle not open for file ${handle.fileId}`)
      );
    }

    const effectiveChunkSize = chunkSize ?? this.chunkManager.defaultChunkSize;
    const offset = this.chunkManager.getChunkOffset(chunkIndex, effectiveChunkSize);
    const length = this.chunkManager.getChunkLength(handle.size, chunkIndex, effectiveChunkSize);
    const data = await reader.read(offset, length);
    const checksum = await calculateChecksum(data);

    return this.chunkManager.createChunk(
      transferId,
      handle.fileId,
      chunkIndex,
      data,
      handle.size,
      effectiveChunkSize,
      checksum.value
    );
  }

  async closeRead(handle: FileReadHandle): Promise<void> {
    const reader = this.readHandles.get(handle.fileId);
    if (reader) {
      await reader.close();
      this.readHandles.delete(handle.fileId);
    }
  }

  async createWrite(
    transferId: string,
    file: FileSource,
    destinationPath?: string
  ): Promise<FileWriteHandle> {
    const staged = this.stagingArea.stageFile(transferId, file);
    const handle: FileWriteHandle = {
      fileId: file.fileId,
      temporaryId: staged.temporaryId,
      expectedSize: file.size,
      bytesWritten: 0,
      destinationPath,
      openedAt: Date.now(),
    };

    const writer = new MockFileWriter(file, handle);
    const assembler = new FileAssembler(
      transferId,
      file,
      writer,
      this.chunkManager,
      this.resumeManager
    );
    await assembler.initialize();

    const key = `${transferId}:${file.fileId}`;
    this.assemblers.set(key, assembler);

    return handle;
  }

  async writeChunk(handle: FileWriteHandle, chunk: FileChunk): Promise<ChunkAssemblyStatus> {
    const key = `${chunk.transferId}:${handle.fileId}`;
    const assembler = this.assemblers.get(key);
    if (!assembler) {
      return {
        status: 'error',
        error: createFileError('FILE_WRITE_FAILED', `No active assembler for file ${handle.fileId}`),
      };
    }

    const status = await assembler.processChunk(chunk);
    if (status.status === 'accepted') {
      this.stagingArea.recordStagedBytes(chunk.transferId, handle.fileId, status.totalReceivedBytes);
    }
    return status;
  }

  async finalizeWrite(handle: FileWriteHandle, expectedChecksum?: string): Promise<FileTransferResult> {
    const transferId = handle.temporaryId.split('_')[1] ?? '';
    const key = `${transferId}:${handle.fileId}`;
    const assembler = this.assemblers.get(key);
    if (!assembler) {
      throw new FileException(
        createFileError('FILE_FINALIZE_FAILED', `Assembler not found for file ${handle.fileId}`)
      );
    }

    const result = await assembler.finalize(expectedChecksum);
    this.stagingArea.markFileComplete(transferId, handle.fileId, result);
    this.assemblers.delete(key);
    return result;
  }

  async abortWrite(handle: FileWriteHandle): Promise<void> {
    const transferId = handle.temporaryId.split('_')[1] ?? '';
    const key = `${transferId}:${handle.fileId}`;
    const assembler = this.assemblers.get(key);
    if (assembler) {
      await assembler.abort();
      this.assemblers.delete(key);
    }
  }

  getCheckpoint(transferId: string, fileId: string): ResumeCheckpoint | null {
    return this.resumeManager.getCheckpoint(transferId, fileId);
  }

  saveCheckpoint(checkpoint: ResumeCheckpoint): void {
    this.resumeManager.updateCheckpoint(checkpoint);
  }

  clearCheckpoint(transferId: string, fileId: string): void {
    this.resumeManager.clearCheckpoint(transferId, fileId);
  }

  async verifyFile(file: FileSource, checksum?: string): Promise<boolean> {
    if (!checksum) return true;
    const buffer = generateDeterministicMockBuffer(file.fileId, file.size);
    const computed = await calculateChecksum(buffer);
    return computed.value.toLowerCase() === checksum.toLowerCase();
  }

  async cleanupTransfer(transferId: string): Promise<void> {
    this.stagingArea.removeTransfer(transferId);
    this.resumeManager.clearTransferCheckpoints(transferId);

    // Clean up any remaining open read/write handles for this transfer
    const prefix = `${transferId}:`;
    for (const [k, assembler] of Array.from(this.assemblers.entries())) {
      if (k.startsWith(prefix)) {
        await assembler.abort();
        this.assemblers.delete(k);
      }
    }
  }

  getAssembler(transferId: string, fileId: string): FileAssembler | null {
    return this.assemblers.get(`${transferId}:${fileId}`) ?? null;
  }
}

/**
 * Generates deterministic mock binary data for testing.
 */
function generateDeterministicMockBuffer(seedStr: string, size: number): Uint8Array {
  if (size <= 0) return new Uint8Array(0);
  const buffer = new Uint8Array(size);
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed + seedStr.charCodeAt(i)) % 256;
  }
  for (let i = 0; i < size; i++) {
    buffer[i] = (seed + i) % 256;
  }
  return buffer;
}
