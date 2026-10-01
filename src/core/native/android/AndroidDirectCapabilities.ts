/**
 * NearShare Android Direct Native Capabilities
 *
 * Defines the capability report and physical validation states
 * for the Android native WifiP2pManager / WifiAwareManager spike.
 */

import type {
  CapabilityState,
  PhysicalValidationState,
} from '../../transport/direct/DirectTransportCapabilities';

export interface AndroidDirectCapabilities {
  readonly platform: 'Android';
  readonly nativeFramework: 'WifiP2pManager' | 'WifiAwareManager';
  readonly nativeSupport: CapabilityState;
  readonly physicalValidation: PhysicalValidationState;
  readonly supportsWifiDirect: CapabilityState;
  readonly supportsWifiAware: CapabilityState;
  readonly supportsPeerDiscovery: CapabilityState;
  readonly supportsBidirectionalStream: CapabilityState;
  readonly supportsTcp: CapabilityState;
  readonly supportsUdp: CapabilityState;
  readonly supportsLargeFiles: CapabilityState;
  readonly supportsResume: CapabilityState;
  readonly supportsBackgroundTransfer: CapabilityState;
  readonly targetProductRangeMeters: number;
  readonly requiresRouter: boolean;
  readonly requiresInternet: boolean;
  readonly requiresWiFiRadioOn: boolean;
  readonly requiresNative: boolean;
}

/**
 * Baseline capabilities for Android Native Direct Spike.
 * Physical validation is strictly set to 'not_verified' until a physical Android device completes testing.
 */
export const DEFAULT_ANDROID_DIRECT_CAPABILITIES: AndroidDirectCapabilities = {
  platform: 'Android',
  nativeFramework: 'WifiP2pManager',
  nativeSupport: 'supported',
  physicalValidation: 'not_verified',
  supportsWifiDirect: 'supported',
  supportsWifiAware: 'restricted', // Hardware/chip dependent
  supportsPeerDiscovery: 'supported',
  supportsBidirectionalStream: 'supported',
  supportsTcp: 'supported',
  supportsUdp: 'supported',
  supportsLargeFiles: 'supported',
  supportsResume: 'supported',
  supportsBackgroundTransfer: 'supported', // via Android Foreground Service
  targetProductRangeMeters: 30,
  requiresRouter: false,
  requiresInternet: false,
  requiresWiFiRadioOn: true,
  requiresNative: true,
};
