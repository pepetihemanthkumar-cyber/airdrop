/**
 * NearShare Native Runtime Implementation Audit — Canonical Database
 *
 * Source of truth establishing the exact implementation status of every subsystem.
 */

import type { AuditEntry, AuditSummary, AuditPlatform } from './NativeImplementationAuditTypes';

export const AUDITED_SUBSYSTEM_ENTRIES: AuditEntry[] = [
  // 1. macOS Direct Mode
  {
    id: 'AUDIT-MAC-DIRECT',
    platform: 'macOS',
    subsystem: 'direct_transport',
    feature: 'macOS Direct Mode (Apple MultipeerConnectivity)',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'Real Swift NearShareDirect module (NearShareDirectTypes.swift, NearShareDirectPeer.swift, NearShareDirectSession.swift, NearShareDirectBridge.swift) compiled into static library and linked via build.rs with Apple MultipeerConnectivity & Network.framework. FFI commands in macos_direct.rs hook into Tauri IPC and stream binary byte channels.',
    nativeFiles: [
      'src-tauri/macos/NearShareDirect/NearShareDirectSession.swift',
      'src-tauri/macos/NearShareDirect/NearShareDirectBridge.swift',
      'src-tauri/src/macos_direct.rs',
      'src-tauri/src/lib.rs',
    ],
    bridgeFiles: ['src/core/native/macos/MacOSDirectPeerBridge.ts', 'src/core/transport/direct/DirectTransportAdapter.ts'],
    productionPath: 'DirectTransportAdapter -> MacOSDirectPeerBridge -> Tauri IPC -> Swift Multipeer Session -> Stream -> SecureTransportSession -> Protocol -> FileEngine',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Physical testing between two distinct physical Macs is pending hardware availability.',
    requiredNextAction: 'Attach secondary physical Mac and execute PHYS-001 through PHYS-032 on Direct mode.',
  },

  // 2. macOS LAN TCP
  {
    id: 'AUDIT-MAC-LAN',
    platform: 'macOS',
    subsystem: 'lan_transport',
    feature: 'macOS Native Tokio TCP Socket Transport',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src-tauri/src/lib.rs implements real Tokio/Std TcpListener and TcpStream IPC commands (tcp_spike_start_server, tcp_spike_connect, tcp_spike_send_data) with 4-byte BE length-prefixed binary framing.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/protocol/native/NativeTcpProtocolPeer.ts', 'src/core/native/tauri/TauriIpc.ts'],
    productionPath: 'React -> TransferQueue -> TransportManager -> NativeTransportManager -> Tauri IPC -> Rust Tokio TCP -> FileEngine',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Physical testing between two distinct Mac computers on LAN is pending hardware availability.',
    requiredNextAction: 'Attach secondary physical Mac and execute PHYS-001 through PHYS-032 on LAN.',
  },

  // 3. macOS mDNS Discovery
  {
    id: 'AUDIT-MAC-MDNS',
    platform: 'macOS',
    subsystem: 'lan_discovery',
    feature: 'macOS UDP Multicast / mDNS Peer Discovery',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src-tauri/src/lib.rs creates native UdpSocket joined to multicast group 239.255.60.60:53317 (udp_discovery_start, udp_discovery_broadcast, udp_discovery_stop) with TTL expiration cache.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/protocol/discovery/DiscoveryManager.ts', 'src/core/native/tauri/TauriIpc.ts'],
    productionPath: 'DiscoveryManager -> TauriIpc -> Rust UdpSocket -> Multicast Group -> PeerCache',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Multi-node multicast propagation unverified without physical network router and secondary peer.',
    requiredNextAction: 'Test cross-subnet and local Wi-Fi multicast beacon exchange across two physical machines.',
  },

  // 4. macOS Native Filesystem
  {
    id: 'AUDIT-MAC-FS',
    platform: 'macOS',
    subsystem: 'filesystem',
    feature: 'macOS Native File & Folder Streaming I/O',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src-tauri/src/lib.rs implements real native OS filesystem operations (native_fs_open, native_fs_read_chunk, native_fs_write_chunk, native_fs_scan_folder, native_fs_atomic_replace) using std::fs and Seek/Write.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/filesystem/TauriFileSystemAdapter.ts', 'src/core/file/ChunkStream.ts'],
    productionPath: 'FileEngine -> FileSystemAdapter -> Tauri IPC -> Rust std::fs::File -> OS Disk',
    runtimeVerified: true,
    physicalVerified: true,
    limitations: 'Security-scoped bookmark renewal for sandboxed App Store builds not yet active.',
    requiredNextAction: 'Maintain current chunk-streaming implementation.',
  },

  // 5. macOS Desktop Lifecycle
  {
    id: 'AUDIT-MAC-LIFECYCLE',
    platform: 'macOS',
    subsystem: 'desktop_lifecycle',
    feature: 'macOS Window Interception, System Tray & Notifications',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src-tauri/src/lib.rs implements Tauri TrayIconBuilder with system menu, window close interception to hide instead of quit, and native notification dispatch.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/lifecycle/DesktopLifecycleManager.ts', 'src/core/native/tauri/TauriIpc.ts'],
    productionPath: 'DesktopLifecycleManager -> Tauri Window API -> System Tray -> OS Notifications',
    runtimeVerified: true,
    physicalVerified: true,
    limitations: 'macOS App Nap throttling active when window hidden unless power assertion enabled.',
    requiredNextAction: 'Add NSProcessInfo power assertion during active streaming.',
  },

  // 6. Windows Direct Mode
  {
    id: 'AUDIT-WIN-DIRECT',
    platform: 'Windows',
    subsystem: 'direct_transport',
    feature: 'Windows Direct Mode (Wi-Fi Direct)',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'Real Windows native WinRT implementation in src-tauri/src/windows_direct.rs linked via windows crate (v0.58) using Windows.Devices.WiFiDirect (WiFiDirectAdvertisementPublisher, WiFiDirectConnectionListener, WiFiDirectDevice) and Windows.Networking.Sockets (StreamSocketListener, StreamSocket, DataReader, DataWriter). Tauri commands hook into WindowsDirectPeerBridge and stream binary byte channels under SecureTransportSession.',
    nativeFiles: ['src-tauri/src/windows_direct.rs'],
    bridgeFiles: ['src/core/native/windows/WindowsDirectPeerBridge.ts', 'src/core/transport/direct/DirectTransportAdapter.ts'],
    productionPath: 'DirectTransportAdapter -> WindowsDirectPeerBridge -> Tauri IPC -> WinRT WiFiDirect / StreamSocket -> SecureTransportSession -> Protocol -> FileEngine',
    runtimeVerified: false,
    physicalVerified: false,
    limitations: 'Physical testing between two distinct physical Windows PCs is pending hardware availability.',
    requiredNextAction: 'Attach physical Windows 10/11 test devices and execute WIN-DIR-01 through WIN-DIR-10 on Direct mode.',
  },

  // 7. Windows LAN TCP & Filesystem
  {
    id: 'AUDIT-WIN-LAN-FS',
    platform: 'Windows',
    subsystem: 'lan_transport',
    feature: 'Windows Native Tokio TCP & Filesystem Engine',
    status: 'UNVERIFIED_RUNTIME',
    evidence: 'Rust backend code in src-tauri/src/lib.rs uses cross-platform Rust std and Tokio libraries which compile for x86_64-pc-windows-msvc on CI, but physical Windows execution has not been verified on this host.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/filesystem/TauriFileSystemAdapter.ts', 'src/core/protocol/native/NativeTcpProtocolPeer.ts'],
    productionPath: 'Tauri IPC -> Tokio TCP / std::fs (Cross-platform Rust)',
    runtimeVerified: false,
    physicalVerified: false,
    limitations: 'Physical Windows 10/11 hardware unavailable on current macOS development machine.',
    requiredNextAction: 'Execute CI release matrix and test on physical Windows machine.',
  },

  // 8. Android Direct Mode
  {
    id: 'AUDIT-ANDROID-DIRECT',
    platform: 'Android',
    subsystem: 'direct_transport',
    feature: 'Android Direct Mode (Wi-Fi P2P / Wi-Fi Aware)',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'Real Android native Kotlin implementation in src-tauri/android/NearShareDirect/*.kt (NearShareDirectManager, NearShareDirectSocket, NearShareDirectService, NearShareDirectTypes) using android.net.wifi.p2p.WifiP2pManager, WifiP2pDnsSdServiceInfo, ConnectivityManager, and java.net.Socket. Tauri IPC commands and event bridges in src-tauri/src/android_direct.rs hook into AndroidDirectPeerBridge under SecureTransportSession.',
    nativeFiles: [
      'src-tauri/android/NearShareDirect/NearShareDirectManager.kt',
      'src-tauri/android/NearShareDirect/NearShareDirectSocket.kt',
      'src-tauri/android/NearShareDirect/NearShareDirectService.kt',
      'src-tauri/android/NearShareDirect/NearShareDirectTypes.kt',
      'src-tauri/src/android_direct.rs',
    ],
    bridgeFiles: ['src/core/native/android/AndroidDirectPeerBridge.ts', 'src/core/transport/direct/DirectTransportAdapter.ts'],
    productionPath: 'DirectTransportAdapter -> AndroidDirectPeerBridge -> Tauri IPC -> Kotlin WifiP2pManager / Socket -> SecureTransportSession -> Protocol -> FileEngine',
    runtimeVerified: false,
    physicalVerified: false,
    limitations: 'Physical testing between two distinct physical Android devices is pending hardware availability.',
    requiredNextAction: 'Attach physical Android 12+ test devices and execute AND-DIR-01 through AND-DIR-10 on Direct mode.',
  },

  // 9. Android LAN Mode & SAF Filesystem
  {
    id: 'AUDIT-ANDROID-LAN-FS',
    platform: 'Android',
    subsystem: 'lan_transport',
    feature: 'Android NSD Discovery & Storage Access Framework',
    status: 'ARCHITECTURAL_ONLY',
    evidence: 'Architecture documents and TypeScript type contracts exist. No executable Android native code.',
    nativeFiles: [],
    bridgeFiles: ['src/core/native/android/'],
    productionPath: 'Unimplemented mobile boundary',
    runtimeVerified: false,
    physicalVerified: false,
    limitations: 'Android target is architectural.',
    requiredNextAction: 'Maintain clean architectural boundary without claiming mobile implementation.',
  },

  // 10. iOS Direct Mode
  {
    id: 'AUDIT-IOS-DIRECT',
    platform: 'iOS',
    subsystem: 'direct_transport',
    feature: 'iOS Direct Mode (MultipeerConnectivity / Network.framework)',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'Real iOS native Swift implementation in src-tauri/ios/NearShareDirect/*.swift (NearShareDirectSession, NearShareDirectPeer, NearShareDirectTypes, NearShareDirectBridge) using MultipeerConnectivity (MCNearbyServiceAdvertiser, MCNearbyServiceBrowser, MCSession, InputStream, OutputStream). Tauri commands and FFI bridge in src-tauri/src/ios_direct.rs hook into IOSDirectPeerBridge under SecureTransportSession.',
    nativeFiles: [
      'src-tauri/ios/NearShareDirect/NearShareDirectTypes.swift',
      'src-tauri/ios/NearShareDirect/NearShareDirectPeer.swift',
      'src-tauri/ios/NearShareDirect/NearShareDirectSession.swift',
      'src-tauri/ios/NearShareDirect/NearShareDirectBridge.swift',
      'src-tauri/src/ios_direct.rs',
    ],
    bridgeFiles: ['src/core/native/ios/IOSDirectPeerBridge.ts', 'src/core/transport/direct/DirectTransportAdapter.ts'],
    productionPath: 'DirectTransportAdapter -> IOSDirectPeerBridge -> Tauri IPC -> Swift MultipeerConnectivity / MCSession -> SecureTransportSession -> Protocol -> FileEngine',
    runtimeVerified: false,
    physicalVerified: false,
    limitations: 'Physical testing between two distinct physical iOS devices is pending hardware availability.',
    requiredNextAction: 'Attach physical iPhone/iPad test devices and execute IOS-DIR-01 through IOS-DIR-10 on Direct mode.',
  },

  // 11. iOS LAN Mode & Filesystem
  {
    id: 'AUDIT-IOS-LAN-FS',
    platform: 'iOS',
    subsystem: 'lan_transport',
    feature: 'iOS NWConnection & Document Picker Filesystem',
    status: 'ARCHITECTURAL_ONLY',
    evidence: 'Architecture documents and TypeScript type contracts exist.',
    nativeFiles: [],
    bridgeFiles: ['src/core/native/ios/'],
    productionPath: 'Unimplemented mobile boundary',
    runtimeVerified: false,
    physicalVerified: false,
    limitations: 'iOS target is architectural.',
    requiredNextAction: 'Maintain clean architectural boundary.',
  },

  // 12. Secure Transport Channel
  {
    id: 'AUDIT-SECURE-TRANSPORT',
    platform: 'Cross-Platform',
    subsystem: 'secure_transport',
    feature: 'End-to-End Cryptographic Channel (ECDH P-256 + HKDF + AES-256-GCM AEAD)',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src/core/security/crypto/ implements real WebCrypto/SubtleCrypto AES-256-GCM AEAD encryption and decryption with 64-bit monotonic sequence numbers, fully integrated into NativeTcpProtocolPeer streaming pipeline.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/security/crypto/SecureTransportSession.ts', 'src/core/security/crypto/SecureFrame.ts', 'src/core/protocol/native/NativeTcpProtocolPeer.ts'],
    productionPath: 'ChunkStream -> SecureTransportSession.encryptFrame() -> Binary TCP Wire -> SecureTransportSession.decryptFrame() -> FileEngine',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Physical multi-device cryptographic key exchange pending physical hardware.',
    requiredNextAction: 'Preserve zero-secret storage invariants.',
  },

  // 13. Protocol Framing & State Machine
  {
    id: 'AUDIT-PROTOCOL-ENGINE',
    platform: 'Cross-Platform',
    subsystem: 'protocol_engine',
    feature: 'Binary Framed Protocol Engine & State Transitions',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src/core/protocol/ implements length-prefixed protocol frames, handshake (HELLO/CAPABILITIES), session negotiation (SESSION_CREATE/SESSION_ACCEPT), chunk transfer (CHUNK_START/CHUNK_DATA/CHUNK_ACK), and state machine transition validation.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/protocol/native/NativeTcpProtocolPeer.ts', 'src/core/protocol/ProtocolStateMachine.ts'],
    productionPath: 'All production file transfers flow through NativeTcpProtocolPeer framing and state machine.',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Physical multi-device wire testing pending physical hardware.',
    requiredNextAction: 'Maintain protocol v1.0 specifications.',
  },

  // 14. File Pipeline & Bounded Backpressure
  {
    id: 'AUDIT-FILE-ENGINE',
    platform: 'Cross-Platform',
    subsystem: 'filesystem',
    feature: 'Bounded Chunk Streaming & Transfer Flow Control',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src/core/file/ and src/core/transfer/ implement TransferBackpressureController with bounded permit window (max 16 in-flight chunks / 64 MiB buffer), streaming SHA-256 calculation, and memory-safe buffer deallocation.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/transfer/pipeline/TransferBackpressureController.ts', 'src/core/file/ChunkStream.ts'],
    productionPath: 'TransferQueue -> ChunkStream -> BackpressureController -> ProtocolPeer -> NativeDiskWriter',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Physical multi-gigabyte transfers over saturated physical Wi-Fi links pending physical hardware.',
    requiredNextAction: 'Validate under high packet-drop simulated physical conditions.',
  },

  // 15. Recovery Engine & Checkpoints
  {
    id: 'AUDIT-RECOVERY-ENGINE',
    platform: 'Cross-Platform',
    subsystem: 'recovery_engine',
    feature: 'Crash-Resilient Checkpoint Engine & Receiver-Authoritative Resume',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src/core/transfer/checkpoint/ and src/core/protocol/resume/ implement atomic JSON checkpoint writes, disjoint ByteRange merging, receiver-authoritative gap calculation, and schema safety validation.',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/transfer/checkpoint/ResumeCheckpoint.ts', 'src/core/protocol/resume/ResumeProtocolEngine.ts'],
    productionPath: 'IncomingTransferContext / TransferQueue -> ResumeCheckpoint -> Native FS -> ResumeProtocolEngine',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Physical sudden socket disconnection during live multi-gigabyte transfer pending physical hardware.',
    requiredNextAction: 'Execute PHYS-021 and PHYS-022 across two physical devices.',
  },

  // 16. Telemetry & Connection Diagnostics
  {
    id: 'AUDIT-TELEMETRY',
    platform: 'Cross-Platform',
    subsystem: 'telemetry_diagnostics',
    feature: 'Sliding-Window Throughput, RTT Latency & 6-State Stability Diagnostics',
    status: 'REAL_NATIVE_IMPLEMENTATION',
    evidence: 'src/core/telemetry/ implements TransferTelemetryManager, LatencyTracker (exponential moving average RTT), ThroughputEstimator (sliding-window rate calculation), and ConnectionStabilityMonitor (6-state health classification).',
    nativeFiles: ['src-tauri/src/lib.rs'],
    bridgeFiles: ['src/core/telemetry/TransferTelemetryManager.ts', 'src/core/telemetry/ConnectionStabilityMonitor.ts'],
    productionPath: 'Active Transfer Chunks -> TelemetryManager -> ConnectionHealthContext -> UI Visualizer',
    runtimeVerified: true,
    physicalVerified: false,
    limitations: 'Live RF interference telemetry measurements pending physical radio hardware.',
    requiredNextAction: 'Feed live physical socket stats into TelemetryManager once hardware is attached.',
  },
];

