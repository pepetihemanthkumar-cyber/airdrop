/**
 * NearShare Platform Capability Definitions
 *
 * Provides realistic architectural capability matrices and target strategies for:
 * - macOS
 * - Windows
 * - Android
 * - iOS
 * - Web (Development Fallback Only)
 *
 * NOTE: These define the ARCHITECTURAL TARGETS for future native adapters.
 * They do not claim that NearShare currently implements real native drivers.
 */

import type { PlatformType } from './PlatformAdapter';
import type { PlatformCapability } from './capabilities';
import type { PlatformTransferStrategy } from './PlatformStrategy';

// ============================================================================
// 1. MACOS CAPABILITIES & STRATEGY
// ============================================================================

/**
 * macOS Platform Capabilities (Target for future native adapter)
 * Direct nearby uses Apple Wireless Direct Link (AWDL) / Multipeer Connectivity candidate technologies.
 * Wi-Fi uses Bonjour mDNS and local socket conduits.
 * Files uses security-scoped bookmarks for sandboxed directory persistence.
 */
export const MACOS_CAPABILITIES: PlatformCapability = {
  platform: 'macOS',
  transferModes: {
    direct: true,
    wifi: true,
  },
  discovery: {
    nearby: true,
    localNetwork: true,
  },
  pairing: {
    pin: true,
    qr: true,
    confirmation: true,
  },
  files: {
    filePicker: true,
    folderPicker: true,
    arbitraryFiles: true,
    folderTransfer: true,
  },
  transfer: {
    pause: true,
    resume: true,
    background: true,
    largeFiles: true,
    streaming: true,
  },
  system: {
    notifications: true,
    storageInfo: true,
    openFile: true,
    revealInFolder: true,
  },
};

export const MACOS_STRATEGY: PlatformTransferStrategy = {
  platform: 'macOS',
  directTransport: 'candidate-macos-awdl-multipeer',
  wifiTransport: 'candidate-macos-bonjour-local-sockets',
  discoveryStrategy: 'candidate-macos-proximity-mdns',
  pairingStrategy: 'candidate-macos-crypto-pairing',
  fileStrategy: 'candidate-macos-security-scoped-bookmarks',
  backgroundStrategy: 'candidate-macos-app-nap-assertion',
  permissionStrategy: 'candidate-macos-tcc-sandbox',
};

// ============================================================================
// 2. WINDOWS CAPABILITIES & STRATEGY
// ============================================================================

/**
 * Windows Platform Capabilities (Target for future native adapter)
 * Direct nearby uses Windows Wi-Fi Direct / Nearby Share candidate technologies.
 * Wi-Fi uses Windows Sockets (Winsock) & SSDP/mDNS.
 * Files uses Windows Storage API and Win32 file picker.
 */
export const WINDOWS_CAPABILITIES: PlatformCapability = {
  platform: 'Windows',
  transferModes: {
    direct: true,
    wifi: true,
  },
  discovery: {
    nearby: true,
    localNetwork: true,
  },
  pairing: {
    pin: true,
    qr: true,
    confirmation: true,
  },
  files: {
    filePicker: true,
    folderPicker: true,
    arbitraryFiles: true,
    folderTransfer: true,
  },
  transfer: {
    pause: true,
    resume: true,
    background: true,
    largeFiles: true,
    streaming: true,
  },
  system: {
    notifications: true,
    storageInfo: true,
    openFile: true,
    revealInFolder: true,
  },
};

export const WINDOWS_STRATEGY: PlatformTransferStrategy = {
  platform: 'Windows',
  directTransport: 'candidate-windows-wifidirect',
  wifiTransport: 'candidate-windows-winsock-mdns',
  discoveryStrategy: 'candidate-windows-nearby-mdns',
  pairingStrategy: 'candidate-windows-crypto-pairing',
  fileStrategy: 'candidate-windows-storage-api',
  backgroundStrategy: 'candidate-windows-background-task',
  permissionStrategy: 'candidate-windows-app-capabilities',
};

// ============================================================================
// 3. ANDROID CAPABILITIES & STRATEGY
// ============================================================================

/**
 * Android Platform Capabilities (Target for future native adapter)
 * Direct nearby uses Android Nearby Connections / Wi-Fi Direct candidate technologies.
 * Wi-Fi uses Network Service Discovery (NSD) and local TCP sockets.
 * Files uses Storage Access Framework (SAF) and DocumentProvider.
 * Background requires Foreground Service with persistent notification.
 */
export const ANDROID_CAPABILITIES: PlatformCapability = {
  platform: 'Android',
  transferModes: {
    direct: true,
    wifi: true,
  },
  discovery: {
    nearby: true,
    localNetwork: true,
  },
  pairing: {
    pin: true,
    qr: true,
    confirmation: true,
  },
  files: {
    filePicker: true,
    folderPicker: true, // SAF document tree
    arbitraryFiles: true,
    folderTransfer: true,
  },
  transfer: {
    pause: true,
    resume: true,
    background: true, // Requires Foreground Service
    largeFiles: true,
    streaming: true,
  },
  system: {
    notifications: true,
    storageInfo: true,
    openFile: true,
    revealInFolder: false, // Android has no universal "reveal in file manager" intent
  },
};

