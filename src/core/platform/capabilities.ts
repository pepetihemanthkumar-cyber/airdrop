/**
 * NearShare Platform Capability Model
 *
 * Defines the comprehensive platform capability matrix across macOS, Windows, Android, iOS, and Web.
 * Distinguishes between architectural target support, native requirement, and mock-only simulation.
 *
 * IMPORTANT:
 * - Do NOT collapse capability statuses into simple booleans.
 * - SUPPORTED means the platform architecture is capable.
 * - IMPLEMENTED is tracked separately via adapter implementations.
 */

import type { PlatformType } from './PlatformAdapter';

export type CapabilityAvailability =
  | 'supported'
  | 'unsupported'
  | 'restricted'
  | 'requiresNative'
  | 'mockOnly'
  | 'notImplemented'
  | 'unknown';

export type CapabilityTier =
  | 'architectural'
  | 'runtime'
  | 'physical_unverified';

export interface DetailedCapabilityStatus {
  availability: CapabilityAvailability;
  architecturalSupport: boolean;
  runtimeSupport: 'implemented' | 'partial' | 'scaffold' | 'unavailable' | 'mock';
  physicalValidation: 'verified' | 'unverified' | 'blocked_by_hardware';
  reason?: string | null;
}

export interface TransferModeCapabilities {
  direct: boolean;
  wifi: boolean;
}

export interface DiscoveryCapabilities {
  nearby: boolean;
  localNetwork: boolean;
}

export interface PairingCapabilities {
  pin: boolean;
  qr: boolean;
  confirmation: boolean;
}

export interface FileCapabilities {
  filePicker: boolean;
  folderPicker: boolean;
  arbitraryFiles: boolean;
  folderTransfer: boolean;
}

export interface TransferCapabilities {
  pause: boolean;
  resume: boolean;
  background: boolean;
  largeFiles: boolean;
  streaming: boolean;
}

export interface SystemCapabilities {
  notifications: boolean;
  storageInfo: boolean;
  openFile: boolean;
  revealInFolder: boolean;
}

export interface PlatformCapability {
  platform: PlatformType;
  transferModes: TransferModeCapabilities;
  discovery: DiscoveryCapabilities;
  pairing: PairingCapabilities;
  files: FileCapabilities;
  transfer: TransferCapabilities;
  system: SystemCapabilities;
}

export type CapabilityPath =
  | 'transferModes.direct'
  | 'transferModes.wifi'
  | 'discovery.nearby'
  | 'discovery.localNetwork'
  | 'pairing.pin'
  | 'pairing.qr'
  | 'pairing.confirmation'
  | 'files.filePicker'
  | 'files.folderPicker'
  | 'files.arbitraryFiles'
  | 'files.folderTransfer'
  | 'transfer.pause'
  | 'transfer.resume'
  | 'transfer.background'
  | 'transfer.largeFiles'
  | 'transfer.streaming'
  | 'system.notifications'
  | 'system.storageInfo'
  | 'system.openFile'
  | 'system.revealInFolder';
