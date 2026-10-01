# NearShare — Windows Native Direct Mode (Wi-Fi Direct) API Feasibility & Architecture

## 1. Executive Summary

NearShare Direct Mode requires an off-grid, zero-router, zero-internet peer-to-peer transport primitive that operates within a 30-meter product/UX proximity boundary. On Windows 10 and 11, the native platform technology for peer-to-peer wireless connectivity without an infrastructure access point is **Wi-Fi Direct** (Wi-Fi Alliance P2P specification), exposed via **Windows Runtime (WinRT) `Windows.Devices.WiFiDirect` APIs** and **`Windows.Networking.Sockets`**.

This document evaluates the public Windows APIs, defines the connection lifecycle from advertisement to reliable byte streaming, and establishes the native implementation boundary for NearShare's Windows Direct Mode bridge.

---

## 2. Distinction: Public WinRT APIs vs Native Platform Behavior

```
┌──────────────────────────────────────────────────────────────────┐
│                   NearShare Application Layer                   │
│   (ProtocolStateMachine, PairingManager, SecureTransportSession) │
├──────────────────────────────────────────────────────────────────┤
│                 Supported Public Windows APIs                    │
│    • Windows.Devices.WiFiDirect.WiFiDirectAdvertisementPublisher │
│    • Windows.Devices.WiFiDirect.WiFiDirectConnectionListener    │
│    • Windows.Devices.WiFiDirect.WiFiDirectDevice                │
│    • Windows.Networking.Sockets.StreamSocket (or Tokio TCP)     │
├──────────────────────────────────────────────────────────────────┤
│             Windows Driver & Kernel Subsystem (WDI)              │
│    • Wi-Fi Direct Miniport Driver Interface (WDI / NDIS 6.50+)   │
│    • Group Owner (GO) Negotiation & Autonomous SoftAP Mode      │
│    • Virtual Wi-Fi Adapter Creation & DHCP Subnet Provisioning   │
└──────────────────────────────────────────────────────────────────┘
```

### Critical Architectural Principle:
- **Wi-Fi Direct Link Negotiation vs Data Channel**: Wi-Fi Direct creates the physical peer-to-peer 802.11 link and provisions an ad-hoc IP network interface. It is *not* an application-level framing protocol.
- **Application Transport**: Once `WiFiDirectDevice.FromIdAsync()` completes link establishment, a standard bidirectional TCP stream (`StreamSocket` / `std::net::TcpStream`) is opened over the negotiated peer IP to transfer length-prefixed NearShare protocol frames.
- **No Emulation on Non-Windows Hosts**: WinRT Wi-Fi Direct APIs require the Windows NDIS 6.50+ Wi-Fi Direct stack. Non-Windows runtimes (e.g. macOS host) report `requiresNative` without faking WinRT handles.

---

## 3. Technology Evaluation Matrix

| Criterion | WinRT Wi-Fi Direct (`WiFiDirectDevice`) | Wi-Fi Direct Services (WFDS) | Windows SoftAP (`WiFiDirectAdvertisementPublisher.PreferredConfigurationMethod = SoftAP`) | Bluetooth LE RFCOMM |
| :--- | :--- | :--- | :--- | :--- |
| **API Status** | Public (Windows 10/11) | Public (Windows 10/11) | Public (Windows 10 1607+) | Public (Windows 10+) |
| **Router-Free Operation** | **YES** | **YES** | **YES** | **YES** |
| **Internet-Free Operation** | **YES** | **YES** | **YES** | **YES** |
| **Discovery Mechanism** | `WiFiDirectAdvertisementPublisher` & `DeviceInformation.CreateWatcher` | `WiFiDirectServiceAdvertiser` | Standard Wi-Fi Beacon Scan | `BluetoothLEAdvertisementWatcher` |
| **Connection Primitive** | Group Owner / Client Negotiation | Service Session ID | Client Connects to SSID/WPA2 | Bluetooth GATT / RFCOMM |
| **Byte Streaming Channel** | Bidirectional TCP `StreamSocket` | `StreamSocket` | Bidirectional TCP Socket | RFCOMM / Serial Port |
| **Throughput Suitability** | High (20–80 MB/s via 5GHz 802.11ac/ax) | High (20–80 MB/s) | High (20–80 MB/s) | Extremely Low (< 0.2 MB/s) |
| **Large File Practicality** | **YES** (Multi-GB streaming) | **YES** | **YES** | **NO** |
| **Resume Practicality** | **YES** (via chunk checkpoints) | **YES** | **YES** | **NO** |
| **Cross-Platform Potential** | Windows $\leftrightarrow$ Windows, Android P2P | Windows $\leftrightarrow$ Windows only | Windows $\leftrightarrow$ Any OS (acts as AP) | Universal GATT (low speed) |

---

## 4. Technology Selection for Windows Direct Spike

### Primary Technology: WinRT `WiFiDirectAdvertisementPublisher` + `WiFiDirectConnectionListener` + `StreamSocket`

**Rationale:**
1. **Zero-Configuration P2P Discovery**: Allows broadcasting NearShare service presence without requiring manual Wi-Fi configuration by the user.
2. **Standard Socket Byte Stream**: Generates a standard TCP endpoint over the virtual Wi-Fi Direct network interface, perfectly aligning with NearShare's length-prefixed `ProtocolStateMachine`.
3. **Autonomous Group Owner Option**: Provides fallback to SoftAP mode for cross-platform pairing where standard Wi-Fi Direct negotiation is unsupported by the peer OS.

---

## 5. Security & Permission Boundary

### 1. Windows App Capabilities (`Package.appxmanifest` / MSIX / NSIS)
- `wiFiDirect`: Required for WinRT Wi-Fi Direct discovery and connection.
- `privateNetworkClientServer`: Required to host TCP `StreamSocketListener` and communicate across peer subnets.
- `internetClientServer`: Required for outbound client sockets.

### 2. Windows Firewall Rules
- Must allow inbound TCP traffic on the selected ephemeral port for the NearShare application binary.
- Wi-Fi Direct virtual adapter connections are typically classified under the `Private` or `Unidentified` network profile.

### 3. Service Identity Constraints
- Service Identifier: `nearshare-p2p`
- Service Information IE (Information Element): Encodes opaque device profile ID, sanitized display name, and protocol version.
- Never advertises private keys, file paths, or auth tokens.

---

## 6. Verification Status

| Milestone | Status | Validation Method |
| :--- | :--- | :--- |
| **API Architecture Specification** | `COMPLETE` | Documented in this specification |
| **TypeScript Native Bridge Contract** | `COMPLETE` | `src/core/native/windows/WindowsDirectPeerBridge.ts` |
| **Tauri Rust Native Interface** | `IMPLEMENTED` | `src-tauri/src/windows_direct.rs` (guarded by `#[cfg(target_os = "windows")]`) |
| **macOS Host Cross-Compilation** | `VERIFIED` | Rust & TypeScript compile cleanly with 0 errors |
| **Windows Runtime Execution** | `NOT_VERIFIED` | Requires execution on physical Windows 10/11 environment |
| **Physical Wi-Fi Direct Transfer** | `NOT_VERIFIED` | Requires two physical devices tested under off-grid conditions |