export const ANDROID_STRATEGY: PlatformTransferStrategy = {
  platform: 'Android',
  directTransport: 'candidate-android-nearby-connections',
  wifiTransport: 'candidate-android-nsd-sockets',
  discoveryStrategy: 'candidate-android-ble-nsd-discovery',
  pairingStrategy: 'candidate-android-crypto-pairing',
  fileStrategy: 'candidate-android-saf-document-tree',
  backgroundStrategy: 'candidate-android-foreground-service',
  permissionStrategy: 'candidate-android-runtime-permissions',
};

// ============================================================================
// 4. IOS CAPABILITIES & STRATEGY
// ============================================================================

/**
 * iOS Platform Capabilities (Target for future native adapter)
 * Direct nearby uses CoreBluetooth + Multipeer Connectivity candidate technologies.
 * Wi-Fi uses NWBrowser / NWListener (Local Network permission required).
 * Background transfer is strictly restricted by iOS app lifecycle constraints.
 */
export const IOS_CAPABILITIES: PlatformCapability = {
  platform: 'iOS',
  transferModes: {
    direct: true,
    wifi: true,
  },
  discovery: {
    nearby: true,
    localNetwork: true,
  },
  pairing: {
    pin: true,
    qr: true,
    confirmation: true,
  },
  files: {
    filePicker: true,
    folderPicker: false, // iOS UIDocumentPicker operates on document selection
    arbitraryFiles: true,
    folderTransfer: false, // Folder tree transfers are limited in standard sandbox
  },
  transfer: {
    pause: true,
    resume: true,
    background: false, // Strongly restricted by iOS background execution limits
    largeFiles: true,
    streaming: true,
  },
  system: {
    notifications: true,
    storageInfo: true,
    openFile: true,
    revealInFolder: false,
  },
};

export const IOS_STRATEGY: PlatformTransferStrategy = {
  platform: 'iOS',
  directTransport: 'candidate-ios-multipeer-corebluetooth',
  wifiTransport: 'candidate-ios-nwconnection-bonjour',
  discoveryStrategy: 'candidate-ios-bonjour-ble-discovery',
  pairingStrategy: 'candidate-ios-crypto-pairing',
  fileStrategy: 'candidate-ios-document-picker-security-scope',
  backgroundStrategy: 'candidate-ios-background-urlsession-restricted',
  permissionStrategy: 'candidate-ios-privacy-manifest-prompts',
};

// ============================================================================
// 5. WEB CAPABILITIES & STRATEGY (DEVELOPMENT FALLBACK ONLY)
// ============================================================================

/**
 * Web Platform Capabilities (Development Fallback Preview Only)
 * The Web frontend CANNOT perform real hardware ad-hoc or direct networking.
 * All transports and nearby discovery are strictly mock development simulations.
 */
export const WEB_CAPABILITIES: PlatformCapability = {
  platform: 'Web',
  transferModes: {
    direct: false, // Mock development only
    wifi: false, // Mock development only
  },
  discovery: {
    nearby: false, // Mock development only
    localNetwork: false, // Browser cannot scan local subnets
  },
  pairing: {
    pin: true, // Simulated UI
    qr: true, // Simulated UI
    confirmation: true,
  },
  files: {
    filePicker: true, // Standard HTML file input
    folderPicker: false, // WebKit directory picker has varied support
    arbitraryFiles: true,
    folderTransfer: false,
  },
  transfer: {
    pause: true,
    resume: true,
    background: false, // Browser tab suspension restricts transfers
    largeFiles: false, // Browser memory/blob size constraints
    streaming: false,
  },
  system: {
    notifications: false,
    storageInfo: true, // StorageManager estimate preview
    openFile: false,
    revealInFolder: false,
  },
};

export const WEB_STRATEGY: PlatformTransferStrategy = {
  platform: 'Web',
  directTransport: 'development-mock-direct-transport',
  wifiTransport: 'development-mock-wifi-transport',
  discoveryStrategy: 'development-mock-discovery',
  pairingStrategy: 'development-mock-pairing',
  fileStrategy: 'development-html-file-picker',
  backgroundStrategy: 'development-unsupported',
  permissionStrategy: 'development-mock-permissions',
};

// ============================================================================
// PLATFORM MATRICES MAP
// ============================================================================

export const PLATFORM_CAPABILITIES_MAP: Record<PlatformType, PlatformCapability> = {
  macOS: MACOS_CAPABILITIES,
  Windows: WINDOWS_CAPABILITIES,
  Android: ANDROID_CAPABILITIES,
  iOS: IOS_CAPABILITIES,
  Web: WEB_CAPABILITIES,
};

export const PLATFORM_STRATEGY_MAP: Record<PlatformType, PlatformTransferStrategy> = {
  macOS: MACOS_STRATEGY,
  Windows: WINDOWS_STRATEGY,
  Android: ANDROID_STRATEGY,
  iOS: IOS_STRATEGY,
  Web: WEB_STRATEGY,
};
