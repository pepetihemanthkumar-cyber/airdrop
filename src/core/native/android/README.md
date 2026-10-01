# NearShare Android Direct Native (Wi-Fi Direct / Wi-Fi Aware) Spike

## Architecture Boundary

The `src/core/native/android/` module defines the native bridging layer between the Android OS Wi-Fi subsystem (`android.net.wifi.p2p.WifiP2pManager` / `WifiAwareManager`) and the NearShare Direct Mode transport architecture.

```
┌────────────────────────────────────────────────────────┐
│               NearShare Direct Mode Core               │
│        (DirectTransportAdapter, DirectDiscovery)      │
└───────────────────────────┬────────────────────────────┘
                            │ (DirectDiscoveryProvider)
┌───────────────────────────▼────────────────────────────┐
│                AndroidDirectPeerBridge                 │
│       • Opaque peer ID mapping                         │
│       • 1–30m UX distance clamping                     │
│       • Zero native path or Java reference leakage     │
└───────────────────────────┬────────────────────────────┘
                            │ (Mobile Bridge / JNI)
┌───────────────────────────▼────────────────────────────┐
│                 Android Kotlin Module                  │
│       • WifiP2pManager (Group Owner negotiation)       │
│       • ForegroundService (transfer persistence)       │
└───────────────────────────┬────────────────────────────┘
                            │ (Android Wi-Fi HAL)
┌───────────────────────────▼────────────────────────────┐
│            Wi-Fi Direct / Wi-Fi Aware Radio            │
└────────────────────────────────────────────────────────┘
```

## Security Invariant
The native peer connection established by `AndroidDirectPeerBridge` provides ONLY the raw bidirectional byte stream. It does NOT bypass:
1. `PairingManager` PIN / cryptographic verification.
2. `DeviceTrustContext` authorization and blocklist checks.
3. `SecureTransportSession` authenticated AEAD encryption (AES-256-GCM).
4. `FileEngine` safe stream chunking and SHA-256 verification.
