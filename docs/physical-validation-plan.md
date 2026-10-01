# NearShare Physical Multi-Device Validation Plan

## 1. Executive Summary

This document establishes the comprehensive test protocol required for physical multi-device validation.

### Critical Classification Invariants
- `ARCHITECTURAL`: TypeScript/Rust interfaces, protocol scaffolds, and type models exist.
- `RUNTIME`: Native bridge and socket engines compile and run on the host platform.
- `LOCALHOST`: Single-node loopback TCP and mock IPC bridge verified on one host.
- `LAN`: Two distinct physical devices communicating over a shared local area network router.
- `PHYSICAL`: Two distinct physical hardware devices communicating over direct peer-to-peer radio (AWDL, Wi-Fi Direct, Multipeer) or verified LAN sockets with cryptographic checksum verification.

> **RULE**: Deterministic simulation and localhost test results CANNOT be promoted to physical evidence. Only physical multi-device telemetry and cryptographic checksum verification qualify.

---

## 2. Multi-Platform Hardware Device Matrix

| Device Pair | Sender | Receiver | Wi-Fi/LAN Status | Direct Status | Hardware Requirement |
|:---|:---|:---|:---|:---|:---|
| **Mac ↔ Mac** | macOS | macOS | `SUPPORTED` | `REQUIRES_NATIVE` (AWDL) | 2x Physical Macs in proximity |
| **Windows ↔ Windows** | Windows | Windows | `SUPPORTED` | `REQUIRES_NATIVE` (Wi-Fi Direct) | 2x Windows 10/11 PCs with Wi-Fi Direct NICs |
| **Mac ↔ Windows** | macOS | Windows | `SUPPORTED` | `PLATFORM_DEPENDENT` | 1x Mac + 1x Windows PC |
| **Android ↔ Android** | Android | Android | `SUPPORTED` | `REQUIRES_NATIVE` (P2P/Aware) | 2x Android 12+ Phones |
| **iOS ↔ iOS** | iOS | iOS | `SUPPORTED` | `REQUIRES_NATIVE` (Multipeer) | 2x iOS 16+ iPhones |
| **Mac ↔ Android** | macOS | Android | `SUPPORTED` | `PLATFORM_DEPENDENT` | 1x Mac + 1x Android Phone |
| **Mac ↔ iOS** | macOS | iOS | `SUPPORTED` | `PLATFORM_DEPENDENT` | 1x Mac + 1x iPhone |
| **Windows ↔ Android** | Windows | Android | `SUPPORTED` | `PLATFORM_DEPENDENT` | 1x Windows PC + 1x Android Phone |
| **Windows ↔ iOS** | Windows | iOS | `SUPPORTED` | `PLATFORM_DEPENDENT` | 1x Windows PC + 1x iPhone |
| **Android ↔ iOS** | Android | iOS | `SUPPORTED` | `NOT_SUPPORTED` | 1x Android + 1x iPhone (LAN only) |

---

## 3. Mandatory 32-Scenario Physical Verification Protocol

| Test ID | Scenario | Verification Criteria |
|:---|:---|:---|
| `PHYS-001` | Discovery | Rapid peer discovery via BLE beacons (Direct) or mDNS / UDP multicast (Wi-Fi/LAN) |
| `PHYS-002` | Device Identity | Exchange of Ed25519 public keys and display name/platform metadata |
| `PHYS-003` | Pairing | Mutual consent and 6-digit SAS verification code generation |
| `PHYS-004` | Verification | Cryptographic confirmation of out-of-band verification PIN |
| `PHYS-005` | Trust Storage | Persistent TOFU identity record caching |
| `PHYS-006` | Secure Session | Authenticated symmetric session establishment (ECDH + HKDF + AEAD) |
| `PHYS-007` | 0-Byte File | Transfer and zero-byte file allocation integrity |
| `PHYS-008` | 1-Byte File | Single-byte edge payload transmission and validation |
| `PHYS-009` | Small File (< 1 MB) | Single chunk transmission with cryptographic checksum match |
| `PHYS-010` | Large File (> 100 MB) | Multi-chunk streaming file transmission with backpressure |
| `PHYS-011` | Multiple Files | Sequential manifest batch processing |
| `PHYS-012` | Nested Folder | Hierarchical folder tree preservation with path traversal prevention |
| `PHYS-013` | Unicode Filenames | Emoji, CJK, and non-ASCII filename preservation |
| `PHYS-014` | Duplicate Filenames | Automatic collision resolution without overwriting existing files |
| `PHYS-015` | Archive / ZIP | Binary compressed archive transmission and byte integrity |
| `PHYS-016` | APK / App Binary | Execution container binary safe transfer as regular file |
| `PHYS-017` | Pause Transfer | Controlled pipeline pause preserving buffer permits |
| `PHYS-018` | Resume Transfer | Resumption from committed byte ranges without retransmission |
| `PHYS-019` | Cancel Transfer | Clean sender/receiver abort and temporary file deletion |
| `PHYS-020` | Retry Transfer | Retry of interrupted transfer using persistent checkpoint |
| `PHYS-021` | Disconnect During Transfer | Unplanned socket termination detection and state update |
| `PHYS-022` | Reconnect & Resume | Session re-establishment and gap recovery over new socket |
| `PHYS-023` | Integrity Verification | SHA-256 receiver digest matching sender digest |
| `PHYS-024` | History Record | Exactly one deduplicated terminal record creation |
| `PHYS-025` | OS Notification | Desktop notification dispatch on transfer completion |
| `PHYS-026` | Background Behavior | Transfer continuity during window minimization/unfocus |
| `PHYS-027` | Destination Handling | Atomic file move to final downloads destination directory |
| `PHYS-028` | Blocked Peer Rejection | Explicit rejection of incoming request from blacklisted device |
| `PHYS-029` | Revoked Session | Immediate teardown upon session revocation |
| `PHYS-030` | Tampered Frame Rejection | AEAD MAC failure and immediate session termination on corrupted frame |
| `PHYS-031` | Large Multi-File Transfer | High-volume mixed-size batch stress test |
| `PHYS-032` | Transfer Completion Cleanup | Verification that zero active sockets, temp files, or leaks remain |

---

## 4. Physical Evidence Invariants

1. **Dual-Digest Matching**: Physical transfers are only marked `PASS` if `sender SHA-256 === receiver SHA-256`.
2. **Distinct Hardware IDs**: `senderDeviceId !== receiverDeviceId` must hold.
3. **No Credential Logging**: Passwords, private keys, auth tokens, and raw local paths must never be logged.
4. **No Silent Mode Fallback**: Direct Mode failure must never silently fallback to Wi-Fi Mode.
