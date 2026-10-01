# NearShare Windows Native Direct Mode Architecture

## Overview
NearShare Direct Mode on Windows provides high-bandwidth, off-grid peer-to-peer file transfer over Wi-Fi Direct (Wi-Fi P2P) without requiring an existing wireless router or internet connection.

---

## 1. Native Windows WinRT Components

### A. Advertisement & Discovery (`Windows.Devices.WiFiDirect`)
- **`WiFiDirectAdvertisementPublisher`**:
  - Configures `WiFiDirectAdvertisement`.
  - Enables autonomous group owner (`SetIsAutonomousGroupOwnerEnabled(true)`), allowing Windows to negotiate Wi-Fi Direct group ownership or act as a SoftAP endpoint.
  - Exposes lifecycle states: `Created`, `Started`, `Stopped`, `Aborted`.
- **`WiFiDirectAdvertisementWatcher` / `DeviceWatcher`**:
  - Created via `DeviceInformation::CreateWatcherAqsFilter(&WiFiDirectDevice::GetDeviceSelector(WiFiDirectDeviceSelectorConfigurationMethod::Default))`.
  - Subscribes to `Added`, `Updated`, `Removed`, and `EnumerationCompleted` events.
  - Maps discovered device nodes into sanitized `WindowsDirectPeerInfo`.

### B. Connection & Socket Streaming (`Windows.Networking.Sockets`)
- **`WiFiDirectConnectionListener`**:
  - Listens for inbound Wi-Fi Direct connection requests from nearby peers.
  - Handles PIN or Push-Button Configuration (PBC) pairing handshakes.
- **`StreamSocketListener` & `StreamSocket`**:
  - Binds service name `"nearshare-p2p"`.
  - Establishes bidirectional binary streaming socket between endpoints.
  - Emits incoming binary chunks to Tauri IPC event stream (`direct_windows_data`).

---

## 2. Security & Framing

1. **Protocol Framing**: All data flowing through `StreamSocket` is encapsulated in `SecureFrame` binary format with magic `0x53454301` (`SEC01`).
2. **Encrypted Channel**: End-to-end authenticated encryption via ECDH P-256 key exchange, HKDF-SHA256 derivation, and AES-256-GCM authenticated ciphertext.
3. **Monotonic Sequence Enforcement**: 64-bit sequence counters prevent replay attacks.
4. **File Integrity**: Full SHA-256 checksum validation upon completion.

---

## 3. Lifecycle & State Machine

```
[IDLE]
  │
  ├──► startAdvertising() ──► [ADVERTISING] (Publisher Started)
  │
  ├──► startDiscovery()   ──► [DISCOVERING] (Watcher Started)
  │                                │
  │                                ▼ (Peer Found)
  │                         [PEER DISCOVERED]
  │                                │
  │                                ▼ (Connect)
  │                         [CONNECTING]
  │                                │
  │                                ▼ (Link Established)
  │                         [CONNECTED]
  │                                │
  │                                ▼ (Open Stream)
  │                         [STREAM OPENED]
  │                                │
  │                                ▼ (Secure Handshake)
  │                         [TRANSFERRING] (ECDH + AES-GCM)
  │                                │
  │                                ▼
  └───────────────────────── [DISCONNECTED] ──► Deterministic Cleanup
```
