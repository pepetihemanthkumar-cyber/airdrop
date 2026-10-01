# NearShare macOS Direct Mode: Release Readiness Matrix

## Target Version: `0.1.0`
## Target Bundle: `com.nearshare.desktop`
## Host Platform: `macOS Darwin arm64 (Apple Silicon)` / Intel macOS 11.0+

---

## 1. Release Readiness Status Matrix

| Subsystem / Dimension | Status | Evidence Level | Verification Detail |
|:---|:---|:---|:---|
| **Native Direct Implementation** | `PASS` | `REAL_NATIVE_IMPLEMENTATION` | Real Swift static library (`NearShareDirect`) compiled via `build.rs` and linked to `MultipeerConnectivity.framework`. |
| **Runtime Self-Test** | `PASS` | `RUNTIME_SELF_TEST_PASS` | Native initialization, session creation, stream delegates, and diagnostics verified (`direct_macos_self_test`). |
| **Production UX Integration** | `PASS` | `PRODUCTION_UX_INTEGRATED` | Discovery Vessel, Pairing, Review Screen, and Queue are integrated with native Multipeer without mock fallbacks. |
| **Debug Tooling Isolation** | `PASS` | `ISOLATED_DEV_ONLY` | All developer inspectors (`MacOSDirectValidationInspector`, etc.) are guarded behind `import.meta.env.DEV`. |
| **Mock Isolation** | `PASS` | `MOCK_EXCLUDED_FROM_PROD` | Production factory fails closed or returns typed error; never silently falls back to Mock or Wi-Fi. |
| **Security & Privacy** | `PASS` | `SECURITY_AUDITED` | AES-256-GCM authenticated cipherframes; ECDH key agreement above transport; zero private keys in Swift. |
| **Logging Redaction** | `PASS` | `LOGS_SANITIZED` | Production logs and error mappers redact filesystem paths, MAC addresses, private IPs, and keys. |
| **Bounded Memory Model** | `PASS` | `BOUNDED_VERIFIED` | 64 KiB native read buffers; 16 in-flight permits / 64 MiB logical pipeline cap; zero whole-file RAM buffering. |
| **Filesystem & Checkpoints** | `PASS` | `CRASH_RESILIENT` | Atomic checkpoint persistence; receiver-authoritative resume; atomic disk file completion. |
| **Permissions & Entitlements** | `READY` | `CONFIGURED_PLIST` | `Info.plist` declares `NSLocalNetworkUsageDescription` and `NSBonjourServices` (`_nearshare-p2p._tcp`). |
| **macOS Bundle Configuration** | `PASS` | `CONFIGURED_VERIFIED` | `tauri.conf.json` configured for `com.nearshare.desktop`, minimum system version `11.0`. |
| **Code Signing** | `READY` | `CREDENTIALS_REQUIRED` | Hardened runtime scaffolding ready in release CI; awaiting Apple Developer ID Application certificates. |
| **Apple Notarization** | `READY` | `NOTARIZATION_PENDING` | Automated notarization workflow scaffolded in `.github/workflows/release.yml`; awaiting Apple Team credentials. |
| **Physical Mac ↔ Mac Validation** | `BLOCKED` | `HARDWARE_UNAVAILABLE` | Gated on secondary physical Mac hardware availability per [macos-direct-two-device-runbook.md](file:///Users/pepetihemanthkumar/Documents/SYNTRA/docs/macos-direct-two-device-runbook.md). |

---

## 2. Release Configuration Check

```
Application Name:        NearShare
Version:                 0.1.0
Protocol Version:        NearShare 1.0
Bundle Identifier:       com.nearshare.desktop
Minimum macOS:           11.0 (Big Sur)
Supported Architectures: arm64 (Apple Silicon), x86_64 (Intel)
Bonjour Service Name:    nearshare-p2p
```

---

## 3. Physical Validation Status

```
Mac ↔ Mac Direct Over-The-Air Validation:
NOT VERIFIED / HARDWARE UNAVAILABLE
```
*Single development Mac available; physical multi-device over-the-air validation requires two distinct physical macOS devices with Apple Silicon / Intel Wi-Fi & Bluetooth hardware.*
