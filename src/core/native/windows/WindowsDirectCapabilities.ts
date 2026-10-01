/**
 * NearShare Windows Direct Native Capabilities
 *
 * Defines the capability report and physical validation states
 * for the Windows native Wi-Fi Direct / StreamSocket spike.
 */

import type {
  CapabilityState,
  PhysicalValidationState,
} from '../../transport/direct/DirectTransportCapabilities';

export interface WindowsDirectCapabilities {
  readonly platform: 'Windows';
  readonly nativeFramework: 'Windows.Devices.WiFiDirect';
  readonly nativeSupport: CapabilityState;
  readonly physicalValidation: PhysicalValidationState;
  readonly supportsWifiDirect: CapabilityState;
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
 * Baseline capabilities for Windows Native Direct Spike.
 * Physical validation is strictly set to 'not_verified' until a physical Windows device completes testing.
 */
export const DEFAULT_WINDOWS_DIRECT_CAPABILITIES: WindowsDirectCapabilities = {
  platform: 'Windows',
  nativeFramework: 'Windows.Devices.WiFiDirect',
  nativeSupport: 'supported',
  physicalValidation: 'not_verified',
  supportsWifiDirect: 'supported',
  supportsPeerDiscovery: 'supported',
  supportsBidirectionalStream: 'supported',
  supportsTcp: 'supported',
  supportsUdp: 'supported',
  supportsLargeFiles: 'supported',
  supportsResume: 'supported',
  supportsBackgroundTransfer: 'restricted',
  targetProductRangeMeters: 30,
  requiresRouter: false,
  requiresInternet: false,
  requiresWiFiRadioOn: true,
  requiresNative: true,
};
