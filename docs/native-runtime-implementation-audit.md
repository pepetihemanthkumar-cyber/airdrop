# NearShare Native Runtime Implementation Audit

> **Target Version**: `0.1.0`  
> **Host Environment**: `macOS Darwin arm64 (Apple Silicon)`  
> **Classification Policy**: Strict evidence-based ground truth. TypeScript interfaces or compiling Rust structs alone are **never** classified as real native implementations.

---

## 1. Audit Summary Matrix

| Platform | Subsystem | Feature | Native Code Present | Production Path | Runtime Verified | Physical Verified | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **macOS** | direct_transport | Direct Mode (AWDL / Multipeer) | `src-tauri/macos/NearShareDirect/*.swift` & `src-tauri/src/macos_direct.rs` | `DirectTransportAdapter` -> `MacOSDirectPeerBridge` -> Tauri IPC -> Swift Multipeer Session -> Stream -> `SecureTransportSession` -> Protocol -> `FileEngine` | Yes (Self-Test + Runtime) | No (Pending 2nd Mac) | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS** | lan_transport | Tokio TCP Socket Transport | `src-tauri/src/lib.rs` | `NativeTcpProtocolPeer` -> Tauri IPC -> Rust Tokio TCP | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS** | lan_discovery | UDP Multicast / mDNS Discovery | `src-tauri/src/lib.rs` | `DiscoveryManager` -> Rust `UdpSocket` (`239.255.60.60:53317`) | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS** | filesystem | File & Folder Streaming I/O | `src-tauri/src/lib.rs` | `FileEngine` -> `FileSystemAdapter` -> Rust `std::fs` | Yes | Yes (Local Disk) | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS** | desktop_lifecycle | Window Intercept, Tray & Notifs | `src-tauri/src/lib.rs` | `DesktopLifecycleManager` -> Tauri Window & Notification API | Yes | Yes (Host OS) | `REAL_NATIVE_IMPLEMENTATION` |
| **Windows** | direct_transport | Direct Mode (Wi-Fi Direct) | `src-tauri/src/windows_direct.rs` (WinRT `Windows.Devices.WiFiDirect`) | `DirectTransportAdapter` -> `WindowsDirectPeerBridge` -> Tauri IPC -> WinRT `WiFiDirectAdvertisementPublisher` / `StreamSocket` | No (macOS Host) | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **Windows** | lan_transport | Native Tokio TCP & Filesystem | `src-tauri/src/lib.rs` | Cross-platform Rust std/Tokio compiled for Windows target | No (macOS Host) | No (Pending HW) | `UNVERIFIED_RUNTIME` |
| **Android** | direct_transport | Direct Mode (Wi-Fi P2P/Aware) | `src-tauri/android/NearShareDirect/*.kt` & `src-tauri/src/android_direct.rs` | `DirectTransportAdapter` -> `AndroidDirectPeerBridge` -> Tauri IPC -> Kotlin `WifiP2pManager` / `Socket` -> `SecureTransportSession` -> Protocol -> `FileEngine` | No (macOS Host) | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **Android** | lan_transport | NSD Discovery & SAF Storage | None (TS Contract Only) | Unimplemented mobile boundary | No | No | `ARCHITECTURAL_ONLY` |
| **iOS** | direct_transport | Direct Mode (Multipeer/NW) | `src-tauri/ios/NearShareDirect/*.swift` & `src-tauri/src/ios_direct.rs` | `DirectTransportAdapter` -> `IOSDirectPeerBridge` -> Tauri IPC -> Swift Multipeer Session -> Stream -> `SecureTransportSession` -> Protocol -> `FileEngine` | No (macOS Host) | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **iOS** | lan_transport | NWConnection & Document Picker | None (TS Contract Only) | Unimplemented mobile boundary | No | No | `ARCHITECTURAL_ONLY` |
| **Cross-Platform** | secure_transport | AEAD Encryption (AES-256-GCM) | `src-tauri/src/lib.rs` | `SecureTransportSession` integrated in `NativeTcpProtocolPeer` | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **Cross-Platform** | protocol_engine | 4-Byte BE Framed Protocol | `src-tauri/src/lib.rs` | `NativeTcpProtocolPeer` binary packet serializer/deserializer | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **Cross-Platform** | filesystem | Chunk Streaming & Backpressure | `src-tauri/src/lib.rs` | `TransferBackpressureController` (bounded 16 chunks / 64 MiB) | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **Cross-Platform** | recovery_engine | Atomic JSON Checkpoints | `src-tauri/src/lib.rs` | `ResumeCheckpoint` -> Receiver-Authoritative Range Resume | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |
| **Cross-Platform** | telemetry_diagnostics| Sliding Throughput & RTT Latency | `src-tauri/src/lib.rs` | `TransferTelemetryManager` -> `ConnectionHealthContext` | Yes | No (Pending HW) | `REAL_NATIVE_IMPLEMENTATION` |

---

## 2. Detailed Subsystem Evidence & Limitations

### 1. macOS Direct Mode
- **Native Files**:
  - `src-tauri/macos/NearShareDirect/NearShareDirectTypes.swift`
  - `src-tauri/macos/NearShareDirect/NearShareDirectPeer.swift`
  - `src-tauri/macos/NearShareDirect/NearShareDirectSession.swift`
  - `src-tauri/macos/NearShareDirect/NearShareDirectBridge.swift`
  - `src-tauri/src/macos_direct.rs`
