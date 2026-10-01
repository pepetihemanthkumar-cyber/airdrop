# NearShare

> Fast, Local-First, End-to-End Encrypted File Transfer for Desktop and Web.

---

## Overview

NearShare is a modern local-first file transfer application built with a high-performance Tauri v2 desktop shell and React 19 web frontend. It provides zero-configuration local network discovery, end-to-end authenticated cryptographic streaming (ECDH P-256 + AES-256-GCM), crash-safe transfer resumption with durable checkpoints, native system tray integration, background execution, an evidence-based multi-device physical validation engine, and a verified native runtime audit database.

---

## Build & Test Commands

### 1. Web Application Mode
```bash
# Install dependencies
npm ci

# Run deterministic test suite (820 tests)
npm test

# Run linter
npm run lint

# Compile TypeScript & production web assets
npm run build
```

### 2. Version & Security Auditing
```bash
# Verify version synchronization across all manifests and tags
npm run validate:version

# Scan source code for accidental secrets or credentials
npm run check:secrets

# Generate and verify release artifact manifest with SHA-256 digests
npm run manifest:generate
npm run manifest:verify
```

### 3. Tauri Desktop Mode
```bash
# Launch development desktop window
npm run tauri:dev

# Build production desktop release bundle (.app / .dmg / .exe)
npm run tauri:build
```

---

## Continuous Integration & Release Automation

NearShare uses GitHub Actions for continuous automated quality assurance and release packaging:

- **CI Workflow (`.github/workflows/ci.yml`)**:
  - Automatically runs on every push and pull request to `main`/`master`.
  - Matrix executes on `macos-14` (Apple Silicon) and `windows-latest`.
  - Enforces version parity, secret scanning, 820 deterministic unit, motion, direct transport, pipeline hardening, native transport integration, release engineering, physical validation, native runtime audit, macOS Direct native tests, validation harness tests, production UX integration tests, release hardening tests (MACREL-001 through MACREL-030), and Windows native direct tests (WINNAT-001 through WINNAT-030), linter validation, frontend production build, and Rust backend check.

- **Release Workflow (`.github/workflows/release.yml`)**:
  - Triggers automatically on version tags matching `v*` (e.g. `v0.1.0`) or manual `workflow_dispatch`.
  - Compiles and publishes macOS `.app` and `.dmg` bundles.
  - Compiles and publishes Windows x64 NSIS installers.
  - Generates verified SHA-256 release artifact manifest (`release-manifest.json`).
  - Includes prepared scaffolding for Apple Developer ID and Windows Authenticode signing.

---

## Platform & Desktop Release Status

| Platform / Mode | Build Status | Test Coverage | Packaging | Verification Level | Audit Status |
|:---|:---|:---|:---|:---|:---|
| **macOS (Apple Silicon)** | Verified | 820 / 820 Passed | `.app` & `.dmg` (10.73 MiB / 3.60 MiB) | **LOCAL BUILD VERIFIED** | `REAL_NATIVE_IMPLEMENTATION` (Direct/LAN/FS/Crypto) |
| **Windows 10/11 (x64)** | Configured | 820 / 820 Passed (Harness) | NSIS Installer (`currentUser`) | **CONFIGURED / CI READY** | `UNVERIFIED_RUNTIME` (Shared Tokio/Std) |
| **Release Artifact Manifest** | Verified | 820 / 820 Passed | SHA-256 verified `release-manifest.json` | **VERIFIED** | `REAL_NATIVE_IMPLEMENTATION` |
| **Physical Multi-Device Validation** | Implemented Engine | 820 / 820 Passed | 10-Pair Matrix / 32 Scenarios / DEV Inspector | **FRAMEWORK COMPLETE (Hardware Blocked)** | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS Direct Mode** | Real Native Implementation | 820 / 820 Passed | Swift static library (`NearShareDirect`) + Apple `MultipeerConnectivity` | **REAL NATIVE IMPLEMENTATION (Physical Validation Pending)** | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS Direct Validation Harness**| Implemented Harness | 820 / 820 Passed | 30 Physical Scenarios / Live Observability & Telemetry | **HARNESS READY (Physical Validation Pending)** | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS Direct Production UX** | Integrated | 820 / 820 Passed | Discovery Vessel -> Pairing -> Review -> Transfer Queue | **PRODUCTION UX INTEGRATED (Physical Pending)** | `REAL_NATIVE_IMPLEMENTATION` |
| **macOS Direct Release Hardening** | Hardened | 820 / 820 Passed | Release readiness matrix, zero-key FFI, log redaction | **RELEASE HARDENED (Physical Pending)** | `REAL_NATIVE_IMPLEMENTATION` |
| **Windows Direct Mode** | Real Native Implementation | 820 / 820 Passed | WinRT `Windows.Devices.WiFiDirect` + `StreamSocket` via `windows` crate | **REAL NATIVE IMPLEMENTATION (Physical Pending)** | `REAL_NATIVE_IMPLEMENTATION` |
| **Android / iOS Direct Spike** | Verified Contracts | 820 / 820 Passed | Native bridge contracts defined in `src/core/native/` | **ARCHITECTURAL ONLY (Zero native code)** | `ARCHITECTURAL_ONLY` |
| **Native Transport Factory** | Verified | 820 / 820 Passed | Mode isolation & 3-tier capability resolution | **PRODUCTION FACTORY IMPLEMENTED** | `REAL_NATIVE_IMPLEMENTATION` |
| **Direct Mode (Off-Grid)** | Complete Architecture | 820 / 820 Passed | Real Swift on macOS / Real WinRT Wi-Fi Direct on Windows | **NATIVE RUNTIME IMPLEMENTED (Physical unverified)** | `REAL_NATIVE_IMPLEMENTATION` |
| **Web Fallback** | Verified | 820 / 820 Passed | Static Single-Page App | **LOCAL BUILD VERIFIED** | `MOCK_ONLY` |

*Note: Physical multi-device radio verification across separate physical units and production code signing certificates are awaiting physical multi-device test hardware attachment per `docs/physical-validation-plan.md`, `docs/macos-direct-two-device-runbook.md`, and `docs/macos-direct-physical-results.md`.*
