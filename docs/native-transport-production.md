# NearShare Native Transport Production Integration Specification

## 1. Overview & Architectural Stack

NearShare enforces a strict separation of concerns across the presentation layer, transfer queue, transport orchestration, security session, protocol decoding, and filesystem I/O:

```
React / UI Layer (Smoked Glass / Liquid Monochrome Design)
        ↓
Context Layer (`TransferQueueContext`, `ConnectionHealthContext`, `DeviceTrustContext`)
        ↓
Production Transport Factory (`ProductionTransportFactory`)
        ↓
Transport Orchestration (`TransportManager`)
        ↓
Transport Adapter Contract (`TransportAdapter`)
        ↓
Native Transport Event Bridge (`NativeTransportEventBridge`)
        ↓
Native Transport Bridge (`NativeTransportBridge`: macOS / Windows / Android / iOS)
        ↓
Cryptographic Session (`SecureTransportSession` / AES-256-GCM AEAD)
        ↓
Binary Protocol Layer (`NativeTcpProtocolPeer` / Framed Length-Prefixed Packets)
        ↓
File Engine (`FileEngine` / `FileSystemManager` / `FileSystemAdapter`)
```

---

## 2. Production Transport Factory (`ProductionTransportFactory`)

The `ProductionTransportFactory` dynamically resolves transport adapters according to:
1. **Target Platform**: `macOS`, `Windows`, `Android`, `iOS`, or `Web`.
2. **Requested Transport Mode**: `direct` or `wifi`.
3. **Runtime Environment**: Native binary runtime (Tauri / Native Mobile) vs. Simulated Web Environment.

### Strict Mode Isolation Guarantees
- **No Automatic Fallback**: If `direct` mode is requested and native Direct Mode hardware is unavailable, the factory returns an explicit `requiresNative` or `unsupported` state. It **never** silently switches the user to `wifi` mode.
- **Explicit Typing**: Statuses are categorized as `ready`, `requiresNative`, `unsupported`, `notImplemented`, or `mockOnly`.

---

## 3. Direct Mode vs. Local Wi-Fi Mode Boundaries

### Direct Nearby Mode (`direct`)
- **Network Requirements**: Zero external infrastructure. Operates without a local Wi-Fi router, access point, or internet connection.
- **Radio Usage**: Direct ad-hoc peer-to-peer wireless channel (AWDL on Apple, Wi-Fi Direct on Windows/Android). Wi-Fi radios are **never disabled**.
- **Bootstrap / Discovery**: Bluetooth Low Energy (BLE) or mDNS proximity beacons assist initial peer discovery and connection bootstrap. Bluetooth is **not** used for bulk payload transfer.
- **Range Semantics**: 30 meters is a NearShare product/UX proximity boundary, not a hard physical limit.

### Local Wi-Fi Mode (`wifi`)
- **Network Requirements**: Both peers connected to the same local area network (LAN / WLAN). No external WAN / internet connection required.
- **Transport**: Standard local TCP sockets and multicast DNS (`_nearshare._tcp.local.`) peer discovery.
- **Range Semantics**: Subnet coverage boundary (no artificial 30-meter proximity cap).

---

## 4. Cryptographic Security & Protocol Integration

Every production file transfer payload is strictly bound to a verified cryptographic session:

1. **Identity Handshake**: Public keys and device fingerprints exchanged via `HELLO` and `CAPABILITIES`.
2. **Mutual Verification**: Authenticated via out-of-band PIN verification or mutual pairing tokens (`PAIRING_VERIFY`).
3. **Secure Channel Creation**: Session keys established using HKDF and AES-256-GCM AEAD (`SESSION_CREATE` / `SESSION_ACCEPT`).
4. **Framed Protocol Stream**: Chunk data frames (`CHUNK_START`, `CHUNK_DATA`, `CHUNK_ACK`) encrypted with sequence-authenticated AEAD envelopes.
5. **Session Revocation**: Blocked peers, revoked devices, expired sessions, or sequence violations immediately terminate the socket connection and wipe active memory buffers.

---

## 5. Bounded Backpressure & Memory Discipline

- **Flow Control**: Implemented via `TransferBackpressureController` with bounded in-flight window (max 16 chunks / 64 MiB buffer).
- **Buffer Deallocation**: Chunk memory is released immediately upon transport ACK or stream cancellation.