- **Bridge Files**: `src/core/native/macos/MacOSDirectPeerBridge.ts`, `src/core/transport/direct/DirectTransportAdapter.ts`
- **Evidence**: Real Swift module compiled via `build.rs` into `libnearshare_direct.a` and linked with Apple `MultipeerConnectivity` and `Network.framework`. C-ABI entry points invoked by `macos_direct.rs` manage `MCSession`, `MCNearbyServiceAdvertiser`, `MCNearbyServiceBrowser`, and continuous byte-streams (`NSInputStream`/`NSOutputStream`).
- **Classification**: `REAL_NATIVE_IMPLEMENTATION`
- **Limitations**: Physical multi-device validation between two physical Macs is pending hardware availability.

### 2. Windows Direct Mode
- **Native Files**: `src-tauri/src/windows_direct.rs`
- **Bridge Files**: `src/core/native/windows/WindowsDirectPeerBridge.ts`, `src/core/transport/direct/DirectTransportAdapter.ts`
- **Evidence**: `windows_direct.rs` implements WinRT `Windows.Devices.WiFiDirect` (`WiFiDirectAdvertisementPublisher`, `WiFiDirectAdvertisementWatcher`, `WiFiDirectConnectionListener`) and `Windows.Networking.Sockets` (`StreamSocket`, `StreamSocketListener`) via the `windows` crate (`v0.58`).
- **Classification**: `REAL_NATIVE_IMPLEMENTATION`
- **Limitations**: Windows runtime execution unverified on macOS host; physical testing pending Windows PC hardware.

### 3. Android Direct Mode
- **Native Files**:
  - `src-tauri/android/NearShareDirect/NearShareDirectManager.kt`
  - `src-tauri/android/NearShareDirect/NearShareDirectSocket.kt`
  - `src-tauri/android/NearShareDirect/NearShareDirectService.kt`
  - `src-tauri/android/NearShareDirect/NearShareDirectTypes.kt`
  - `src-tauri/src/android_direct.rs`
- **Bridge Files**: `src/core/native/android/AndroidDirectPeerBridge.ts`, `src/core/transport/direct/DirectTransportAdapter.ts`
- **Evidence**: Kotlin module implements `android.net.wifi.p2p.WifiP2pManager`, DNS-SD service registration (`WifiP2pDnsSdServiceInfo`), `ConnectivityManager` network binding, and `java.net.Socket` streaming. Tauri IPC bridge in `android_direct.rs` manages IPC calls under `#[cfg(target_os = "android")]`.
- **Classification**: `REAL_NATIVE_IMPLEMENTATION`
- **Limitations**: Android runtime execution unverified on macOS host; physical testing pending Android hardware.

### 4. iOS Direct Mode
- **Native Files**:
  - `src-tauri/ios/NearShareDirect/NearShareDirectTypes.swift`
  - `src-tauri/ios/NearShareDirect/NearShareDirectPeer.swift`
  - `src-tauri/ios/NearShareDirect/NearShareDirectSession.swift`
  - `src-tauri/ios/NearShareDirect/NearShareDirectBridge.swift`
  - `src-tauri/src/ios_direct.rs`
- **Bridge Files**: `src/core/native/ios/IOSDirectPeerBridge.ts`, `src/core/transport/direct/DirectTransportAdapter.ts`
- **Evidence**: Real Swift module implementing Apple `MultipeerConnectivity` (`MCNearbyServiceAdvertiser`, `MCNearbyServiceBrowser`, `MCSession`, `InputStream`, `OutputStream`) and Tauri FFI bridge in `ios_direct.rs`.
- **Classification**: `REAL_NATIVE_IMPLEMENTATION`
- **Limitations**: iOS runtime execution unverified on desktop macOS host; physical testing pending iPhone/iPad hardware.

### 5. iOS LAN Mode
- **Native Files**: None
- **Bridge Files**: `src/core/native/ios/`
- **Evidence**: Strongly typed TypeScript capability interfaces and feasibility architecture documents exist.
- **Classification**: `ARCHITECTURAL_ONLY`

### 4. macOS Native LAN TCP & mDNS
- **Native Files**: `src-tauri/src/lib.rs`
- **Bridge Files**: `src/core/protocol/native/NativeTcpProtocolPeer.ts`, `src/core/protocol/discovery/DiscoveryManager.ts`
- **Evidence**: Real native `std::net::TcpListener`, `TcpStream`, and `UdpSocket` multicast joining (`239.255.60.60:53317`) compiled and executed in desktop binary with 4-byte big-endian framing.
- **Classification**: `REAL_NATIVE_IMPLEMENTATION` (Localhost Verified / Physical LAN Pending)

### 5. Native Filesystem & File Streaming
- **Native Files**: `src-tauri/src/lib.rs`
- **Bridge Files**: `src/core/filesystem/NativeFileReference.ts`, `src/core/filesystem/NativeFolderReference.ts`
- **Evidence**: Native file readers, chunking, manifest generation, and streaming writes execute via Rust `std::fs` and Tauri IPC.
- **Classification**: `REAL_NATIVE_IMPLEMENTATION` (Fully Verified)
