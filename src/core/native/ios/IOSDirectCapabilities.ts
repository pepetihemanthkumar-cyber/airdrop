/**
 * NearShare iOS Direct Native Capabilities
 *
 * Defines the capability report and physical validation states
 * for the iOS/iPadOS native MultipeerConnectivity / Network.framework spike.
 */

import type {
  CapabilityState,
  PhysicalValidationState,
} from '../../transport/direct/DirectTransportCapabilities';

export interface IOSDirectCapabilities {
  readonly platform: 'iOS';
  readonly nativeFramework: 'MultipeerConnectivity' | 'Network.framework';
  readonly nativeSupport: CapabilityState;
  readonly physicalValidation: PhysicalValidationState;
  /** iOS does NOT provide a public Wi-Fi Direct API */
  readonly supportsWifiDirect: CapabilityState;
  readonly supportsMultipeer: CapabilityState;
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
 * Baseline capabilities for iOS Native Direct Spike.
 * NOTE: supportsWifiDirect is strictly 'unsupported' as Apple does not expose
 * standard Wi-Fi Direct (P2P-GO / P2P-Client) APIs on iOS/iPadOS.
 * MultipeerConnectivity / AWDL is used instead.
 * Physical validation is strictly set to 'not_verified'.
 */
export const DEFAULT_IOS_DIRECT_CAPABILITIES: IOSDirectCapabilities = {
  platform: 'iOS',
  nativeFramework: 'MultipeerConnectivity',
  nativeSupport: 'supported',
  physicalValidation: 'not_verified',
  supportsWifiDirect: 'unsupported', // Strictly unsupported via public iOS APIs
  supportsMultipeer: 'supported',
  supportsPeerDiscovery: 'supported',
  supportsBidirectionalStream: 'supported',
  supportsTcp: 'restricted', // Multipeer provides streams; generic arbitrary TCP requires Network.framework peer-to-peer or local Wi-Fi
  supportsUdp: 'restricted',
  supportsLargeFiles: 'supported', // via MCSession startStream / sendResource
  supportsResume: 'supported', // protocol-level resume
  supportsBackgroundTransfer: 'restricted', // Subject to iOS ~30s background suspension without BGProcessingTask
  targetProductRangeMeters: 30,
  requiresRouter: false,
  requiresInternet: false,
  requiresWiFiRadioOn: true,
  requiresNative: true,
};
