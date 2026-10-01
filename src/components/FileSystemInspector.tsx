/**
 * NearShare Filesystem Inspector (Development Only)
 *
 * Diagnostic panel to inspect active native/mock filesystem capabilities,
 * verify platform adapter boundaries, and execute the deterministic test suite.
 *
 * PALETTE: STRICT MONOCHROME #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FolderTree,
  Check,
  X,
  Play,
  CheckCircle2,
  XCircle,
  Cpu,
  Layers,
} from 'lucide-react';
import { useFileSystem } from '../context/FileSystemContext';
import { useSettings } from '../context/SettingsContext';
import type { FsTestSuiteSummary } from '../core/filesystem/mock/mockFileSystemTestSuite';

export const FileSystemInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { adapter, capabilities, runTestSuite } = useFileSystem();
  const { settings } = useSettings();
  const reducedMotion = settings.reducedMotion;

  const [isOpen, setIsOpen] = useState(false);
  const [testSummary, setTestSummary] = useState<FsTestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape key listener for modal closing
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
      console.error('[FileSystemInspector] Test suite run failed:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  if (!isDev) {
    return null;
  }

  const capabilityItems = [
    { label: 'Read Files', active: capabilities.readFiles },
    { label: 'Write Files', active: capabilities.writeFiles },
    { label: 'Read Folders', active: capabilities.readFolders },
    { label: 'Write Folders', active: capabilities.writeFolders },
    { label: 'Streaming Read', active: capabilities.streamingRead },
    { label: 'Streaming Write', active: capabilities.streamingWrite },
    { label: 'Random Access Read', active: capabilities.randomAccessRead },
    { label: 'Random Access Write', active: capabilities.randomAccessWrite },
    { label: 'File Picker', active: capabilities.filePicker },
    { label: 'Directory Picker', active: capabilities.directoryPicker },
    { label: 'Persistent Access', active: capabilities.persistentAccess },
    { label: 'Background Access', active: capabilities.backgroundAccess },
    { label: 'Custom Destination', active: capabilities.customDestination },
  ];

  return (
    <>
      {/* Floating dev trigger badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open NearShare Native Filesystem Adapter Inspector"
        className="fixed bottom-4 right-84 z-50 flex items-center gap-2 px-3 py-2 bg-[#101114]/90 hover:bg-[#17191D] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-full text-xs font-mono backdrop-blur-md shadow-2xl transition-colors cursor-pointer pointer-events-auto"
        title="Open Native Filesystem Adapter Inspector (Dev Only)"
      >
        <FolderTree className="w-3.5 h-3.5 text-[#F5F5F5]" />
        <span>FS ADAPTER</span>
      </button>

      {/* Main Modal Viewport */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fs-inspector-title"
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
                    <h2 id="fs-inspector-title" className="text-sm font-semibold tracking-wide text-[#F5F5F5]">
                      NearShare Native Filesystem Adapter
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] bg-white/10 text-[#A6A8AD] border border-white/10 rounded">
                      ADAPTER CONTRACT
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-white/5 text-[#686B72] border border-white/5 rounded">
                      PLATFORM: {adapter.platform.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A6A8AD]">
                    Platform-neutral I/O boundary, opaque native reference isolation, and test runner
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
                  <span>{isRunningTests ? 'Running...' : 'Run Adapter Tests'}</span>
                </button>
                <button
                  ref={closeButtonRef}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Filesystem Inspector"
                  className="p-1.5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-bar */}
            <div className="px-6 py-2.5 bg-[#101114]/60 border-b border-white/10 text-xs text-[#A6A8AD] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>Active Adapter: <strong className="text-[#F5F5F5]">{adapter.constructor.name}</strong></span>
                <span>•</span>
                <span>Isolation: <strong className="text-[#F5F5F5]">Strict Opaque Handles</strong></span>
              </div>
              <div className="text-[11px] text-[#686B72]">
                Total Capabilities: <span className="text-[#F5F5F5] font-semibold">{capabilityItems.filter(c => c.active).length}/{capabilityItems.length} Active</span>
              </div>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Capability Matrix */}
              <div className="w-1/2 border-r border-white/10 flex flex-col bg-[#08090B]">
                <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Adapter Capability Matrix</span>
                  <span>Support State</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    {capabilityItems.map((item) => (
                      <div
                        key={item.label}
                        className="p-2.5 bg-[#17191D] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                      >
                        <span className="text-[#F5F5F5]">{item.label}</span>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {item.active ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 border border-white/15 rounded text-[#F5F5F5]">
                              <Check className="w-3 h-3 text-[#F5F5F5]" /> Supported
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[#686B72]">
                              <X className="w-3 h-3" /> Unsupported
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: 17-Scenario Test Runner Results */}
              <div className="w-1/2 flex flex-col bg-[#101114]/30">
                <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                  <span>Deterministic Adapter Test Suite</span>
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
                      <p className="text-xs text-[#A6A8AD] mb-1">Adapter test suite not yet executed</p>
                      <p className="text-[11px] max-w-xs">
                        Click "Run Adapter Tests" to validate the 17 platform adapter scenarios: metadata, chunk streaming, path safety, and duplicate protection.
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
                <span>Zero Absolute Path Leakage</span>
                <span>•</span>
                <span>Opaque Handles</span>
                <span>•</span>
                <span>Platform Agnostic Boundary</span>
              </div>
              <div>NearShare Filesystem Core</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
