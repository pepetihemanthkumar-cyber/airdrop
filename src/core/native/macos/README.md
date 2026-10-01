# NearShare macOS Direct Native Peer-to-Peer Spike

## Architecture Boundary

The `src/core/native/macos/` module defines the native bridging layer between the macOS operating system's peer-to-peer subsystem (`MultipeerConnectivity` / `Network.framework`) and the NearShare Direct Mode transport architecture.

```
┌────────────────────────────────────────────────────────┐
│               NearShare Direct Mode Core               │
│        (DirectTransportAdapter, DirectDiscovery)      │
└───────────────────────────┬────────────────────────────┘
                            │ (DirectDiscoveryProvider)
┌───────────────────────────▼────────────────────────────┐
│                 MacOSDirectPeerBridge                  │
│       • Opaque peer ID mapping                         │
│       • 1–30m UX distance clamping                     │
│       • Zero native path or pointer leakage            │
└───────────────────────────┬────────────────────────────┘
                            │ (Tauri IPC invoke/events)
┌───────────────────────────▼────────────────────────────┐
│                 Tauri Native Rust Core                 │
│      • direct_macos_start_discovery                    │
│      • direct_macos_connect / direct_macos_send_bytes  │
└───────────────────────────┬────────────────────────────┘
                            │ (Public Apple Frameworks)
┌───────────────────────────▼────────────────────────────┐
│      MultipeerConnectivity / Network.framework         │
│          (AWDL / Ad-Hoc 5GHz Wi-Fi Radio)              │
└────────────────────────────────────────────────────────┘
```

## Security Invariant
The native peer connection established by `MacOSDirectPeerBridge` provides ONLY the bidirectional byte transport stream. It does NOT bypass:
1. `PairingManager` PIN / cryptographic verification.
2. `DeviceTrustContext` authorization and blocklist checks.
3. `SecureTransportSession` authenticated AEAD encryption (AES-256-GCM).
4. `FileEngine` safe stream chunking and SHA-256 verification.
