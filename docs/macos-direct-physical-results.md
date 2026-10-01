# NearShare macOS Direct Mode: Physical Validation Results & Audit

## Evidence Status

```
Native Implementation:       IMPLEMENTED (Swift static library + MultipeerConnectivity.framework)
Runtime Self-Test:           PASS (Native initialization, stream subsystem, delegate registration verified)
Physical Mac ↔ Mac Direct:   NOT VERIFIED / HARDWARE UNAVAILABLE
```

---

## 1. Laboratory Environment Baseline

| Parameter | Value | Verification State |
|:---|:---|:---|
| **Available Host Hardware** | 1 Physical Apple Silicon Mac | Verified Local Host |
| **Secondary Physical Mac** | None (Hardware Unavailable) | Blocked Physical Multi-Device |
| **Operating System** | macOS 14+ | Verified |
| **Native Transport Framework** | `MultipeerConnectivity.framework` + `Network.framework` | Compiled, Linked & Self-Tested |
| **Bonjour Service Type** | `nearshare-p2p` | Verified RFC/Apple Compliant |
| **Memory Buffer Model** | Bounded (64 KiB read chunks / 16 in-flight permits) | Hardened & Tested |

---

## 2. Validation Gate Status

When running the validation engine under `physicalDirect` mode on the single available host, the Physical Gate correctly reports:

```json
{
  "gateStatus": "BLOCKED",
  "nativeImplemented": true,
  "macOsRuntimeConfirmed": true,
  "peerDeviceDetected": false,
  "peerIsMacOS": false,
  "directPathConfirmed": true,
  "noWifiFallback": true,
  "physicalDirectExplicitlySelected": true,
  "blockReason": "No remote macOS peer device connected over Multipeer"
}
```

---

## 3. Physical Scenario Readiness Matrix (DIRECT-PHYS-001 ... DIRECT-PHYS-030)

| Scenario Code | Scenario Name | Deterministic Harness | Physical Direct Status |
|:---|:---|:---|:---|
| **DIRECT-PHYS-001** | Peer Discovery | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-002** | Peer Invitation | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-003** | Pairing & Trust Handshake | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-004** | Secure Session Establishment | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-005** | 0-Byte Boundary File Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-006** | 1-Byte Boundary File Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-007** | 4 KiB Small Block Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-008** | 1 MiB Standard Stream Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-009** | 100 MiB High-Throughput Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-010** | Large File (500 MiB / 1 GiB) Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-011** | Nested Folder Manifest Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-012** | Unicode Filename Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-013** | Compressed Archive Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-014** | Arbitrary Binary (.apk) Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-015** | Pause In-Flight Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-016** | Resume Paused Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-017** | Transfer Cancellation Cleanup | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-018** | Disconnect Mid-Transfer | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-019** | Transport Reconnection | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-020** | Resume After Reconnect | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-021** | Bidirectional SHA-256 Integrity Verification | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-022** | Single History Record Logging | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-023** | Blocked Peer Rejection | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-024** | Revoked Session Key Invalidation | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-025** | Expired / Mismatched Session ID Frame Drop | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-026** | Duplicate Frame / Replay Protection | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-027** | Corrupted Ciphertext AEAD Failure | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-028** | Peer Device Disappearance | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-029** | App Background / Tray Continuity | PASS | PENDING HARDWARE |
| **DIRECT-PHYS-030** | Clean App Shutdown Flushes Checkpoints | PASS | PENDING HARDWARE |

---

## 4. Execution Requirement For Physical Sign-off
To transition from `NOT VERIFIED / HARDWARE UNAVAILABLE` to `VERIFIED`:
1. Attach secondary physical Mac running NearShare desktop v0.1.0+.
2. Execute the procedure documented in [macos-direct-two-device-runbook.md](file:///Users/pepetihemanthkumar/Documents/SYNTRA/docs/macos-direct-two-device-runbook.md).
3. Record measured over-the-air throughput, physical latency, and SHA-256 verification results into this document.
