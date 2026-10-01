/**
 * NearShare Mock File Engine Test Suite
 *
 * Deterministic test runner and verification suite for validating chunk math,
 * edge cases (0-byte, 1-byte, exact boundaries), out-of-order assembly,
 * duplicate handling, checkpointing, resume, and staging cleanup.
 */

import { MockFileEngine } from './MockFileEngine';
import { ChunkManager } from '../ChunkManager';
import { ResumeManager } from '../ResumeManager';
import { DEFAULT_CHUNK_SIZE } from '../../protocol/messageTypes';
import type { FileSource, FileChunk } from '../types';

export interface TestResultItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResultItem[];
}

export async function runMockFileTestSuite(): Promise<TestSuiteSummary> {
  const startTime = Date.now();
  const results: TestResultItem[] = [];

  const runTest = async (
    id: string,
    name: string,
    testFn: () => Promise<void> | void
  ) => {
    const t0 = Date.now();
    try {
      await testFn();
      results.push({
        id,
        name,
        passed: true,
        message: 'Passed successfully',
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      results.push({
        id,
        name,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      });
    }
  };

  const chunkManager = new ChunkManager(DEFAULT_CHUNK_SIZE);

  // 1. 0-byte file test
  await runTest('T01', '0-Byte File Handling', async () => {
    const count = chunkManager.calculateChunkCount(0);
    if (count !== 0) throw new Error(`Expected 0 chunks for 0-byte file, got ${count}`);

    const engine = new MockFileEngine();
    const source: FileSource = { fileId: 'f0', name: 'empty.txt', size: 0, type: 'text' };
    const writeHandle = await engine.createWrite('tr_0', source);
    const finalize = await engine.finalizeWrite(writeHandle);
    if (finalize.bytesProcessed !== 0) throw new Error('Expected 0 bytes processed for 0-byte file');
  });

  // 2. 1-byte file test
  await runTest('T02', '1-Byte File Handling', async () => {
    const count = chunkManager.calculateChunkCount(1);
    if (count !== 1) throw new Error(`Expected 1 chunk for 1-byte file, got ${count}`);

    const len = chunkManager.getChunkLength(1, 0);
    if (len !== 1) throw new Error(`Expected chunk length 1, got ${len}`);
  });

  // 3. 4 MiB exact chunk boundary
  await runTest('T03', '4 MiB Exact Chunk Boundary', async () => {
    const size = DEFAULT_CHUNK_SIZE; // 4,194,304 bytes
    const count = chunkManager.calculateChunkCount(size);
    if (count !== 1) throw new Error(`Expected 1 chunk for exact 4 MiB, got ${count}`);

    const len = chunkManager.getChunkLength(size, 0);
    if (len !== DEFAULT_CHUNK_SIZE) throw new Error(`Expected chunk length ${DEFAULT_CHUNK_SIZE}, got ${len}`);
  });

  // 4. 4 MiB + 1 byte boundary
  await runTest('T04', '4 MiB + 1 Byte Chunk Boundary', async () => {
    const size = DEFAULT_CHUNK_SIZE + 1;
    const count = chunkManager.calculateChunkCount(size);
    if (count !== 2) throw new Error(`Expected 2 chunks for 4 MiB + 1 byte, got ${count}`);

    const len0 = chunkManager.getChunkLength(size, 0);
    const len1 = chunkManager.getChunkLength(size, 1);
    if (len0 !== DEFAULT_CHUNK_SIZE) throw new Error(`Expected chunk 0 length ${DEFAULT_CHUNK_SIZE}, got ${len0}`);
    if (len1 !== 1) throw new Error(`Expected chunk 1 length 1, got ${len1}`);
  });

  // 5. Large multi-chunk file (12 MiB = 3 chunks)
  await runTest('T05', 'Large Multi-Chunk File Simulation', async () => {
    const size = DEFAULT_CHUNK_SIZE * 3;
    const count = chunkManager.calculateChunkCount(size);
    if (count !== 3) throw new Error(`Expected 3 chunks for 12 MiB, got ${count}`);

    const engine = new MockFileEngine();
    const source: FileSource = { fileId: 'f_large', name: 'movie.mp4', size, type: 'video' };
    const readHandle = await engine.openRead(source);
    const writeHandle = await engine.createWrite('tr_large', source);

    for (let i = 0; i < count; i++) {
      const chunk = await engine.readChunk(readHandle, i, 'tr_large');
      const writeStatus = await engine.writeChunk(writeHandle, chunk);
      if (writeStatus.status !== 'accepted') {
        throw new Error(`Chunk ${i} rejected with status: ${writeStatus.status}`);
      }
    }

    const finalResult = await engine.finalizeWrite(writeHandle);
    if (!finalResult.verified) throw new Error('Large file finalization failed integrity check');
    await engine.closeRead(readHandle);
  });

  // 6. Duplicate chunk detection
  await runTest('T06', 'Duplicate Chunk Rejection & Idempotency', async () => {
    const engine = new MockFileEngine();
    const source: FileSource = { fileId: 'f_dup', name: 'report.pdf', size: 1024, type: 'pdf' };
    const readHandle = await engine.openRead(source);
    const writeHandle = await engine.createWrite('tr_dup', source);

    const chunk = await engine.readChunk(readHandle, 0, 'tr_dup');
    const firstWrite = await engine.writeChunk(writeHandle, chunk);
    if (firstWrite.status !== 'accepted') throw new Error('First chunk write should be accepted');

    const secondWrite = await engine.writeChunk(writeHandle, chunk);
    if (secondWrite.status !== 'duplicate') {
      throw new Error(`Duplicate chunk should return 'duplicate' status, got '${secondWrite.status}'`);
    }

    await engine.closeRead(readHandle);
  });

  // 7. Missing chunk calculation
  await runTest('T07', 'Missing Chunk Calculation via ResumeManager', async () => {
    const resumeManager = new ResumeManager();
    const missing = resumeManager.getMissingChunks(5, [0, 1, 3]);
    if (missing.length !== 2 || missing[0] !== 2 || missing[1] !== 4) {
      throw new Error(`Expected missing chunks [2, 4], got [${missing.join(', ')}]`);
    }
  });

  // 8. Out-of-order chunk assembly
  await runTest('T08', 'Out-of-Order Chunk Assembly', async () => {
    const size = 3000;
    const customChunkSize = 1000;
    const engine = new MockFileEngine(customChunkSize);
    const source: FileSource = { fileId: 'f_ooo', name: 'data.bin', size, type: 'bin' };

    const readHandle = await engine.openRead(source);
    const writeHandle = await engine.createWrite('tr_ooo', source);

    const c0 = await engine.readChunk(readHandle, 0, 'tr_ooo', customChunkSize);
    const c1 = await engine.readChunk(readHandle, 1, 'tr_ooo', customChunkSize);
    const c2 = await engine.readChunk(readHandle, 2, 'tr_ooo', customChunkSize);

    // Write in out-of-order sequence: chunk 1, then chunk 0, then chunk 2
    await engine.writeChunk(writeHandle, c1);
    await engine.writeChunk(writeHandle, c0);
    await engine.writeChunk(writeHandle, c2);

    const finalResult = await engine.finalizeWrite(writeHandle);
    if (!finalResult.verified) throw new Error('Out-of-order assembly failed integrity check');
    await engine.closeRead(readHandle);
  });

  // 9. Resume checkpoint verification
  await runTest('T09', 'Resume Checkpoint Tracking', async () => {
    const resumeManager = new ResumeManager();
    const cp = resumeManager.createCheckpoint('tr_res', 'f_res', 42, 176160768);
    if (cp.nextChunkIndex !== 42) throw new Error('Checkpoint nextChunkIndex mismatch');

    const fetched = resumeManager.getCheckpoint('tr_res', 'f_res');
    if (!fetched || fetched.bytesReceived !== 176160768) {
      throw new Error('Checkpoint retrieval mismatch');
    }
  });

  // 10. Transfer staging cleanup
  await runTest('T10', 'Transfer Staging & Memory Cleanup', async () => {
    const engine = new MockFileEngine();
    const source: FileSource = { fileId: 'f_clean', name: 'temp.dat', size: 500, type: 'dat' };
    await engine.createWrite('tr_clean', source);
    await engine.cleanupTransfer('tr_clean');

    const cp = engine.getCheckpoint('tr_clean', 'f_clean');
    if (cp !== null) throw new Error('Checkpoint was not cleared after cleanupTransfer');
  });

  // 11. Invalid chunk boundary validation
  await runTest('T11', 'Invalid Chunk Boundary Detection', async () => {
    const badChunk: FileChunk = {
      transferId: 'tr_bad',
      fileId: 'f_bad',
      chunkIndex: 5,
      offset: 5000,
      length: 2000,
      totalChunks: 2, // chunkIndex >= totalChunks
      data: new Uint8Array(2000),
    };

    const val = chunkManager.validateChunk(badChunk, 2000);
    if (val.valid) throw new Error('Invalid chunk was unexpectedly marked valid');
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    durationMs: Date.now() - startTime,
    results,
  };
}
