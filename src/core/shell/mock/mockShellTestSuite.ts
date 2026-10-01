/**
 * NearShare Mock Native Shell Test Suite
 *
 * Deterministic test runner validating the 11 core application shell lifecycle
 * and OS service operations.
 */

import { MockNativeShell } from './MockNativeShell';

export interface ShellTestResultItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface ShellTestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  tests: ShellTestResultItem[];
}

export async function runMockShellTestSuite(): Promise<ShellTestSuiteSummary> {
  const startTime = Date.now();
  const tests: ShellTestResultItem[] = [];

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

  // 1. Resolve shell
  await runTest('SH01', 'Resolve Native Shell', () => {
    const shell = new MockNativeShell();
    if (shell.getPlatform() !== 'mock') {
      throw new Error(`Unexpected platform: ${shell.getPlatform()}`);
    }
  });

  // 2. Start shell
  await runTest('SH02', 'Start Shell Lifecycle', async () => {
    const shell = new MockNativeShell();
    await shell.start();
    if (shell.getLifecycleState() !== 'ready') {
      throw new Error(`Expected 'ready', got '${shell.getLifecycleState()}'`);
    }
  });

  // 3. Ready lifecycle
  await runTest('SH03', 'Verify Ready Lifecycle State', () => {
    const shell = new MockNativeShell();
    if (shell.getLifecycleState() !== 'ready') {
      throw new Error(`Expected ready state`);
    }
  });

  // 4. Background lifecycle
  await runTest('SH04', 'Enter Background State', async () => {
    const shell = new MockNativeShell();
    await shell.enterBackground();
    if (shell.getLifecycleState() !== 'background') {
      throw new Error(`Expected 'background', got '${shell.getLifecycleState()}'`);
    }
  });

  // 5. Foreground lifecycle
  await runTest('SH05', 'Enter Foreground State', async () => {
    const shell = new MockNativeShell();
    await shell.enterForeground();
    if (shell.getLifecycleState() !== 'foreground') {
      throw new Error(`Expected 'foreground', got '${shell.getLifecycleState()}'`);
    }
  });

  // 6. Capability reporting
  await runTest('SH06', 'Report Shell Capabilities', () => {
    const shell = new MockNativeShell();
    const caps = shell.getCapabilities();
    if (caps.filesystem !== 'mockOnly' || caps.bluetooth !== 'notImplemented') {
      throw new Error(`Unexpected capabilities: ${JSON.stringify(caps)}`);
    }
  });

  // 7. Notification simulation
  await runTest('SH07', 'Simulate System Notification', async () => {
    const shell = new MockNativeShell();
    await shell.showNotification('Transfer Completed', 'Photo.jpg received successfully');
    const hist = shell.getNotificationHistory();
    if (hist.length !== 1 || hist[0].title !== 'Transfer Completed') {
      throw new Error('Notification not recorded in history');
    }
  });

  // 8. Clipboard simulation
  await runTest('SH08', 'Clipboard Read and Write', async () => {
    const shell = new MockNativeShell();
    await shell.setClipboard('NearShare-PIN-8921');
    const text = await shell.getClipboard();
    if (text !== 'NearShare-PIN-8921') {
      throw new Error(`Clipboard text mismatch: got '${text}'`);
    }
  });

  // 9. External URL simulation
  await runTest('SH09', 'External URL Launch Validation', async () => {
    const shell = new MockNativeShell();
    const valid = await shell.openExternal('https://syntra.nearshare.local');
    if (!valid) throw new Error('Valid URL rejected');
    const invalid = await shell.openExternal('javascript:alert(1)');
    if (invalid) throw new Error('Invalid URL accepted');
  });

  // 10. Stop shell
  await runTest('SH10', 'Stop Shell Lifecycle', async () => {
    const shell = new MockNativeShell();
    await shell.stop();
    if (shell.getLifecycleState() !== 'stopped') {
      throw new Error(`Expected 'stopped', got '${shell.getLifecycleState()}'`);
    }
  });

  // 11. Error handling
  await runTest('SH11', 'Secure Storage Access', async () => {
    const shell = new MockNativeShell();
    await shell.setSecureStorage('device_key_01', 'sec_tok_991823');
    const tok = await shell.getSecureStorage('device_key_01');
    if (tok !== 'sec_tok_991823') {
      throw new Error('Secure storage retrieval failed');
    }
    const missing = await shell.getSecureStorage('missing_key');
    if (missing !== null) {
      throw new Error('Missing key should return null');
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
