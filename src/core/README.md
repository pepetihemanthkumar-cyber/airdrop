# NearShare Core Architecture & Native Platform Capability Matrix

## 1. Overview & Layered Architecture

NearShare enforces a strict separation of concerns across presentation, state, transfer orchestration, platform capability resolution, and transport layers.

```
NearShare UI (React Components / Smoked Glass Design)
        ↓
Contexts (TransferQueueContext, ConnectionHealthContext, DeviceTrustContext, SecurityContext, SettingsContext)
        ↓
Capability Resolver (`CapabilityResolver`)
        ↓
Transport Context (`useTransport`)
        ↓
Transport Manager (`TransportManager`)
        ↓
Transport Adapter (`TransportAdapter`: DirectNearbyTransport | WiFiTransport)
        ↓
Platform Adapter (`PlatformAdapter`: MacOS | Windows | Android | iOS | Web)
        ↓
Native Platform Runtime (AWDL / Multipeer / Wi-Fi Direct / Local Sockets)
```

UI components and screen views NEVER interact directly with raw transport sockets or filesystem paths. All operations flow through standardized contracts.

---

## 2. Platform Capability Matrix

Architectural targets supported across operating systems:

| Capability | macOS | Windows | Android | iOS | Web (Dev Fallback) |
|---|---|---|---|---|---|
| **Direct Mode (P2P)** | Supported (AWDL / Multipeer) | Supported (Wi-Fi Direct) | Supported (Nearby Connections) | Supported (Multipeer / BLE) | Mock Only |
| **Local Wi-Fi Mode** | Supported (Bonjour / Sockets) | Supported (Winsock / mDNS) | Supported (NSD / Sockets) | Supported (NWConnection) | Mock Only |
| **Proximity Discovery** | Supported | Supported | Supported | Supported | Mock Only |
| **Local mDNS Discovery** | Supported | Supported | Supported | Supported | Mock Only |
| **PIN Verification** | Supported | Supported | Supported | Supported | Supported (Preview) |
| **QR Code Pairing** | Supported | Supported | Supported | Supported | Supported (Preview) |
| **Native File Picker** | Supported | Supported | Supported | Supported | Supported |
| **Folder Picker & Tree** | Supported | Supported | Supported (SAF Tree) | Unsupported (Sandbox) | Unsupported |
| **Background Transfer** | Supported (App Nap Assertion) | Supported (Process Execution) | Supported (Foreground Service) | Restricted (Lifecycle Limits) | Restricted |
| **Large Files (>4 GB)** | Supported | Supported | Supported | Supported | Restricted (Browser RAM) |
| **System Notifications** | Supported | Supported | Supported | Supported | Restricted / Mock |
| **Storage Quota Access** | Supported | Supported | Supported | Supported | Supported (Estimate) |
| **Reveal in Folder** | Supported | Supported | Unsupported | Unsupported | Unsupported |

---

## 3. Native Integration Strategies

Each target platform defines a declarative candidate integration strategy:

1. **macOS**:
   - Direct: `candidate-macos-awdl-multipeer`
   - Wi-Fi: `candidate-macos-bonjour-local-sockets`
   - Discovery: `candidate-macos-proximity-mdns`
   - Files: `candidate-macos-security-scoped-bookmarks`
   - Background: `candidate-macos-app-nap-assertion`

2. **Windows**:
   - Direct: `candidate-windows-wifidirect`
   - Wi-Fi: `candidate-windows-winsock-mdns`
   - Discovery: `candidate-windows-nearby-mdns`
   - Files: `candidate-windows-storage-api`
   - Background: `candidate-windows-background-task`

3. **Android**:
   - Direct: `candidate-android-nearby-connections`
   - Wi-Fi: `candidate-android-nsd-sockets`
   - Discovery: `candidate-android-ble-nsd-discovery`
   - Files: `candidate-android-saf-document-tree`
   - Background: `candidate-android-foreground-service`

4. **iOS**:
   - Direct: `candidate-ios-multipeer-corebluetooth`
   - Wi-Fi: `candidate-ios-nwconnection-bonjour`
   - Discovery: `candidate-ios-bonjour-ble-discovery`
   - Files: `candidate-ios-document-picker-security-scope`
   - Background: `candidate-ios-background-urlsession-restricted`

