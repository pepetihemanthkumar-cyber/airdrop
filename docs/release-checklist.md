# NearShare Release Checklist & Hardening Verification

> **Product**: NearShare  
> **Release Version**: `0.1.0`  
> **Target Runtimes**: Tauri v2 (`2.12.0`) Desktop (macOS Apple Silicon / Windows 10/11) & Web Fallback  
> **Protocol Version**: `1.0`  

---

## 1. Application Identity & Metadata
- [x] **Product Name**: Verified as `NearShare` across `tauri.conf.json`, `package.json`, and UI.
- [x] **Bundle Identifier**: Set to `com.nearshare.desktop` (safe for macOS `.app` bundle rules).
- [x] **Release Version**: Centralized in `src/core/appVersion.ts` (`0.1.0`), `package.json` (`0.1.0`), and `src-tauri/Cargo.toml` (`0.1.0`).
- [x] **Icon Suite**: Multi-resolution icons present in `src-tauri/icons/` (`icon.icns`, `icon.ico`, 32x32, 128x128, etc.).
- [x] **Smoked-Glass Visual Identity**: Preserved monochromatic dark theme without third-party colorful branding.
- [x] **About & Version Screen**: Exposed in Settings with product metadata, build type, and protocol version.

---

## 2. Security & Hardening Invariants
- [x] **Zero Persistent Secrets**: Ephemeral ECDH P-256 session keys, HKDF master keys, and AES-256-GCM tokens are never written to disk or checkpoints.
- [x] **Production Dynamic SAS**: Hardcoded `482917` removed from all production paths. Dynamically derived from session transcript (protocol version, session ID, peer fingerprints, ephemeral public keys).
- [x] **Production Pairing Adapter**: `ProductionPairingAdapter` active by default in `PairingManager`. Enforces 60s expiration, blocked-device checks, and single-use SAS lifecycle.
- [x] **Production LAN Transport**: `ProductionLanTransportAdapter` active for Wi-Fi mode in `TransportRegistry`. Full AES-256-GCM authenticated encryption enforced over LAN.
- [x] **Tauri Permissions (Least Privilege)**: Only `core:default` permission is granted in `src-tauri/capabilities/default.json`. No arbitrary process execution or unbounded disk access.
- [x] **User-Facing Error Sanitization**: `SafeErrorMapper` translates raw Rust panics, OS errno codes, and internal paths into friendly, safe UI alerts.
- [x] **Structured Safe Logging**: `Logger` automatically redacts sensitive properties (`key`, `pin`, `token`, `secret`, `auth`) and suppresses debug statements in production builds.
- [x] **Debug Inspectors Excluded in Production**: `ProtocolInspector`, `FileEngineInspector`, `NativeBridgeInspector`, etc. are strictly wrapped with `import.meta.env.DEV` guards.

---

## 3. Transport, Discovery & Recovery Architecture
- [x] **Native TCP/LAN Transport**: High-throughput framed byte streaming with 1 MiB maximum frame constraint.
- [x] **UDP LAN Discovery**: Multicast beacon exchange on port 53317 with TTL eviction and blocklist filtering.
- [x] **Cryptographic Channel**: End-to-end AEAD (AES-256-GCM) with 64-bit monotonic sequence numbers.
- [x] **Resilient Checkpoints**: Atomic crash-safe file replacement in application data directory.
- [x] **Receiver-Authoritative Resume**: Authoritative missing-range calculation prevents redundant chunk retransmission.
- [x] **Mandatory SHA-256 Verification**: Final whole-file checksum verification required before marking transfer completed.

---

## 4. Test & Verification Summary
- [x] **Test Suite**: **962 / 962 PASS** (including SAS-001..SAS-010, LAN-001..LAN-015, LAN-RUNTIME-001..LAN-RUNTIME-020).
- [x] **Lint**: **0 errors**, 38 warnings.
- [x] **Frontend Build**: **PASS** (`npm run build`).
- [x] **Rust Build**: **PASS** (`cargo tauri build` generating `.app` and `.dmg`).
- [x] **Secret Check**: **PASS** (`npm run check:secrets`).
- [x] **Version Check**: **PASS** (`npm run validate:version`).
- [x] **Manifest Check**: **PASS** (`npm run manifest:verify`).
- [ ] **Physical Multi-Device Validation**: **BLOCKED** (Single Mac environment; physical multi-device validation blocked).
