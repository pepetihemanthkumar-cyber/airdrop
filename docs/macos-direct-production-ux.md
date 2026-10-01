# NearShare macOS Direct Mode: Production UX Integration & Architecture

## Overview
This document describes the production integration of the native Apple `MultipeerConnectivity` Direct Mode pipeline into the NearShare user experience. The production flow operates seamlessly without requiring developer validation inspectors, mocks, or synthetic fallback paths.

---

## 1. End-to-End Production UX Flow

```
┌────────────────────────┐
│  Mode Selection Screen │  User selects 'Direct Nearby' (Off-grid ad-hoc transport)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  DeviceDiscoveryVessel │  Starts native Multipeer browsing/advertising (nearshare-p2p)
└───────────┬────────────┘
            │ Real over-the-air peer discovered / scanned
            ▼
┌────────────────────────┐
│ SecurePairing / Trust  │  Cryptographic ECDH mutual authentication & DeviceTrustContext
└───────────┬────────────┘
            │ Trust established
            ▼
┌────────────────────────┐
│  TransferReviewScreen  │  Validates pre-flight conditions, chunking, and displays 'DIRECT'
└───────────┬────────────┘
            │ User confirms 'Send'
            ▼
┌────────────────────────┐
│  TransferQueueContext  │  Orchestrates transfer task lifecycle
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ SecureTransportSession │  Encrypts frame payload with AES-256-GCM
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ MacOSDirectPeerBridge  │  Tauri IPC -> Rust FFI -> Swift NSOutputStream
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ TransferProgressVessel │  Live progress, byte metrics, and real throughput telemetry
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  TransferHistoryScreen │  Single terminal record with mode = 'direct' and SHA-256 verified
└────────────────────────┘
```

---

## 2. Production Transport Resolution

- **Production Factory (`ProductionTransportFactory`)**:
  - Resolves `DirectTransportAdapter` with `MacOSDirectPeerBridge` when running on macOS under the Tauri native binary.
  - **No Wi-Fi Fallback**: Direct Mode never silently falls back to local Wi-Fi or LAN TCP. If native direct initialization fails, a typed `TransportError` is returned to the user interface.
  - **No Mock Fallback**: Production builds exclude `MockDirectNearbyTransport` and `MockTransport`. Mocks are strictly isolated in automated unit tests.

---

## 3. UI State Accuracy & Integrity

| UI Element | Production Behavior | Guarantee |
|:---|:---|:---|
| **Distance** | Displays `"Nearby"`, `"Direct"`, `"Up to 30 m"` | **No fabricated distances** (e.g. simulated "8 m" or "14 m" are removed). |
| **Throughput** | Displays live speed from `TelemetryManager` | **No synthetic speed** (displays `—` when speed is not yet measured). |
| **Peer Availability** | Shows empty scanning state `"Looking for nearby devices..."` when no real peer is present | **No demo or fake peers** in production discovery. |
| **Connection Quality** | Displays neutral / verified connection health | Based strictly on heartbeat ACK latency. |
| **Security Status** | Displays `"✓ Trusted"`, `"Pairing Required"`, or `"Blocked"` | Derived strictly from `DeviceTrustContext`. |

---

## 4. Cross-Platform Safety

| Platform | Direct Transport Status | Evidence Level |
|:---|:---|:---|
| **macOS (Apple Silicon / Intel)** | Real Native Implementation | `libNearShareDirect.a` + `MultipeerConnectivity` linked |
| **Windows 10/11 (x64)** | Scaffold | In-memory Rust scaffold; WinRT Wi-Fi Direct unlinked |
| **Android** | Architectural Only | Native TypeScript contract only; zero native code |
| **iOS** | Architectural Only | Native TypeScript contract only; zero native code |
| **Web Browser** | Mock Only | Displays honest native-required capability warning |

---

## 5. Physical Validation Limitation

```
Mac ↔ Mac Direct:
NOT VERIFIED / HARDWARE UNAVAILABLE
```
*Physical over-the-air verification between two separate physical Macs is pending secondary hardware attachment. Local development host runs native Swift and passes all deterministic and self-test validations.*
