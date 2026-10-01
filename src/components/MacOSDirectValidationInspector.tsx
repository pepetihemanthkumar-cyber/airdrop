/**
 * NearShare macOS Direct Transfer Validation & Observability Inspector (Development Only)
 *
 * Dedicated laboratory diagnostic screen for the real native MultipeerConnectivity Direct Mode pipeline.
 * Exposes role switching, environment barriers, physical gate criteria, live telemetry, and scenario execution.
 *
 * PALETTE: STRICT MONOCHROME #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 */

import React, { useState, useEffect } from 'react';
import {
  Radio,
  X,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Activity,
  Layers,
  Cpu,
  Lock,
} from 'lucide-react';
import {
  MacOSDirectValidationStore,
  type ValidationStoreState,
  type ValidationRole,
  type ValidationEnvironment,
  MACOS_DIRECT_SCENARIOS,
} from '../core/validation/direct';

export const MacOSDirectValidationInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const [isOpen, setIsOpen] = useState(false);
  const [storeState, setStoreState] = useState<ValidationStoreState>(() =>
    MacOSDirectValidationStore.getInstance().getState()
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!isDev) return;
    const store = MacOSDirectValidationStore.getInstance();
    const unsub = store.subscribe((st) => setStoreState(st));
    return unsub;
  }, [isDev]);

  if (!isDev) return null;

  const store = MacOSDirectValidationStore.getInstance();
  const scenarios = MACOS_DIRECT_SCENARIOS.filter(
    (s) => selectedCategory === 'all' || s.category === selectedCategory
  );

  const handleExportJson = () => {
    const data = store.exportReport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macos-direct-validation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const md = store.exportMarkdownReport();
    navigator.clipboard.writeText(md);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const categories = [
    'all',
    'discovery',
    'pairing',
    'session',
    'transfer',
    'control',
    'recovery',
    'integrity',
    'security',
    'lifecycle',
  ];

  return (
    <>
      {/* Floating Inspector Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-[#101114]/90 hover:bg-[#17191D] border border-white/10 rounded-full text-xs font-mono text-[#A6A8AD] shadow-xl backdrop-blur-md transition-all hover:scale-105"
        title="Open macOS Direct Validation & Observability Inspector"
      >
        <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
        <span>DIRECT VALIDATOR</span>
      </button>

      {/* Main Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl h-[88vh] bg-[#08090B] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#F5F5F5]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#101114]/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                    macOS Direct Transfer Validation Engine
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-white/10 rounded-md text-[#A6A8AD]">
                      DEV ONLY
                    </span>
                  </h2>
                  <p className="text-xs text-[#A6A8AD]">
                    MultipeerConnectivity Native Pipeline &amp; Observability Matrix
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {copySuccess ? 'Copied MD!' : 'Copy MD'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[#A6A8AD] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-Header: Role & Environment Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-3 bg-[#101114]/80 border-b border-white/5 text-xs font-mono">
              {/* Role Selection */}
              <div className="flex items-center gap-2">
                <span className="text-[#686B72]">ROLE:</span>
                {(['SENDER', 'RECEIVER'] as ValidationRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => store.setRole(r)}
                    className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                      storeState.role === r
                        ? 'bg-white text-black font-semibold border-white'
                        : 'bg-white/5 text-[#A6A8AD] border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Environment Selection */}
              <div className="flex items-center gap-2">
                <span className="text-[#686B72]">ENV:</span>
                {(['deterministic', 'localhost', 'lan', 'physicalDirect'] as ValidationEnvironment[]).map((env) => (
                  <button
                    key={env}
                    onClick={() => store.setEnvironment(env)}
                    className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${
                      storeState.environment === env
                        ? 'bg-white text-black font-semibold border-white'
                        : 'bg-white/5 text-[#A6A8AD] border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>

              {/* Status Pills */}
              <div className="flex items-center justify-end gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#686B72]">Native:</span>
                  <span className="text-emerald-400 font-semibold">IMPLEMENTED</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#686B72]">Physical:</span>
                  <span className="text-amber-400 font-semibold">UNVERIFIED</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Physical Gate Card */}
              <div className="p-4 bg-[#101114] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A6A8AD] flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-white" />
                    Physical Direct Validation Gate
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                      storeState.gateState.passed
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {storeState.gateState.passed ? 'GATE OPEN' : 'GATE BLOCKED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 bg-black/40 rounded border border-white/5 flex items-center justify-between">
                    <span className="text-[#686B72]">Native Swift</span>
                    <span className="text-emerald-400">OK</span>
                  </div>
                  <div className="p-2 bg-black/40 rounded border border-white/5 flex items-center justify-between">
                    <span className="text-[#686B72]">macOS Host</span>
                    <span className={storeState.gateState.macOsRuntimeConfirmed ? 'text-emerald-400' : 'text-rose-400'}>
                      {storeState.gateState.macOsRuntimeConfirmed ? 'OK' : 'FAIL'}
                    </span>
                  </div>
                  <div className="p-2 bg-black/40 rounded border border-white/5 flex items-center justify-between">
                    <span className="text-[#686B72]">Remote Peer</span>
                    <span className={storeState.gateState.peerDeviceDetected ? 'text-emerald-400' : 'text-amber-400'}>
                      {storeState.gateState.peerDeviceDetected ? 'DETECTED' : 'NONE'}
                    </span>
                  </div>
                  <div className="p-2 bg-black/40 rounded border border-white/5 flex items-center justify-between">
                    <span className="text-[#686B72]">Transport Path</span>
                    <span className="text-white">{storeState.transportUsed}</span>
                  </div>
                </div>

                {storeState.gateState.blockReason && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{storeState.gateState.blockReason}</span>
                  </div>
                )}
              </div>

              {/* Live Observability & Telemetry Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stream Metrics */}
                <div className="p-4 bg-[#101114] border border-white/10 rounded-xl space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-[#A6A8AD] flex items-center gap-1.5 font-semibold">
                      <Activity className="w-3.5 h-3.5 text-white" />
                      STREAM TELEMETRY
                    </span>
                    <span className="text-[10px] text-[#686B72]">LIVE NATIVE COUNTERS</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-[#686B72]">Frames Sent / Recv: </span>
                      <span className="text-white">
                        {storeState.streamTelemetry.framesSent} / {storeState.streamTelemetry.framesReceived}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686B72]">Bytes Sent: </span>
                      <span className="text-white">{(storeState.streamTelemetry.bytesSent / 1024).toFixed(1)} KB</span>
                    </div>
                    <div>
                      <span className="text-[#686B72]">Partial Reads/Writes: </span>
                      <span className="text-white">
                        {storeState.streamTelemetry.partialReads} / {storeState.streamTelemetry.partialWrites}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686B72]">Errors / Reconnects: </span>
                      <span className="text-white">
                        {storeState.streamTelemetry.streamErrors} / {storeState.streamTelemetry.reconnectCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bounded Memory Metrics */}
                <div className="p-4 bg-[#101114] border border-white/10 rounded-xl space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-[#A6A8AD] flex items-center gap-1.5 font-semibold">
                      <Cpu className="w-3.5 h-3.5 text-white" />
                      BOUNDED MEMORY MODEL
                    </span>
                    <span className="text-[10px] text-emerald-400">BOUNDED</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-[#686B72]">Native Stream Peak: </span>
                      <span className="text-white">
                        {(storeState.memoryMetrics.nativeStreamBufferPeakBytes / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686B72]">Protocol Buffer Peak: </span>
                      <span className="text-white">
                        {(storeState.memoryMetrics.protocolBufferPeakBytes / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686B72]">Backpressure Peak: </span>
                      <span className="text-white">
                        {(storeState.memoryMetrics.transferBackpressurePeakBytes / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                    <div>
                      <span className="text-[#686B72]">In-Flight Max: </span>
                      <span className="text-white">16 Chunks / 64 MB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scenarios Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-white" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A6A8AD]">
                      Scenario Matrix (DIRECT-PHYS-001 ... 030)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => store.runAllScenarios()}
                      disabled={storeState.isRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-semibold rounded-lg text-xs font-mono hover:bg-[#F5F5F5] disabled:opacity-50 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      Run All Matrix
                    </button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-md border capitalize transition-colors ${
                        selectedCategory === cat
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-white/5 text-[#A6A8AD] border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Scenario List */}
                <div className="space-y-2">
                  {scenarios.map((sc) => {
                    const result = storeState.results.get(sc.code);
                    const isPassed = result?.result === 'PASS';
                    const isBlocked = result?.result === 'BLOCKED';
                    const isFailed = result?.result === 'FAIL';

                    return (
                      <div
                        key={sc.code}
                        className="p-3 bg-[#101114] border border-white/5 hover:border-white/15 rounded-xl flex items-center justify-between gap-4 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {isBlocked && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                            {isFailed && <XCircle className="w-4 h-4 text-rose-400" />}
                            {!result || result.result === 'NOT_RUN' ? (
                              <div className="w-4 h-4 rounded-full border border-white/20" />
                            ) : null}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-white">{sc.code}</span>
                              <span className="text-xs text-[#A6A8AD]">{sc.name}</span>
                              <span className="text-[10px] font-mono uppercase text-[#686B72] px-1.5 py-0.2 bg-white/5 rounded">
                                {sc.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#686B72] mt-0.5">{sc.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 font-mono text-xs">
                          {result && result.result !== 'NOT_RUN' && (
                            <span
                              className={`px-2 py-0.5 text-[10px] rounded border ${
                                isPassed
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isBlocked
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {result.result}
                            </span>
                          )}

                          <button
                            onClick={() => store.runScenario(sc.code)}
                            disabled={storeState.isRunning}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-[#A6A8AD] hover:text-white transition-colors disabled:opacity-50"
                          >
                            Run
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
