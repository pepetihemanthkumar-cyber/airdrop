# NearShare Cross-Platform Interoperability Specification

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering (Pair Programming with Lead Architect)  
**Status:** VALIDATION_BASELINE_ESTABLISHED

---

## 1. Executive Summary

NearShare achieves cross-platform interoperability through a **strictly layered architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                   Unified NearShare UI                      │
│            (Monochrome Liquid-Glass Interface)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    FileEngine & Queue                       │
│    (Atomic Checkpoints, Bounded Buffer Backpressure, AAD)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  SecureTransportSession                     │
│    (ECDH P-256 Key Agreement, HKDF-SHA256, AES-256-GCM)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│               NearShare Framed Protocol v1.0                │
│    (4-Byte Big-Endian Header, Structured JSON Envelopes)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       │                                               │
┌──────▼───────────────────────┐       ┌───────────────▼──────────────┐
│     ⚡ Direct Mode Radio      │       │     📶 Local Network Mode    │
│  (Native Peer-to-Peer Link)  │       │     (mDNS / UDP + TCP LAN)   │
├──────────────────────────────┤       ├──────────────────────────────┤
│ Apple AWDL (macOS / iOS)     │       │ Cross-Platform Tokio TCP     │
│ WinRT Wi-Fi Direct (Windows) │       │ Standard BSD Socket / SAF    │
│ Kotlin WifiP2p (Android)     │       │ Multi-OS LAN Port 53317      │
└──────────────────────────────┘       └──────────────────────────────┘
```

---

## 2. Direct Mode vs. Local Network Mode Rules

1. **No Silent Mode Fallback**: If a user initiates a transfer in **⚡ Direct Mode**, the application will NEVER silently fallback to **📶 Local Network Mode**. If the devices are direct-radio incompatible, NearShare displays an honest alert and prompts the user to explicitly select Local Network Mode.
2. **Platform-Neutral Protocol**: The framing, message types, transfer chunks, manifest formats, and cryptographic payloads are 100% platform-agnostic across all operating systems.
3. **Transport Independence**: The native transport layer only carries raw binary bytes. Native Kotlin, Swift, or WinRT code never performs custom protocol serialization or handles private keys.

---

## 3. Direct Radio Interoperability Truth Table

| Platform Pair | Direct Radio Compatibility | Status | Recommended Mode |
|---|---|---|---|
| **macOS ↔ macOS** | `NATIVE_COMPATIBLE` (Apple AWDL) | Native Implemented / Physical Pending | ⚡ Direct or 📶 Wi-Fi |
| **macOS ↔ iOS** | `NATIVE_COMPATIBLE` (Apple Multipeer) | Native Implemented / Physical Pending | ⚡ Direct or 📶 Wi-Fi |
| **Windows ↔ Windows** | `STANDARDIZED_WIFI_DIRECT` | Native Implemented / Physical Pending | ⚡ Direct or 📶 Wi-Fi |
| **Windows ↔ Android** | `STANDARDIZED_WIFI_DIRECT` | Native Implemented / Physical Pending | ⚡ Direct or 📶 Wi-Fi |
| **Android ↔ Android** | `STANDARDIZED_WIFI_DIRECT` | Native Implemented / Physical Pending | ⚡ Direct or 📶 Wi-Fi |
| **iOS ↔ iOS** | `NATIVE_COMPATIBLE` (Apple Multipeer) | Native Implemented / Physical Pending | ⚡ Direct or 📶 Wi-Fi |
| **macOS ↔ Windows** | `RADIO_INCOMPATIBLE` (AWDL vs Wi-Fi Direct) | Incompatible Direct Radio | 📶 Wi-Fi (Local Network) |
| **macOS ↔ Android** | `RADIO_INCOMPATIBLE` (AWDL vs Wi-Fi P2P) | Incompatible Direct Radio | 📶 Wi-Fi (Local Network) |
| **Windows ↔ iOS** | `RADIO_INCOMPATIBLE` (Wi-Fi Direct vs AWDL) | Incompatible Direct Radio | 📶 Wi-Fi (Local Network) |
| **Android ↔ iOS** | `RADIO_INCOMPATIBLE` (Wi-Fi P2P vs Multipeer) | Incompatible Direct Radio | 📶 Wi-Fi (Local Network) |
