/**
 * NearShare Physical Multi-Device Validation Matrix
 *
 * Defines the complete device-pair matrix and standard test scenarios (PHYS-001 to PHYS-032, RECOVERY-25 to RECOVERY-90).
 */

import type {
  DevicePairDefinition,
  ScenarioDefinition,
} from './PhysicalValidationTypes';

/**
 * Standard 10 device pair validation definitions.
 */
export const REQUIRED_DEVICE_PAIRS: DevicePairDefinition[] = [
  {
    id: 'mac-mac',
    senderPlatform: 'macOS',
    receiverPlatform: 'macOS',
    wifiStatus: 'SUPPORTED',
    directStatus: 'REQUIRES_NATIVE', // AWDL/NAN
    notes: 'Primary desktop target; Wi-Fi TCP native loopback verified; Direct mode requires physical hardware testing.',
  },
  {
    id: 'win-win',
    senderPlatform: 'Windows',
    receiverPlatform: 'Windows',
    wifiStatus: 'SUPPORTED',
    directStatus: 'REQUIRES_NATIVE', // Wi-Fi Direct (Windows.Devices.WiFiDirect)
    notes: 'Primary desktop target; NSIS packaging configured; Windows hardware required.',
  },
  {
    id: 'mac-win',
    senderPlatform: 'macOS',
    receiverPlatform: 'Windows',
    wifiStatus: 'SUPPORTED',
    directStatus: 'PLATFORM_DEPENDENT', // Heterogeneous Direct requires common AP/softAP
    notes: 'Cross-platform desktop transfer over common Wi-Fi/LAN.',
  },
  {
    id: 'android-android',
    senderPlatform: 'Android',
    receiverPlatform: 'Android',
    wifiStatus: 'SUPPORTED',
    directStatus: 'REQUIRES_NATIVE', // Android Wi-Fi Direct / Wi-Fi Aware
    notes: 'Mobile target; Android native transport bridge architectural.',
  },
  {
    id: 'ios-ios',
    senderPlatform: 'iOS',
    receiverPlatform: 'iOS',
    wifiStatus: 'SUPPORTED',
    directStatus: 'REQUIRES_NATIVE', // MultipeerConnectivity / Network.framework
    notes: 'Mobile target; iOS native transport bridge architectural.',
  },
  {
    id: 'mac-android',
    senderPlatform: 'macOS',
    receiverPlatform: 'Android',
    wifiStatus: 'SUPPORTED',
    directStatus: 'PLATFORM_DEPENDENT',
    notes: 'Desktop to mobile transfer over common Wi-Fi/LAN.',
  },
  {
    id: 'mac-ios',
    senderPlatform: 'macOS',
    receiverPlatform: 'iOS',
    wifiStatus: 'SUPPORTED',
    directStatus: 'PLATFORM_DEPENDENT',
    notes: 'Desktop to mobile Apple ecosystem transfer.',
  },
  {
    id: 'win-android',
    senderPlatform: 'Windows',
    receiverPlatform: 'Android',
    wifiStatus: 'SUPPORTED',
    directStatus: 'PLATFORM_DEPENDENT',
    notes: 'Desktop to mobile transfer over common Wi-Fi/LAN.',
  },
  {
    id: 'win-ios',
    senderPlatform: 'Windows',
    receiverPlatform: 'iOS',
    wifiStatus: 'SUPPORTED',
    directStatus: 'PLATFORM_DEPENDENT',
    notes: 'Windows to iOS transfer over common Wi-Fi/LAN.',
  },
  {
    id: 'android-ios',
    senderPlatform: 'Android',
    receiverPlatform: 'iOS',
    wifiStatus: 'SUPPORTED',
    directStatus: 'NOT_SUPPORTED', // Direct cross-radio between iOS Multipeer and Android Wi-Fi Direct is not interoperable
    notes: 'Cross-mobile interoperability supported exclusively via Wi-Fi/LAN mode.',
  },
];

export const CANONICAL_DEVICE_PAIRS = REQUIRED_DEVICE_PAIRS;

/**
 * Standard scenario matrix (PHYS-001 through PHYS-032 + Canonical Recovery Scenarios).
 */
