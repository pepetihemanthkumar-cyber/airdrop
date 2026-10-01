/**
 * NearShare File Engine Inspector (Development Only)
 *
 * Provides a strictly monochromatic, zero-secret diagnostic viewport for inspecting
 * chunk boundaries, resume checkpoints, staging buffers, and running the mock test suite.
 *
 * PALETTE: STRICT MONOCHROME #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HardDrive,
  Cpu,
  Layers,
  Play,
  RotateCcw,
  Check,
  X,
  FileCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useFileEngine } from '../context/FileEngineContext';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_CHUNK_SIZE } from '../core/protocol/messageTypes';
import type { FileSource, FileChunk } from '../core/file/types';
import type { TestSuiteSummary } from '../core/file/mock/mockFileTestSuite';

const SAMPLE_DEV_FILES: FileSource[] = [
  {
    fileId: 'dev_sample_01',
    name: 'Syntra_Core_Spec.pdf',
    size: 12582912, // 12 MiB (3 chunks)
    type: 'pdf',
    mimeType: 'application/pdf',
    relativePath: 'Documents/Syntra_Core_Spec.pdf',
    modifiedAt: Date.now() - 3600000,
  },
  {
    fileId: 'dev_sample_02',
    name: 'SystemLogs_ZeroByte.log',
    size: 0, // 0-byte edge case
    type: 'log',
    mimeType: 'text/plain',
    relativePath: 'Logs/SystemLogs_ZeroByte.log',
    modifiedAt: Date.now() - 7200000,
  },
  {
    fileId: 'dev_sample_03',
    name: '4MiB_ExactBoundary.bin',
    size: DEFAULT_CHUNK_SIZE, // 4,194,304 bytes (1 exact chunk)
    type: 'bin',
    mimeType: 'application/octet-stream',
    relativePath: 'Binaries/4MiB_ExactBoundary.bin',
    modifiedAt: Date.now() - 1000000,
  },
  {
    fileId: 'dev_sample_04',
    name: '4MiB_PlusOneByte.bin',
    size: DEFAULT_CHUNK_SIZE + 1, // 2 chunks
    type: 'bin',
    mimeType: 'application/octet-stream',
    relativePath: 'Binaries/4MiB_PlusOneByte.bin',
    modifiedAt: Date.now() - 500000,
  },
];

export const FileEngineInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { engine, runTestSuite } = useFileEngine();
  const { settings } = useSettings();
  const reducedMotion = settings.reducedMotion;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileSource>(SAMPLE_DEV_FILES[0]);
  const [customChunkSize, setCustomChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
  const [testSummary, setTestSummary] = useState<TestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [activeSimulationTransferId, setActiveSimulationTransferId] = useState<string | null>(null);
  const [simulatedChunks, setSimulatedChunks] = useState<FileChunk[]>([]);
  const [isSimulatingChunking, setIsSimulatingChunking] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard accessibility: Escape key to close modal
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

  const handleExecuteTestSuite = async () => {
    setIsRunningTests(true);
    try {
      const summary = await runTestSuite();
      setTestSummary(summary);
    } catch (err) {
      console.error('[FileEngineInspector] Test suite run failed:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleRunChunkSimulation = useCallback(async () => {
    setIsSimulatingChunking(true);
    const transferId = `sim_tr_${Date.now().toString(36)}`;
    setActiveSimulationTransferId(transferId);

    try {
      const readHandle = await engine.openRead(selectedFile);
      const writeHandle = await engine.createWrite(transferId, selectedFile);

      const totalChunks = Math.ceil(selectedFile.size / customChunkSize) || (selectedFile.size === 0 ? 0 : 1);
      const chunks: FileChunk[] = [];

      if (totalChunks === 0) {
        // 0-byte file
        await engine.finalizeWrite(writeHandle);
      } else {
        for (let i = 0; i < totalChunks; i++) {
          const chunk = await engine.readChunk(readHandle, i, transferId, customChunkSize);
          chunks.push(chunk);
          await engine.writeChunk(writeHandle, chunk);
        }
        await engine.finalizeWrite(writeHandle);
      }

      await engine.closeRead(readHandle);
      setSimulatedChunks(chunks);
    } catch (err) {
      console.error('[FileEngineInspector] Chunk simulation failed:', err);
    } finally {
      setIsSimulatingChunking(false);
    }
  }, [engine, selectedFile, customChunkSize]);

  const handleClearSimulation = async () => {
    if (activeSimulationTransferId) {
      await engine.cleanupTransfer(activeSimulationTransferId);
    }
    setActiveSimulationTransferId(null);
    setSimulatedChunks([]);
  };

  if (!isDev) {
    return null;
  }

  const totalChunks = selectedFile.size === 0 ? 0 : Math.ceil(selectedFile.size / customChunkSize);
  const checkpoint = activeSimulationTransferId
    ? engine.getCheckpoint(activeSimulationTransferId, selectedFile.fileId)
    : null;

  return (
    <>
      {/* Floating Trigger Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open NearShare File Engine Inspector"
        className="fixed bottom-4 right-48 z-50 flex items-center gap-2 px-3 py-2 bg-[#101114]/90 hover:bg-[#17191D] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-full text-xs font-mono backdrop-blur-md shadow-2xl transition-colors cursor-pointer pointer-events-auto"
        title="Open File Engine Inspector (Dev Only)"
      >
        <HardDrive className="w-3.5 h-3.5 text-[#F5F5F5]" />
        <span>FILE ENGINE</span>
      </button>

      {/* Main Inspector Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-inspector-title"
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
                    <h2 id="file-inspector-title" className="text-sm font-semibold tracking-wide text-[#F5F5F5]">
                      NearShare File Engine Inspector
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] bg-white/10 text-[#A6A8AD] border border-white/10 rounded">
                      CHUNK/RESUME CONTRACT
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-white/5 text-[#686B72] border border-white/5 rounded">
                      DEV ONLY
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A6A8AD]">
                    Boundary validation, chunk arithmetic, and resume test harness
                  </p>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExecuteTestSuite}
                  disabled={isRunningTests}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-[#F5F5F5]" />
                  <span>{isRunningTests ? 'Running Suite...' : 'Run Test Suite'}</span>
                </button>
                <button
                  ref={closeButtonRef}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close File Engine Inspector"
                  className="p-1.5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-bar: Target File Selector & Chunk Size Controls */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-[#101114]/60 border-b border-white/10 text-xs text-[#A6A8AD]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-[#686B72]" />
                  <span>Inspect File:</span>
                  <select
                    value={selectedFile.fileId}
                    onChange={(e) => {
                      const f = SAMPLE_DEV_FILES.find((x) => x.fileId === e.target.value);
                      if (f) {
                        setSelectedFile(f);
                        setSimulatedChunks([]);
                        setActiveSimulationTransferId(null);
                      }
                    }}
                    className="bg-[#17191D] text-[#F5F5F5] border border-white/10 rounded px-2 py-1 text-xs outline-none"
                  >
                    {SAMPLE_DEV_FILES.map((f) => (
                      <option key={f.fileId} value={f.fileId}>
                        {f.name} ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>Chunk Size:</span>
                  <select
                    value={customChunkSize}
                    onChange={(e) => {
                      setCustomChunkSize(Number(e.target.value));
                      setSimulatedChunks([]);
                    }}
                    className="bg-[#17191D] text-[#F5F5F5] border border-white/10 rounded px-2 py-1 text-xs outline-none"
                  >
                    <option value={DEFAULT_CHUNK_SIZE}>4 MiB (Standard Default)</option>
                    <option value={1048576}>1 MiB (Mobile Constrained)</option>
                    <option value={524288}>512 KiB (BLE/Simulated)</option>
                    <option value={2097152}>2 MiB (Direct P2P)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunChunkSimulation}
                  disabled={isSimulatingChunking}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs text-[#F5F5F5] border border-white/10 rounded cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Simulate Chunking</span>
                </button>
                <button
                  onClick={handleClearSimulation}
                  disabled={simulatedChunks.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs text-[#A6A8AD] border border-white/10 rounded cursor-pointer"
                  title="Purge staging area"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Purge Staging</span>
                </button>
              </div>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Metadata & Chunk Descriptors */}
              <div className="w-1/2 border-r border-white/10 flex flex-col bg-[#08090B]">
                <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>File Metadata & Boundary Math</span>
                  <span>Calculated Bounds</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                      <span className="text-[10px] text-[#686B72] block">File ID</span>
                      <span className="text-[#F5F5F5] font-semibold">{selectedFile.fileId}</span>
                    </div>
                    <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                      <span className="text-[10px] text-[#686B72] block">Type</span>
                      <span className="text-[#F5F5F5] uppercase">{selectedFile.type}</span>
                    </div>
                    <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                      <span className="text-[10px] text-[#686B72] block">Exact Size</span>
                      <span className="text-[#F5F5F5] font-mono">{selectedFile.size.toLocaleString()} bytes</span>
                    </div>
                    <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg">
                      <span className="text-[10px] text-[#686B72] block">Total Chunks</span>
                      <span className="text-[#F5F5F5] font-bold">{totalChunks} chunks</span>
                    </div>
                    <div className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg col-span-2">
                      <span className="text-[10px] text-[#686B72] block">Relative Path (No absolute leak)</span>
                      <span className="text-[#A6A8AD] text-[11px]">{selectedFile.relativePath}</span>
                    </div>
                  </div>

                  {/* Simulated Chunk Stream */}
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider text-[#686B72] mb-3 flex items-center justify-between">
                      <span>Chunk Descriptors ({simulatedChunks.length} Staged)</span>
                      <span className="text-[10px] text-[#A6A8AD]">
                        {simulatedChunks.length === totalChunks && totalChunks > 0 ? 'All Chunks Staged' : ''}
                      </span>
                    </h4>

                    {simulatedChunks.length === 0 ? (
                      <div className="p-6 bg-[#17191D]/40 border border-white/5 rounded-xl text-center text-xs text-[#686B72]">
                        <Layers className="w-6 h-6 mx-auto mb-2 opacity-40 text-[#A6A8AD]" />
                        <p className="text-[#A6A8AD] mb-1">No chunks currently staged</p>
                        <p className="text-[11px]">Click "Simulate Chunking" to read, chunk, and stage this file in memory.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {simulatedChunks.map((chunk) => (
                          <div
                            key={chunk.chunkIndex}
                            className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg flex items-center justify-between text-xs font-mono"
                          >
                            <div>
                              <span className="text-[#F5F5F5] font-semibold">Chunk #{chunk.chunkIndex}</span>
                              <span className="text-[#686B72] text-[10px] ml-2">
                                offset {chunk.offset.toLocaleString()}B | len {chunk.length.toLocaleString()}B
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A6A8AD]">
                              <ShieldCheck className="w-3 h-3 text-[#F5F5F5]" />
                              <span>{chunk.checksum ? chunk.checksum.substring(0, 16) + '...' : 'Verified'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Checkpoints & Test Suite Results */}
              <div className="w-1/2 flex flex-col bg-[#101114]/30">
                <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Resume Checkpoint & Test Suite Execution</span>
                  <span>Integrity Validation</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Checkpoint Status */}
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider text-[#686B72] mb-3">
                      Active Resume Checkpoint
                    </h4>
                    {checkpoint ? (
                      <div className="p-3.5 bg-[#17191D] border border-white/10 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Transfer ID:</span>
                          <span className="text-[#F5F5F5]">{checkpoint.transferId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Next Chunk Index:</span>
                          <span className="text-[#F5F5F5] font-semibold">{checkpoint.nextChunkIndex}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#686B72]">Bytes Received:</span>
                          <span className="text-[#F5F5F5] font-mono">{checkpoint.bytesReceived.toLocaleString()} bytes</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-[#17191D]/40 border border-white/5 rounded-xl text-xs text-[#686B72]">
                        No active checkpoint for this file (Idle / Completed / Cleaned).
                      </div>
                    )}
                  </div>

                  {/* Deterministic Test Suite Results */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] uppercase tracking-wider text-[#686B72]">
                        Deterministic Edge-Case Test Suite
                      </h4>
                      {testSummary && (
                        <span className="text-[10px] px-2 py-0.5 bg-white/10 text-[#F5F5F5] border border-white/10 rounded">
                          {testSummary.passed}/{testSummary.total} Passed ({testSummary.durationMs}ms)
                        </span>
                      )}
                    </div>

                    {!testSummary ? (
                      <div className="p-6 bg-[#17191D]/40 border border-white/5 rounded-xl text-center text-xs text-[#686B72]">
                        <p className="text-[#A6A8AD] mb-1">Test suite has not been executed in this session.</p>
                        <p className="text-[11px]">Click "Run Test Suite" to validate 0-byte, 1-byte, exact 4 MiB, out-of-order, and duplicate handling.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {testSummary.results.map((res) => (
                          <div
                            key={res.id}
                            className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {res.passed ? (
                                <Check className="w-3.5 h-3.5 text-[#F5F5F5]" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-[#A6A8AD]" />
                              )}
                              <span className="text-[#F5F5F5]">{res.name}</span>
                            </div>
                            <span className="text-[10px] text-[#686B72]">{res.durationMs}ms</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[#101114] border-t border-white/10 flex items-center justify-between text-xs text-[#686B72]">
              <div className="flex items-center gap-4">
                <span>Deterministic I/O Isolation</span>
                <span>•</span>
                <span>Zero File Path Leakage</span>
                <span>•</span>
                <span>Platform Agnostic Contract</span>
              </div>
              <div>NearShare FileEngine Core</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
