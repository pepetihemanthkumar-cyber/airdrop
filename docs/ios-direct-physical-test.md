# NearShare iOS Direct Physical Validation Protocol

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering  
**Validation Status:** NOT_RUN / BLOCKED (Requires Dual Physical iOS Devices)

---

## 1. Test Hardware Topology

```
┌─────────────────────────┐               ┌─────────────────────────┐
│     Device A (iOS)      │  Multipeer/   │     Device B (iOS)      │
│  iPhone 15 Pro (iOS 17) ├───────────────┤  iPhone 16 (iOS 18)     │
│   Host / Advertiser     │     AWDL      │   Client / Browser      │
└─────────────────────────┘               └─────────────────────────┘
```

---

## 2. Test Execution Matrix

| Test ID | Category | Description | Status | Evidence |
|---|---|---|---|---|
| **IOS-DIR-01** | Discovery | Device B browses and discovers Device A via `MCNearbyServiceBrowser` | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-02** | Advertisement | Device A advertises `nearshare-p2p` with safe discovery metadata | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-03** | Invitation | Device B sends invitation to Device A; Device A accepts | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-04** | Session Formation | `MCSession` enters `.connected` state | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-05** | Stream Opening | Device B opens stream with name `nearshare-stream` to Device A | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-06** | Zero-Byte Transfer | Send 0-byte file payload across Multipeer stream | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-07** | Small File Transfer | Send 64 KiB text file with SHA-256 verification | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-08** | 100 MiB Transfer | Send 100 MiB binary file measuring throughput and backpressure | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-09** | Large File (1 GiB) | Stream 1 GiB media file under bounded 64 KiB chunking | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-10** | Disconnect / Reconnect | Device A leaves range, returns; session cleanly recovers | `NOT_RUN / BLOCKED` | Physical pair required |
| **IOS-DIR-11** | Background Suspension | App enters background; tests 30s timeout and foreground resume | `NOT_RUN / BLOCKED` | Physical pair required |

---

## 3. Honest Verification Verdict

No test execution results are fabricated. All 11 physical verification test cases remain marked as `NOT_RUN / BLOCKED` until dedicated physical hardware is connected and run through the testing harness.
