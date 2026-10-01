/**
 * NearShare Direct Transport Capability Specification
 *
 * Defines strongly-typed capabilities, constraints, and physical validation states
 * for off-grid peer-to-peer Direct Mode transfers.
 */

export type CapabilityState =
  | 'supported'
  | 'unsupported'
  | 'restricted'
  | 'requiresNative'
  | 'mockOnly'
  | 'notImplemented'
  | 'unknown';

export type PhysicalValidationState =
  | 'not_verified'
  | 'localhost_verified'
  | 'lan_verified'
  | 'single_device_verified'
  | 'physical_same_platform_verified'
  | 'physical_cross_platform_verified';

export interface DirectTransportCapabilities {
  /** Mode identifier */
  readonly mode: 'direct';
  
  /** Whether Direct Mode peer-to-peer is architecturally enabled */
  readonly directNearby: CapabilityState;
  
  /** Whether an external Wi-Fi router / access point is required (Direct Mode = false) */
  readonly routerRequired: boolean;
  
  /** Whether internet connectivity is required (Direct Mode = false) */
  readonly internetRequired: boolean;
  
  /** Auxiliary discovery via Bluetooth Low Energy (advertisements/beacons) */
  readonly bluetoothDiscovery: CapabilityState;
  
  /**
   * Bluetooth as large data transport (unsupported due to throughput constraints;
   * BLE is strictly for discovery/bootstrap).
   */
  readonly bluetoothTransport: CapabilityState;
  
  /** Whether the native Wi-Fi radio hardware must remain powered on */
  readonly wifiRadioRequired: boolean;
  
  /** Whether existing LAN subnet connectivity is required (Direct Mode = false) */
  readonly localNetworkRequired: boolean;
  
  /** Support for arbitrary TCP socket stream across peer link */
  readonly supportsTcp: CapabilityState;
  
  /** Support for UDP datagram broadcasts / multicast across peer link */
  readonly supportsUdp: CapabilityState;
  
  /** Support for native ad-hoc peer-to-peer link (Wi-Fi Direct, AWDL, Wi-Fi Aware) */
  readonly supportsPeerToPeer: CapabilityState;
  
  /** Support for background transfer persistence */
  readonly supportsBackgroundTransfer: CapabilityState;
  
  /** Support for multi-gigabyte large file streaming */
  readonly supportsLargeFiles: CapabilityState;
  
  /** Support for checkpointed resume after disconnection */
  readonly supportsResume: CapabilityState;
  
  /** Support for end-to-end cryptographic transport encryption (SecureTransportSession) */
  readonly supportsEncryptedTransport: CapabilityState;
  
  /** Whether full operation requires native desktop/mobile OS runtime */
  readonly requiresNative: boolean;
  
  /** Honest verification level of the transport implementation */
  readonly physicalValidationStatus: PhysicalValidationState;
  
  /** Maximum product/UX range boundary in meters (not a physical radio guarantee) */
  readonly targetProductRangeMeters: number;
}

/**
 * Standard baseline capabilities for the Direct Mode transport architecture.
 */
export const DEFAULT_DIRECT_CAPABILITIES: DirectTransportCapabilities = {
  mode: 'direct',
  directNearby: 'requiresNative',
  routerRequired: false,
  internetRequired: false,
  bluetoothDiscovery: 'requiresNative',
  bluetoothTransport: 'unsupported', // BLE is unviable for bulk file streaming
  wifiRadioRequired: true,          // Wi-Fi radio must remain enabled on device
  localNetworkRequired: false,
  supportsTcp: 'requiresNative',
  supportsUdp: 'requiresNative',
  supportsPeerToPeer: 'requiresNative',
  supportsBackgroundTransfer: 'restricted',
  supportsLargeFiles: 'supported',
  supportsResume: 'supported',
  supportsEncryptedTransport: 'supported', // via SecureTransportSession layer
  requiresNative: true,
  physicalValidationStatus: 'not_verified',
  targetProductRangeMeters: 30,
};
