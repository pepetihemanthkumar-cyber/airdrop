/**
 * NearShare Mock Native Bridge Test Suite
 *
 * Deterministic test runner validating the 17 core NativeBridge operations:
 * platform resolution, capabilities, permissions, pickers, file/folder I/O,
 * destination resolution, error normalization, and availability checks.
 */

import { MockNativeBridge } from './MockNativeBridge';
import { createNativeError, NativeException } from '../NativeError';
import type { FileReference, DestinationLocation, FileMetadata } from '../../filesystem/types';

export interface BridgeTestResultItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface BridgeTestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  tests: BridgeTestResultItem[];
}

export async function runMockNativeBridgeTestSuite(): Promise<BridgeTestSuiteSummary> {
  const startTime = Date.now();
  const tests: BridgeTestResultItem[] = [];

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

  // 1. Resolve mock platform
  await runTest('NB01', 'Resolve Platform Target', () => {
    const bridge = new MockNativeBridge();
    const platform = bridge.getPlatform();
    if (!platform || (platform !== 'web' && platform !== 'unknown')) {
      throw new Error(`Unexpected platform: ${platform}`);
    }
  });

  // 2. Get capabilities
  await runTest('NB02', 'Retrieve Bridge Capabilities', () => {
    const bridge = new MockNativeBridge();
    const caps = bridge.getCapabilities();
    if (caps.filesystem !== 'mockOnly' || caps.bluetooth !== 'notImplemented') {
      throw new Error(`Unexpected capabilities: ${JSON.stringify(caps)}`);
    }
  });

  // 3. Request permission
  await runTest('NB03', 'Request Runtime Permission', async () => {
    const bridge = new MockNativeBridge();
    const perm = await bridge.requestPermission('fileAccess');
    if (!perm.granted || perm.state !== 'granted') {
      throw new Error(`Permission grant failed: ${JSON.stringify(perm)}`);
    }
  });

  // 4. Pick file
  await runTest('NB04', 'Simulate Native File Picker', async () => {
    const bridge = new MockNativeBridge();
    const picker = await bridge.pickFiles({ multiple: true });
    if (picker.cancelled || picker.references.length === 0) {
      throw new Error('File picker did not return simulated references');
    }
  });

  // 5. Pick folder
  await runTest('NB05', 'Simulate Native Directory Picker', async () => {
    const bridge = new MockNativeBridge();
    const picker = await bridge.pickFolder();
    if (picker.cancelled || picker.references.length === 0 || picker.references[0].kind !== 'folder') {
      throw new Error('Folder picker did not return directory reference');
    }
  });

  // 6. Read metadata
  await runTest('NB06', 'Read File Metadata via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const ref: FileReference = { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file' };
    const meta = await bridge.getFileMetadata(ref);
    if (meta.name !== 'photo.jpg' || meta.size <= 0) {
      throw new Error(`Invalid metadata: ${JSON.stringify(meta)}`);
    }
  });

  // 7. Read chunk
  await runTest('NB07', 'Read Binary Chunk via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const ref: FileReference = { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file' };
    const data = await bridge.readFile(ref, 0, 1024);
    if (data.byteLength !== 1024) {
      throw new Error(`Expected 1024 bytes read, got ${data.byteLength}`);
    }
  });

  // 8. Create file
  await runTest('NB08', 'Create Destination File via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const meta: FileMetadata = { name: 'sample.txt', kind: 'file', size: 100, relativePath: 'sample.txt' };
    const ref = await bridge.createFile(defaultDestination, meta);
    if (!ref.id || ref.name !== 'sample.txt') {
      throw new Error('CreateFile failed to return valid reference');
    }
  });

  // 9. Write chunk
  await runTest('NB09', 'Write Binary Chunk via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const meta: FileMetadata = { name: 'sample.txt', kind: 'file', size: 100, relativePath: 'sample.txt' };
    const ref = await bridge.createFile(defaultDestination, meta);
    const written = await bridge.writeFile(ref, 0, new Uint8Array(100));
    if (written !== 100) {
      throw new Error(`Expected 100 bytes written, got ${written}`);
    }
  });

  // 10. Finalize file
  await runTest('NB10', 'Finalize File via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const meta: FileMetadata = { name: 'final.bin', kind: 'file', size: 200, relativePath: 'final.bin' };
    const ref = await bridge.createFile(defaultDestination, meta);
    await bridge.writeFile(ref, 0, new Uint8Array(200));
    const finalized = await bridge.finalizeFile(ref);
    if (finalized.size !== 200) {
      throw new Error('Finalized metadata size mismatch');
    }
  });

  // 11. Scan folder
  await runTest('NB11', 'Scan Folder via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const ref: FileReference = { id: 'fs_seed_06', name: 'project', kind: 'folder' };
    const entries = await bridge.scanDirectory(ref);
    if (entries.length < 3) {
      throw new Error(`Expected at least 3 entries in project folder, got ${entries.length}`);
    }
  });

  // 12. Resolve destination
  await runTest('NB12', 'Resolve Destination Descriptor', async () => {
    const bridge = new MockNativeBridge();
    const resolved = await bridge.resolveDestination(defaultDestination);
    if (!resolved.pathDescriptor) {
      throw new Error('Resolved destination missing pathDescriptor');
    }
  });

  // 13. Delete temporary reference
  await runTest('NB13', 'Delete Temporary File via Bridge', async () => {
    const bridge = new MockNativeBridge();
    const meta: FileMetadata = { name: 'temp.tmp', kind: 'file', size: 50, relativePath: 'temp.tmp' };
    const ref = await bridge.createFile(defaultDestination, meta);
    await bridge.deleteTemporary(ref);
  });

  // 14. Release reference
  await runTest('NB14', 'Release Reference Handle', async () => {
    const bridge = new MockNativeBridge();
    const ref: FileReference = { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file' };
    await bridge.releaseReference(ref);
  });

  // 15. Error normalization
  await runTest('NB15', 'Native Error Normalization', () => {
    const err = createNativeError('PERMISSION_DENIED', 'Access Denied to Protected Folder', {
      operation: 'readFile',
      retryable: false,
      recoverable: true,
    });
    if (err.code !== 'PERMISSION_DENIED' || !err.recoverable) {
      throw new Error(`Error normalization mismatch: ${JSON.stringify(err)}`);
    }
  });

  // 16. Unknown operation / exception handling
  await runTest('NB16', 'Native Exception Propagation', () => {
    const exc = new NativeException(createNativeError('UNSUPPORTED', 'Direct Bluetooth not supported on this target'));
    if (!exc.message.includes('Direct Bluetooth')) {
      throw new Error('NativeException message formatting error');
    }
  });

  // 17. Bridge availability
  await runTest('NB17', 'Bridge Availability Verification', () => {
    const bridge = new MockNativeBridge();
    if (!bridge.isAvailable()) {
      throw new Error('Mock bridge expected to report available');
    }
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