5. **Web (Development Fallback)**:
   - Direct: `development-mock-direct-transport`
   - Wi-Fi: `development-mock-wifi-transport`
   - Discovery: `development-mock-discovery`
   - Files: `development-html-file-picker`
   - Background: `development-unsupported`

---

## 4. Semantic Definitions

### Direct Nearby Mode (`direct`)
- **Semantics**: No existing Wi-Fi network, local router, or internet access is required.
- **Hardware**: Direct ad-hoc peer-to-peer wireless channel (e.g. Apple Wireless Direct Link / AWDL, Android Wi-Fi Direct, Windows Wi-Fi Direct). It does *not* imply turning off Wi-Fi radios.
- **Product UX Boundary**: 30 meters is a NearShare product UX boundary, not a physical hardware constraint.

### Local Wi-Fi Mode (`wifi`)
- **Semantics**: Communicates over an existing local area network (LAN / WLAN) using local subnet routing and mDNS peer discovery.
- **Internet Requirement**: An external WAN / internet connection is NOT required.
- **Range**: No artificial 30-meter proximity constraint; valid across local subnet coverage.

---

## 5. Web Development Fallback Rules

- The Web frontend is strictly for local design, developer workflow testing, and state inspection.
- The web application must NEVER claim native hardware peer-to-peer capabilities or fake actual local subnet socket binding.
- All transport simulation runs through deterministic mock adapters (`MockDirectNearbyTransport`, `MockWiFiTransport`, `MockPairingAdapter`).

---

## 6. Zero-Refactor Native Injection

When native platform binary bridges are built, they register with:
- `TransportRegistry.getInstance().registerAdapter(mode, nativeAdapter, platform, 'native', 'supported')`
- `PlatformRegistry.getInstance().setAdapter(nativePlatformAdapter)`

The application UI, contexts, pairing flows, and queue management remain completely unchanged.

---

## 7. Direct Mode Status & Verification Tiers (Step 62)

| Verification Dimension | Status | Notes |
| :--- | :--- | :--- |
| **Architecture Specification** | **COMPLETE** | Universal contracts, capabilities, and errors defined in `src/core/transport/direct/` |
| **macOS Native Direct Spike** | **NATIVE BRIDGE IMPLEMENTED** | `MacOSDirectPeerBridge`, `MacOSDirectCapabilities`, and `src-tauri/src/macos_direct.rs` |
| **Windows Native Direct Spike** | **NATIVE BRIDGE CONTRACT IMPLEMENTED** | `WindowsDirectPeerBridge`, `WindowsDirectCapabilities`, and `src-tauri/src/windows_direct.rs` |
| **Android Native Direct Spike** | **NATIVE BRIDGE CONTRACT IMPLEMENTED** | `AndroidDirectPeerBridge`, `AndroidDirectCapabilities`, `WifiP2pManager` analysis |
| **iOS Native Direct Spike** | **NATIVE BRIDGE CONTRACT IMPLEMENTED** | `IOSDirectPeerBridge`, `IOSDirectCapabilities`, `MultipeerConnectivity` analysis |
| **Native Bridge & Protocol Engine** | **COMPLETE** | Length-prefixed binary frames, AES-256-GCM AEAD, and Tokio async TCP server |
| **Telemetry & Diagnostics Layer** | **COMPLETE** | Sliding-window throughput, RTT latency EMA, stability estimator, and inspector (`src/core/telemetry/`) |
| **Transfer Pipeline Hardening** | **COMPLETE** | Resource limits, backpressure flow controller, deterministic manifest hardener, memory bounds (`src/core/transfer/`) |
| **Native Transport Production Integration** | **COMPLETE** | Factory, 3-tier capability resolver, lifecycle state machine, leak-safe event bridge, test harness (`src/core/transport/`) |
| **Desktop Release Engineering** | **COMPLETE** | Release metadata model, readiness evaluator, manifest generator, and checksum verifier (`src/core/release/`, `scripts/`) |
| **Deterministic Test Validation** | **COMPLETE** | Deterministic test suite passes (570/570 tests: STRESS-001..025, NATIVE-001..030, RELEASE-001..025) |
| **macOS Physical Direct Radio** | **NOT VERIFIED** | Requires two physical Apple machines for physical AWDL verification (`docs/direct-mode-macos-physical-test.md`) |
| **Windows Physical Direct Radio** | **NOT VERIFIED** | Requires physical Windows machine with Wi-Fi Direct hardware |
| **Android / iOS Physical Direct Radio** | **NOT VERIFIED** | Requires physical mobile devices for physical peer-to-peer radio verification |
| **Cross-Platform Direct Radio** | **NOT VERIFIED** | SoftAP / Wi-Fi Direct bridging requires physical cross-vendor hardware testing |

