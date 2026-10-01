# NearShare iOS Direct Native Runtime Architecture

**Document Version:** 1.0.0  
**Implementation Date:** 2026-10-01  
**Author:** Antigravity Engineering (Pair Programming with Lead Architect)  
**Status:** REAL_NATIVE_IMPLEMENTATION  
**Runtime Verification:** UNVERIFIED (Darwin macOS Host)  
**Physical Validation:** NOT_RUN / BLOCKED (Requires Physical iPhone/iPad Pair)

---

## 1. Subsystem Architecture

NearShare iOS Direct Mode implements peer-to-peer wireless transfer using Apple's native **MultipeerConnectivity** framework.

```
┌─────────────────────────────────────────────────────────────┐
│                    NearShare React UI                       │
│       (Monochrome Liquid-Glass Direct Discovery View)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  DirectTransportAdapter                     │
│    (Orchestrates Direct Discovery, Stream & Transfer State)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    IOSDirectPeerBridge                      │
│      (TypeScript Boundary, Sanitized Domain Models, IPC)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Tauri IPC (`direct_ios_*`)
┌──────────────────────────────▼──────────────────────────────┐
│                  src-tauri/src/ios_direct.rs                │
│     (Rust Tauri Command Handlers, Buffer Management & FFI)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Swift C-ABI FFI (`@_cdecl`)
┌──────────────────────────────▼──────────────────────────────┐
│         src-tauri/ios/NearShareDirect/ (Swift Module)       │
│  - NearShareDirectSession (MCSession, Browser, Advertiser)  │
│  - NearShareDirectPeer (MCPeerID, Sanitized Discovery Info) │
│  - NearShareDirectSocket (InputStream / OutputStream)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│              Apple MultipeerConnectivity & AWDL             │
│            (Apple Wireless Direct Link / Ad-hoc P2P)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Native Lifecycle & State Flow

1. **Initialization**: `configureLocalIdentity(displayName:deviceId:)` creates `NearShareDirectPeer` and `MCSession` with `.required` encryption.
2. **Service Advertisement**: `startAdvertising()` initializes `MCNearbyServiceAdvertiser` for service type `nearshare-p2p` with safe discovery metadata.
3. **Peer Browsing**: `startDiscovery()` initializes `MCNearbyServiceBrowser` emitting `peerDiscovered` events with sanitized IDs.
4. **Invitation & Acceptance**: `invitePeer(peerId:)` and `acceptInvitation(invitationId:)` negotiate peer connection without compromising security.
5. **Bidirectional Byte Stream**: `openDataStream(peerId:streamName:)` calls `MCSession.startStream(withName:toPeer:)` returning `OutputStream` and receiving `InputStream`.
6. **Bounded Chunk Transfers**: Reads and writes are strictly chunked to 64 KiB frames with backpressure enforcement.
7. **Security Layering**: `SecureTransportSession` (ECDH P-256 + HKDF + AES-256-GCM) operates on top of the native byte stream.
8. **Teardown**: Complete session cleanup without leaked streams, browser delegates, or background threads.

---

## 3. Safe Domain Model Invariants

- **No MCPeerID exposure**: Native Apple object references are encapsulated; TypeScript receives only opaque identifiers.
- **No Synthetic Telemetry**: Distance is estimated strictly within standard UX bounds (1-30m) without synthetic throughput or signal percentages.
- **No Sensitive Metadata**: Discovery advertisements contain only protocol version, device platform, and supported capabilities.
