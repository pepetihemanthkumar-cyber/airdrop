/**
 * NearShare Native Bridge Capabilities
 *
 * Defines granular capability indicators for native platform features.
 * Only actual production implementations will report 'supported'; mock or candidate
 * platforms report 'mockOnly', 'notImplemented', or 'unsupported'.
 */

export type BridgeSupportLevel =
  | 'supported'
  | 'unsupported'
  | 'restricted'
  | 'requiresNative'
  | 'notImplemented'
  | 'mockOnly';

export interface NativeBridgeCapabilities {
  filesystem: BridgeSupportLevel;
  filePicker: BridgeSupportLevel;
  folderPicker: BridgeSupportLevel;
  streamingRead: BridgeSupportLevel;
  streamingWrite: BridgeSupportLevel;
  randomAccessRead: BridgeSupportLevel;
  randomAccessWrite: BridgeSupportLevel;
  persistentAccess: BridgeSupportLevel;
  backgroundExecution: BridgeSupportLevel;
  notifications: BridgeSupportLevel;
  secureStorage: BridgeSupportLevel;
  bluetooth: BridgeSupportLevel;
  directNearbyNetworking: BridgeSupportLevel;
  localNetworkNetworking: BridgeSupportLevel;
}

export const DEFAULT_MOCK_BRIDGE_CAPABILITIES: NativeBridgeCapabilities = {
  filesystem: 'mockOnly',
  filePicker: 'mockOnly',
  folderPicker: 'mockOnly',
  streamingRead: 'mockOnly',
  streamingWrite: 'mockOnly',
  randomAccessRead: 'mockOnly',
  randomAccessWrite: 'mockOnly',
  persistentAccess: 'mockOnly',
  backgroundExecution: 'restricted',
  notifications: 'mockOnly',
  secureStorage: 'mockOnly',
  bluetooth: 'notImplemented',
  directNearbyNetworking: 'notImplemented',
  localNetworkNetworking: 'mockOnly',
};