---

## 8. Real-Time Telemetry Architecture (Step 59)

- **ThroughputEstimator**: Bounded sliding window measuring instantaneous, rolling average, and peak speeds from observed byte deltas.
- **LatencyEstimator**: RTT latency tracking derived strictly from protocol heartbeats and acknowledgments using exponential moving average smoothing.
- **StabilityEstimator**: Evaluates connection health (`stable`, `degraded`, `unstable`, `reconnecting`, `disconnected`, `failed`) based on retransmissions, disconnects, and packet integrity.
- **Strict Mode Separation**: Direct Mode and Wi-Fi Mode remain strictly isolated without silent automatic transport fallback.

---

## 9. Production Transfer Pipeline Hardening (Step 60)

- **Resource Limits (`ResourceLimits.ts`)**: Explicit code-level bounds for concurrency (1 active), queue capacity (100), in-flight chunks (16), buffer bytes (64 MiB), manifest entries (25,000 files), path depth (32 levels), and filename length (255 chars).
- **Backpressure Controller (`TransferBackpressureController.ts`)**: Flow-control mechanism maintaining in-flight chunk permits and preventing unbounded reader generation over high-latency or slow transports.
- **Deterministic Manifest Hardener (`TransferManifestHardener.ts`)**: Normalized relative path sanitization, traversal attack rejection (`../`, UNC, absolute paths, null bytes), duplicate filename disambiguation, 0-byte file support, and recursive tree sorting.
- **Bounded Memory Lifecycle**: Full buffer release upon ACK, cancellation, pause, and error handling. Verified via comprehensive 25-scenario stress testing suite (`STRESS-001` through `STRESS-025`).

---

## 10. Native Transport Production Integration (Step 61)

- **Production Transport Factory (`ProductionTransportFactory.ts`)**: Resolves target platform adapters with strict mode isolation; prevents silent substitution of Direct for Wi-Fi.
- **3-Tier Capability Resolver (`CapabilityResolver.ts`)**: Clearly separates Architectural Support, Runtime Implementation, and Physical Hardware Validation tiers.
- **Deterministic State Machine (`NativeTransportLifecycle.ts`)**: Enforces legal state transitions (`idle` -> `discovering` -> `connecting` -> `authenticating` -> `connected` -> `transferring` -> `paused` -> `reconnecting` -> `completed`) and rejects invalid state jumps.
- **Leak-Safe Event Bridge (`NativeTransportEventBridge.ts`)**: Maps native bridge signals to adapter events with stable logical transfer IDs and unsubscribe deallocation.
- **Native Test Harness (`NativeTransportHarness.ts`)**: In-memory simulation environment with deterministic packet delay, loss, duplication, and fault injection capabilities.

---

## 11. Production Desktop Release Engineering (Step 62)

- **Release Metadata & Channels (`ReleaseMetadata.ts`)**: Typed metadata schema tracking channel (`development`, `nightly`, `beta`, `stable`), platform, architecture (`arm64`, `x86_64`), build type, and standardized artifact naming.
- **Evidence-Based Readiness Evaluator (`ReleaseReadiness.ts`)**: Evaluates release readiness tiers (`ready`, `unsigned`, `notNotarized`, `missingNativeValidation`, `developmentOnly`, `blocked`) based on verified evidence.
- **Cryptographic Release Manifest (`generate-release-manifest.mjs` & `verify-release-manifest.mjs`)**: Scans built binaries, generates `release-manifest.json` with SHA-256 digests, and validates bundle integrity.
- **Release Matrix CI (`.github/workflows/release.yml`)**: Automated multi-platform build workflow for macOS (`.app` / `.dmg`) and Windows (`.exe` NSIS installer).



