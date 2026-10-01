# NearShare Windows Direct Native (Wi-Fi Direct) Spike

## Architecture Boundary

The `src/core/native/windows/` module defines the native bridging layer between the Windows 10/11 Wi-Fi Direct subsystem (`Windows.Devices.WiFiDirect` / `Windows.Networking.Sockets`) and the NearShare Direct Mode transport architecture.

```
┌────────────────────────────────────────────────────────┐
│               NearShare Direct Mode Core               │
│        (DirectTransportAdapter, DirectDiscovery)      │
└───────────────────────────┬────────────────────────────┘
                            │ (DirectDiscoveryProvider)
┌───────────────────────────▼────────────────────────────┐
│                WindowsDirectPeerBridge                 │
│       • Opaque device info ID mapping                  │
│       • 1–30m UX distance clamping                     │
│       • Zero native path or WinRT handle leakage       │
└───────────────────────────┬────────────────────────────┘
                            │ (Tauri IPC invoke/events)
┌───────────────────────────▼────────────────────────────┐
│                 Tauri Native Rust Core                 │
│      • direct_windows_start_discovery                  │
│      • direct_windows_connect / direct_windows_send    │
└───────────────────────────┬────────────────────────────┘
                            │ (Public WinRT APIs)
┌───────────────────────────▼────────────────────────────┐
│        Windows.Devices.WiFiDirect & StreamSocket       │
│           (NDIS 6.50+ WDI Wi-Fi Direct Adapter)        │
└────────────────────────────────────────────────────────┘
```

## Security Invariant
The native peer connection established by `WindowsDirectPeerBridge` provides ONLY the bidirectional byte transport stream. It does NOT bypass:
1. `PairingManager` PIN / cryptographic verification.
2. `DeviceTrustContext` authorization and blocklist checks.
3. `SecureTransportSession` authenticated AEAD encryption (AES-256-GCM).
4. `FileEngine` safe stream chunking and SHA-256 verification.
