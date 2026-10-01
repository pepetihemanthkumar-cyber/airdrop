/**
 * NearShare macOS Direct Transfer Validation Store
 *
 * Reactive singleton state manager for the macOS Direct validation harness,
 * maintaining active role, environment selection, live diagnostics, and scenario outcomes.
 */

import {
  type ValidationEnvironment,
  type ValidationRole,
  type MacOSDirectScenarioResult,
  type PhysicalGateState,
  type DirectStreamTelemetry,
  type DirectMemoryMetrics,
  type SanitizedDeviceInfo,
  type DirectTransportUsed,
} from './MacOSDirectValidationTypes';
import { MACOS_DIRECT_SCENARIOS } from './MacOSDirectValidationScenarios';
import { MacOSDirectValidationRunner, type ValidationRunnerContext } from './MacOSDirectValidationRunner';
import { MacOSDirectValidationReport, type MacOSDirectValidationReportData } from './MacOSDirectValidationReport';

export interface ValidationStoreState {
  role: ValidationRole;
  environment: ValidationEnvironment;
  localDevice: SanitizedDeviceInfo;
  remoteDevice?: SanitizedDeviceInfo;
  nativeImplemented: boolean;
  macOsRuntime: boolean;
  transportUsed: DirectTransportUsed;
  peerConnected: boolean;
  gateState: PhysicalGateState;
  results: Map<string, MacOSDirectScenarioResult>;
  streamTelemetry: DirectStreamTelemetry;
  memoryMetrics: DirectMemoryMetrics;
  isRunning: boolean;
  activeScenarioCode?: string;
}

export class MacOSDirectValidationStore {
  private static instance: MacOSDirectValidationStore | null = null;
  private state: ValidationStoreState;
  private listeners = new Set<(state: ValidationStoreState) => void>();

  private constructor() {
    const localDevice: SanitizedDeviceInfo = {
      deviceId: 'mac-host-syntra-01',
      profileName: 'Syntra Studio Local',
      platform: 'macOS',
      appVersion: '0.1.0',
    };

    const initialTelemetry: DirectStreamTelemetry = {
      bytesSent: 0,
      bytesReceived: 0,
      framesSent: 0,
      framesReceived: 0,
      framesRejected: 0,
      partialReads: 0,
      partialWrites: 0,
      streamErrors: 0,
      reconnectCount: 0,
      cancelCount: 0,
      pauseCount: 0,
      resumeCount: 0,
      currentBufferedBytes: 0,
      peakBufferedBytes: 0,
    };

    const initialMemory: DirectMemoryMetrics = {
      nativeStreamBufferPeakBytes: 64 * 1024,
      protocolBufferPeakBytes: 256 * 1024,
      transferBackpressurePeakBytes: 1024 * 1024,
    };

    this.state = {
      role: 'SENDER',
      environment: 'deterministic',
      localDevice,
      nativeImplemented: true,
      macOsRuntime: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac'),
      transportUsed: 'DIRECT_NATIVE',
      peerConnected: false,
      gateState: {
        passed: true,
        nativeImplemented: true,
        macOsRuntimeConfirmed: true,
        peerDeviceDetected: false,
        peerIsMacOS: false,
        directPathConfirmed: true,
        noWifiFallback: true,
        physicalDirectExplicitlySelected: false,
      },
      results: new Map(),
      streamTelemetry: initialTelemetry,
      memoryMetrics: initialMemory,
      isRunning: false,
    };

    // Initialize scenario result placeholders
    for (const sc of MACOS_DIRECT_SCENARIOS) {
      this.state.results.set(sc.code, {
        scenarioId: sc.id,
        scenarioCode: sc.code,
        name: sc.name,
        environment: 'deterministic',
        startedAt: null,
        completedAt: null,
        senderDeviceId: localDevice.deviceId,
        receiverDeviceId: 'unassigned',
        transportMode: 'direct',
        transportUsed: 'DIRECT_NATIVE',
        nativeImplementation: 'implemented',
        physicalValidation: 'unverified',
        result: 'NOT_RUN',
        bytesTransferred: 0,
        durationMs: 0,
        averageThroughput: null,
        peakThroughput: null,
        latencyMs: null,
        integrityVerified: 'NOT_VERIFIED',
        securityVerified: false,
        recoveryVerified: false,
      });
    }

    this.updateGate();
  }

