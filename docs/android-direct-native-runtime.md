# NearShare Android Native Direct Mode Architecture

## Overview
NearShare Direct Mode on Android provides high-bandwidth, off-grid peer-to-peer file transfer over Wi-Fi Direct (Wi-Fi P2P) and Wi-Fi Aware without requiring an external wireless router or internet connection.

---

## 1. Native Android Components

### A. Discovery & Advertisement (`android.net.wifi.p2p.nsd`)
- **DNS-SD Service Registration (`WifiP2pDnsSdServiceInfo`)**:
  - Registers DNS-SD service `_nearshare._tcp` with TXT record metadata (`version="1.0"`, `platform="Android"`, `security="ecdh-p256"`).
  - Broadcasts availability without exposing private IPs or MAC addresses.
- **Service Request & Discovery (`WifiP2pDnsSdServiceRequest`)**:
  - Registers DNS-SD TXT and service response listeners via `WifiP2pManager.setDnsSdResponseListeners()`.
  - Discovers nearby active NearShare peers and maps them into sanitized `AndroidDirectPeerInfo`.

### B. Connection & Socket Streaming (`android.net.wifi.p2p`, `java.net`)
- **`WifiP2pManager.connect()`**:
  - Initiates Wi-Fi Direct group negotiation with balanced intent (`groupOwnerIntent = 6`).
  - Queries `WifiP2pInfo` upon group formation to identify Group Owner IP address and assigned role (`groupOwner` vs `client`).
- **`NearShareDirectSocket` & `ConnectivityManager`**:
  - Binds socket stream directly to the Wi-Fi Direct network interface via `ConnectivityManager.NetworkCallback` (`Network.bindSocket()`), preventing traffic leakage over cellular, normal Wi-Fi LAN, or VPNs.
  - Server listens on port `53318` on the Group Owner; Client connects to the GO IP address on port `53318`.
  - Bounded 64 KiB chunk streaming (`CHUNK_SIZE = 65536`) with backpressure control (max 16 in-flight chunks / 64 MiB total buffered ceiling).

### C. Background Transfer Service (`android.app.Service`)
- **`NearShareDirectService`**:
  - Android `ForegroundService` with `ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE` and `FOREGROUND_SERVICE_TYPE_DATA_SYNC` (Android 14+ / API 34+).
  - Displays persistent notification during active streaming to prevent OS process suspension or socket teardown.

---

## 2. Security & Framing

1. **Protocol Framing**: Sits below NearShare `SecureTransportSession`.
2. **Encrypted Channel**: End-to-end authenticated encryption via ECDH P-256 key exchange, HKDF-SHA256 key derivation, and AES-256-GCM authenticated ciphertext.
3. **Monotonic Sequence Enforcement**: 64-bit sequence counters prevent replay attacks.
4. **File Integrity**: Full SHA-256 checksum validation upon completion.

---

## 3. Lifecycle State Machine

```
[IDLE]
  │
  ├──► startAdvertising() ──► [ADVERTISING] (DNS-SD Service Registered)
  │
  ├──► startDiscovery()   ──► [DISCOVERING] (Service Discovery Active)
  │                                │
  │                                ▼ (Peer Found)
  │                         [PEER DISCOVERED]
  │                                │
  │                                ▼ (connectPeer)
  │                         [CONNECTING] (Group Formation)
  │                                │
  │                                ▼ (Group Formed + GO IP Identified)
  │                         [CONNECTED]
  │                                │
  │                                ▼ (openStream)
  │                         [STREAM OPENED] (TCP Socket Connected & Bound)
  │                                │
  │                                ▼ (Foreground Service Active)
  │                         [TRANSFERRING] (ECDH + AES-256-GCM)
  │                                │
  │                                ▼
  └───────────────────────── [DISCONNECTED] ──► Deterministic Teardown
```
