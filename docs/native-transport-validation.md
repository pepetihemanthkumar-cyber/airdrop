# NearShare Native Transport Validation Matrix & Platform Status

## 1. Testing Tier Taxonomy

NearShare strictly categorizes validation into five distinct tiers. Tests in lower tiers must never be confused with physical hardware verification:

| Tier | Category | Environment | Description |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Deterministic Simulation** | In-Memory / CI | Mock adapters, `NativeTransportHarness`, unit/stress tests (`STRESS-001..025`, `NATIVE-001..030`). |
| **Tier 2** | **Localhost Test** | Single Machine Loopback | Native Tauri Tokio TCP loopback (`127.0.0.1`) verifying IPC and binary framing. |
| **Tier 3** | **Local LAN Test** | Same Wi-Fi Subnet | Real socket communication over an existing local Wi-Fi router / switch without internet. |
| **Tier 4** | **Physical Same-Platform** | 2 Physical Devices | Direct radio verification (e.g. 2 physical Apple Macs testing AWDL P2P links). |
| **Tier 5** | **Physical Cross-Platform** | Cross-Vendor Devices | Direct Mode SoftAP / Wi-Fi Direct verification across Mac, Windows, Android, and iOS. |

---

## 2. Platform Implementation Status

| Platform | Subsystem | Status Tier | Current State & Details |
| :--- | :--- | :--- | :--- |
| **macOS** | Direct Mode (AWDL) | `ARCHITECTURAL / SCAFFOLD` | `MacOSDirectPeerBridge` + `macos_direct.rs`. Physical AWDL radio unverified. |
| **macOS** | Local Wi-Fi (TCP) | `RUNTIME IMPLEMENTED` | Native Tokio async TCP server + mDNS responder compiled in Tauri backend. |
| **macOS** | Secure Transport | `RUNTIME IMPLEMENTED` | AES-256-GCM AEAD, HKDF key derivation, cryptographic frame validation. |
| **macOS** | Native Filesystem | `RUNTIME IMPLEMENTED` | Chunked file streaming with disk sync and SHA-256 verification. |
| **Windows** | Direct Mode (Wi-Fi Direct) | `ARCHITECTURAL / SCAFFOLD` | `WindowsDirectPeerBridge` contract defined. Hardware unverified (no Windows device). |
| **Windows** | Local Wi-Fi (Winsock) | `ARCHITECTURAL ONLY` | Standard TCP architecture mapped. Requires Windows runtime. |
| **Windows** | Native Filesystem | `ARCHITECTURAL ONLY` | WinRT Storage API contract defined. |
| **Android** | Direct Mode (Nearby/P2P) | `ARCHITECTURAL ONLY` | `AndroidDirectPeerBridge` contract defined. Requires Android hardware runtime. |
| **Android** | Local Wi-Fi (NSD/Sockets) | `ARCHITECTURAL ONLY` | Architecture defined. |
| **Android** | Native Filesystem (SAF) | `ARCHITECTURAL ONLY` | Storage Access Framework tree architecture defined. |
| **iOS** | Direct Mode (Multipeer) | `ARCHITECTURAL ONLY` | `IOSDirectPeerBridge` contract defined. Requires iOS hardware runtime. |
| **iOS** | Local Wi-Fi (NWConnection) | `ARCHITECTURAL ONLY` | Network.framework architecture defined. |
| **iOS** | Native Filesystem | `ARCHITECTURAL ONLY` | Security-scoped document picker architecture defined. |
| **Web** | All Subsystems | `MOCK ONLY` | Browser preview fallback with simulated transfers. |

---

## 3. Physical Verification Gap Analysis

Current development host is a single physical macOS machine.
- **Verified in Host Runtime**: TypeScript engine, Tauri Rust backend, Localhost loopback TCP, AES-256-GCM encryption, 515+ deterministic tests.
- **Physical Unverified**:
  - AWDL radio direct link between two physical Macs.
  - Windows Wi-Fi Direct radio handshakes.
  - Android Nearby Connections / Wi-Fi P2P radio handshakes.
  - iOS Multipeer Connectivity / CoreBluetooth discovery.
  - Cross-platform direct bridging.
