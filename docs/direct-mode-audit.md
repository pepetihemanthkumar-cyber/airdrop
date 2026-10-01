# NearShare Direct Mode — Architectural & Feasibility Audit (Step 55)

## Executive Summary
Direct Mode is NearShare's foundational off-grid transfer capability:
- **Core Principle**: No external Wi-Fi access point, local router, or internet connection is required.
- **Hardware Semantics**: Does *not* disable device Wi-Fi radios. Native platforms utilize Wi-Fi Direct, AWDL/MultipeerConnectivity, Wi-Fi Aware, or ad-hoc wireless adapters while maintaining local radio states.
- **Product UX Boundary**: 30 meters is a product design and UX target boundary, *not* a guaranteed physical radio distance. Real-world range is subject to physical interference, hardware antenna efficiency, OS radio power states, and environmental obstacles.
- **Technical Honesty Contract**: No physical cross-platform Direct transfer is claimed as verified unless tested on actual physical multi-device pairs.

---

## 1. Audit by Architectural Layers

### A. UI Already Implemented
1. **Mode Switcher Pill & Dropdown** (`FloatingNavPill.tsx`, `CentralTransferVessel.tsx`):
   - Supports selecting `⚡ Direct` (Nearby peer-to-peer) and `Wi-Fi` (Local Area Network).
   - Responsive active indicator, mode badges, and status labels.
2. **Device Discovery Radar Vessel** (`DeviceDiscoveryVessel.tsx`):
   - Monochromatic liquid-glass circular radar canvas animating nearby peer nodes within the 30m target radius.
   - Distinct display of estimated distance, signal strength quality, trusted badge, and platform icons.
3. **Platform Readiness & Permissions Screen** (`PlatformReadinessScreen.tsx`):
   - Surfaces OS permission states for Local Network, Nearby Devices, Wi-Fi, Notifications, and Storage.
4. **Connection Diagnostics Drawer** (`ConnectionHealthPanel.tsx`):
   - Telemetry breakdown showing Connection Mode (`direct` vs `wifi`), latency, packet loss, stability %, throughput graphs, and encryption status.

---

### B. Transport Architecture Already Implemented
1. **Transport Abstraction Interfaces** (`src/core/transport/TransportAdapter.ts`):
   - Standard interface for `discover()`, `connect()`, `send()`, `pause()`, `resume()`, `cancel()`, `getCapabilities()`, `getConnectionState()`, and `onEvent()`.
2. **Transport Manager & Registry** (`TransportManager.ts`, `TransportRegistry.ts`):
   - Central registration for mode adapters with implementation type tracking (`mock`, `native`, `unavailable`) and capability metadata.
3. **Native Bridge & IPC Interface** (`NativeTransportBridge.ts`, `TauriIpc.ts`):
   - Tauri Rust bridge for native TCP server hosting, TCP client streaming, and UDP discovery broadcasts.
4. **Protocol State Machine & Frame Serialization** (`ProtocolStateMachine.ts`, `ProtocolFrame.ts`):
   - Binary frame encapsulation, length-prefixed streaming, message envelopes (`HELLO`, `FILE_MANIFEST`, `CHUNK_START`, `CHUNK_DATA`, `CHUNK_ACK`, `TRANSFER_COMPLETE`), and deterministic state transitions.
5. **Cryptographic Secure Transport** (`SecureTransportSession.ts`, `PairingManager.ts`, `DeviceIdentityManager.ts`):
   - ECDSA P-256 device keypairs, SHA-256 fingerprint verification, ECDH key agreement, and AES-256-GCM AEAD encrypted frames.

---

### C. Native Capability Declarations
1. **Platform Capability Maps** (`platformCapabilities.ts`, `CapabilityResolver.ts`):
   - Declares platform-level transfer features: `transferModes.directNearby`, `transferModes.localWifi`, `discovery.ble`, `discovery.wifiDirect`, `discovery.bonjour`.
   - Explicitly tags native features as `requiresNative` when running in browser mock environments.
