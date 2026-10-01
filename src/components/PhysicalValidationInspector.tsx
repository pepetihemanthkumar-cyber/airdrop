/**
 * NearShare Physical Validation Inspector (Development Only)
 *
 * Dedicated laboratory diagnostic screen to evaluate physical multi-device
 * validation evidence, device pairs, and standard scenarios (PHYS-001 through PHYS-032).
 *
 * PALETTE: STRICT MONOCHROME #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Layers,
  Radio,
  Wifi,
  Laptop,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  PhysicalValidationRunner,
  PhysicalValidationReportGenerator,
  REQUIRED_DEVICE_PAIRS,
  PHYSICAL_SCENARIOS,
  type DevicePlatform,
  type TransportValidationMode,
} from '../core/validation';

export const PhysicalValidationInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [selectedMode, setSelectedMode] = useState<TransportValidationMode>('wifi');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('PHYS-001');

  if (!isDev) return null;

  const runner = PhysicalValidationRunner.getInstance();
  const currentPair = REQUIRED_DEVICE_PAIRS[selectedPairIndex] || REQUIRED_DEVICE_PAIRS[0];
  const scenarios = PHYSICAL_SCENARIOS;
  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const pairEvaluation = runner.evaluateDevicePair(
    currentPair.senderPlatform,
    currentPair.receiverPlatform,
    selectedMode
  );

  const reportSummary = PhysicalValidationReportGenerator.generateSummary(runner);

  const getPlatformIcon = (platform: DevicePlatform) => {
    switch (platform) {
      case 'macOS':
      case 'Windows':
        return <Laptop className="w-4 h-4 text-[#A6A8AD]" />;
      case 'Android':
      case 'iOS':
        return <Smartphone className="w-4 h-4 text-[#A6A8AD]" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/10 text-white border border-white/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-white" /> PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-400" /> FAIL
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#A6A8AD]/10 text-[#A6A8AD] border border-[#A6A8AD]/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-[#A6A8AD]" /> BLOCKED
          </span>
        );
      case 'NOT_AVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-800 text-neutral-400 border border-neutral-700">
            NOT AVAILABLE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#17191D] text-[#686B72] border border-white/5">
            NOT RUN
          </span>
        );
    }
  };

  return (
    <>
      {/* Floating Trigger Button in Dev Mode */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-40 px-3 py-1.5 rounded-lg bg-[#101114]/90 border border-white/10 text-[#A6A8AD] hover:text-white text-xs font-mono flex items-center gap-2 backdrop-blur-md shadow-xl transition-colors hover:border-white/25"
        title="Open Physical Multi-Device Validation Inspector"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-white" />
        <span>PHYSICAL VALIDATION</span>
      </button>

      {/* Modal Inspector */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-5xl h-[85vh] bg-[#08090B] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#101114]/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#F5F5F5] tracking-wide flex items-center gap-2">
                    PHYSICAL MULTI-DEVICE VALIDATION INSPECTOR
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A6A8AD] border border-white/10 font-mono">
                      DEV ONLY
                    </span>
                  </h2>
                  <p className="text-xs text-[#686B72] mt-0.5">
                    Strict Evidence-Based Physical Matrix & Scenario Verifier (32 Scenarios)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[#A6A8AD] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Header: Device Pairs & Mode Selector */}
            <div className="px-6 py-3 border-b border-white/5 bg-[#0C0D10] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#686B72] font-mono">DEVICE PAIR:</span>
                <select
                  value={selectedPairIndex}
                  onChange={(e) => setSelectedPairIndex(Number(e.target.value))}
                  className="bg-[#17191D] border border-white/10 rounded-lg px-3 py-1 text-xs text-[#F5F5F5] font-mono focus:outline-none focus:border-white/30"
                >
                  {REQUIRED_DEVICE_PAIRS.map((pair, idx) => (
                    <option key={pair.id} value={idx}>
                      {pair.senderPlatform} ↔ {pair.receiverPlatform} ({pair.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#686B72] font-mono">TRANSPORT MODE:</span>
                <div className="flex bg-[#101114] p-0.5 rounded-lg border border-white/10">
                  <button
                    onClick={() => setSelectedMode('wifi')}
                    className={`px-3 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors ${
                      selectedMode === 'wifi'
                        ? 'bg-white/15 text-white font-medium shadow-sm'
                        : 'text-[#686B72] hover:text-[#A6A8AD]'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" /> Wi-Fi / LAN
                  </button>
                  <button
                    onClick={() => setSelectedMode('direct')}
                    className={`px-3 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors ${
                      selectedMode === 'direct'
                        ? 'bg-white/15 text-white font-medium shadow-sm'
                        : 'text-[#686B72] hover:text-[#A6A8AD]'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" /> Direct Mode
                  </button>
                </div>
              </div>
            </div>

            {/* Main Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Scenarios List (PHYS-001 to PHYS-032) */}
              <div className="w-72 border-r border-white/10 bg-[#0A0B0D] overflow-y-auto flex flex-col">
                <div className="p-3 border-b border-white/5 text-[11px] font-mono text-[#686B72] uppercase tracking-wider">
                  Test Scenarios ({scenarios.length})
                </div>
                <div className="divide-y divide-white/5">
                  {scenarios.map((sc) => {
                    const isSelected = sc.id === selectedScenarioId;
                    return (
                      <button
                        key={sc.id}
                        onClick={() => setSelectedScenarioId(sc.id)}
                        className={`w-full text-left p-3 flex flex-col gap-1 transition-colors ${
                          isSelected
                            ? 'bg-white/10 border-l-2 border-white'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-white font-semibold">
                            {sc.code}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-[#A6A8AD]">
                            {sc.category}
                          </span>
                        </div>
                        <div className="text-xs text-[#A6A8AD] truncate">
                          {sc.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center/Right Panel: Detail & Evidence View */}
              <div className="flex-1 bg-[#08090B] p-6 overflow-y-auto flex flex-col gap-6">
                {/* Pair Status Banner */}
                <div className="p-4 rounded-xl bg-[#101114] border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-[#F5F5F5] font-mono">
                        {getPlatformIcon(currentPair.senderPlatform)}
                        <span>{currentPair.senderPlatform}</span>
                        <span className="text-[#686B72]">↔</span>
                        {getPlatformIcon(currentPair.receiverPlatform)}
                        <span>{currentPair.receiverPlatform}</span>
                      </div>
                      <span className="text-xs text-[#686B72]">|</span>
                      <span className="text-xs text-[#A6A8AD] font-mono uppercase">
                        {selectedMode === 'wifi' ? 'Wi-Fi / LAN Mode' : 'Direct Mode'}
                      </span>
                    </div>
                    <div>{getStatusBadge(pairEvaluation.overallStatus)}</div>
                  </div>

                  <div className="text-xs text-[#A6A8AD] leading-relaxed">
                    {currentPair.notes}
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-2 border-t border-white/5 text-center">
                    <div className="p-2 rounded bg-[#17191D] border border-white/5">
                      <div className="text-[10px] text-[#686B72] font-mono">SCENARIOS</div>
                      <div className="text-sm font-semibold text-white mt-0.5">{scenarios.length}</div>
                    </div>
                    <div className="p-2 rounded bg-[#17191D] border border-white/5">
                      <div className="text-[10px] text-[#686B72] font-mono">PASSED</div>
                      <div className="text-sm font-semibold text-white mt-0.5">{pairEvaluation.passed}</div>
                    </div>
                    <div className="p-2 rounded bg-[#17191D] border border-white/5">
                      <div className="text-[10px] text-[#686B72] font-mono">BLOCKED</div>
                      <div className="text-sm font-semibold text-[#A6A8AD] mt-0.5">{pairEvaluation.blocked}</div>
                    </div>
                    <div className="p-2 rounded bg-[#17191D] border border-white/5">
                      <div className="text-[10px] text-[#686B72] font-mono">NOT RUN</div>
                      <div className="text-sm font-semibold text-[#686B72] mt-0.5">{pairEvaluation.notRun}</div>
                    </div>
                  </div>
                </div>

                {/* Scenario Details */}
                <div className="p-5 rounded-xl bg-[#101114] border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-white" />
                      <h3 className="text-xs font-semibold text-[#F5F5F5] font-mono">
                        {selectedScenario.code}: {selectedScenario.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-[#686B72] uppercase">
                      Category: {selectedScenario.category}
                    </span>
                  </div>

                  <div className="text-xs text-[#A6A8AD] leading-relaxed">
                    {selectedScenario.description}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 rounded bg-[#0A0B0D] border border-white/5 flex flex-col gap-1">
                      <span className="text-[#686B72] text-[10px]">PAYLOAD PIPELINE</span>
                      <span className="text-[#F5F5F5]">
                        {selectedScenario.requiresTransfer ? 'File Payload + SHA-256 Checksum' : 'Control / Discovery Protocol Frame'}
                      </span>
                    </div>
                    <div className="p-3 rounded bg-[#0A0B0D] border border-white/5 flex flex-col gap-1">
                      <span className="text-[#686B72] text-[10px]">PHYSICAL STATUS</span>
                      <span className="text-[#A6A8AD]">BLOCKED — Physical Hardware Required</span>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#17191D]/70 border border-white/5 text-[11px] text-[#A6A8AD] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#A6A8AD] shrink-0 mt-0.5" />
                    <div>
                      <strong>Honest Validation Gate:</strong> Deterministic or Localhost tests cannot satisfy physical evidence requirements. A physical PASS requires evidence produced by two distinct hardware devices verifying mutual cryptographic digests.
                    </div>
                  </div>
                </div>

                {/* Global Summary Metrics */}
                <div className="p-4 rounded-xl bg-[#0A0B0D] border border-white/5 flex items-center justify-between text-xs font-mono text-[#686B72]">
                  <span>Total Pairs: {reportSummary.totalPairs}</span>
                  <span>Physical Evidence Records: {reportSummary.physicalEvidencesRecorded}</span>
                  <span>Generated: {new Date(reportSummary.generatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
