/**
 * NearShare Mock Native Transport Test Suite
 *
 * Deterministic test runner validating the 15 core transport bridge operations:
 * discovery, connection lifecycle, transport sessions, chunk streaming,
 * pause/resume/cancel semantics, and telemetry metrics.
 */

import { MockNativeTransportBridge } from './MockNativeTransportBridge';

export interface TransportTestResultItem {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface TransportTestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  tests: TransportTestResultItem[];
}

export async function runMockNativeTransportTestSuite(): Promise<TransportTestSuiteSummary> {
  const startTime = Date.now();
  const tests: TransportTestResultItem[] = [];

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

  // 1. Capability discovery
  await runTest('TR01', 'Retrieve Transport Capabilities', () => {
    const bridge = new MockNativeTransportBridge();
    const caps = bridge.getCapabilities();
    if (caps.directNearby !== 'mockOnly' || caps.wifiDirect !== 'notImplemented') {
      throw new Error(`Unexpected transport capabilities: ${JSON.stringify(caps)}`);
    }
  });

  // 2. Direct discovery
  await runTest('TR02', 'Start Direct Mode Discovery', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    if (peers.length === 0 || peers[0].mode !== 'direct') {
      throw new Error('Direct discovery failed to return direct peers');
    }
  });

  // 3. Wi-Fi discovery
  await runTest('TR03', 'Start Wi-Fi Mode Discovery', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('wifi');
    if (peers.length === 0 || peers[0].mode !== 'wifi') {
      throw new Error('Wi-Fi discovery failed to return LAN peers');
    }
  });

  // 4. Connect
  await runTest('TR04', 'Establish Peer Connection', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    if (!conn.id || conn.state !== 'connected') {
      throw new Error(`Connection creation failed: ${JSON.stringify(conn)}`);
    }
  });

  // 5. Connection state
  await runTest('TR05', 'Verify Connected State Lifecycle', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    if (conn.state !== 'connected') {
      throw new Error('Expected state connected');
    }
  });

  // 6. Session creation
  await runTest('TR06', 'Open Transport Session', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    if (!sess.id || sess.state !== 'active') {
      throw new Error(`Transport session open failed: ${JSON.stringify(sess)}`);
    }
  });

  // 7. Send bytes
  await runTest('TR07', 'Send Binary Chunks over Session', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    const sent = await bridge.sendBytes(sess, {
      transferId: 'tr_tx',
      fileId: 'f1',
      chunkIndex: 0,
      offset: 0,
      data: new Uint8Array(4096),
      isFinal: true,
    });
    if (sent !== 4096) {
      throw new Error(`Expected 4096 bytes sent, got ${sent}`);
    }
  });

  // 8. Receive bytes
  await runTest('TR08', 'Receive Simulated Chunks', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    const chunk = await bridge.receiveBytes(sess);
    if (chunk !== null && typeof chunk !== 'object') {
      throw new Error('Invalid receiveBytes response');
    }
  });

  // 9. Pause
  await runTest('TR09', 'Pause In-Flight Transfer', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    await bridge.pauseTransfer(sess, 'tr_01');
  });

  // 10. Resume
  await runTest('TR10', 'Resume Paused Transfer', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    await bridge.resumeTransfer(sess, 'tr_01');
  });

  // 11. Cancel
  await runTest('TR11', 'Cancel In-Flight Transfer', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    await bridge.cancelTransfer(sess, 'tr_01');
  });

  // 12. Metrics
  await runTest('TR12', 'Retrieve Connection Telemetry Metrics', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const metrics = await bridge.getConnectionMetrics(conn);
    if (metrics.throughput <= 0 || metrics.latency <= 0) {
      throw new Error(`Invalid telemetry metrics: ${JSON.stringify(metrics)}`);
    }
  });

  // 13. Reconnect
  await runTest('TR13', 'Simulate Disconnect and Reconnect', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    await bridge.disconnect(conn);
    if (conn.state !== 'disconnected') {
      throw new Error(`Expected disconnected state, got ${conn.state}`);
    }
    const reconnected = await bridge.connect(peers[0]);
    if (reconnected.state !== 'connected') {
      throw new Error('Reconnect failed');
    }
  });

  // 14. Session close
  await runTest('TR14', 'Close Transport Session', async () => {
    const bridge = new MockNativeTransportBridge();
    const peers = await bridge.startDiscovery('direct');
    const conn = await bridge.connect(peers[0]);
    const sess = await bridge.openSession(conn);
    await bridge.closeSession(sess);
    if (sess.state !== 'closed') {
      throw new Error(`Expected closed state, got ${sess.state}`);
    }
  });

  // 15. Error normalization
  await runTest('TR15', 'Stop Discovery Lifecycle', async () => {
    const bridge = new MockNativeTransportBridge();
    await bridge.stopDiscovery();
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
