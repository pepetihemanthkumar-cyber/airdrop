# NearShare Direct Mode — macOS Two-Mac Physical Test Procedure

## 1. Test Overview

This document specifies the exact, reproducible manual test procedure to physically validate NearShare Direct Mode peer-to-peer transfers between two real, physical Apple Mac computers without an external Wi-Fi router or active internet connection.

> **CRITICAL VERIFICATION RULE**:
> This test CANNOT be performed on a single machine using loopback, localhost, or standard LAN networking. Physical validation requires two independent physical hardware devices with active Wi-Fi radios communicating directly over ad-hoc peer channels.

---

## 2. Test Environment Requirements

### Hardware Requirements
- **Mac A (Sender / Primary)**: Physical Apple Silicon (M1/M2/M3/M4) or Intel Mac running macOS 14+ (Sonoma or Sequoia).
- **Mac B (Receiver / Secondary)**: Physical Apple Silicon or Intel Mac running macOS 14+ (Sonoma or Sequoia).
- **Physical Proximity**: Both machines placed within 1 to 15 meters of each other (well within the 30m product UX target boundary).

### Radio & Network State
1. **Wi-Fi Radio**: **ENABLED (ON)** on both Mac A and Mac B.
2. **Wi-Fi Network Connection**: **DISCONNECTED** from all external access points / Wi-Fi routers on both machines (Turn off "Auto-Join" for local networks).
3. **Ethernet**: Unplugged / Inactive on both machines.
4. **Internet**: **NO active internet connectivity** on either machine.
5. **Bluetooth**: **ENABLED (ON)** on both machines (for auxiliary discovery bootstrap).

### Application State
- NearShare desktop build (`Syntra.app` / `cargo tauri build`) installed and launched on both Mac A and Mac B.
- App permissions granted: Local Network permission allowed when prompted.

---

## 3. Step-by-Step Execution Protocol

```
┌─────────────────────────────────────────────────────────────┐
│                           Mac A                             │
│ 1. Launch NearShare                                         │
│ 2. Select "Direct Mode"                                     │
│ 3. Click "Discover Peers" ───────────────┐                  │
└──────────────────────────────────────────┼──────────────────┘
                                           │ Ad-Hoc Multipeer
                                           │ Wireless Discovery
┌──────────────────────────────────────────┼──────────────────┐
│                           Mac B          │                  │
│ 4. Launch NearShare                      │                  │
│ 5. Select "Direct Mode"                  │                  │
│ 6. Click "Discover Peers" <──────────────┘                  │
│ 7. Verify Mac A appears on Mac B radar                      │
│ 8. Verify Mac B appears on Mac A radar                      │
└─────────────────────────────────────────────────────────────┘
                                           │
                                           │ Direct Link Establishment
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Mac A clicks Mac B: Initiate Connection                  │
│ 10. Direct Stream Channel Opened (NSStream / NWConnection)  │
│ 11. NearShare Protocol HELLO exchanged                     │
│ 12. Security Verification & PIN Confirmation Handshake      │
│ 13. SecureTransportSession (AES-256-GCM AEAD) Key Generated │
└─────────────────────────────────────────────────────────────┘
                                           │
                                           │ Data Transmission
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 14. Mac A selects a 50 MiB test file                        │
│ 15. FileEngine generates chunks & SHA-256 manifest          │
│ 16. Chunks transferred across direct byte channel           │
│ 17. Mac B streams chunks directly to disk                   │
│ 18. SHA-256 checksum verified on Mac B                      │
│ 19. Reverse test: Mac B sends 50 MiB file to Mac A          │
│ 20. Disconnect, reconnect, and record latency & throughput  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Verification Checklist & Success Criteria

| Step | Verification Gate | Pass Criteria | Result |
| :--- | :--- | :--- | :--- |
| **G-01** | Zero External AP | `ifconfig en0` shows active interface but NO router IP/gateway assigned. | `[ ] PASS` / `[ ] FAIL` |
| **G-02** | Peer Discovery | Mac A discovers Mac B within 5 seconds without internet or router. | `[ ] PASS` / `[ ] FAIL` |
| **G-03** | Distance Estimate | Radar displays distance estimate between 1m and 30m. | `[ ] PASS` / `[ ] FAIL` |
| **G-04** | Direct Channel | Direct byte stream opens with zero dropped packets. | `[ ] PASS` / `[ ] FAIL` |
| **G-05** | Protocol Handshake | `HELLO` and `CAPABILITIES` frames exchange cleanly over native stream. | `[ ] PASS` / `[ ] FAIL` |
| **G-06** | Pairing & Trust | PIN verification / device trust handshake completes. | `[ ] PASS` / `[ ] FAIL` |
| **G-07** | Cryptographic AEAD | `SecureTransportSession` encrypts chunks with zero integrity failures. | `[ ] PASS` / `[ ] FAIL` |
| **G-08** | Payload Transfer | 50 MiB file transfers at >= 10 MB/s over direct ad-hoc channel. | `[ ] PASS` / `[ ] FAIL` |
| **G-09** | Checksum Match | SHA-256 of received file on Mac B identically matches Mac A source file. | `[ ] PASS` / `[ ] FAIL` |
| **G-10** | Clean Teardown | `disconnect()` releases socket/stream handles without process hang. | `[ ] PASS` / `[ ] FAIL` |

---

## 5. Promotion to `physical_same_platform_verified`

Only when all gates G-01 through G-10 pass on two real physical Apple Macs may [`MacOSDirectCapabilities.physicalValidation`](file:///Users/pepetihemanthkumar/Documents/SYNTRA/src/core/native/macos/MacOSDirectCapabilities.ts) and [`DirectTransportCapabilities.physicalValidationStatus`](file:///Users/pepetihemanthkumar/Documents/SYNTRA/src/core/transport/direct/DirectTransportCapabilities.ts) be changed from `not_verified` to `physical_same_platform_verified`.