export const PHYSICAL_SCENARIOS: ScenarioDefinition[] = [
  { id: 'PHYS-001', code: 'PHYS-001', name: 'Discovery', description: 'mDNS/LAN and Direct broadcast discovery between two peers', category: 'discovery', requiresTransfer: false },
  { id: 'PHYS-002', code: 'PHYS-002', name: 'Device Identity', description: 'Exchange of cryptographic public keys and display metadata', category: 'discovery', requiresTransfer: false },
  { id: 'PHYS-003', code: 'PHYS-003', name: 'Pairing', description: 'Mutual consent and 6-digit verification code generation', category: 'pairing', requiresTransfer: false },
  { id: 'PHYS-004', code: 'PHYS-004', name: 'Verification', description: 'Cryptographic confirmation of out-of-band verification PIN', category: 'pairing', requiresTransfer: false },
  { id: 'PHYS-005', code: 'PHYS-005', name: 'Trust Storage', description: 'Persistent TOFU (Trust-On-First-Use) identity caching', category: 'pairing', requiresTransfer: false },
  { id: 'PHYS-006', code: 'PHYS-006', name: 'Secure Session', description: 'Noise / HKDF-derived authenticated symmetric session establishment', category: 'session', requiresTransfer: false },
  { id: 'PHYS-007', code: 'PHYS-007', name: '0-Byte File', description: 'Transfer and zero-byte file allocation integrity', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-008', code: 'PHYS-008', name: '1-Byte File', description: 'Single-byte edge payload transmission and validation', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-009', code: 'PHYS-009', name: 'Small File (< 1 MB)', description: 'Single chunk file transmission and verification', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-010', code: 'PHYS-010', name: 'Large File (> 100 MB)', description: 'Multi-chunk streaming file transmission with backpressure', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-011', code: 'PHYS-011', name: 'Multiple Files', description: 'Sequential batch file manifest processing', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-012', code: 'PHYS-012', name: 'Nested Folder', description: 'Hierarchical folder structure recreation with path traversal prevention', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-013', code: 'PHYS-013', name: 'Unicode Filenames', description: 'Emoji, CJK, and non-ASCII filename preservation', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-014', code: 'PHYS-014', name: 'Duplicate Filenames', description: 'Automatic collision resolution without overwriting existing files', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-015', code: 'PHYS-015', name: 'Archive / ZIP File', description: 'Binary compressed archive transmission and byte integrity', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-016', code: 'PHYS-016', name: 'APK / App Binary File', description: 'Execution container binary safe transfer as regular file', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-017', code: 'PHYS-017', name: 'Pause Transfer', description: 'Controlled pipeline pause preserving write buffer state', category: 'control', requiresTransfer: true },
  { id: 'PHYS-018', code: 'PHYS-018', name: 'Resume Transfer', description: 'Resumption from committed byte ranges without retransmission', category: 'control', requiresTransfer: true },
  { id: 'PHYS-019', code: 'PHYS-019', name: 'Cancel Transfer', description: 'Clean sender/receiver abort and temporary file deletion', category: 'control', requiresTransfer: true },
  { id: 'PHYS-020', code: 'PHYS-020', name: 'Retry Transfer', description: 'Retry of interrupted transfer using persistent checkpoint', category: 'control', requiresTransfer: true },
  { id: 'PHYS-021', code: 'PHYS-021', name: 'Disconnect During Transfer', description: 'Unplanned socket termination and state detection', category: 'recovery', requiresTransfer: true },
  { id: 'PHYS-022', code: 'PHYS-022', name: 'Reconnect & Resume', description: 'Session re-establishment and gap recovery over new socket', category: 'recovery', requiresTransfer: true },
  { id: 'PHYS-023', code: 'PHYS-023', name: 'Integrity Verification', description: 'SHA-256 receiver verification matching sender digest', category: 'integrity', requiresTransfer: true },
  { id: 'PHYS-024', code: 'PHYS-024', name: 'History Record', description: 'Deduplicated immutable history record creation', category: 'lifecycle', requiresTransfer: true },
  { id: 'PHYS-025', code: 'PHYS-025', name: 'OS Notification', description: 'Desktop notification dispatch on transfer completion', category: 'lifecycle', requiresTransfer: false },
  { id: 'PHYS-026', code: 'PHYS-026', name: 'Background Behavior', description: 'Transfer continuity during window minimization/unfocus', category: 'lifecycle', requiresTransfer: true },
  { id: 'PHYS-027', code: 'PHYS-027', name: 'Destination Handling', description: 'Atomic file move to final downloads destination directory', category: 'integrity', requiresTransfer: true },
  { id: 'PHYS-028', code: 'PHYS-028', name: 'Blocked Peer Rejection', description: 'Explicit rejection of incoming request from blacklisted device', category: 'security', requiresTransfer: false },
  { id: 'PHYS-029', code: 'PHYS-029', name: 'Revoked Session', description: 'Immediate teardown upon session revocation', category: 'security', requiresTransfer: false },
  { id: 'PHYS-030', code: 'PHYS-030', name: 'Tampered Frame Rejection', description: 'AEAD MAC failure and immediate session termination on corrupted frame', category: 'security', requiresTransfer: true },
  { id: 'PHYS-031', code: 'PHYS-031', name: 'Large Multi-File Transfer', description: 'High-volume mixed-size batch stress test', category: 'transfer', requiresTransfer: true },
  { id: 'PHYS-032', code: 'PHYS-032', name: 'Transfer Completion Cleanup', description: 'Verification that zero active sockets, temp files, or leaks remain', category: 'lifecycle', requiresTransfer: true },
];

/**
 * Canonical Recovery Progression Scenarios (RECOVERY-25 through RECOVERY-90).
 */
export const RECOVERY_SCENARIOS: ScenarioDefinition[] = [
  { id: 'RECOVERY-25', code: 'RECOVERY-25', name: 'Recovery at 25%', description: 'Unplanned interruption at ~25% transfer progress with resume verification', category: 'recovery', requiresTransfer: true },
  { id: 'RECOVERY-50', code: 'RECOVERY-50', name: 'Recovery at 50%', description: 'Unplanned interruption at ~50% transfer progress with resume verification', category: 'recovery', requiresTransfer: true },
  { id: 'RECOVERY-75', code: 'RECOVERY-75', name: 'Recovery at 75%', description: 'Unplanned interruption at ~75% transfer progress with resume verification', category: 'recovery', requiresTransfer: true },
  { id: 'RECOVERY-90', code: 'RECOVERY-90', name: 'Recovery at 90%', description: 'Unplanned interruption at ~90% transfer progress with resume verification', category: 'recovery', requiresTransfer: true },
];

export const ALL_VALIDATION_SCENARIOS: ScenarioDefinition[] = [
  ...PHYSICAL_SCENARIOS,
  ...RECOVERY_SCENARIOS,
];
