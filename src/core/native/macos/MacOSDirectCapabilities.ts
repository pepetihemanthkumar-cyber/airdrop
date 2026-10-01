/**
 * NearShare macOS Direct Native Capabilities
 *
 * Defines the capability report and physical validation states
 * for the macOS native Multipeer / Network.framework spike.
 */

import type {
  CapabilityState,
  PhysicalValidationState,
} from '../../transport/direct/DirectTransportCapabilities';

export interface MacOSDirectCapabilities {
  readonly platform: 'macOS';
  readonly nativeFramework: 'MultipeerConnectivity' | 'Network.framework';
  readonly nativeSupport: CapabilityState;
  readonly physicalValidation: PhysicalValidationState;
  readonly peerDiscovery: CapabilityState;
  readonly directStream: CapabilityState;
  readonly targetProductRangeMeters: number;
  readonly requiresRouter: boolean;
  readonly requiresInternet: boolean;
  readonly requiresWiFiRadioOn: boolean;
}

/**
 * Baseline capabilities for macOS Native Direct Spike.
 * Physical validation is strictly set to 'not_verified' until two physical Macs complete testing.
 */
export const DEFAULT_MACOS_DIRECT_CAPABILITIES: MacOSDirectCapabilities = {
  platform: 'macOS',
  nativeFramework: 'MultipeerConnectivity',
  nativeSupport: 'supported',
  physicalValidation: 'not_verified',
  peerDiscovery: 'supported',
  directStream: 'supported',
  targetProductRangeMeters: 30,
  requiresRouter: false,
  requiresInternet: false,
  requiresWiFiRadioOn: true,
};
