# NearShare — macOS Direct Mode Mac-to-Mac Physical Test Plan

## 1. Executive Summary

This document establishes the official 23-scenario physical validation suite for NearShare macOS Direct Mode (Apple MultipeerConnectivity over AWDL). It defines the strict boundary between compiled native runtime implementation and physical multi-device verification.

### Physical Environment Status
- **Physical Test Target**: macOS ↔ macOS Direct (MultipeerConnectivity / AWDL)
- **Available Hardware**: 1 physical Mac (Apple Silicon)
- **Required Hardware**: 2 physical Macs with Wi-Fi / Bluetooth hardware
- **Current Physical Verification Status**: `BLOCKED_HARDWARE_UNAVAILABLE`
- **Native Runtime Implementation Status**: `REAL_NATIVE_IMPLEMENTATION` (Swift static library compiled & linked)

---

## 2. 23-Point Mac-to-Mac Physical Scenario Test Matrix

| # | Scenario | Target Behavior | Expected Verification | Physical Result | Status |
|---|---|---|---|---|---|
| 1 | **Discovery** | Mac A discovers Mac B via `MCNearbyServiceBrowser` on service `nearshare-p2p` without Wi-Fi router | Event `direct_macos_peer_discovered` emitted with valid `peerId` | Blocked (Hardware Unavailable) | `BLOCKED` |
| 2 | **Peer Identity** | Mac A receives sanitized peer identity (`deviceId`, `deviceName`, `platform`, `capabilities`) | Zero leakage of MAC address, serial number, private key, or filesystem path | Blocked (Hardware Unavailable) | `BLOCKED` |
| 3 | **Invitation** | Mac A invites Mac B via `MCNearbyServiceBrowser.invitePeer()`; Mac B receives delegate callback | User prompt or auto-accept rule executes; `MCSessionState.connected` reached | Blocked (Hardware Unavailable) | `BLOCKED` |
| 4 | **Pairing** | Out-of-band 6-digit PIN / QR verification between Mac A and Mac B | Cryptographic commitment verified via `PairingManager` | Blocked (Hardware Unavailable) | `BLOCKED` |
| 5 | **Secure Session** | ECDH P-256 handshake over `MCSession` establishes AES-256-GCM session keys | `SecureTransportSession` transitions to `active`; AEAD tags valid | Blocked (Hardware Unavailable) | `BLOCKED` |
| 6 | **0-Byte File** | Transmission of empty 0-byte file | Manifest verified, 0-byte file created with correct permissions, SHA-256 empty hash | Blocked (Hardware Unavailable) | `BLOCKED` |
| 7 | **1-Byte File** | Transmission of single byte file (`0x53`) | Single chunk frame transferred and acknowledged; hash verified | Blocked (Hardware Unavailable) | `BLOCKED` |
| 8 | **1 MB File** | Transmission of 1 MiB binary payload over `NSOutputStream` / `NSInputStream` | High-speed transfer completes within 100ms; SHA-256 bit-identical | Blocked (Hardware Unavailable) | `BLOCKED` |
| 9 | **100 MB File** | Transmission of 100 MiB multi-chunk payload | Transfer backpressure throttles inflight chunks at 16; zero memory explosion | Blocked (Hardware Unavailable) | `BLOCKED` |
| 10 | **1 GB File** | Bulk payload transfer (1 GiB) | Continuous streaming with rolling SHA-256 verification and disk flush | Blocked (Hardware Unavailable) | `BLOCKED` |
| 11 | **Folder Transfer** | Hierarchical directory with nested files and folders | Directory structure reconstructed atomically without path traversal escapes | Blocked (Hardware Unavailable) | `BLOCKED` |
| 12 | **Unicode Filenames** | Files with UTF-8 emojis, Asian characters, and special symbols (`日本語_📄_ö.dat`) | File names sanitized and preserved across filesystems | Blocked (Hardware Unavailable) | `BLOCKED` |
| 13 | **Pause Transfer** | User pauses active transfer from UI | Producer pauses reading; stream remains open; inflight chunks drain | Blocked (Hardware Unavailable) | `BLOCKED` |
| 14 | **Resume Transfer** | User resumes paused transfer | Transfer resumes from exact checkpoint chunk index without full retransmit | Blocked (Hardware Unavailable) | `BLOCKED` |
| 15 | **Cancel Transfer** | User cancels transfer mid-flight | `TRANSFER_CANCEL` frame sent; temporary files deleted; stream recycled | Blocked (Hardware Unavailable) | `BLOCKED` |
| 16 | **Disconnect** | Physical radio disconnect / out of range | `MCSessionState.notConnected` handled gracefully; error mapped safely | Blocked (Hardware Unavailable) | `BLOCKED` |
| 17 | **Reconnect & Recovery** | Re-establishing direct link after disconnect | Logical `transferId` maintained; ephemeral `connectionId` rotated; resume negotiation | Blocked (Hardware Unavailable) | `BLOCKED` |
| 18 | **Payload Integrity** | SHA-256 digest validation of all transferred files | End-to-end hash match against source file before moving from `.part` to final file | Blocked (Hardware Unavailable) | `BLOCKED` |
| 19 | **Transfer History** | Completed and cancelled transfer records saved to SQLite/Store | Persistent audit history reflects exact direct transport mode and byte counts | Blocked (Hardware Unavailable) | `BLOCKED` |
| 20 | **Blocked Peer** | Untrusted / blocked Mac attempts direct connection | Multipeer invitation rejected immediately; stream never allocated | Blocked (Hardware Unavailable) | `BLOCKED` |
| 21 | **Revoked Session** | Session token revoked mid-transfer | Immediate crypto key wipe; remaining chunks dropped with auth error | Blocked (Hardware Unavailable) | `BLOCKED` |
| 22 | **Background Behavior** | App minimized or placed in background on macOS during direct transfer | Transfer continues uninterrupted within OS sandbox process limits | Blocked (Hardware Unavailable) | `BLOCKED` |
| 23 | **Resource Cleanup** | Teardown of direct bridge, streams, delegates, and allocated native buffers | Native `deinit` executes; zero leaked socket handles, memory, or thread workers | Blocked (Hardware Unavailable) | `BLOCKED` |

---

## 3. Summary of Results

- **Total Scenarios**: 23
- **Passed (Physical)**: 0 (No secondary Mac available)
- **Blocked (Hardware Unavailable)**: 23
- **Failed**: 0
- **Not Run**: 0

### Verdict
The macOS Direct Mode native code is fully implemented and compiled into the application binary. Physical multi-device verification remains **PENDING** until a second physical Mac is attached to the test bench.
