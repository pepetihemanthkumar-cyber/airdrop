# NearShare 0.1.0 — Platform Support Matrix

> Evidence classification legend:
> - `IMPLEMENTED` — Code exists and compiles
> - `RUNTIME_VERIFIED` — Executed and confirmed working on physical hardware
> - `PHYSICAL_VERIFIED` — Executed between two distinct physical devices on radio/wire
> - `RUNTIME_UNVERIFIED` — Code is real; execution on target hardware not confirmed
> - `BLOCKED` — Hardware or environment prevents verification
> - `NOT_AVAILABLE` — Feature is not architecturally possible for this combination
> - `NOT_PERFORMED` — Action not taken (external credential / hardware dependency)

---

## 1. macOS

| Feature | Status | Evidence Level |
|:---|:---|:---|
| Native Swift Direct (MultipeerConnectivity) | `IMPLEMENTED` + `RUNTIME_VERIFIED` | Local single-node host confirmed. Peer radio requires Mac B. |
| macOS Direct — Multi-Device Peer Discovery | `IMPLEMENTED` — `BLOCKED` (physical) | AWDL requires two physical Apple devices in proximity. |
| macOS LAN (`ProductionLanTransportAdapter`) | `IMPLEMENTED` + `RUNTIME_VERIFIED` | Localhost TCP streaming verified. Multi-device LAN BLOCKED. |
| Production SAS (`SasDerivation.ts`) | `IMPLEMENTED` + `RUNTIME_VERIFIED` | Dynamic 6-digit session-bound SAS verified (SAS-001..SAS-010). |
| Production Build (.app/.dmg) | `IMPLEMENTED` + `RUNTIME_VERIFIED` | Tauri build produced `NearShare.app` and `NearShare_0.1.0_aarch64.dmg`. |
| Code Signing | `READY — CREDENTIALS REQUIRED` | Ad-hoc signature applied. Developer ID cert not present. |
| Notarization | `NOT_PERFORMED` | Apple notarization credentials required. |
| Protocol / Security / FileEngine | `IMPLEMENTED` + `RUNTIME_VERIFIED` (deterministic) | **942/942 tests PASS**. |

---

## 2. Windows

| Feature | Status | Evidence Level |
|:---|:---|:---|
| Native WinRT Wi-Fi Direct (Windows.Devices.WiFiDirect) | `IMPLEMENTED` | Rust/WinRT code compiles. Windows runtime `UNVERIFIED`. |
| Windows Direct — Multi-Device Peer Discovery | `RUNTIME_UNVERIFIED` | No Windows hardware available. |
| Windows LAN (TCP/UDP LAN) | `IMPLEMENTED` | Windows runtime `UNVERIFIED`. |
| Production Build (NSIS .exe) | `CONFIGURED` — `NOT_BUILT_LOCALLY` | GitHub Actions workflow configured. Windows build requires `windows-latest` runner. |
| Code Signing (Authenticode) | `READY — CREDENTIALS REQUIRED` | Certificate configured via CI env var. `.pfx` credential not present locally. |

---

## 3. Android

| Feature | Status | Evidence Level |
|:---|:---|:---|
| Native Kotlin Wi-Fi P2P (WifiP2pManager) | `IMPLEMENTED` | Kotlin and JNI bridge code compiles. Android runtime `UNVERIFIED`. |
| Android Direct — Multi-Device P2P | `RUNTIME_UNVERIFIED` | No physical Android device available. |
| Android LAN (TCP) | `IMPLEMENTED` | Android runtime `UNVERIFIED`. |
| Production Build (APK/AAB) | `CONFIGURED` — `NOT_BUILT_LOCALLY` | Tauri Android build requires Android SDK + physical device or emulator. |

---

## 4. iOS

| Feature | Status | Evidence Level |
|:---|:---|:---|
| Native Swift Multipeer (MultipeerConnectivity) | `IMPLEMENTED` | Swift code compiles, Simulator build verified. Physical runtime `UNVERIFIED`. |
| iOS Direct — Multi-Device Peer Discovery | `RUNTIME_UNVERIFIED` | MultipeerConnectivity radio requires physical iOS device. |
| iOS LAN (TCP/NWListener) | `IMPLEMENTED` | iOS runtime `UNVERIFIED`. |
| Production Build (IPA) | `CONFIGURED` — `NOT_BUILT_LOCALLY` | Tauri iOS build requires Xcode + Apple Developer account. |

---

## 5. Security & Verification Summary

| Component | Status | Evidence |
|:---|:---|:---|
| **Production SAS** | `IMPLEMENTED` | Dynamic SHA-256 session-bound derivation (`XXX YYY` format, 60s expiry) |
| **Production Pairing** | `REAL IMPLEMENTATION` | `ProductionPairingAdapter` (Zero hardcoded PINs in production) |
| **Production LAN Transport** | `REAL IMPLEMENTATION` | `ProductionLanTransportAdapter` (Native TCP socket + UDP discovery) |
| **Physical LAN** | `BLOCKED` | Single physical Mac available — physical multi-device validation blocked |
| **Physical Direct** | `BLOCKED` | Single physical Mac available — physical multi-device validation blocked |
| **Windows Runtime** | `UNVERIFIED` | No physical Windows host in current environment |
| **Android Runtime** | `UNVERIFIED` | No physical Android host in current environment |
| **iOS Runtime** | `UNVERIFIED` | No physical iOS host in current environment |