2. **Tauri Native Diagnostics** (`TauriIpc.ts`, `tauriBridgeTest.ts`):
   - Reports runtime platform (`macOS`, `Windows`, `Linux`), bridge presence, and capability levels (`FullNative`, `PartialNative`, `WebMockFallback`).

---

### D. Mock / Simulation Behavior
1. **Frontend Simulation Transport** (`MockDirectNearbyTransport.ts`, `MockWiFiTransport.ts`):
   - Simulates discovery timer loops and emits mock `TransportDevice` objects (`Hemanth's MacBook Air`, `Poco F7`, `Elena's iPad Pro`).
   - Simulates chunked data transfers via `setInterval` progress timers.
2. **In-Memory Loopback Peer** (`MockProtocolPeer.ts`):
   - Simulates protocol handshakes in frontend memory for diagnostic inspection in `ProtocolInspector.tsx`.

---

### E. Real Native Implementation (Verified Localhost / Single-Node)
1. **macOS Native Direct Mode Spike** (`src/core/native/macos/`, `src-tauri/src/macos_direct.rs`):
   - Implemented `MacOSDirectPeerBridge`, `MacOSDirectCapabilities`, and Tauri IPC commands (`direct_macos_start_discovery`, `direct_macos_connect`, `direct_macos_send_bytes`).
   - Integrated `DirectModeInspector` for real-time diagnostics.
2. **Windows Native Direct Mode Spike** (`src/core/native/windows/`, `src-tauri/src/windows_direct.rs`):
   - Implemented `WindowsDirectPeerBridge`, `WindowsDirectCapabilities`, and Tauri IPC commands (`direct_windows_start_discovery`, `direct_windows_connect`, `direct_windows_send_bytes`) with cross-platform build guards.
3. **Native TCP Socket Server & Client** (`MacTcpLanSpikeTransport.ts`, `WindowsTcpLanSpikeTransport.ts`, `src-tauri/src/lib.rs`):
   - Real async TCP socket server listening on ephemeral port, socket connection, chunk serialization, and bi-directional frame exchange on loopback/LAN interfaces.
4. **Native File Engine & Streaming Reader/Writer** (`FileStreamReader.ts`, `FileStreamWriter.ts`, `NativeFileWriter.ts`):
   - Real binary file streaming, chunk hashing (SHA-256), sequential write validation, directory scanning, and durable checkpoint recovery.

---

### F. Physical-Device Validation Status
- **macOS ↔ macOS Physical Direct Radio**: `NOT VERIFIED` (requires two physical Macs with native Multipeer/AWDL adapter per `docs/direct-mode-macos-physical-test.md`).
- **Windows ↔ Windows Physical Direct Radio**: `NOT VERIFIED` (requires physical Windows 10/11 machines with Wi-Fi Direct WDI driver).
- **macOS ↔ Windows Physical Direct Radio**: `NOT VERIFIED` (cross-vendor Direct mode requires bridging Wi-Fi Direct SoftAP/GroupOwner).
- **macOS ↔ Android Physical Direct Radio**: `NOT VERIFIED` (requires Android Wi-Fi Direct / Hotspot bootstrap).
- **Physical Multi-Device LAN TCP/UDP**: `NOT VERIFIED` (only verified on single-machine localhost / loopback).

---

### G. Unsupported / Unverified Areas
1. **Cross-Vendor Direct Discovery**: Apple MultipeerConnectivity cannot discover Android Wi-Fi Direct or Windows Wi-Fi Direct out of the box. An auxiliary bootstrap primitive (BLE, QR code, or Local SoftAP) is required.
2. **Bluetooth as Primary Data Transport**: Bluetooth LE throughput (~100–250 KB/s in practice) is strictly unsuitable for multi-megabyte/gigabyte payload transfer; Bluetooth must remain auxiliary (discovery/pairing bootstrap only).
3. **Unattended Process-Restart Transfer**: Application termination checkpoints state to disk, but OS-level background daemon auto-start across reboot is not implemented.
