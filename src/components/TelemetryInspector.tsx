/**
 * NearShare Telemetry & Diagnostics Inspector (Development Only)
 *
 * Real-time diagnostic panel for monitoring throughput estimators,
 * sliding-window speeds, RTT latencies, connection stability, and chunk health.
 *
 * PALETTE: STRICT MONOCHROME (#08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72)
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Radio,
  Wifi,
  Terminal,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { TelemetryManager } from '../core/telemetry/TelemetryManager';
import type { TransferTelemetrySnapshot } from '../core/telemetry/TelemetryTypes';
import type { TelemetryEvent } from '../core/telemetry/TelemetryEvents';
import { GlassCloseButton } from './common/GlassCloseButton';

export const TelemetryInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const [isOpen, setIsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<TransferTelemetrySnapshot | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!isDev) return;
    const manager = TelemetryManager.getInstance();

    const unsubscribe = manager.onEvent((event: TelemetryEvent) => {
      if (isPaused) return;

      const time = new Date(event.timestamp).toLocaleTimeString();
      let msg = `[${time}] Event: ${event.type}`;

      if (event.type === 'telemetryUpdated') {
        setSnapshot(event.snapshot);
      } else if (event.type === 'latencyUpdated') {
        msg += ` | RTT: ${event.latestRttMs}ms (rolling: ${event.rollingRttMs}ms)`;
      } else if (event.type === 'chunkRetried') {
        msg += ` | Chunk #${event.chunkIndex} retry #${event.retryCount} (${event.reason})`;
      } else if (event.type === 'integrityFailure') {
        msg += ` | FAILURE: ${event.reason}`;
      } else if (event.type === 'transferCompleted') {
        msg += ` | Complete! Avg: ${(event.summary.averageSpeedBps / (1024 * 1024)).toFixed(1)} MB/s`;
      }

      setEvents((prev) => [msg, ...prev.slice(0, 49)]);
    });

    return unsubscribe;
  }, [isDev, isPaused]);

  if (!isDev) return null;

  const handleClear = () => {
    setEvents([]);
  };

  const formatMBps = (bps: number) => {
    return (bps / (1024 * 1024)).toFixed(2);
  };

  const formatEta = (ms: number | null) => {
    if (ms === null || ms < 0) return 'Unknown';
    if (ms === 0) return '0s';
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  };

  return (
    <>
      {/* Floating Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-36 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#101114]/90 border border-white/10 text-white/70 hover:text-white hover:border-white/20 text-xs font-mono backdrop-blur-md transition-all shadow-lg"
        title="Open Real-time Telemetry Diagnostics"
      >
        <Activity className="w-3.5 h-3.5 text-white/80" />
        <span>TELEMETRY</span>
        <span
          className={`w-2 h-2 rounded-full ${
            snapshot?.connectionState === 'stable'
              ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]'
              : snapshot?.connectionState === 'degraded'
              ? 'bg-white/50 animate-pulse'
              : 'bg-white/20'
          }`}
        />
      </button>

      {/* Modal Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-[#0d0e11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121317]/50">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-white/90" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Transfer Telemetry Diagnostics
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 uppercase">
                  Live Engine
                </span>
                {snapshot && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80 font-mono">
                    {snapshot.transportMode === 'direct' ? (
                      <Radio className="w-3 h-3 text-white/70" />
                    ) : (
                      <Wifi className="w-3 h-3 text-white/70" />
                    )}
                    {snapshot.transportMode.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`p-1.5 rounded-lg border transition-all text-xs flex items-center gap-1 ${
                    isPaused
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                  }`}
                  title={isPaused ? 'Resume Diagnostics Feed' : 'Pause Diagnostics Feed'}
                >
                  {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span className="text-[10px]">{isPaused ? 'Paused' : 'Pause'}</span>
                </button>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all"
                  title="Clear Event Log"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <GlassCloseButton onClose={() => setIsOpen(false)} ariaLabel="Close Telemetry Panel" />
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-white/70 font-sans">
              {/* Primary Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Current Speed</span>
                  <span className="font-mono text-white text-base font-semibold">
                    {snapshot ? `${formatMBps(snapshot.instantaneousSpeedBps)} MB/s` : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Rolling Average</span>
                  <span className="font-mono text-white text-base font-semibold">
                    {snapshot ? `${formatMBps(snapshot.averageSpeedBps)} MB/s` : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Peak Speed</span>
                  <span className="font-mono text-white text-base font-semibold">
                    {snapshot ? `${formatMBps(snapshot.peakSpeedBps)} MB/s` : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Estimated Remaining</span>
                  <span className="font-mono text-white text-base font-semibold">
                    {snapshot ? formatEta(snapshot.estimatedRemainingMs) : '—'}
                  </span>
                </div>
              </div>

              {/* Reliability & Latency Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Latency (RTT)</span>
                  <span className="font-mono text-white font-medium">
                    {snapshot?.latestLatencyMs !== null && snapshot?.latestLatencyMs !== undefined
                      ? `${snapshot.latestLatencyMs} ms`
                      : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Stability State</span>
                  <span className="font-mono text-white font-medium capitalize">
                    {snapshot?.connectionState || 'Idle'}
                    {snapshot && ` (${snapshot.stabilityScore}/100)`}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Chunks / Retries</span>
                  <span className="font-mono text-white font-medium">
                    {snapshot
                      ? `${snapshot.chunksCompleted} / ${snapshot.chunksRetried} retries`
                      : '0 / 0'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Reconnects / Fails</span>
                  <span className="font-mono text-white font-medium">
                    {snapshot
                      ? `${snapshot.reconnectCount} / ${snapshot.chunksFailed + snapshot.integrityFailures} fails`
                      : '0 / 0'}
                  </span>
                </div>
              </div>

              {/* Progress Detail */}
              {snapshot && (
                <div className="p-4 rounded-xl bg-[#121317] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60 font-mono">
                      Transfer ID: {snapshot.transferId}
                    </span>
                    <span className="text-white font-mono">
                      {Math.round(snapshot.progressRatio * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${Math.round(snapshot.progressRatio * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/40 font-mono">
                    <span>
                      {(snapshot.completedBytes / (1024 * 1024)).toFixed(1)} /{' '}
                      {(snapshot.totalBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <span>Platform: {snapshot.platform}</span>
                  </div>
                </div>
              )}

              {/* Event Logs */}
              <div className="space-y-2">
                <span className="text-[11px] text-white/50 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> Diagnostic Events ({events.length})
                </span>
                <div className="h-44 overflow-y-auto p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] space-y-1 text-white/60">
                  {events.length === 0 ? (
                    <div className="text-white/20 italic">No diagnostic events recorded.</div>
                  ) : (
                    events.map((ev, i) => <div key={i}>{ev}</div>)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