  public static getInstance(): MacOSDirectValidationStore {
    if (!MacOSDirectValidationStore.instance) {
      MacOSDirectValidationStore.instance = new MacOSDirectValidationStore();
    }
    return MacOSDirectValidationStore.instance;
  }

  public getState(): ValidationStoreState {
    return { ...this.state, results: new Map(this.state.results) };
  }

  public subscribe(listener: (state: ValidationStoreState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.getState();
    for (const l of this.listeners) {
      l(snap);
    }
  }

  public setRole(role: ValidationRole): void {
    this.state.role = role;
    this.updateGate();
    this.notify();
  }

  public setEnvironment(env: ValidationEnvironment): void {
    this.state.environment = env;
    this.updateGate();
    this.notify();
  }

  public setRemoteDevice(device?: SanitizedDeviceInfo): void {
    this.state.remoteDevice = device;
    this.state.peerConnected = Boolean(device);
    this.updateGate();
    this.notify();
  }

  public setTransportUsed(transport: DirectTransportUsed): void {
    this.state.transportUsed = transport;
    this.updateGate();
    this.notify();
  }

  private updateGate(): void {
    const ctx: ValidationRunnerContext = {
      role: this.state.role,
      environment: this.state.environment,
      localDevice: this.state.localDevice,
      remoteDevice: this.state.remoteDevice,
      nativeImplemented: this.state.nativeImplemented,
      macOsRuntime: this.state.macOsRuntime,
      transportUsed: this.state.transportUsed,
      peerConnected: this.state.peerConnected,
      streamTelemetry: this.state.streamTelemetry,
      memoryMetrics: this.state.memoryMetrics,
    };
    this.state.gateState = MacOSDirectValidationRunner.evaluateGate(ctx);
  }

  public async runScenario(code: string): Promise<MacOSDirectScenarioResult | null> {
    const def = MACOS_DIRECT_SCENARIOS.find((s) => s.code === code);
    if (!def) return null;

    this.state.isRunning = true;
    this.state.activeScenarioCode = code;
    this.notify();

    const ctx: ValidationRunnerContext = {
      role: this.state.role,
      environment: this.state.environment,
      localDevice: this.state.localDevice,
      remoteDevice: this.state.remoteDevice,
      nativeImplemented: this.state.nativeImplemented,
      macOsRuntime: this.state.macOsRuntime,
      transportUsed: this.state.transportUsed,
      peerConnected: this.state.peerConnected,
      streamTelemetry: this.state.streamTelemetry,
      memoryMetrics: this.state.memoryMetrics,
    };

    const res = await MacOSDirectValidationRunner.runScenario(def, ctx);
    this.state.results.set(code, res);
    this.state.isRunning = false;
    this.state.activeScenarioCode = undefined;
    this.notify();

    return res;
  }

  public async runAllScenarios(): Promise<void> {
    this.state.isRunning = true;
    this.notify();

    for (const def of MACOS_DIRECT_SCENARIOS) {
      this.state.activeScenarioCode = def.code;
      this.notify();
      const ctx: ValidationRunnerContext = {
        role: this.state.role,
        environment: this.state.environment,
        localDevice: this.state.localDevice,
        remoteDevice: this.state.remoteDevice,
        nativeImplemented: this.state.nativeImplemented,
        macOsRuntime: this.state.macOsRuntime,
        transportUsed: this.state.transportUsed,
        peerConnected: this.state.peerConnected,
        streamTelemetry: this.state.streamTelemetry,
        memoryMetrics: this.state.memoryMetrics,
      };
      const res = await MacOSDirectValidationRunner.runScenario(def, ctx);
      this.state.results.set(def.code, res);
    }

    this.state.isRunning = false;
    this.state.activeScenarioCode = undefined;
    this.notify();
  }

  public exportReport(): MacOSDirectValidationReportData {
    return MacOSDirectValidationReport.generateReportData(
      this.state.environment,
      this.state.localDevice,
      this.state.gateState,
      Array.from(this.state.results.values()),
      this.state.remoteDevice
    );
  }

  public exportMarkdownReport(): string {
    return MacOSDirectValidationReport.toMarkdown(this.exportReport());
  }
}
