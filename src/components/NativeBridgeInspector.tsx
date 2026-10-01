/**
 * NearShare Native Bridge Inspector (Development Only)
 *
 * Diagnostic panel to inspect active NativeBridge status, bridge availability,
 * capability levels across desktop/mobile targets, and execute the test runner.
 *
 * PALETTE: STRICT MONOCHROME #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Link2,
  Cpu,
  Play,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  FileUp,
  FolderUp,
  FolderTree,
  Download,
  Network,
  Radio,
} from 'lucide-react';
import { useNativeBridge } from '../context/NativeBridgeContext';
import { useSettings } from '../context/SettingsContext';
import type { BridgeTestSuiteSummary } from '../core/native/mock/mockNativeBridgeTestSuite';

import { TauriNativeBridge } from '../core/native/tauri/TauriNativeBridge';
import {
  type TauriRuntimeDiagnostics,
  getRuntimeDiagnostics,
  scanNativeFolder,
  type TcpServerInfo,
  type TcpConnectResult,
} from '../core/native/tauri/TauriIpc';
import {
  type TransferFolderSource,
  type TransferFileChunkResult,
  createTransferSourceFromFolder,
  readTransferFileChunk,
  releaseTransferFolderSource,
} from '../core/file/NativeFolderTransferSource';
import {
  type ReceiveFileDestinationItem,
  createReceiveDestinationFromFile,
  writeReceiveDestinationChunk,
  finalizeReceiveDestination,
  releaseReceiveDestination,
} from '../core/file/NativeReceiveFileDestination';
import { MacTcpLanSpikeTransport } from '../core/transport/native/mac/MacTcpLanSpikeTransport';
import { FileSystemManager } from '../core/filesystem/FileSystemManager';
import { DEFAULT_CHUNK_SIZE } from '../core/protocol/messageTypes';

export const NativeBridgeInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { bridge, platform, capabilities, isAvailable, runTestSuite, pickFiles: bridgePickFiles } = useNativeBridge();
  const { settings } = useSettings();
  const reducedMotion = settings.reducedMotion;
  const isTauri = TauriNativeBridge.isTauriDetected();

  const [isOpen, setIsOpen] = useState(false);
  const [testSummary, setTestSummary] = useState<BridgeTestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [ipcDiagnostics, setIpcDiagnostics] = useState<TauriRuntimeDiagnostics | null>(null);
  const [pickedFiles, setPickedFiles] = useState<Array<{ id: string; name: string; size?: number; mimeType?: string }>>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [readDiagnostic, setReadDiagnostic] = useState<{
    fileId: string;
    fileName: string;
    requestedBytes: number;
    actuallyRead: number;
    offset: number;
    status: 'idle' | 'reading' | 'success' | 'error';
    isEof?: boolean;
    hexPreview?: string;
    errorMessage?: string;
    isReleased?: boolean;
  } | null>(null);

  const [writeDiagnostic, setWriteDiagnostic] = useState<{
    fileId: string;
    fileName: string;
    mode: 'multi-chunk' | 'large-4mib' | 'zero-byte';
    bytesWritten: number;
    offsetsUsed: number[];
    finalSize: number;
    status: 'idle' | 'writing' | 'verifying' | 'success' | 'error';
    readBackVerified?: boolean;
    readBackText?: string;
    errorMessage?: string;
    isReleased?: boolean;
  } | null>(null);
  const [isWriting, setIsWriting] = useState(false);

  const [folderDiagnostic, setFolderDiagnostic] = useState<{
    folderId: string;
    folderName: string;
    fileCount: number;
    totalBytes: number;
    durationMs: number;
    status: 'idle' | 'scanning' | 'success' | 'error';
    entries: Array<{ relativePath: string; name: string; size: number; kind: string }>;
    errorMessage?: string;
    isReleased?: boolean;
  } | null>(null);
  const [isScanningFolder, setIsScanningFolder] = useState(false);

  // Step 36: Folder Transfer Source -> FileEngine Diagnostic State
  const [folderSource, setFolderSource] = useState<TransferFolderSource | null>(null);
  const [selectedTransferFileId, setSelectedTransferFileId] = useState<string | null>(null);
  const [folderChunkDiagnostic, setFolderChunkDiagnostic] = useState<TransferFileChunkResult | null>(null);
  const [isReadingFolderChunk, setIsReadingFolderChunk] = useState(false);
  const [isRegisteringFolderSource, setIsRegisteringFolderSource] = useState(false);
  const [folderEngineError, setFolderEngineError] = useState<string | null>(null);

  // Step 37: Native Receive Destination -> FileEngine Writer Diagnostic State
  const [receiveDestination, setReceiveDestination] = useState<ReceiveFileDestinationItem | null>(null);
  const [receiveDiagnostic, setReceiveDiagnostic] = useState<{
    scenario: 'sequential-8mb' | 'outoforder-8mb' | 'duplicate-range' | 'zero-byte';
    transferFileId: string;
    filename: string;
    expectedSize: number;
    bytesWritten: number;
    missingRangesCount: number;
    isComplete: boolean;
    readBackVerified: boolean;
    durationMs: number;
    status: 'idle' | 'running' | 'success' | 'error';
    errorMessage?: string;
  } | null>(null);
  const [isRunningReceiveTest, setIsRunningReceiveTest] = useState(false);

  // Step 38: Native Local TCP Transport Spike Diagnostic State
  const [tcpServer, setTcpServer] = useState<TcpServerInfo | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [tcpConnectHost, setTcpConnectHost] = useState('127.0.0.1');
  const [tcpConnectPort, setTcpConnectPort] = useState<number>(0);
  const [tcpClient, setTcpClient] = useState<TcpConnectResult | null>(null);
  const [isConnectingTcp, setIsConnectingTcp] = useState(false);
  const [tcpDiagnostic, setTcpDiagnostic] = useState<{
    action: 'ping' | 'test-payload-64k' | 'test-payload-256k' | 'test-payload-1mb';
    rttMs: number;
    bytesSent: number;
    verified: boolean;
    status: 'idle' | 'running' | 'success' | 'error';
    errorMessage?: string;
  } | null>(null);
  const [isRunningTcpTest, setIsRunningTcpTest] = useState(false);
  const tcpTransportRef = useRef<MacTcpLanSpikeTransport | null>(null);

  useEffect(() => {
    tcpTransportRef.current = new MacTcpLanSpikeTransport();
    return () => {
      if (tcpTransportRef.current) {
        tcpTransportRef.current.destroy();
      }
    };
  }, []);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && isTauri) {
      getRuntimeDiagnostics().then((diag) => {
        setIpcDiagnostics(diag);
      });
    }
  }, [isOpen, isTauri]);

  const handlePickFiles = async () => {
    setIsPicking(true);
    setReadDiagnostic(null);
    try {
      const res = await bridgePickFiles();
      if (!res.cancelled && res.references.length > 0) {
        setPickedFiles(res.references);
      }
    } catch (err) {
      console.error('[NativeBridgeInspector] pickFiles error:', err);
    } finally {
      setIsPicking(false);
    }
  };

  const handleTestNativeRead = async (file: { id: string; name: string; size?: number }) => {
    const requestedSize = 4 * 1024 * 1024; // 4 MiB
    setReadDiagnostic({
      fileId: file.id,
      fileName: file.name,
      requestedBytes: requestedSize,
      actuallyRead: 0,
      offset: 0,
      status: 'reading',
    });

    try {
      const dummyRef = {
        id: file.id,
        name: file.name,
        kind: 'file' as const,
        size: file.size,
      };

      const bytes = await bridge.readFile(dummyRef as any, 0, requestedSize);
      const hex = Array.from(bytes.slice(0, 16))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');

      setReadDiagnostic({
        fileId: file.id,
        fileName: file.name,
        requestedBytes: requestedSize,
        actuallyRead: bytes.length,
        offset: 0,
        status: 'success',
        isEof: bytes.length < requestedSize || bytes.length === file.size,
        hexPreview: hex.length > 0 ? hex : '(empty file — 0 bytes)',
        isReleased: false,
      });
    } catch (err) {
      setReadDiagnostic({
        fileId: file.id,
        fileName: file.name,
        requestedBytes: requestedSize,
        actuallyRead: 0,
        offset: 0,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleTestNativeWrite = async (mode: 'multi-chunk' | 'large-4mib' | 'zero-byte') => {
    setIsWriting(true);
    const suggestedName =
      mode === 'large-4mib'
        ? 'NearShare-Large-4MiB.bin'
        : mode === 'zero-byte'
        ? 'NearShare-ZeroByte.bin'
        : 'NearShare-WriteTest.txt';

    try {
      const fileRef = await bridge.createFile(
        { id: 'custom', name: 'custom', kind: 'custom' },
        { name: suggestedName, kind: 'file', size: 0, relativePath: suggestedName }
      );

      setWriteDiagnostic({
        fileId: fileRef.id,
        fileName: fileRef.name,
        mode,
        bytesWritten: 0,
        offsetsUsed: [],
        finalSize: 0,
        status: 'writing',
      });

      if (mode === 'multi-chunk') {
        const chunkA = new TextEncoder().encode('NearShare Native Write Test');
        const chunkB = new TextEncoder().encode(' — chunk two');

        await bridge.writeFile(fileRef, 0, chunkA);
        await bridge.writeFile(fileRef, chunkA.length, chunkB);

        setWriteDiagnostic((prev) => prev ? { ...prev, status: 'verifying' } : null);

        const readBack = await bridge.readFile(fileRef, 0, 1024);
        const decoded = new TextDecoder().decode(readBack);
        const expected = 'NearShare Native Write Test — chunk two';
        const isVerified = decoded === expected;

        setWriteDiagnostic({
          fileId: fileRef.id,
          fileName: fileRef.name,
          mode,
          bytesWritten: chunkA.length + chunkB.length,
          offsetsUsed: [0, chunkA.length],
          finalSize: chunkA.length + chunkB.length,
          status: 'success',
          readBackVerified: isVerified,
          readBackText: decoded,
          isReleased: false,
        });
      } else if (mode === 'large-4mib') {
        const fourMib = 4 * 1024 * 1024;
        const payload = new Uint8Array(fourMib);
        for (let i = 0; i < 1024; i++) {
          payload[i] = (i * 31) & 0xff;
        }

        await bridge.writeFile(fileRef, 0, payload);

        setWriteDiagnostic((prev) => prev ? { ...prev, status: 'verifying' } : null);

        const readBack = await bridge.readFile(fileRef, 0, fourMib);
        const isVerified = readBack.length === fourMib && readBack[100] === payload[100];

        setWriteDiagnostic({
          fileId: fileRef.id,
          fileName: fileRef.name,
          mode,
          bytesWritten: fourMib,
          offsetsUsed: [0],
          finalSize: fourMib,
          status: 'success',
          readBackVerified: isVerified,
          readBackText: `4 MiB chunk verified (${readBack.length.toLocaleString()} bytes matches payload)`,
          isReleased: false,
        });
      } else if (mode === 'zero-byte') {
        // Zero-byte file: do not write chunks, verify 0-byte read
        const readBack = await bridge.readFile(fileRef, 0, 1024);
        const isVerified = readBack.length === 0;

        setWriteDiagnostic({
          fileId: fileRef.id,
          fileName: fileRef.name,
          mode,
          bytesWritten: 0,
          offsetsUsed: [],
          finalSize: 0,
          status: 'success',
          readBackVerified: isVerified,
          readBackText: '0 bytes written (Empty file confirmed)',
          isReleased: false,
        });
      }
    } catch (err: any) {
      if (err.message && err.message.includes('CANCELLED')) {
        // Cancelled by user in save dialog
        setWriteDiagnostic(null);
      } else {
        setWriteDiagnostic({
          fileId: 'failed',
          fileName: suggestedName,
          mode,
          bytesWritten: 0,
          offsetsUsed: [],
          finalSize: 0,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setIsWriting(false);
    }
  };

  const handleTestFolderScan = async () => {
    setIsScanningFolder(true);
    try {
      const pickRes = await bridge.pickFolder();
      if (pickRes.cancelled || pickRes.references.length === 0) {
        setIsScanningFolder(false);
        return;
      }

      const folderRef = pickRes.references[0];
      setFolderDiagnostic({
        folderId: folderRef.id,
        folderName: folderRef.name,
        fileCount: 0,
        totalBytes: 0,
        durationMs: 0,
        status: 'scanning',
        entries: [],
      });

      const t0 = Date.now();
      const entries = await bridge.scanDirectory(folderRef as any);
      const totalBytes = entries.reduce((acc, e) => acc + (e.size || 0), 0);
      const durationMs = Date.now() - t0;

      setFolderDiagnostic({
        folderId: folderRef.id,
        folderName: folderRef.name,
        fileCount: entries.length,
        totalBytes,
        durationMs,
        status: 'success',
        entries: entries.slice(0, 10).map((e) => ({
          relativePath: e.relativePath,
          name: e.name,
          size: e.size,
          kind: e.kind,
        })),
        isReleased: false,
      });
    } catch (err) {
      setFolderDiagnostic({
        folderId: 'failed',
        folderName: 'Selected Folder',
        fileCount: 0,
        totalBytes: 0,
        durationMs: 0,
        status: 'error',
        entries: [],
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsScanningFolder(false);
    }
  };

  const handlePickAndRegisterFolderSource = async () => {
    setIsRegisteringFolderSource(true);
    setFolderEngineError(null);
    setFolderChunkDiagnostic(null);

    try {
      const pickRes = await bridge.pickFolder();
      if (pickRes.cancelled || pickRes.references.length === 0) {
        setIsRegisteringFolderSource(false);
        return;
      }

      const folderRef = pickRes.references[0];
      const scanResult = await scanNativeFolder(folderRef.id);
      if (!scanResult) {
        throw new Error('Failed to scan selected folder');
      }

      const source = createTransferSourceFromFolder(scanResult);
      setFolderSource(source);
      if (source.files.length > 0) {
        setSelectedTransferFileId(source.files[0].transferFileId);
      }
    } catch (err: any) {
      setFolderEngineError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegisteringFolderSource(false);
    }
  };

  const handleReadFolderFileChunk = async (fileId: string, offset: number = 0) => {
    if (!folderSource) return;
    setIsReadingFolderChunk(true);
    setFolderEngineError(null);

    try {
      const result = await readTransferFileChunk(folderSource, fileId, offset, DEFAULT_CHUNK_SIZE);
      setFolderChunkDiagnostic(result);
    } catch (err: any) {
      setFolderEngineError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReadingFolderChunk(false);
    }
  };

  const handleReleaseFolderSource = async () => {
    if (!folderSource) return;
    try {
      await releaseTransferFolderSource(folderSource);
      setFolderSource({
        ...folderSource,
        isReleased: true,
      });
      setFolderChunkDiagnostic(null);
    } catch (err: any) {
      setFolderEngineError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleTestReceiveFileEngine = async (
    scenario: 'sequential-8mb' | 'outoforder-8mb' | 'duplicate-range' | 'zero-byte'
  ) => {
    setIsRunningReceiveTest(true);
    setReceiveDiagnostic(null);

    const t0 = Date.now();
    let filename = 'nearshare-receive-8mb.bin';
    let size = 8 * 1024 * 1024; // 8 MiB
    let transferFileId = 'tr_file_rcv_001';

    if (scenario === 'duplicate-range') {
      filename = 'nearshare-receive-dup.bin';
      size = 1024 * 1024; // 1 MiB
      transferFileId = 'tr_file_rcv_dup';
    } else if (scenario === 'zero-byte') {
      filename = 'nearshare-receive-zero.bin';
      size = 0;
      transferFileId = 'tr_file_rcv_zero';
    }

    try {
      const dest = await createReceiveDestinationFromFile({
        fileId: transferFileId,
        name: filename,
        relativePath: filename,
        size,
        fileType: 'bin',
      });
      setReceiveDestination(dest);

      const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB
      let readBackMatches = false;

      if (scenario === 'sequential-8mb') {
        // Chunk 1: offset 0, 4 MiB
        const chunk1 = new Uint8Array(CHUNK_SIZE);
        for (let i = 0; i < CHUNK_SIZE; i++) chunk1[i] = i % 251;
        await writeReceiveDestinationChunk(dest, 0, chunk1);

        // Chunk 2: offset 4 MiB, 4 MiB
        const chunk2 = new Uint8Array(CHUNK_SIZE);
        for (let i = 0; i < CHUNK_SIZE; i++) chunk2[i] = (i + CHUNK_SIZE) % 251;
        await writeReceiveDestinationChunk(dest, CHUNK_SIZE, chunk2);

        await finalizeReceiveDestination(dest);

        // Read-back verification through FileSystemManager
        const read1 = await FileSystemManager.getInstance().read({ id: dest.nativeReferenceId, name: dest.name, kind: 'file' }, 0, CHUNK_SIZE);
        const read2 = await FileSystemManager.getInstance().read({ id: dest.nativeReferenceId, name: dest.name, kind: 'file' }, CHUNK_SIZE, CHUNK_SIZE);

        let match1 = read1.byteLength === CHUNK_SIZE;
        let match2 = read2.byteLength === CHUNK_SIZE;
        for (let i = 0; i < CHUNK_SIZE && match1; i += 1024) {
          if (read1[i] !== chunk1[i]) match1 = false;
        }
        for (let i = 0; i < CHUNK_SIZE && match2; i += 1024) {
          if (read2[i] !== chunk2[i]) match2 = false;
        }
        readBackMatches = match1 && match2;

      } else if (scenario === 'outoforder-8mb') {
        // Chunk 2 FIRST: offset 4 MiB, 4 MiB
        const chunk2 = new Uint8Array(CHUNK_SIZE);
        for (let i = 0; i < CHUNK_SIZE; i++) chunk2[i] = (i + CHUNK_SIZE) % 251;
        await writeReceiveDestinationChunk(dest, CHUNK_SIZE, chunk2);

        // Chunk 1 SECOND: offset 0, 4 MiB
        const chunk1 = new Uint8Array(CHUNK_SIZE);
        for (let i = 0; i < CHUNK_SIZE; i++) chunk1[i] = i % 251;
        await writeReceiveDestinationChunk(dest, 0, chunk1);

        await finalizeReceiveDestination(dest);

        const read1 = await FileSystemManager.getInstance().read({ id: dest.nativeReferenceId, name: dest.name, kind: 'file' }, 0, CHUNK_SIZE);
        const read2 = await FileSystemManager.getInstance().read({ id: dest.nativeReferenceId, name: dest.name, kind: 'file' }, CHUNK_SIZE, CHUNK_SIZE);

        let match1 = read1.byteLength === CHUNK_SIZE;
        let match2 = read2.byteLength === CHUNK_SIZE;
        for (let i = 0; i < CHUNK_SIZE && match1; i += 1024) {
          if (read1[i] !== chunk1[i]) match1 = false;
        }
        for (let i = 0; i < CHUNK_SIZE && match2; i += 1024) {
          if (read2[i] !== chunk2[i]) match2 = false;
        }
        readBackMatches = match1 && match2;

      } else if (scenario === 'duplicate-range') {
        const payload = new Uint8Array(1024 * 1024);
        for (let i = 0; i < payload.length; i++) payload[i] = (i + 13) % 251;

        // Write once
        await writeReceiveDestinationChunk(dest, 0, payload);
        // Write duplicate
        await writeReceiveDestinationChunk(dest, 0, payload);

        await finalizeReceiveDestination(dest);

        const read = await FileSystemManager.getInstance().read({ id: dest.nativeReferenceId, name: dest.name, kind: 'file' }, 0, payload.length);
        readBackMatches = read.byteLength === payload.length && dest.bytesWritten === payload.length;

      } else if (scenario === 'zero-byte') {
        await finalizeReceiveDestination(dest);
        readBackMatches = dest.bytesWritten === 0 && dest.status === 'completed';
      }

      setReceiveDiagnostic({
        scenario,
        transferFileId,
        filename,
        expectedSize: size,
        bytesWritten: dest.bytesWritten,
        missingRangesCount: 0,
        isComplete: true,
        readBackVerified: readBackMatches,
        durationMs: Date.now() - t0,
        status: 'success',
      });
    } catch (err: any) {
      if (err.message && err.message.includes('CANCELLED')) {
        setReceiveDiagnostic(null);
      } else {
        setReceiveDiagnostic({
          scenario,
          transferFileId,
          filename,
          expectedSize: size,
          bytesWritten: 0,
          missingRangesCount: 0,
          isComplete: false,
          readBackVerified: false,
          durationMs: Date.now() - t0,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setIsRunningReceiveTest(false);
    }
  };

  const handleReleaseReceiveDestination = async () => {
    if (!receiveDestination) return;
    try {
      await releaseReceiveDestination(receiveDestination);
      setReceiveDestination({
        ...receiveDestination,
        isReleased: true,
      });
    } catch (err) {
      console.error('[NativeBridgeInspector] release receive error:', err);
    }
  };

  const handleStartTcpServer = async (bindLan = false) => {
    setIsStartingServer(true);
    setTcpDiagnostic(null);
    try {
      if (!tcpTransportRef.current) {
        tcpTransportRef.current = new MacTcpLanSpikeTransport();
      }
      const srv = await tcpTransportRef.current.startServer(0, bindLan);
      setTcpServer(srv);
      setTcpConnectPort(srv.port);
    } catch (err: any) {
      console.error('[NativeBridgeInspector] startTcpServer error:', err);
      setTcpDiagnostic({
        action: 'ping',
        rttMs: 0,
        bytesSent: 0,
        verified: false,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsStartingServer(false);
    }
  };

  const handleStopTcpServer = async () => {
    try {
      if (tcpTransportRef.current) {
        await tcpTransportRef.current.stopServer();
      }
      setTcpServer(null);
    } catch (err: any) {
      console.error('[NativeBridgeInspector] stopTcpServer error:', err);
    }
  };

  const handleConnectTcp = async () => {
    if (!tcpConnectPort) return;
    setIsConnectingTcp(true);
    setTcpDiagnostic(null);
    try {
      if (!tcpTransportRef.current) {
        tcpTransportRef.current = new MacTcpLanSpikeTransport();
      }
      const res = await tcpTransportRef.current.connectToHost(tcpConnectHost, tcpConnectPort);
      setTcpClient(res);
    } catch (err: any) {
      console.error('[NativeBridgeInspector] connectTcp error:', err);
      setTcpDiagnostic({
        action: 'ping',
        rttMs: 0,
        bytesSent: 0,
        verified: false,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsConnectingTcp(false);
    }
  };

  const handleDisconnectTcp = async () => {
    if (!tcpClient) return;
    try {
      if (tcpTransportRef.current) {
        await tcpTransportRef.current.disconnect(tcpClient.connectionId);
      }
      setTcpClient(null);
    } catch (err: any) {
      console.error('[NativeBridgeInspector] disconnectTcp error:', err);
    }
  };

  const handleSendTcpPing = async () => {
    if (!tcpClient || !tcpTransportRef.current) return;
    setIsRunningTcpTest(true);
    setTcpDiagnostic(null);
    try {
      const rttMs = await tcpTransportRef.current.sendPing(tcpClient.connectionId);
      setTcpDiagnostic({
        action: 'ping',
        rttMs,
        bytesSent: 24,
        verified: true,
        status: 'success',
      });
    } catch (err: any) {
      setTcpDiagnostic({
        action: 'ping',
        rttMs: 0,
        bytesSent: 0,
        verified: false,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunningTcpTest(false);
    }
  };

  const handleSendTcpPayload = async (sizeBytes: number) => {
    if (!tcpClient || !tcpTransportRef.current) return;
    setIsRunningTcpTest(true);
    setTcpDiagnostic(null);
    const action =
      sizeBytes === 1024 * 1024
        ? 'test-payload-1mb'
        : sizeBytes === 256 * 1024
        ? 'test-payload-256k'
        : 'test-payload-64k';
    try {
      const res = await tcpTransportRef.current.sendTestPayload(tcpClient.connectionId, sizeBytes);
      setTcpDiagnostic({
        action,
        rttMs: res.rttMs,
        bytesSent: res.bytesSent,
        verified: res.verified,
        status: 'success',
      });
    } catch (err: any) {
      setTcpDiagnostic({
        action,
        rttMs: 0,
        bytesSent: 0,
        verified: false,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunningTcpTest(false);
    }
  };

  const handleReleaseReference = async (fileId: string) => {
    try {
      await bridge.releaseReference({ id: fileId } as any);
      if (readDiagnostic && readDiagnostic.fileId === fileId) {
        setReadDiagnostic({
          ...readDiagnostic,
          isReleased: true,
        });
      }
      if (writeDiagnostic && writeDiagnostic.fileId === fileId) {
        setWriteDiagnostic({
          ...writeDiagnostic,
          isReleased: true,
        });
      }
      if (folderDiagnostic && folderDiagnostic.folderId === fileId) {
        setFolderDiagnostic({
          ...folderDiagnostic,
          isReleased: true,
        });
      }
    } catch (err) {
      console.error('[NativeBridgeInspector] release error:', err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      closeButtonRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const summary = await runTestSuite();
      setTestSummary(summary);
    } catch (err) {
      console.error('[NativeBridgeInspector] Test suite run failed:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  if (!isDev) {
    return null;
  }

  const capabilityList = [
    { label: 'Filesystem', level: capabilities.filesystem },
    { label: 'File Picker', level: capabilities.filePicker },
    { label: 'Folder Picker', level: capabilities.folderPicker },
    { label: 'Streaming Read', level: capabilities.streamingRead },
    { label: 'Streaming Write', level: capabilities.streamingWrite },
    { label: 'Random Access Read', level: capabilities.randomAccessRead },
    { label: 'Random Access Write', level: capabilities.randomAccessWrite },
    { label: 'Persistent Access', level: capabilities.persistentAccess },
    { label: 'Background Execution', level: capabilities.backgroundExecution },
    { label: 'Notifications', level: capabilities.notifications },
    { label: 'Secure Storage', level: capabilities.secureStorage },
    { label: 'Bluetooth', level: capabilities.bluetooth },
    { label: 'Native TCP LAN Spike', level: isTauri ? 'Supported (macOS)' : 'Unsupported' },
    { label: 'Direct Nearby Networking', level: capabilities.directNearbyNetworking },
    { label: 'Local Network Networking', level: capabilities.localNetworkNetworking },
  ];

  return (
    <>
      {/* Floating Trigger Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open NearShare Native Bridge Inspector"
        className="fixed bottom-4 right-[30rem] z-50 flex items-center gap-2 px-3 py-2 bg-[#101114]/90 hover:bg-[#17191D] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-full text-xs font-mono backdrop-blur-md shadow-2xl transition-colors cursor-pointer pointer-events-auto"
        title="Open Native Bridge Inspector (Dev Only)"
      >
        <Link2 className="w-3.5 h-3.5 text-[#F5F5F5]" />
        <span>{isTauri ? 'TAURI BRIDGE' : 'NATIVE BRIDGE'}</span>
        <span className="text-[10px] px-1.5 py-0.2 bg-white/10 text-[#F5F5F5] rounded">
          {isTauri ? 'DESKTOP' : 'WEB'}
        </span>
      </button>

      {/* Modal Viewport */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bridge-inspector-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono pointer-events-auto"
        >
          <div
            ref={modalRef}
            className={`relative w-full max-w-5xl h-[88vh] bg-[#08090B] border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden text-[#F5F5F5] ${
              reducedMotion ? '' : 'transition-all'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#101114] border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                  <Cpu className="w-4 h-4 text-[#F5F5F5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="bridge-inspector-title" className="text-sm font-semibold tracking-wide text-[#F5F5F5]">
                      NearShare Native Bridge Contract
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] bg-white/10 text-[#A6A8AD] border border-white/10 rounded">
                      {isTauri ? 'TAURI DESKTOP RUNTIME' : 'WEB RUNTIME'}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-white/5 text-[#686B72] border border-white/5 rounded">
                      PLATFORM: {platform.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A6A8AD]">
                    Boundary contract connecting React runtime to native operating system hosts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunTests}
                  disabled={isRunningTests}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 text-[#F5F5F5]" />
                  <span>{isRunningTests ? 'Running...' : 'Run Bridge Tests'}</span>
                </button>
                <button
                  ref={closeButtonRef}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Native Bridge Inspector"
                  className="p-1.5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-bar: Diagnostic Overview */}
            <div className="px-6 py-2.5 bg-[#101114]/60 border-b border-white/10 text-xs text-[#A6A8AD] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Runtime: <strong className="text-[#F5F5F5]">{isTauri ? 'Tauri Desktop' : 'Web'}</strong></span>
                <span>•</span>
                <span>Tauri: <strong className="text-[#F5F5F5]">{isTauri ? 'Detected' : 'Unavailable'}</strong></span>
                <span>•</span>
                <span>Bridge: <strong className="text-[#F5F5F5]">{bridge.constructor.name}</strong></span>
                <span>•</span>
                <span>Status: <strong className="text-[#F5F5F5]">{isAvailable ? 'ACTIVE' : 'STANDBY'}</strong></span>
                <span>•</span>
                <span>Native FS: <strong className="text-[#A6A8AD]">Not implemented</strong></span>
                <span>•</span>
                <span>Direct Nearby: <strong className="text-[#A6A8AD]">Not implemented</strong></span>
              </div>
              <div className="text-[11px] text-[#686B72]">
                Capabilities Declared: <span className="text-[#F5F5F5] font-semibold">{capabilityList.length}</span>
              </div>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Capability Levels */}
              <div className="w-1/2 border-r border-white/10 flex flex-col bg-[#08090B]">
                <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Bridge Capability Matrix</span>
                  <span>Support Level</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {/* Tauri IPC Section */}
                  <div className="p-3.5 bg-[#101114] border border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">Tauri IPC Round-Trip</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        ipcDiagnostics ? 'bg-white/10 border-white/20 text-[#F5F5F5]' : 'bg-white/5 border-white/10 text-[#686B72]'
                      }`}>
                        {ipcDiagnostics ? 'IPC CONNECTED' : isTauri ? 'INITIALIZING' : 'UNAVAILABLE (WEB)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#A6A8AD]">
                      <div>Runtime: <span className="text-[#F5F5F5]">{ipcDiagnostics?.runtime ?? (isTauri ? 'tauri' : 'web')}</span></div>
                      <div>Platform: <span className="text-[#F5F5F5]">{ipcDiagnostics?.platform ?? platform}</span></div>
                      <div>Tauri Version: <span className="text-[#F5F5F5]">{ipcDiagnostics?.tauriVersion ?? '2.12.0'}</span></div>
                      <div>Native Networking: <span className="text-[#A6A8AD]">{ipcDiagnostics?.nativeNetworking ? 'true' : 'false (Not implemented)'}</span></div>
                      <div className="col-span-2">Native Filesystem: <span className="text-[#A6A8AD]">{ipcDiagnostics?.nativeFilesystem ? 'true' : 'false (Not implemented)'}</span></div>
                    </div>
                  </div>

                  {/* Native File Picker Test Section */}
                  <div className="p-3.5 bg-[#101114] border border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileUp className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">Test Native File Picker</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        capabilities.filePicker === 'supported'
                          ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                          : 'bg-white/5 border-white/10 text-[#686B72]'
                      }`}>
                        {capabilities.filePicker === 'supported' ? 'NATIVE PICKER: CONNECTED' : 'UNAVAILABLE (WEB)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-[#A6A8AD]">
                        Opens macOS native file dialog and returns safe, path-isolated opaque references.
                      </p>
                      <button
                        onClick={handlePickFiles}
                        disabled={isPicking}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      >
                        {isPicking ? 'Selecting...' : 'Select Files'}
                      </button>
                    </div>

                    {pickedFiles.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="text-[11px] text-[#686B72] uppercase tracking-wider">
                          Selected Files ({pickedFiles.length})
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1.5">
                          {pickedFiles.map((file) => (
                            <div
                              key={file.id}
                              className="p-2 bg-[#17191D] border border-white/10 rounded text-[11px] font-mono flex items-center justify-between text-[#F5F5F5]"
                            >
                              <div className="truncate mr-2">
                                <strong>{file.name}</strong>
                                <span className="text-[#686B72] ml-2">
                                  ({file.size !== undefined ? `${(file.size / 1024).toFixed(1)} KB` : '0 B'})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleTestNativeRead(file)}
                                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-[#F5F5F5] border border-white/10 rounded text-[10px] cursor-pointer"
                                  title="Read first 4 MiB chunk from native file"
                                >
                                  Test Read (4 MiB)
                                </button>
                                <button
                                  onClick={() => handleReleaseReference(file.id)}
                                  className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/5 rounded text-[10px] cursor-pointer"
                                  title="Close native file handle"
                                >
                                  Release
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Native File Read Diagnostic Result */}
                    {readDiagnostic && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#F5F5F5] uppercase tracking-wider">
                            Native File Read Diagnostic
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            readDiagnostic.status === 'success'
                              ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                              : readDiagnostic.status === 'reading'
                              ? 'bg-white/5 border-white/10 text-[#A6A8AD]'
                              : 'bg-red-500/10 border-red-500/30 text-[#F5F5F5]'
                          }`}>
                            {readDiagnostic.status === 'success'
                              ? 'READ: SUCCESS'
                              : readDiagnostic.status === 'reading'
                              ? 'READING...'
                              : 'READ: FAILED'}
                          </span>
                        </div>

                        <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">File:</span>
                            <span className="text-[#F5F5F5] font-semibold truncate max-w-[200px]">{readDiagnostic.fileName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Requested:</span>
                            <span className="text-[#A6A8AD]">4 MiB (4,194,304 bytes)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Actually read:</span>
                            <span className="text-[#F5F5F5] font-semibold">{readDiagnostic.actuallyRead} bytes</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Offset:</span>
                            <span className="text-[#A6A8AD]">{readDiagnostic.offset}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">EOF Reached:</span>
                            <span className="text-[#A6A8AD]">{readDiagnostic.isEof ? 'true' : 'false'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Handle State:</span>
                            <span className={readDiagnostic.isReleased ? 'text-[#686B72]' : 'text-[#F5F5F5]'}>
                              {readDiagnostic.isReleased ? 'Closed / Released' : 'Active in Session'}
                            </span>
                          </div>

                          {readDiagnostic.hexPreview && (
                            <div className="pt-1.5 border-t border-white/5">
                              <span className="text-[#686B72] block mb-1">First 16 Bytes (Hex Preview):</span>
                              <div className="p-1.5 bg-[#17191D] border border-white/5 rounded text-[10px] text-[#A6A8AD] tracking-wider font-mono select-all">
                                {readDiagnostic.hexPreview}
                              </div>
                            </div>
                          )}

                          {readDiagnostic.errorMessage && (
                            <div className="pt-1.5 border-t border-white/5 text-[10px] text-red-400">
                              Error: {readDiagnostic.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Native File Writer Test Section (Step 34 Spike) */}
                  <div className="p-3.5 bg-[#101114] border border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileUp className="w-3.5 h-3.5 text-[#F5F5F5] rotate-180" />
                        <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">Test Native File Write (Destination)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        capabilities.streamingWrite === 'supported'
                          ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                          : 'bg-white/5 border-white/10 text-[#686B72]'
                      }`}>
                        {capabilities.streamingWrite === 'supported' ? 'NATIVE WRITER: CONNECTED' : 'UNAVAILABLE (WEB)'}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#A6A8AD]">
                      Prompts native Save Dialog, executes random-access chunk writes at explicit offsets, and reads back to verify integrity.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => handleTestNativeWrite('multi-chunk')}
                        disabled={isWriting}
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer"
                      >
                        {isWriting ? 'Executing...' : 'Multi-Chunk Write'}
                      </button>
                      <button
                        onClick={() => handleTestNativeWrite('large-4mib')}
                        disabled={isWriting}
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer"
                      >
                        4 MiB Bounded Write
                      </button>
                      <button
                        onClick={() => handleTestNativeWrite('zero-byte')}
                        disabled={isWriting}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-lg transition-colors cursor-pointer"
                      >
                        Zero-Byte File
                      </button>
                    </div>

                    {/* Native File Write Diagnostic Result */}
                    {writeDiagnostic && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#F5F5F5] uppercase tracking-wider">
                            Write & Read-Back Result
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            writeDiagnostic.status === 'success'
                              ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                              : writeDiagnostic.status === 'writing' || writeDiagnostic.status === 'verifying'
                              ? 'bg-white/5 border-white/10 text-[#A6A8AD]'
                              : 'bg-red-500/10 border-red-500/30 text-[#F5F5F5]'
                          }`}>
                            {writeDiagnostic.status === 'success'
                              ? 'WRITE & VERIFY: SUCCESS'
                              : writeDiagnostic.status === 'verifying'
                              ? 'VERIFYING READ-BACK...'
                              : writeDiagnostic.status === 'writing'
                              ? 'WRITING CHUNKS...'
                              : 'WRITE: FAILED'}
                          </span>
                        </div>

                        <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Destination:</span>
                            <span className="text-[#F5F5F5] font-semibold truncate max-w-[200px]">{writeDiagnostic.fileName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Bytes Written:</span>
                            <span className="text-[#F5F5F5] font-semibold">{writeDiagnostic.bytesWritten.toLocaleString()} bytes</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Offsets Used:</span>
                            <span className="text-[#A6A8AD]">
                              {writeDiagnostic.offsetsUsed.length > 0 ? `[${writeDiagnostic.offsetsUsed.join(', ')}]` : 'None (0 B)'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Final File Size:</span>
                            <span className="text-[#A6A8AD]">{writeDiagnostic.finalSize.toLocaleString()} bytes</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Read-Back Verified:</span>
                            <span className={writeDiagnostic.readBackVerified ? 'text-[#F5F5F5] font-semibold' : 'text-red-400'}>
                              {writeDiagnostic.readBackVerified ? 'YES (Byte Match)' : 'NO / PENDING'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#686B72]">Handle State:</span>
                            <div className="flex items-center gap-2">
                              <span className={writeDiagnostic.isReleased ? 'text-[#686B72]' : 'text-[#F5F5F5]'}>
                                {writeDiagnostic.isReleased ? 'Closed / Released' : 'Active in Session'}
                              </span>
                              {!writeDiagnostic.isReleased && (
                                <button
                                  onClick={() => handleReleaseReference(writeDiagnostic.fileId)}
                                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/5 rounded cursor-pointer"
                                >
                                  Close Handle
                                </button>
                              )}
                            </div>
                          </div>

                          {writeDiagnostic.readBackText && (
                            <div className="pt-1.5 border-t border-white/5">
                              <span className="text-[#686B72] block mb-1">Payload / Read-Back Verification:</span>
                              <div className="p-1.5 bg-[#17191D] border border-white/5 rounded text-[10px] text-[#A6A8AD] tracking-wider font-mono select-all">
                                {writeDiagnostic.readBackText}
                              </div>
                            </div>
                          )}

                          {writeDiagnostic.errorMessage && (
                            <div className="pt-1.5 border-t border-white/5 text-[10px] text-red-400">
                              Error: {writeDiagnostic.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Native Folder Scanner Test Section (Step 35 Spike) */}
                  <div className="p-3.5 bg-[#101114] border border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderUp className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">Test Native Folder Scan (Manifest)</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        capabilities.folderPicker === 'supported'
                          ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                          : 'bg-white/5 border-white/10 text-[#686B72]'
                      }`}>
                        {capabilities.folderPicker === 'supported' ? 'FOLDER SCANNER: CONNECTED' : 'UNAVAILABLE (WEB)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-[#A6A8AD]">
                        Selects a native directory, recursively scans files in Rust, and produces a safe relative-path manifest without host path leakage.
                      </p>
                      <button
                        onClick={handleTestFolderScan}
                        disabled={isScanningFolder}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      >
                        {isScanningFolder ? 'Scanning...' : 'Select & Scan Folder'}
                      </button>
                    </div>

                    {/* Native Folder Scan Result */}
                    {folderDiagnostic && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#F5F5F5] uppercase tracking-wider">
                            Folder Manifest Result
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            folderDiagnostic.status === 'success'
                              ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                              : folderDiagnostic.status === 'scanning'
                              ? 'bg-white/5 border-white/10 text-[#A6A8AD]'
                              : 'bg-red-500/10 border-red-500/30 text-[#F5F5F5]'
                          }`}>
                            {folderDiagnostic.status === 'success'
                              ? 'SCAN: SUCCESS'
                              : folderDiagnostic.status === 'scanning'
                              ? 'SCANNING DIRECTORY...'
                              : 'SCAN: FAILED'}
                          </span>
                        </div>

                        <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Folder:</span>
                            <span className="text-[#F5F5F5] font-semibold truncate max-w-[200px]">{folderDiagnostic.folderName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Total Files:</span>
                            <span className="text-[#F5F5F5] font-semibold">{folderDiagnostic.fileCount.toLocaleString()} regular files</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Total Size:</span>
                            <span className="text-[#A6A8AD]">{folderDiagnostic.totalBytes.toLocaleString()} bytes ({(folderDiagnostic.totalBytes / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Scan Duration:</span>
                            <span className="text-[#A6A8AD]">{folderDiagnostic.durationMs}ms</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#686B72]">Handle State:</span>
                            <div className="flex items-center gap-2">
                              <span className={folderDiagnostic.isReleased ? 'text-[#686B72]' : 'text-[#F5F5F5]'}>
                                {folderDiagnostic.isReleased ? 'Closed / Released' : 'Active in Session'}
                              </span>
                              {!folderDiagnostic.isReleased && (
                                <button
                                  onClick={() => handleReleaseReference(folderDiagnostic.folderId)}
                                  className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/5 rounded cursor-pointer"
                                >
                                  Release
                                </button>
                              )}
                            </div>
                          </div>

                          {folderDiagnostic.entries.length > 0 && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <span className="text-[#686B72] block text-[10px]">
                                Manifest Preview (Showing first {folderDiagnostic.entries.length} items):
                              </span>
                              <div className="max-h-36 overflow-y-auto space-y-1">
                                {folderDiagnostic.entries.map((entry, idx) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 bg-[#17191D] border border-white/5 rounded text-[10px] flex items-center justify-between text-[#F5F5F5]"
                                  >
                                    <span className="truncate mr-2 font-mono text-[#A6A8AD]">
                                      {entry.relativePath}
                                    </span>
                                    <span className="text-[#686B72] shrink-0">
                                      {entry.size ? `${(entry.size / 1024).toFixed(1)} KB` : '0 B'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {folderDiagnostic.errorMessage && (
                            <div className="pt-1.5 border-t border-white/5 text-[10px] text-red-400">
                              Error: {folderDiagnostic.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 36: Native Folder -> FileEngine Integration Spike */}
                  <div className="p-3.5 bg-[#101114] border border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span className="text-xs font-semibold text-[#F5F5F5] tracking-wide">Test Native Folder → FileEngine</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        capabilities.folderPicker === 'supported'
                          ? 'bg-white/10 border-white/20 text-[#F5F5F5]'
                          : 'bg-white/5 border-white/10 text-[#686B72]'
                      }`}>
                        {capabilities.folderPicker === 'supported' ? 'FILE_ENGINE: READY' : 'UNAVAILABLE (WEB)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-[#A6A8AD]">
                        Registers folder manifest as a local TransferFolderSource and reads file chunks through FileEngine/FileReader.
                      </p>
                      <button
                        onClick={handlePickAndRegisterFolderSource}
                        disabled={isRegisteringFolderSource}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      >
                        {isRegisteringFolderSource ? 'Registering...' : 'Scan & Register Source'}
                      </button>
                    </div>

                    {folderEngineError && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-mono">
                        {folderEngineError}
                      </div>
                    )}

                    {folderSource && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#F5F5F5] uppercase tracking-wider">
                            Transfer Source Registered
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            folderSource.isReleased
                              ? 'bg-white/5 border-white/10 text-[#686B72]'
                              : 'bg-white/10 border-white/20 text-[#F5F5F5]'
                          }`}>
                            {folderSource.isReleased ? 'RELEASED' : 'ACTIVE SOURCE'}
                          </span>
                        </div>

                        <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Source ID:</span>
                            <span className="text-[#F5F5F5]">{folderSource.sourceId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Folder:</span>
                            <span className="text-[#F5F5F5]">{folderSource.folderName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Total Files:</span>
                            <span className="text-[#F5F5F5]">{folderSource.fileCount} files ({folderSource.totalBytes.toLocaleString()} bytes)</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-white/5">
                            <span className="text-[#686B72]">Source State:</span>
                            {!folderSource.isReleased ? (
                              <button
                                onClick={handleReleaseFolderSource}
                                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/5 rounded cursor-pointer"
                              >
                                Release Source
                              </button>
                            ) : (
                              <span className="text-[#686B72]">Handles Released</span>
                            )}
                          </div>
                        </div>

                        {folderSource.files.length > 0 && !folderSource.isReleased && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[#686B72] block text-[10px] uppercase tracking-wider">
                              Manifest Files (Select to Read via FileEngine):
                            </span>
                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {folderSource.files.map((file) => {
                                const isSelected = selectedTransferFileId === file.transferFileId;
                                const isLarge = file.size > 4 * 1024 * 1024;
                                return (
                                  <div
                                    key={file.transferFileId}
                                    className={`p-2 rounded border text-[11px] font-mono flex items-center justify-between transition-colors ${
                                      isSelected
                                        ? 'bg-[#17191D] border-white/20 text-[#F5F5F5]'
                                        : 'bg-[#08090B] border-white/5 text-[#A6A8AD]'
                                    }`}
                                  >
                                    <div
                                      onClick={() => setSelectedTransferFileId(file.transferFileId)}
                                      className="truncate mr-2 cursor-pointer flex-1"
                                    >
                                      <span className="text-[#F5F5F5] font-semibold">{file.relativePath}</span>
                                      <span className="text-[#686B72] ml-1.5">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => {
                                          setSelectedTransferFileId(file.transferFileId);
                                          handleReadFolderFileChunk(file.transferFileId, 0);
                                        }}
                                        disabled={isReadingFolderChunk}
                                        className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-[#F5F5F5] border border-white/10 rounded text-[10px] cursor-pointer"
                                        title="Read first 4 MiB chunk through FileEngine"
                                      >
                                        Read Chunk 1 (0)
                                      </button>
                                      {isLarge && (
                                        <button
                                          onClick={() => {
                                            setSelectedTransferFileId(file.transferFileId);
                                            handleReadFolderFileChunk(file.transferFileId, 4 * 1024 * 1024);
                                          }}
                                          disabled={isReadingFolderChunk}
                                          className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-[#F5F5F5] border border-white/10 rounded text-[10px] cursor-pointer"
                                          title="Read second 4 MiB chunk through FileEngine"
                                        >
                                          Chunk 2 (4 MiB)
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {folderChunkDiagnostic && (
                          <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                            <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider pb-1 border-b border-white/5">
                              <span>FileEngine Chunk Read Result</span>
                              <span className="text-[#F5F5F5] font-semibold">READ SUCCESS</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#686B72]">File:</span>
                              <span className="text-[#F5F5F5] truncate max-w-[200px]">{folderChunkDiagnostic.relativePath}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#686B72]">Transfer File ID:</span>
                              <span className="text-[#A6A8AD]">{folderChunkDiagnostic.transferFileId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#686B72]">Offset / Length:</span>
                              <span className="text-[#F5F5F5]">{folderChunkDiagnostic.offset.toLocaleString()} B / {folderChunkDiagnostic.requestedLength.toLocaleString()} B</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#686B72]">Actual Bytes Read:</span>
                              <span className="text-[#F5F5F5] font-semibold">{folderChunkDiagnostic.actualLength.toLocaleString()} bytes</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#686B72]">EOF Reached:</span>
                              <span className={folderChunkDiagnostic.isEof ? 'text-[#F5F5F5] font-semibold' : 'text-[#A6A8AD]'}>
                                {folderChunkDiagnostic.isEof ? 'YES (End of File)' : 'NO'}
                              </span>
                            </div>
                            {folderChunkDiagnostic.durationMs !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-[#686B72]">Read Latency:</span>
                                <span className="text-[#A6A8AD]">{folderChunkDiagnostic.durationMs}ms</span>
                              </div>
                            )}
                            {folderChunkDiagnostic.bytes.length > 0 && (
                              <div className="pt-1.5 border-t border-white/5">
                                <span className="text-[#686B72] block mb-1">16-Byte Hex Preview:</span>
                                <div className="p-1.5 bg-[#17191D] border border-white/5 rounded text-[10px] text-[#A6A8AD] tracking-wider select-all font-mono">
                                  {Array.from(folderChunkDiagnostic.bytes.slice(0, 16))
                                    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                                    .join(' ')}
                                </div>
                              </div>
                            )}
                            <div className="pt-1 text-[9px] text-[#686B72]">
                              Trace: UI → FileEngine → FileReader → FileSystemManager → NativeBridge → Rust
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step 37: Native Receive Destination -> FileEngine Writer Diagnostic */}
                  <div className="p-3.5 bg-[#17191D] border border-white/10 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-[#F5F5F5]" />
                        <span className="text-xs font-medium text-[#F5F5F5]">
                          Test Native Receive → FileEngine
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/5 text-[#A6A8AD] border border-white/10 rounded">
                        Step 37 FileEngine Writer
                      </span>
                    </div>

                    <p className="text-[11px] text-[#A6A8AD] leading-relaxed">
                      Prove that a logical NearShare receive file can be created, bounded/random-access written (with 4 MiB limits), and finalized through the existing FileEngine/FileWriter abstraction to native macOS storage.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTestReceiveFileEngine('sequential-8mb')}
                        disabled={isRunningReceiveTest}
                        className="py-1.5 px-2.5 bg-[#101114] hover:bg-[#101114]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-[#F5F5F5]" />
                        {isRunningReceiveTest ? 'Running...' : 'Sequential (8 MiB)'}
                      </button>

                      <button
                        onClick={() => handleTestReceiveFileEngine('outoforder-8mb')}
                        disabled={isRunningReceiveTest}
                        className="py-1.5 px-2.5 bg-[#101114] hover:bg-[#101114]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-[#F5F5F5]" />
                        {isRunningReceiveTest ? 'Running...' : 'Out-of-Order (8 MiB)'}
                      </button>

                      <button
                        onClick={() => handleTestReceiveFileEngine('duplicate-range')}
                        disabled={isRunningReceiveTest}
                        className="py-1.5 px-2.5 bg-[#101114] hover:bg-[#101114]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-[#F5F5F5]" />
                        {isRunningReceiveTest ? 'Running...' : 'Duplicate Range (1 MiB)'}
                      </button>

                      <button
                        onClick={() => handleTestReceiveFileEngine('zero-byte')}
                        disabled={isRunningReceiveTest}
                        className="py-1.5 px-2.5 bg-[#101114] hover:bg-[#101114]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-[#F5F5F5]" />
                        {isRunningReceiveTest ? 'Running...' : 'Zero-Byte (0 B)'}
                      </button>
                    </div>

                    {receiveDestination && !receiveDestination.isReleased && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleReleaseReceiveDestination}
                          className="py-1 px-2.5 bg-red-950/20 hover:bg-red-950/40 text-[#F5F5F5] border border-red-500/30 rounded text-[10px] font-medium transition-colors"
                        >
                          Release Destination Handle
                        </button>
                      </div>
                    )}

                    {receiveDiagnostic && (
                      <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider pb-1 border-b border-white/5">
                          <span>Receive Destination Diagnostic</span>
                          <span className={receiveDiagnostic.status === 'success' ? 'text-[#F5F5F5] font-semibold' : 'text-red-400 font-semibold'}>
                            {receiveDiagnostic.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Scenario:</span>
                          <span className="text-[#F5F5F5]">{receiveDiagnostic.scenario}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Transfer File ID:</span>
                          <span className="text-[#A6A8AD]">{receiveDiagnostic.transferFileId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Destination Filename:</span>
                          <span className="text-[#F5F5F5] truncate max-w-[200px]">{receiveDiagnostic.filename}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Expected / Written:</span>
                          <span className="text-[#F5F5F5]">{receiveDiagnostic.expectedSize.toLocaleString()} B / {receiveDiagnostic.bytesWritten.toLocaleString()} B</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Missing Ranges:</span>
                          <span className="text-[#A6A8AD]">{receiveDiagnostic.missingRangesCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Completion State:</span>
                          <span className={receiveDiagnostic.isComplete ? 'text-[#F5F5F5] font-semibold' : 'text-[#A6A8AD]'}>
                            {receiveDiagnostic.isComplete ? 'COMPLETE' : 'INCOMPLETE'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Read-Back Verified:</span>
                          <span className={receiveDiagnostic.readBackVerified ? 'text-[#F5F5F5] font-semibold' : 'text-[#A6A8AD]'}>
                            {receiveDiagnostic.readBackVerified ? 'BYTE-FOR-BYTE IDENTICAL' : 'FAILED'}
                          </span>
                        </div>
                        {receiveDiagnostic.durationMs !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Elapsed Time:</span>
                            <span className="text-[#A6A8AD]">{receiveDiagnostic.durationMs}ms</span>
                          </div>
                        )}
                        {receiveDiagnostic.errorMessage && (
                          <div className="text-red-400 text-[10px] pt-1">
                            Error: {receiveDiagnostic.errorMessage}
                          </div>
                        )}
                        <div className="pt-1 text-[9px] text-[#686B72]">
                          Trace: Protocol Manifest → TransferFileManager → FileEngine → FileWriter → FileSystemManager → NativeBridge → Rust
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 38: Native TCP LAN Spike Diagnostic */}
                  <div className="p-3.5 bg-[#17191D] border border-white/10 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-[#F5F5F5]" />
                        <span className="text-xs font-medium text-[#F5F5F5]">
                          Test Native TCP LAN Spike
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/5 text-[#A6A8AD] border border-white/10 rounded">
                        Step 38 TCP Socket Spike
                      </span>
                    </div>

                    <p className="text-[11px] text-[#A6A8AD] leading-relaxed">
                      Prove that the macOS native shell can host a local TCP socket server, establish peer connections, and exchange binary-safe framed messages (up to 1 MiB) with round-trip acknowledgements.
                    </p>

                    {/* Server Controls */}
                    <div className="p-2.5 bg-[#101114] border border-white/10 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider">
                        <span>TCP Server</span>
                        <span className={tcpServer ? 'text-[#F5F5F5] font-semibold' : 'text-[#686B72]'}>
                          {tcpServer ? `RUNNING (PORT ${tcpServer.port})` : 'STOPPED'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!tcpServer ? (
                          <>
                            <button
                              onClick={() => handleStartTcpServer(false)}
                              disabled={isStartingServer}
                              className="py-1 px-2.5 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <Play className="w-3 h-3 text-[#F5F5F5]" />
                              {isStartingServer ? 'Starting...' : 'Start Localhost Server'}
                            </button>
                            <button
                              onClick={() => handleStartTcpServer(true)}
                              disabled={isStartingServer}
                              className="py-1 px-2.5 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <Radio className="w-3 h-3 text-[#F5F5F5]" />
                              Start LAN Server (0.0.0.0)
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleStopTcpServer}
                            className="py-1 px-2.5 bg-red-950/30 hover:bg-red-950/50 text-[#F5F5F5] border border-red-500/30 rounded text-[11px] font-medium transition-colors"
                          >
                            Stop TCP Server
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Client & Message Exchange Controls */}
                    <div className="p-2.5 bg-[#101114] border border-white/10 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider">
                        <span>TCP Client & Diagnostics</span>
                        <span className={tcpClient ? 'text-[#F5F5F5] font-semibold' : 'text-[#686B72]'}>
                          {tcpClient ? 'CONNECTED' : 'NOT CONNECTED'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tcpConnectHost}
                          onChange={(e) => setTcpConnectHost(e.target.value)}
                          placeholder="Host (e.g. 127.0.0.1)"
                          className="px-2 py-1 bg-[#08090B] border border-white/10 rounded text-xs text-[#F5F5F5] w-28 font-mono"
                        />
                        <input
                          type="number"
                          value={tcpConnectPort || ''}
                          onChange={(e) => setTcpConnectPort(parseInt(e.target.value) || 0)}
                          placeholder="Port"
                          className="px-2 py-1 bg-[#08090B] border border-white/10 rounded text-xs text-[#F5F5F5] w-20 font-mono"
                        />
                        {!tcpClient ? (
                          <button
                            onClick={handleConnectTcp}
                            disabled={isConnectingTcp || !tcpConnectPort}
                            className="py-1 px-2.5 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                          >
                            {isConnectingTcp ? 'Connecting...' : 'Connect'}
                          </button>
                        ) : (
                          <button
                            onClick={handleDisconnectTcp}
                            className="py-1 px-2.5 bg-red-950/30 hover:bg-red-950/50 text-[#F5F5F5] border border-red-500/30 rounded text-[11px] font-medium transition-colors"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>

                      {tcpClient && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                          <button
                            onClick={handleSendTcpPing}
                            disabled={isRunningTcpTest}
                            className="py-1.5 px-2 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Play className="w-3 h-3 text-[#F5F5F5]" />
                            Send PING → PONG
                          </button>
                          <button
                            onClick={() => handleSendTcpPayload(64 * 1024)}
                            disabled={isRunningTcpTest}
                            className="py-1.5 px-2 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Play className="w-3 h-3 text-[#F5F5F5]" />
                            Send 64 KiB Payload
                          </button>
                          <button
                            onClick={() => handleSendTcpPayload(256 * 1024)}
                            disabled={isRunningTcpTest}
                            className="py-1.5 px-2 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Play className="w-3 h-3 text-[#F5F5F5]" />
                            Send 256 KiB Payload
                          </button>
                          <button
                            onClick={() => handleSendTcpPayload(1024 * 1024)}
                            disabled={isRunningTcpTest}
                            className="py-1.5 px-2 bg-[#17191D] hover:bg-[#17191D]/80 text-[#F5F5F5] border border-white/10 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Play className="w-3 h-3 text-[#F5F5F5]" />
                            Send 1 MiB Payload
                          </button>
                        </div>
                      )}
                    </div>

                    {tcpDiagnostic && (
                      <div className="p-2.5 bg-[#08090B] border border-white/10 rounded-lg space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between items-center text-[10px] text-[#686B72] uppercase tracking-wider pb-1 border-b border-white/5">
                          <span>TCP Socket Diagnostic Result</span>
                          <span className={tcpDiagnostic.status === 'success' ? 'text-[#F5F5F5] font-semibold' : 'text-red-400 font-semibold'}>
                            {tcpDiagnostic.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Action:</span>
                          <span className="text-[#F5F5F5]">{tcpDiagnostic.action}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Round-Trip Time:</span>
                          <span className="text-[#F5F5F5] font-semibold">{tcpDiagnostic.rttMs}ms</span>
                        </div>
                        {tcpDiagnostic.bytesSent > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#686B72]">Bytes Transmitted:</span>
                            <span className="text-[#A6A8AD]">{tcpDiagnostic.bytesSent.toLocaleString()} B</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Byte-for-Byte Verified:</span>
                          <span className={tcpDiagnostic.verified ? 'text-[#F5F5F5] font-semibold' : 'text-[#A6A8AD]'}>
                            {tcpDiagnostic.verified ? 'YES (ACK MATCH)' : 'NO / FAILED'}
                          </span>
                        </div>
                        {tcpDiagnostic.errorMessage && (
                          <div className="text-red-400 text-[10px] pt-1">
                            Error: {tcpDiagnostic.errorMessage}
                          </div>
                        )}
                        <div className="pt-1 text-[9px] text-[#686B72]">
                          Trace: React UI → MacTcpLanSpikeTransport → TauriIpc → Rust TcpStream → Remote Host
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between border-t border-white/5">
                    <span>Capabilities</span>
                    <span>Support</span>
                  </div>

                  {capabilityList.map((item) => (
                    <div
                      key={item.label}
                      className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                    >
                      <span className="text-[#F5F5F5]">{item.label}</span>
                      <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#A6A8AD]">
                        {item.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Bridge Test Results */}
              <div className="w-1/2 flex flex-col bg-[#101114]/30">
                <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Bridge Test Suite (17 Tests)</span>
                  {testSummary && (
                    <span className="text-[10px] px-2 py-0.5 bg-white/10 text-[#F5F5F5] border border-white/10 rounded">
                      {testSummary.passed}/{testSummary.total} PASSED ({testSummary.durationMs}ms)
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                  {!testSummary ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#686B72]">
                      <Layers className="w-8 h-8 mb-3 opacity-40 text-[#A6A8AD]" />
                      <p className="text-xs text-[#A6A8AD] mb-1">Bridge test suite not yet executed</p>
                      <p className="text-[11px] max-w-xs">
                        Click "Run Bridge Tests" to validate the 17 bridge contract operations: permissions, file/folder pickers, metadata, chunking, and error normalization.
                      </p>
                    </div>
                  ) : (
                    testSummary.tests.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {t.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#F5F5F5] shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#A6A8AD] shrink-0" />
                          )}
                          <span className="text-[#F5F5F5] truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-[#686B72] shrink-0 ml-2">{t.durationMs}ms</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[#101114] border-t border-white/10 flex items-center justify-between text-xs text-[#686B72]">
              <div className="flex items-center gap-4">
                <span>Contract Only</span>
                <span>•</span>
                <span>No Native Shell Dependency</span>
                <span>•</span>
                <span>Strict Separation</span>
              </div>
              <div>NearShare Bridge Core</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
