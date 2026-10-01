/**
 * NearShare Mock Filesystem Test Suite
 *
 * Deterministic test runner validating the 17 core filesystem adapter scenarios:
 * metadata, chunk streaming, zero-byte handling, writing, out-of-order writes,
 * duplicate handling, folder scans, path traversal rejections, destination resolution,
 * finalization, and staging cleanup.
 */

import { MockFileSystemAdapter } from './MockFileSystemAdapter';
import { FileStreamReader } from '../FileStreamReader';
import { FileStreamWriter } from '../FileStreamWriter';
import { FolderScanner } from '../FolderScanner';
import { isSafeRelativePath, normalizeSafeRelativePath } from '../PathSafety';
import type { FileReference, DestinationLocation, FileMetadata } from '../types';

export interface FsTestResultItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface FsTestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  tests: FsTestResultItem[];
}

export async function runMockFileSystemTestSuite(): Promise<FsTestSuiteSummary> {
  const startTime = Date.now();
  const tests: FsTestResultItem[] = [];

  const runTest = async (
    id: string,
    name: string,
    testFn: () => Promise<void> | void
  ) => {
    const t0 = Date.now();
    try {
      await testFn();
      tests.push({
        id,
        name,
        passed: true,
        message: 'Passed',
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      tests.push({
        id,
        name,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      });
    }
  };

  const defaultDestination: DestinationLocation = {
    id: 'dest_dl',
    name: 'Downloads',
    kind: 'downloads',
  };

  // 1. Read metadata
  await runTest('FS01', 'Read Metadata', async () => {
    const adapter = new MockFileSystemAdapter();
    const ref: FileReference = { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file' };
    const meta = await adapter.getFileMetadata(ref);
    if (meta.name !== 'photo.jpg' || meta.size <= 0) {
      throw new Error(`Invalid metadata returned: ${JSON.stringify(meta)}`);
    }
  });

  // 2. Read first chunk
  await runTest('FS02', 'Read First Chunk', async () => {
    const adapter = new MockFileSystemAdapter();
    const ref: FileReference = { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file' };
    const reader = new FileStreamReader(ref, adapter);
    await reader.open();
    const chunk0 = await reader.readChunk(0, 'tr_fs02', 1048576); // 1 MiB chunk
    if (chunk0.chunkIndex !== 0 || chunk0.offset !== 0 || chunk0.length !== 1048576) {
      throw new Error(`Chunk 0 bounds mismatch: offset=${chunk0.offset}, len=${chunk0.length}`);
    }
    await reader.close();
  });

  // 3. Read final partial chunk
  await runTest('FS03', 'Read Final Partial Chunk', async () => {
    const adapter = new MockFileSystemAdapter();
    const ref: FileReference = { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file' }; // 2,516,582 bytes
    const reader = new FileStreamReader(ref, adapter);
    await reader.open();
    const chunkSize = 1048576; // 1 MiB -> chunk 0 (1MB), chunk 1 (1MB), chunk 2 (420,582 B)
    const lastChunk = await reader.readChunk(2, 'tr_fs03', chunkSize);
    if (lastChunk.length !== 2516582 - 2097152) {
      throw new Error(`Expected last chunk length ${2516582 - 2097152}, got ${lastChunk.length}`);
    }
    await reader.close();
  });

  // 4. Zero-byte file
  await runTest('FS04', 'Zero-Byte File Handling', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = {
      name: 'empty.txt',
      kind: 'file',
      size: 0,
      relativePath: 'empty.txt',
    };
    const ref = await adapter.createFile(defaultDestination, meta);
    const finalized = await adapter.finalizeFile(ref);
    if (finalized.size !== 0) throw new Error('Zero-byte file size mismatch on finalization');
  });

  // 5. Create destination
  await runTest('FS05', 'Create Destination File', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = {
      name: 'report.pdf',
      kind: 'file',
      size: 4096,
      relativePath: 'Documents/report.pdf',
    };
    const ref = await adapter.createFile(defaultDestination, meta);
    if (!ref.id || ref.name !== 'report.pdf') {
      throw new Error('CreateFile failed to return valid FileReference');
    }
  });

  // 6. Write chunk
  await runTest('FS06', 'Write Chunk Sequentially', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = {
      name: 'notes.txt',
      kind: 'file',
      size: 100,
      relativePath: 'notes.txt',
    };
    const writer = new FileStreamWriter(defaultDestination, meta, adapter);
    await writer.open();
    const data = new TextEncoder().encode('Hello NearShare Native Adapter');
    const res = await writer.writeChunk({
      transferId: 'tr_w1',
      fileId: 'f1',
      chunkIndex: 0,
      offset: 0,
      length: data.length,
      totalChunks: 1,
      data,
    });
    if (res.status !== 'written' || res.bytesWritten !== data.length) {
      throw new Error(`WriteChunk failed with status: ${res.status}`);
    }
  });

  // 7. Out-of-order writes
  await runTest('FS07', 'Out-of-Order Chunk Writes', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = {
      name: 'data.bin',
      kind: 'file',
      size: 300,
      relativePath: 'data.bin',
    };
    const writer = new FileStreamWriter(defaultDestination, meta, adapter);
    await writer.open();

    const d1 = new Uint8Array(100);
    const d0 = new Uint8Array(100);
    const d2 = new Uint8Array(100);

    // Write chunk 1, then chunk 0, then chunk 2
    await writer.writeChunk({ transferId: 'tr_ooo', fileId: 'f_ooo', chunkIndex: 1, offset: 100, length: 100, totalChunks: 3, data: d1 });
    await writer.writeChunk({ transferId: 'tr_ooo', fileId: 'f_ooo', chunkIndex: 0, offset: 0, length: 100, totalChunks: 3, data: d0 });
    await writer.writeChunk({ transferId: 'tr_ooo', fileId: 'f_ooo', chunkIndex: 2, offset: 200, length: 100, totalChunks: 3, data: d2 });

    const finalMeta = await writer.finalize();
    if (finalMeta.size !== 300) throw new Error('Out-of-order finalization size mismatch');
  });

  // 8. Duplicate write
  await runTest('FS08', 'Duplicate Chunk Write Idempotency', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = { name: 'dup.txt', kind: 'file', size: 100, relativePath: 'dup.txt' };
    const writer = new FileStreamWriter(defaultDestination, meta, adapter);
    await writer.open();
    const chunkData = new Uint8Array(100);

    const first = await writer.writeChunk({ transferId: 'tr_dup', fileId: 'f_dup', chunkIndex: 0, offset: 0, length: 100, totalChunks: 1, data: chunkData });
    if (first.status !== 'written') throw new Error('Initial write expected to succeed');

    const second = await writer.writeChunk({ transferId: 'tr_dup', fileId: 'f_dup', chunkIndex: 0, offset: 0, length: 100, totalChunks: 1, data: chunkData });
    if (second.status !== 'duplicate') throw new Error(`Expected 'duplicate' status, got '${second.status}'`);
  });

  // 9. Folder scan
  await runTest('FS09', 'Folder Hierarchy Scan', async () => {
    const adapter = new MockFileSystemAdapter();
    const scanner = new FolderScanner(adapter);
    const folderRef: FileReference = { id: 'fs_seed_06', name: 'project', kind: 'folder' };
    const entries = await scanner.scanFolder(folderRef);
    if (entries.length < 3) {
      throw new Error(`Expected at least 3 folder entries, found ${entries.length}`);
    }
  });

  // 10. Relative path preservation
  await runTest('FS10', 'Relative Path Preservation', async () => {
    const p1 = 'Project/src/App.tsx';
    if (!isSafeRelativePath(p1)) throw new Error('Expected safe relative path');
    const normalized = normalizeSafeRelativePath(p1);
    if (normalized !== 'Project/src/App.tsx') throw new Error(`Normalization error: ${normalized}`);
  });

  // 11. Path traversal rejection
  await runTest('FS11', 'Path Traversal Rejection (../)', async () => {
    if (isSafeRelativePath('../etc/passwd')) throw new Error('Failed to reject ../ path traversal');
    if (isSafeRelativePath('foo/../../bar')) throw new Error('Failed to reject embedded traversal');
  });

  // 12. Absolute path rejection
  await runTest('FS12', 'Absolute Path Rejection', async () => {
    if (isSafeRelativePath('/Users/hemanth/Documents')) throw new Error('Failed to reject POSIX root /');
    if (isSafeRelativePath('C:\\Windows\\System32')) throw new Error('Failed to reject Windows drive letter');
    if (isSafeRelativePath('\\\\server\\share\\file')) throw new Error('Failed to reject UNC network path');
  });

  // 13. Missing reference
  await runTest('FS13', 'Missing Reference Detection', async () => {
    const adapter = new MockFileSystemAdapter();
    const badRef: FileReference = { id: 'fs_non_existent_999', name: 'ghost.png', kind: 'file' };
    let threw = false;
    try {
      await adapter.getFileMetadata(badRef);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected exception when accessing non-existent reference');
  });

  // 14. Permission error simulation
  await runTest('FS14', 'Unsupported Operation Guard', async () => {
    const adapter = new MockFileSystemAdapter();
    const folderRef: FileReference = { id: 'fs_seed_06', name: 'project', kind: 'folder' };
    let threw = false;
    try {
      await adapter.read(folderRef, 0, 100);
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected error reading binary bytes directly from folder');
  });

  // 15. Destination resolution
  await runTest('FS15', 'Destination Resolution', async () => {
    const adapter = new MockFileSystemAdapter();
    const resolved = await adapter.resolveDestination(defaultDestination);
    if (!resolved.pathDescriptor?.includes('Downloads')) {
      throw new Error(`Destination descriptor mismatch: ${resolved.pathDescriptor}`);
    }
  });

  // 16. Finalization
  await runTest('FS16', 'Atomic File Finalization', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = { name: 'archive.tar', kind: 'file', size: 500, relativePath: 'archive.tar' };
    const ref = await adapter.createFile(defaultDestination, meta);
    await adapter.write(ref, 0, new Uint8Array(500));
    const fin = await adapter.finalizeFile(ref);
    if (fin.size !== 500) throw new Error('Finalization byte size mismatch');
    const exists = await adapter.exists(ref);
    if (!exists) throw new Error('Finalized file not found in storage');
  });

  // 17. Temporary cleanup
  await runTest('FS17', 'Temporary File Cleanup', async () => {
    const adapter = new MockFileSystemAdapter();
    const meta: FileMetadata = { name: 'abandoned.tmp', kind: 'file', size: 100, relativePath: 'abandoned.tmp' };
    const ref = await adapter.createFile(defaultDestination, meta);
    await adapter.deleteTemporary(ref);
    const exists = await adapter.exists(ref);
    if (exists) throw new Error('Temporary file was not deleted');
  });

  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  return {
    total: tests.length,
    passed,
    failed,
    durationMs: Date.now() - startTime,
    tests,
  };
}
