# NearShare Direct Mode — Native Implementation Boundary (Step 55)

## 1. Architectural Responsibility Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TypeScript Layer                              │
│  - React UI & Monochrome Liquid-Glass Presentation                      │
│  - NearShare Protocol State Machine (HELLO, MANIFEST, CHUNKS, ACKS)     │
│  - Transfer Queue, Checkpoint Recovery Management & Durable State       │
│  - Cryptographic Handshake (ECDSA, ECDH, AES-256-GCM SecureFrame)       │
│  - Device Trust & Blocked List Filtering                                │
│  - Platform Capability Resolution & User-Facing Statuses                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Tauri IPC Commands & Events
┌────────────────────────────────────▼────────────────────────────────────┐
│                        Tauri / Rust Native Core                         │
│  - Async Tokio TCP Server & Client Sockets                              │
│  - UDP Discovery Broadcast & Multicast Listener                         │
│  - High-Speed Buffered File Stream Reading / Writing                   │
│  - System Tray / Window Lifecycle Management                            │
│  - Safe Shutdown Checkpoint Flushing                                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ OS Platform FFI / Native Services
┌────────────────────────────────────▼────────────────────────────────────┐
│                       Platform-Specific Drivers                         │
│                                                                         │
│  macOS:   Swift / Objective-C bindings (AWDL, Multipeer, CoreBluetooth) │
│  Windows: WinRT / windows-rs bindings (WiFiDirect, BLE Advertisements)  │
│  Android: Kotlin / NDK bindings (WifiP2pManager, WifiAware, Services)   │
│  iOS:     Swift bindings (MultipeerConnectivity, Network.framework P2P) │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Strict Boundary Rules

1. **No Absolute Native Path Leakage**:
   - The React UI never receives or constructs raw OS filesystem paths directly.
   - All file selection, writing, and directory scanning happen through opaque identifiers or sanitized relative paths.

2. **No Platform Security Internals in Frontend**:
   - Private keys and low-level cryptographic entropy generation remain secured within the core cryptographic manager.
   - Hardware radio handles and OS-level socket pointers remain encapsulated in the native layer.

3. **Universal Transport Abstraction**:
   - The React UI talks only to `TransportAdapter` and `TransportManager`.
   - The same `ProtocolStateMachine` and `FileEngine` operate seamlessly whether frames are piped over an in-memory test loopback, an off-grid Wi-Fi Direct socket, or an AWDL Multipeer stream.