export class NativeImplementationAudit {
  public static getAllEntries(): AuditEntry[] {
    return AUDITED_SUBSYSTEM_ENTRIES;
  }

  public static getEntryById(id: string): AuditEntry | undefined {
    return AUDITED_SUBSYSTEM_ENTRIES.find((e) => e.id === id);
  }

  public static getEntriesByPlatform(platform: AuditPlatform): AuditEntry[] {
    return AUDITED_SUBSYSTEM_ENTRIES.filter((e) => e.platform === platform);
  }

  public static getEntriesByStatus(status: AuditEntry['status']): AuditEntry[] {
    return AUDITED_SUBSYSTEM_ENTRIES.filter((e) => e.status === status);
  }

  public static generateSummary(): AuditSummary {
    const entries = AUDITED_SUBSYSTEM_ENTRIES;
    const entriesByPlatform: Record<AuditPlatform, AuditEntry[]> = {
      'macOS': [],
      'Windows': [],
      'Android': [],
      'iOS': [],
      'Cross-Platform': [],
      'Web': [],
    };

    let realNativeCount = 0;
    let partialCount = 0;
    let scaffoldCount = 0;
    let architecturalCount = 0;
    let unverifiedRuntimeCount = 0;
    let mockOnlyCount = 0;
    let notImplementedCount = 0;

    for (const entry of entries) {
      entriesByPlatform[entry.platform].push(entry);

      switch (entry.status) {
        case 'REAL_NATIVE_IMPLEMENTATION':
          realNativeCount++;
          break;
        case 'PARTIAL_IMPLEMENTATION':
          partialCount++;
          break;
        case 'SCAFFOLD':
          scaffoldCount++;
          break;
        case 'ARCHITECTURAL_ONLY':
          architecturalCount++;
          break;
        case 'UNVERIFIED_RUNTIME':
          unverifiedRuntimeCount++;
          break;
        case 'MOCK_ONLY':
          mockOnlyCount++;
          break;
        case 'NOT_IMPLEMENTED':
          notImplementedCount++;
          break;
      }
    }

    return {
      totalEntries: entries.length,
      realNativeCount,
      partialCount,
      scaffoldCount,
      architecturalCount,
      unverifiedRuntimeCount,
      mockOnlyCount,
      notImplementedCount,
      entriesByPlatform,
    };
  }
}
