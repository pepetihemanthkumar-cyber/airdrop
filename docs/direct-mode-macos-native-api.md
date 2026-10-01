# NearShare — macOS Native Peer-to-Peer API Boundary & Feasibility Analysis

## 1. Executive Summary

NearShare Direct Mode requires an off-grid, zero-router, zero-internet peer-to-peer transport primitive that operates within a 30-meter product/UX proximity boundary. On macOS, this requirement intersects Apple's wireless networking architecture, sandbox permissions, and public framework boundaries.

This document evaluates candidate Apple-native technologies, distinguishes public APIs from private platform behaviors, and defines the native implementation boundary for NearShare's macOS Direct Mode spike.

---

## 2. Distinction: Public APIs vs Internal Platform Behavior

```
┌──────────────────────────────────────────────────────────────────┐
│                   NearShare Application Layer                   │
│   (ProtocolStateMachine, PairingManager, SecureTransportSession) │
├──────────────────────────────────────────────────────────────────┤
│                  Supported Public Apple APIs                     │
│    • MultipeerConnectivity Framework (MCSession, MCNearbyBrowser)│
│    • Network.framework (NWListener, NWBrowser + includePeerToPeer)│
│    • CoreBluetooth / BLE (Auxiliary Discovery & Bootstrap only)  │
├──────────────────────────────────────────────────────────────────┤
│           Internal Platform Behavior (Private / Driver)          │
│    • Apple Wireless Direct Link (AWDL)                           │
│    • CoreUtils / AirDrop Private Daemons (sharingd, rapportd)   │
│    • Wi-Fi Interface Virtualization (awdl0, llw0)                │
└──────────────────────────────────────────────────────────────────┘
```

### Critical Architectural Principle:
- **AWDL is NOT a generic public API**: AWDL is Apple's proprietary link-layer IEEE 802.11 ad-hoc mesh protocol operating over virtual network interface `awdl0`. Third-party developers cannot bind raw AWDL sockets or issue direct IOCTL commands in sandboxed App Store or notarized macOS applications.
- **Accessing AWDL via Public Frameworks**: Apple provides access to peer-to-peer Wi-Fi and Bluetooth mesh routing through **`MultipeerConnectivity`** and **`Network.framework`** (with `NWParameters.includePeerToPeer = true`).
- **No Private APIs**: NearShare strictly utilizes documented, stable Apple public SDKs to ensure sandbox compatibility, App Store compliance, and long-term operating system stability.

---

## 3. Technology Evaluation Matrix

| Criterion | MultipeerConnectivity | Network.framework (P2P) | Bonjour / mDNS (NSNetService) | CoreBluetooth (BLE) |
| :--- | :--- | :--- | :--- | :--- |
| **API Status** | Public (macOS 10.10+ / iOS 7+) | Public (macOS 10.14+ / iOS 12+) | Public (macOS 10.0+) | Public (macOS 10.7+) |
| **Router-Free Operation** | **YES** (Ad-hoc Wi-Fi + BLE) | **YES** (`includePeerToPeer`) | NO (Requires active LAN/AP) | **YES** (Direct RF) |
| **Internet-Free Operation** | **YES** | **YES** | **YES** | **YES** |
| **Discovery Mechanism** | `MCNearbyServiceBrowser` | `NWBrowser` (`.bonjour`) | `NSNetServiceBrowser` | `CBCentralManager` |
| **Connection Primitive** | `MCSession` | `NWConnection` | BSD / TCP Sockets | `CBPeripheral` / GATT |
| **Byte Streaming** | Reliable Byte Stream / Packet | Bidirectional TCP/UDP stream | Bidirectional TCP socket | Tiny GATT packets (~512B) |
| **Throughput Suitability** | High (5–40 MB/s via Wi-Fi) | High (10–60 MB/s via Wi-Fi) | Network-dependent | Extremely Low (< 0.1 MB/s) |
| **Large File Practicality** | **YES** (via stream chunks) | **YES** (via socket stream) | **YES** | **NO** (Unusable for GBs) |
| **Resume Practicality** | **YES** (via chunk protocol) | **YES** (via chunk protocol) | **YES** | **NO** |
| **Background Persistence** | Limited by App lifecycle | Limited by App lifecycle | Standard daemon rules | Extremely restricted |
| **Cross-Platform Compatibility** | Apple Ecosystem only | Apple Ecosystem only | Standard RFC 6762 (LAN) | Standard GATT (Low speed) |

---

## 4. Technology Selection for macOS Direct Spike

### Primary Spike Technology: `MultipeerConnectivity` + `Network.framework` Peer-to-Peer Stream

**Rationale:**
1. **Zero-Configuration Ad-Hoc Mesh**: `MultipeerConnectivity` abstracts ad-hoc Wi-Fi negotiation and Bluetooth bootstrap without requiring manual network SSID switching or infrastructure access points.
2. **Reliable Bidirectional Byte Channel**: Provides `MCSession.startStream(withName:toPeer:)` returning standard `NSInputStream` and `NSOutputStream` objects, which cleanly map to length-prefixed NearShare protocol binary frames.
3. **Transparent Interface Selection**: Automatically leverages AWDL and Bluetooth LE under the hood for discovery and switches to 5GHz/2.4GHz ad-hoc Wi-Fi channels for bulk data transmission.
4. **App Sandbox Compliance**: Runs securely inside macOS App Sandbox with standard network client/server entitlements.

---

## 5. Security & Permission Boundary

### 1. Entitlements (`NearShare.entitlements`)
- `com.apple.security.network.client`: Required to initiate outgoing connections.
- `com.apple.security.network.server`: Required to accept incoming peer connections.

### 2. Information Property List (`Info.plist`)
- `NSLocalNetworkUsageDescription`: `"NearShare requires local network access to discover and securely transfer files to nearby Apple devices without internet."` (Required on macOS 15 Sequoia and iOS 14+).
- `NSBonjourServices`:
  - `_nearshare-p2p._tcp`
  - `_nearshare-p2p._udp`

### 3. Native Service Identification
- Service Type: `nearshare-p2p` (1–15 ASCII alphanumeric and hyphen characters).
- Peer Name: Opaque local node identifier (e.g. `NS-MAC-XXXX`); never contains user personal names or private hardware MAC addresses in unauthenticated discovery frames.

---

## 6. Verification Status

| Milestone | Status | Validation Method |
| :--- | :--- | :--- |
| **API Architecture Specification** | `COMPLETE` | Documented in this specification |
| **TypeScript Native Bridge Contract** | `COMPLETE` | `src/core/native/macos/MacOSDirectPeerBridge.ts` |
| **Tauri Rust Native Implementation** | `IMPLEMENTED` | `src-tauri/src/macos_direct.rs` & `src-tauri/src/lib.rs` |
| **Single-Machine Local Compilation** | `VERIFIED` | Rust compilation & TypeScript test suite pass |
| **Physical Two-Mac Direct Transfer** | `NOT_VERIFIED` | Requires two physical Macs tested under off-grid conditions |
