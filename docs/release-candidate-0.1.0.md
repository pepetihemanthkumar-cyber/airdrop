# NearShare 0.1.0 — Release Candidate Baseline & Freeze Report

> **Product**: NearShare  
> **Release Candidate**: `0.1.0-rc1` (Version `0.1.0`)  
> **Freeze Date**: 2026-10-01  
> **Source Control Baseline**: `d3f988bebd2e031380258bef8a68218f629687ec`  
> **Release Tag**: `v0.1.0-rc1`  
> **Host Architecture**: macOS (Darwin arm64, Apple Silicon)  
> **Target Channel**: Stable Release Candidate

---

## 1. Executive Summary & Verification Matrix

| Release Gate | Verification Level | Status | Evidence Summary |
|:---|:---|:---|:---|
| **Version Sync** | Static Analysis | **PASS** | `0.1.0` synchronized across `package.json`, `Cargo.toml`, `tauri.conf.json`, `appVersion.ts` |
| **Deterministic Tests** | Test Harness | **PASS** | **1,002 / 1,002 PASS** (0 failures, 342ms execution) |
| **Code Linting** | Oxlint / ESLint | **PASS** | **0 errors**, 38 non-blocking informational compiler notes |
| **Frontend Production Build** | Vite v8.3.0 | **PASS** | `dist/assets/index-Bwg0suMj.js` (981.99 kB), `dist/assets/index-CpF7PY1g.css` (116.04 kB) |
| **Rust Desktop Backend** | Cargo / Tauri | **PASS** | `cargo check` clean, `cargo build` clean |
| **Tauri App Bundle** | Tauri Bundler | **PASS** | `NearShare.app` (11.47 MiB), `NearShare_0.1.0_aarch64.dmg` (3.77 MiB) |
| **Secret & Key Audit** | Regex / Scanner | **PASS** | Zero exposed private keys, fixed PINs (`482917`), or `.env` secrets |
| **Release Manifest** | SHA-256 Verification | **PASS** | All artifacts verified matching `release-manifest.json` |
| **Code Signature** | `codesign -dvvv` | **AD-HOC SIGNED** | Linker-signed arm64 binary; Developer ID certificate not configured |
| **Notarization** | Apple Notary Service | **NOT NOTARIZED** | Requires Apple Developer Program credentials |
| **Physical LAN Mode** | Multi-Device Hardware | **BLOCKED** | Only 1 physical Mac available in local testbed |
| **Physical Direct Mode** | Multi-Device Hardware | **BLOCKED** | Secondary physical AWDL/NAN device unavailable |
| **Windows Platform** | Native Bridge / CI | **UNVERIFIED** | Packaging & CI workflow configured; Windows hardware unavailable |
| **Android Platform** | Native Bridge / Specs | **UNVERIFIED** | Architectural bridge specified; Android hardware unavailable |
| **iOS Platform** | Native Bridge / Specs | **UNVERIFIED** | Architectural bridge specified; iOS hardware unavailable |

---

## 2. Release Candidate Artifact Manifest

| Artifact File | Platform | Architecture | SHA-256 Checksum | Size |
|:---|:---|:---|:---|:---|
| `NearShare.app/Contents/MacOS/app` | macOS | arm64 | `ec7ed25ceb7f2bc79eeb00f5934a47d3d4e3d789076e305af71350c07ec9e47b` | 11.47 MiB |
| `NearShare_0.1.0_aarch64.dmg` | macOS | arm64 | `4acdad7e9d4bf3e65690da180759a101779447d7ce10c9daa24ba5d33b3c3da9` | 3,950,543 B |

---

## 3. Production Architecture Audits

### 3.1 Mock Isolation Audit
- **Production Transport Registry**: Only real native adapters (`ProductionLanTransportAdapter` and `DirectTransportAdapter`) are registered.
- **Production Pairing**: Uses `ProductionPairingAdapter` exclusively.
- **Mock Transports**: `MockWiFiTransport`, `MockDirectNearbyTransport`, `MockPairingAdapter`, `MockNativeBridge`, `MockFileSystemAdapter`, `MockProtocolPeer` are strictly isolated to test fixtures and dev-only inspectors. **Zero production leakages**.

### 3.2 Security & Cryptographic Integrity
- **Key Agreement**: ECDH P-256 ephemeral key exchange per session.
- **Key Derivation**: HKDF-SHA256 with distinct domain separation labels.
- **Payload Encryption**: Authenticated AES-256-GCM encryption with sequence numbers and anti-replay window.
- **Device Identity**: ECDSA P-256 TOFU identity caching.
- **SAS Verification**: Dynamic 6-digit Short Authentication String derived from transcript hash with 60-second expiration.
- **Fixed PIN**: Value `482917` is **100% eliminated** from production code paths.

### 3.3 Filesystem & Path Safety
- Zero host paths (e.g. `/Users/...`, `C:\...`) exposed to protocol manifests or UI.
- Path traversal (`..`), null bytes (`\0`), absolute roots, and UNC paths are strictly rejected.
- Directory manifests recreate nested trees cleanly with relative path validation.

### 3.4 Resource Bounds
- `maxConcurrentTransfers`: 4
- `maxQueuedTransfers`: 50
- `maxInFlightChunks`: 16
- `maxChunkBufferBytes`: 4 MiB
- `maxManifestFiles`: 20,000
- `maxPathDepth`: 32
- Telemetry ring buffer capped at 300 samples.

---

## 4. Release Candidate Freeze Declaration

The NearShare 0.1.0 codebase is **FROZEN** as a Release Candidate.
No further feature additions or refactorings are permitted without explicit blocker justification.
