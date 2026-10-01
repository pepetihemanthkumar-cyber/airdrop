# NearShare — Mobile Native Boundary (Android Kotlin / iOS Swift vs Tauri Desktop)

## 1. Executive Summary

NearShare's desktop shell utilizes Tauri v2 with Rust IPC for macOS, Windows, and Linux desktop builds. However, for mobile platforms (Android and iOS), the native operating system environment presents distinct threading, lifecycle, permission, and battery management models.

This document defines how the platform-neutral TypeScript application layer interfaces with mobile native bridges without forcing desktop Tauri assumptions onto mobile runtimes.

---

## 2. Layered Mobile Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 NearShare React Application                 │
│         (VesselState, FloatingNavPill, TransferQueue)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           Platform-Neutral TypeScript Transport Core        │
│        (DirectTransportAdapter, DirectDiscoveryProvider)   │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
    ┌───────────▼───────────┐     ┌───────────▼───────────┐
    │AndroidDirectPeerBridge│     │  IOSDirectPeerBridge  │
    └───────────┬───────────┘     └───────────┬───────────┘
                │ (JNI / Mobile Bridge)       │ (WKScriptMessage / Swift FFI)
    ┌───────────▼───────────┐     ┌───────────▼───────────┐
    │ Android Kotlin Module │     │    iOS Swift Module   │
    │  • WifiP2pManager     │     │  • MultipeerFramework │
    │  • ForegroundService  │     │  • NEHotspotConfig    │
    │  • TCP Server/Client  │     │  • BackgroundTask     │
    └───────────┬───────────┘     └───────────┬───────────┘
                │                             │
    ┌───────────▼─────────────────────────────▼───────────┐
    │             Standard Reliable Byte Stream           │
    │            (NearShare ProtocolStateMachine)         │
    └───────────────────────────┬─────────────────────────┘
                                │
    ┌───────────────────────────▼─────────────────────────┐
    │                 Pairing & Cryptography              │
    │   (PairingManager, SecureTransportSession AEAD)     │
    └───────────────────────────┬─────────────────────────┘
                                │
    ┌───────────────────────────▼─────────────────────────┐
    │                FileEngine & Checkpoints             │
    │         (Chunk Verification & Storage Access)       │
    └─────────────────────────────────────────────────────┘
```

---

## 3. Native Responsibilities vs TypeScript Core

| Responsibility | TypeScript Core | Android Native (Kotlin) | iOS Native (Swift) |
| :--- | :--- | :--- | :--- |
| **Peer Discovery Lifecycle** | Coordinates timers & trust filtering | Calls `WifiP2pManager.discoverPeers` | Calls `MCNearbyServiceBrowser.startBrowsing` |
| **Link Negotiation** | Requests connection by opaque peer ID | Manages Group Owner negotiation | Manages `MCSession.invitePeer` |
| **Byte Transport Channel** | Feeds framed chunks to transport | Maintains TCP `Socket` over P2P link | Maintains `NSOutputStream` / `NWConnection` |
| **Protocol State Machine** | Length-prefixed frames & messages | Transport-agnostic | Transport-agnostic |
| **End-to-End Encryption** | AES-256-GCM AEAD Session | Pure byte passthrough | Pure byte passthrough |
| **Transfer Checkpointing** | Calculates missing chunk ranges | Persists to private app storage | Persists to Application Support |
| **OS Background Execution** | Requests background mode | Hosts `ForegroundService` with notification | Requests `beginBackgroundTask` |

---

## 4. Platform-Neutral Bridge Invariants

1. **Zero Native Handle Leakage**: No Java/Kotlin object references (`WifiP2pDevice`, `Socket`) or Swift pointers (`MCPeerID`, `MCSession`) are ever passed into React state.
2. **Opaque Identifiers**: Devices are identified strictly by sanitized string IDs (e.g. `android-p2p-XXXX` or `ios-mc-XXXX`).
3. **No Protocol Code in Native Bridges**: Native mobile modules do not parse `HELLO`, `CAPABILITIES`, `MANIFEST`, or `CHUNK` frames; they strictly pass framed byte arrays.
