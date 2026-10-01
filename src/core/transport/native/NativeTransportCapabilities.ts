/**
 * NearShare Native Transport Capabilities
 *
 * Declares granular platform support levels for radio technologies and network modes.
 * Prevents assuming that Wi-Fi Direct or MultipeerConnectivity is universally available.
 */

export type TransportSupportLevel =
  | 'supported'
  | 'unsupported'
  | 'restricted'
  | 'requiresNative'
  | 'notImplemented'
  | 'mockOnly';

export interface NativeTransportCapabilities {
  directNearby: TransportSupportLevel;
  localNetwork: TransportSupportLevel;
  bluetooth: TransportSupportLevel;
  wifiAware: TransportSupportLevel;
  wifiDirect: TransportSupportLevel;
  multipeerConnectivity: TransportSupportLevel;
  localNetworkDiscovery: TransportSupportLevel;
  backgroundTransfer: TransportSupportLevel;
  streaming: TransportSupportLevel;
  pauseResume: TransportSupportLevel;
  largeFileTransfer: TransportSupportLevel;
}

export const DEFAULT_MOCK_TRANSPORT_CAPABILITIES: NativeTransportCapabilities = {
  directNearby: 'mockOnly',
  localNetwork: 'mockOnly',
  bluetooth: 'notImplemented',
  wifiAware: 'notImplemented',
  wifiDirect: 'notImplemented',
  multipeerConnectivity: 'notImplemented',
  localNetworkDiscovery: 'mockOnly',
  backgroundTransfer: 'restricted',
  streaming: 'mockOnly',
  pauseResume: 'mockOnly',
  largeFileTransfer: 'mockOnly',
};
