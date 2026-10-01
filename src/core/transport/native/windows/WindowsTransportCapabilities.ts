/**
 * NearShare Windows Native Transport & Bridge Capabilities
 *
 * Defines the explicit capability matrix for the Windows native desktop runtime.
 * Strictly distinguishes implemented/tested technologies from candidate or unverified features.
 *
 * CAPABILITY MATRIX POLICY:
 * - supported: Implemented in Rust Tauri host and functional over TCP/LAN.
 * - requiresNative: Available when running inside Windows Tauri desktop host.
 * - restricted: Available with OS-enforced restrictions (e.g. background power throttling).
 * - mockOnly: Fallback simulation in web development mode without native shell.
 * - notImplemented: Future candidate technology not yet wired or verified (e.g. Wi-Fi Direct).
 * - unsupported: Unsupported by host platform or architecture.
 */

import type { BridgeSupportLevel } from '../../../native/NativeBridgeCapabilities';
import type { TransportSupportLevel } from '../NativeTransportCapabilities';

export interface WindowsCapabilityMatrix {
  filesystem: BridgeSupportLevel;
  filePicker: BridgeSupportLevel;
  folderPicker: BridgeSupportLevel;
  streamingRead: BridgeSupportLevel;
  streamingWrite: BridgeSupportLevel;
  randomAccessRead: BridgeSupportLevel;
  randomAccessWrite: BridgeSupportLevel;
  tcpLan: TransportSupportLevel;
  udpDiscovery: TransportSupportLevel;
  directNearby: TransportSupportLevel;
  wifiDirect: TransportSupportLevel;
  bluetooth: TransportSupportLevel;
  backgroundTransfer: TransportSupportLevel;
}

/**
 * Windows Native Capability Manifest
 * Reflects exact verified status for Step 46.
 */
export const WINDOWS_NATIVE_CAPABILITIES: WindowsCapabilityMatrix = {
  // Filesystem & Pickers: Handled via Rust rfd + std::fs when running on Windows desktop
  filesystem: 'requiresNative',
  filePicker: 'requiresNative',
  folderPicker: 'requiresNative',
  streamingRead: 'requiresNative',
  streamingWrite: 'requiresNative',
  randomAccessRead: 'requiresNative',
  randomAccessWrite: 'requiresNative',

  // Networking:
  // - tcpLan: 'supported' via cross-platform Tokio/std::net socket bridge in Rust host
  // - udpDiscovery: 'supported' via native UDP multicast/broadcast provider + DiscoveryProtocol
  // - directNearby & wifiDirect: 'notImplemented' — reserved for future Wi-Fi Direct spike
  // - bluetooth: 'notImplemented' — reserved for future auxiliary BLE beacon spike
  // - backgroundTransfer: 'restricted' — Windows Modern Standby / background throttling
  tcpLan: 'supported',
  udpDiscovery: 'supported',
  directNearby: 'notImplemented',
  wifiDirect: 'notImplemented',
  bluetooth: 'notImplemented',
  backgroundTransfer: 'restricted',
};

/**
 * Validates whether a requested capability is supported in the current Windows environment.
 */
export function isWindowsCapabilitySupported(
  matrix: WindowsCapabilityMatrix,
  key: keyof WindowsCapabilityMatrix,
  isTauriDesktop: boolean = false
): boolean {
  const level = matrix[key];
  if (level === 'supported') return true;
  if (level === 'requiresNative' && isTauriDesktop) return true;
  return false;
}
