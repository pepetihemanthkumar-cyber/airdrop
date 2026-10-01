# NearShare Physical Validation — Operator Protocol & Checklist

> **Document**: `docs/physical-validation-operator-checklist.md`  
> **Version**: 0.1.0  
> **Scope**: Physical Multi-Device Execution Protocol for QA & Release Engineering  
> **Classification**: Internal Test Procedure

---

## Overview

This checklist defines the canonical 22-step testing procedure for executing real physical validation across two distinct physical devices (e.g. Mac-Mac, Mac-Windows, Mac-Android, Mac-iOS).

> [!IMPORTANT]
> **Zero-Tampering Rule**: Never record simulated, unit test, or single-host localhost results as physical evidence. If a second physical device is not present, mark the corresponding test pair and scenarios as `BLOCKED — HARDWARE UNAVAILABLE`.

---

## Canonical 22-Step Operator Checklist

| Step | Phase | Action / Verification | Acceptance Criteria |
|:---|:---|:---|:---|
| **01** | **Setup** | Install identical NearShare version (`0.1.0`) on Device A (Sender) and Device B (Receiver). | Version strings match exactly in App $\rightarrow$ Settings $\rightarrow$ About. |
| **02** | **Setup** | Confirm Device Identities and cryptographic public key fingerprints. | Each device displays distinct `@username`, device name, and valid fingerprint. |
| **03** | **Setup** | Select initial transfer mode (**Wi-Fi Mode** or **Direct Mode**). | Both devices explicitly configured to matching transfer mode. |
| **04** | **Setup** | Confirm OS permissions (Local Network on macOS/iOS, Location/Nearby on Android, Firewall on Windows). | No OS security popups blocking socket binds or discovery probes. |
| **05** | **Setup** | Confirm network topology (same subnet for LAN Mode; Wi-Fi radio active for Direct Mode). | Devices have IP connectivity or active peer-to-peer radios. |
| **06** | **Session** | Initialize validation session in test runner (`PhysicalValidationRunner.startSession()`). | Session ID generated and safe device metadata recorded in inventory. |
| **07** | **Discovery** | Trigger nearby device discovery on Device A. | Device B appears on Device A's radar/list within 5 seconds without synthetic artifacts. |
| **08** | **Pairing** | Initiate pairing request from Device A to Device B. | Device B receives incoming pairing sheet with accurate sender metadata. |
| **09** | **SAS Verification** | Compare 6-digit Short Authentication String (SAS) code on both screens. | SAS codes match identically. Accept on both devices; session authorized. |
| **10** | **Transfer: 0B** | Transmit a 0-byte edge file (`empty.txt`). | File successfully created on Device B; 0 bytes recorded; integrity confirmed. |
| **11** | **Transfer: Small** | Transmit a small payload file (< 1 MB, e.g. `doc.pdf`). | Single-chunk transmission completes; SHA-256 digest matches sender. |
| **12** | **Transfer: Multi-File** | Transmit a batch of 5 mixed-size files (`.png`, `.json`, `.txt`, `.mp4`). | Sequential or multiplexed transfer completes all 5 files without corruption. |
| **13** | **Transfer: Folder** | Transmit a nested directory structure (e.g. `src/` containing subfolders and files). | Directory hierarchy recreated identically on Receiver; no traversal escape (`..`). |
| **14** | **Transfer: Large** | Transmit a large payload (> 100 MB, e.g. `video.mov`). | Multi-chunk streaming with backpressure; throughput telemetry remains stable. |
| **15** | **Control: Pause/Resume** | Pause active transfer at ~50%, wait 5 seconds, then click Resume. | Transfer halts without socket panic; resumes from committed byte offset. |
| **16** | **Recovery: Interrupt** | Simulate unexpected drop (toggle Wi-Fi / disconnect interface) at ~50%. Reconnect. | Session interrupted state detected; checkpoint saved; resume gap protocol completes. |
| **17** | **Integrity** | Verify bidirectional SHA-256 checksums across all received payloads. | Sender SHA-256 matches Receiver SHA-256 byte-for-byte; zero corruptions. |
| **18** | **History** | Inspect Transfer History on both Sender and Receiver. | Completed transfers recorded with accurate timestamps, sizes, and device records. |
| **19** | **Security: Blocked** | Add Device A to Device B's Blocked List in Settings/Device Trust. Attempt transfer. | Connection immediately rejected with `ERR_DEVICE_BLOCKED`; zero data sent. |
| **20** | **Security: Trusted** | Mark Device A as Trusted on Device B. Re-attempt pairing/transfer. | Subsequent transfers skip manual verification prompt; session auto-authorizes. |
| **21** | **Direct Mode** | Repeat Steps 06–18 in **Direct Mode** (Apple Multipeer/AWDL on macOS/iOS). | Transport used confirms `DIRECT_NATIVE`; no Wi-Fi AP fallback. |
| **22** | **Evidence Export** | Export sanitized evidence report (`PhysicalValidationRunner.exportReport()`). | Public report contains zero private keys, secrets, or raw host paths. |

---

## Evidence Logging Constraints

When recording evidence to [`docs/physical-validation-results.md`](file:///Users/pepetihemanthkumar/Documents/SYNTRA/docs/physical-validation-results.md):

1. **Excluded Data**:
   - Never record private IP addresses in public reports (use `192.168.x.x` or sanitized device IDs).
   - Never record filesystem paths (e.g. `/Users/username/...` must be redacted to `/Users/***` or relative paths).
   - Never record private ECDSA/ECDH keys, raw session keys, or SAS transcript salts.
2. **Result Classifications**:
   - `PASS`: Only when physical transfer and SHA-256 match succeeded on distinct physical hardware.
   - `FAIL`: Execution failed or checksum mismatch occurred.
   - `BLOCKED`: Hardware unavailable (e.g. only one physical Mac present).
   - `NOT_RUN`: Test scenario queued but not executed.
