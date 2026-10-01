/**
 * NearShare Production Transport Factory
 *
 * Responsibilities:
 * - Resolves the exact transport adapter implementation based on:
 *   - Target Platform (macOS, Windows, Android, iOS, Web)
 *   - Requested Transport Mode ('direct' | 'wifi')
 *   - Native Bridge Runtime Availability
 * - Strictly enforces mode isolation: NEVER silently substitutes Direct for Wi-Fi or vice-versa.
 * - Returns explicit typed capability/error resolution states ('ready', 'requiresNative', 'unsupported', 'notImplemented', 'mockOnly').
 * - Preserves distinction between Architectural Support, Runtime Support, and Physical Validation.
 */

import type { PlatformType } from '../platform/PlatformAdapter';
import { CapabilityResolver } from '../platform/CapabilityResolver';
import type { TransportMode } from './types';
import type { TransportAdapter } from './TransportAdapter';
import { TransportRegistry } from './TransportRegistry';
import type { NativeTransportBridge } from './native/NativeTransportBridge';

export type TransportResolutionStatus =
  | 'ready'
  | 'requiresNative'
  | 'unsupported'
  | 'notImplemented'
  | 'mockOnly';

export interface TransportResolutionOptions {
  platform: PlatformType;
  requestedMode: TransportMode;
  forceMock?: boolean;
  isNativeRuntime?: boolean;
  customNativeBridge?: NativeTransportBridge;
}

export interface TransportResolutionResult {
  status: TransportResolutionStatus;
  mode: TransportMode;
  platform: PlatformType;
  adapter?: TransportAdapter;
  reason?: string;
  architecturalSupport: boolean;
  runtimeSupport: 'implemented' | 'partial' | 'scaffold' | 'unavailable' | 'mock';
  physicalValidation: 'verified' | 'unverified' | 'blocked_by_hardware';
}

export class ProductionTransportFactory {
  private static instance: ProductionTransportFactory | null = null;

  public static getInstance(): ProductionTransportFactory {
    if (!ProductionTransportFactory.instance) {
      ProductionTransportFactory.instance = new ProductionTransportFactory();
    }
    return ProductionTransportFactory.instance;
  }

  /**
   * Resolves the appropriate transport adapter without cross-mode substitution.
   */
  public resolveTransport(options: TransportResolutionOptions): TransportResolutionResult {
    const { platform, requestedMode, forceMock = false, isNativeRuntime = false } = options;
    const capabilityPath = requestedMode === 'direct' ? 'transferModes.direct' : 'transferModes.wifi';
    const detailedCap = CapabilityResolver.getDetailedCapabilityStatus(platform, capabilityPath);

    // 1. Web or Force Mock environment
    if (platform === 'Web' || forceMock) {
      try {
        const adapter = TransportRegistry.getInstance().getAdapter(requestedMode);
        return {
          status: 'mockOnly',
          mode: requestedMode,
          platform,
          adapter,
          reason: 'Running in development / simulated Web mode.',
          architecturalSupport: detailedCap.architecturalSupport,
          runtimeSupport: 'mock',
          physicalValidation: 'unverified',
        };
      } catch {
        return {
          status: 'notImplemented',
          mode: requestedMode,
          platform,
          reason: `No mock adapter registered for mode: ${requestedMode}`,
          architecturalSupport: false,
          runtimeSupport: 'unavailable',
          physicalValidation: 'unverified',
        };
      }
    }

    // 2. Check architectural feasibility
    if (!detailedCap.architecturalSupport) {
      return {
        status: 'unsupported',
        mode: requestedMode,
        platform,
        reason: `${platform} does not architecturally support ${requestedMode} mode.`,
        architecturalSupport: false,
        runtimeSupport: 'unavailable',
        physicalValidation: 'unverified',
      };
    }

    // 3. Native runtime check
    if (!isNativeRuntime) {
      return {
        status: 'requiresNative',
        mode: requestedMode,
        platform,
        reason: `Native ${requestedMode} transport requires the ${platform} native binary runtime.`,
        architecturalSupport: true,
        runtimeSupport: detailedCap.runtimeSupport,
        physicalValidation: detailedCap.physicalValidation,
      };
    }

    // 4. Native runtime is present: Attempt to get registered native adapter
    try {
      const adapter = TransportRegistry.getInstance().getAdapter(requestedMode);
      return {
        status: 'ready',
        mode: requestedMode,
        platform,
        adapter,
        architecturalSupport: true,
        runtimeSupport: detailedCap.runtimeSupport,
        physicalValidation: detailedCap.physicalValidation,
      };
    } catch {
      return {
        status: 'notImplemented',
        mode: requestedMode,
        platform,
        reason: `Native adapter for ${requestedMode} mode is not registered in the TransportRegistry.`,
        architecturalSupport: true,
        runtimeSupport: 'scaffold',
        physicalValidation: detailedCap.physicalValidation,
      };
    }
  }

  /**
   * Validates if the requested mode is permissible without automatic substitution.
   */
  public validateModeRequest(
    platform: PlatformType,
    mode: TransportMode,
    isNativeRuntime = false
  ): { valid: boolean; status: TransportResolutionStatus; reason?: string } {
    const result = this.resolveTransport({ platform, requestedMode: mode, isNativeRuntime });
    return {
      valid: result.status === 'ready' || result.status === 'mockOnly',
      status: result.status,
      reason: result.reason,
    };
  }

  /**
   * Returns all available modes for a platform without mixing tiers.
   */
  public getAvailableModes(platform: PlatformType, isNativeRuntime = false): TransportMode[] {
    const modes: TransportMode[] = [];
    for (const mode of ['direct', 'wifi'] as const) {
      const res = this.resolveTransport({ platform, requestedMode: mode, isNativeRuntime });
      if (res.status === 'ready' || res.status === 'mockOnly') {
        modes.push(mode);
      }
    }
    return modes;
  }
}
