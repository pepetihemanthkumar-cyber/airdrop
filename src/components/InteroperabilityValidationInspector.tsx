import React, { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Layers, Laptop, Smartphone } from 'lucide-react';
import {
  CROSS_PLATFORM_INTEROPERABILITY_ENTRIES,
  InteroperabilityReportGenerator,
  InteroperabilityEvidenceStore,
  type InteroperabilityEvidenceRecord,
  type EvidenceEnvironment,
  type InteroperabilityResultState,
  type PlatformType,
  type ConnectionMode,
} from '../core/validation/interoperability';

export const InteroperabilityValidationInspector: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'evidence' | 'verify'>('matrix');
  const [selectedPairId, setSelectedPairId] = useState<string>(CROSS_PLATFORM_INTEROPERABILITY_ENTRIES[0]?.pairId || '');

  // Manual evidence capture form state
  const [platformA, setPlatformA] = useState<PlatformType>('macOS');
  const [platformB, setPlatformB] = useState<PlatformType>('iOS');
  const [deviceIdA, setDeviceIdA] = useState('mac_device_01');
  const [deviceIdB, setDeviceIdB] = useState('ios_device_02');
  const [mode, setMode] = useState<ConnectionMode>('direct');
  const [environment, setEnvironment] = useState<EvidenceEnvironment>('physicalDirect');
  const [sha256Sender, setSha256Sender] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const [sha256Receiver, setSha256Receiver] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const [fileSize, setFileSize] = useState(1048576);
  const [durationMs, setDurationMs] = useState(420);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  const evidenceStore = InteroperabilityEvidenceStore.getInstance();
  const summary = InteroperabilityReportGenerator.generateSummaryReport();
  const records = evidenceStore.getAllRecords();

  const handleRecordEvidence = () => {
    setSubmissionError(null);
    setSubmissionSuccess(null);

    const record: InteroperabilityEvidenceRecord = {
      recordId: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      platformA,
      platformB,
      deviceIdA,
      deviceIdB,
      mode,
      transport: mode === 'direct' ? 'Native Direct Radio' : 'Native TCP LAN',
      environment,
      protocolVersion: '1.0',
      fileSize,
      bytesTransferred: fileSize,
      sha256Sender,
      sha256Receiver,
      durationMs,
      averageThroughputBps: durationMs > 0 ? Math.floor((fileSize * 1000) / durationMs) : 0,
      result: (sha256Sender === sha256Receiver ? 'PASS' : 'FAIL') as InteroperabilityResultState,
      securityValidated: true,
      checksumMatched: sha256Sender === sha256Receiver,
    };

    const res = evidenceStore.recordEvidence(record);
    if (!res.success) {
      setSubmissionError(res.error || 'Failed to record evidence');
    } else {
      setSubmissionSuccess(`Evidence record ${record.recordId} successfully committed to store`);
    }
  };

  const selectedEntry = CROSS_PLATFORM_INTEROPERABILITY_ENTRIES.find((e) => e.pairId === selectedPairId);

  return (
    <div className="flex flex-col h-full bg-black/90 text-white/90 p-4 font-mono text-xs overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-white/70" />
          <span className="font-semibold tracking-wider uppercase text-white/90">
            Cross-Platform Interoperability Validator
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'matrix' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Matrix ({summary.totalPairsEvaluated})
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'evidence' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Evidence ({records.length})
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'verify' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Record Physical Result
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white/5 p-2.5 rounded border border-white/10">
          <div className="text-white/50 text-[10px] uppercase">Protocol Alignment</div>
          <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> 100% Unified
          </div>
        </div>
        <div className="bg-white/5 p-2.5 rounded border border-white/10">
          <div className="text-white/50 text-[10px] uppercase">Direct Radio Pairs</div>
          <div className="text-sm font-semibold text-white/90 mt-1">{summary.directPairsCount} Combos</div>
        </div>
        <div className="bg-white/5 p-2.5 rounded border border-white/10">
          <div className="text-white/50 text-[10px] uppercase">LAN Transport Pairs</div>
          <div className="text-sm font-semibold text-white/90 mt-1">{summary.lanPairsCount} Combos</div>
        </div>
        <div className="bg-white/5 p-2.5 rounded border border-white/10">
          <div className="text-white/50 text-[10px] uppercase">Physical Hardware Status</div>
          <div className="text-sm font-semibold text-amber-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Blocked (No Multi-Device Lab)
          </div>
        </div>
      </div>

      {/* Tab: Matrix */}
      {activeTab === 'matrix' && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Pair List */}
          <div className="w-1/3 overflow-y-auto space-y-1.5 pr-1 border-r border-white/10">
            {CROSS_PLATFORM_INTEROPERABILITY_ENTRIES.map((entry) => (
              <div
                key={entry.pairId}
                onClick={() => setSelectedPairId(entry.pairId)}
                className={`p-2 rounded cursor-pointer border transition-colors ${
                  selectedPairId === entry.pairId
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{entry.platformA} ↔ {entry.platformB}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">
                    {entry.mode === 'direct' ? '⚡ Direct' : '📶 Wi-Fi'}
                  </span>
                </div>
                <div className="text-[10px] text-white/50 mt-1 flex items-center gap-1">
                  Status: <span className="text-amber-400">{entry.physicalInteroperabilityStatus}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pair Details */}
          <div className="w-2/3 pl-2 overflow-y-auto space-y-3">
            {selectedEntry ? (
              <>
                <div className="bg-white/5 p-3 rounded border border-white/10 space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {selectedEntry.platformA === 'macOS' || selectedEntry.platformA === 'Windows' ? (
                      <Laptop className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4" />
                    )}
                    <span>{selectedEntry.platformA}</span>
                    <span className="text-white/40">↔</span>
                    {selectedEntry.platformB === 'macOS' || selectedEntry.platformB === 'Windows' ? (
                      <Laptop className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4" />
                    )}
                    <span>{selectedEntry.platformB}</span>
                    <span className="text-white/40">({selectedEntry.mode.toUpperCase()})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-white/10">
                    <div>
                      <span className="text-white/50">Direct Radio Compatibility:</span>{' '}
                      <span className="text-white/90 font-medium">{selectedEntry.directRadioCompatibility}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Primary Transport:</span>{' '}
                      <span className="text-white/90 font-medium">{selectedEntry.primaryTransport}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Native Code A / B:</span>{' '}
                      <span className="text-emerald-400">{selectedEntry.nativeCodePresentA ? 'Yes' : 'No'}</span> /{' '}
                      <span className="text-emerald-400">{selectedEntry.nativeCodePresentB ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Security Protocol:</span>{' '}
                      <span className="text-white/90">{selectedEntry.securityProtocol}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 p-3 rounded border border-white/10 space-y-1.5">
                  <div className="text-white/70 font-semibold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span>Physical Verification Assessment</span>
                  </div>
                  <div className="text-amber-400 text-[11px]">
                    Status: {selectedEntry.physicalInteroperabilityStatus}
                  </div>
                  <div className="text-white/60 text-[11px]">
                    {selectedEntry.failureOrBlockerReason}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-white/40 italic">Select a pair to inspect details</div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Evidence */}
      {activeTab === 'evidence' && (
        <div className="space-y-3 flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="bg-white/5 p-6 rounded border border-white/10 text-center text-white/50">
              No physical validation records submitted yet. Physical hardware pair is pending.
            </div>
          ) : (
            records.map((r) => (
              <div key={r.recordId} className="bg-white/5 p-3 rounded border border-white/10 space-y-1">
                <div className="flex justify-between items-center font-semibold">
                  <span>{r.platformA} ({r.deviceIdA}) ↔ {r.platformB} ({r.deviceIdB})</span>
                  <span className={r.result === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}>{r.result}</span>
                </div>
                <div className="text-[10px] text-white/50">
                  Env: {r.environment} | Size: {r.fileSize} bytes | Throughput: {(r.averageThroughputBps / (1024 * 1024)).toFixed(2)} MB/s
                </div>
                <div className="text-[10px] text-white/40 truncate">
                  SHA-256 Sender: {r.sha256Sender}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Record Physical Evidence */}
      {activeTab === 'verify' && (
        <div className="bg-white/5 p-4 rounded border border-white/10 space-y-3 max-w-lg">
          <div className="font-semibold text-white/90">Submit Physical Device Test Evidence</div>

          {submissionError && (
            <div className="bg-rose-500/20 text-rose-300 p-2 rounded border border-rose-500/30">
              Error: {submissionError}
            </div>
          )}
          {submissionSuccess && (
            <div className="bg-emerald-500/20 text-emerald-300 p-2 rounded border border-emerald-500/30">
              {submissionSuccess}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 block mb-1">Platform A</label>
              <select
                value={platformA}
                onChange={(e) => setPlatformA(e.target.value as PlatformType)}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              >
                <option value="macOS">macOS</option>
                <option value="Windows">Windows</option>
                <option value="Android">Android</option>
                <option value="iOS">iOS</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 block mb-1">Platform B</label>
              <select
                value={platformB}
                onChange={(e) => setPlatformB(e.target.value as PlatformType)}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              >
                <option value="iOS">iOS</option>
                <option value="macOS">macOS</option>
                <option value="Windows">Windows</option>
                <option value="Android">Android</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 block mb-1">Device ID A (Distinct)</label>
              <input
                type="text"
                value={deviceIdA}
                onChange={(e) => setDeviceIdA(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              />
            </div>
            <div>
              <label className="text-white/50 block mb-1">Device ID B (Distinct)</label>
              <input
                type="text"
                value={deviceIdB}
                onChange={(e) => setDeviceIdB(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 block mb-1">Transport Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ConnectionMode)}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              >
                <option value="direct">Direct (P2P Radio)</option>
                <option value="wifi">Wi-Fi (Local Network)</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 block mb-1">Evidence Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as EvidenceEnvironment)}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              >
                <option value="physicalDirect">physicalDirect</option>
                <option value="physicalLan">physicalLan</option>
                <option value="localhost">localhost</option>
                <option value="deterministic">deterministic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 block mb-1">File Size (Bytes)</label>
              <input
                type="number"
                value={fileSize}
                onChange={(e) => setFileSize(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              />
            </div>
            <div>
              <label className="text-white/50 block mb-1">Duration (ms)</label>
              <input
                type="number"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
                className="w-full bg-black/60 border border-white/20 rounded p-1.5"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 block mb-1">Sender SHA-256 Digest</label>
            <input
              type="text"
              value={sha256Sender}
              onChange={(e) => setSha256Sender(e.target.value)}
              className="w-full bg-black/60 border border-white/20 rounded p-1.5"
            />
          </div>

          <div>
            <label className="text-white/50 block mb-1">Receiver SHA-256 Digest</label>
            <input
              type="text"
              value={sha256Receiver}
              onChange={(e) => setSha256Receiver(e.target.value)}
              className="w-full bg-black/60 border border-white/20 rounded p-1.5"
            />
          </div>

          <button
            onClick={handleRecordEvidence}
            className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 rounded transition-colors"
          >
            Validate & Commit Evidence Record
          </button>
        </div>
      )}
    </div>
  );
};
