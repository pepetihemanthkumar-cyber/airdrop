# NearShare Windows Direct Physical Two-Device Validation Runbook

## Objective
Verify true physical off-grid peer-to-peer file transfer between two distinct Windows 10/11 physical machines using NearShare's native Wi-Fi Direct transport.

---

## 1. Hardware & Environment Requirements
- **PC A (Sender)**: Windows 10 (21H2+) or Windows 11 with Wi-Fi Direct capable adapter.
- **PC B (Receiver)**: Windows 10 (21H2+) or Windows 11 with Wi-Fi Direct capable adapter.
- **Network Environment**: Off-grid (disconnect both machines from all Wi-Fi access points and Ethernet cables; ensure Wi-Fi radio is toggled ON).
- **Application Build**: NearShare `0.1.0` production desktop installer or release build.

---

## 2. Step-by-Step Two-Device Validation Protocol

### Step 1: Pre-Flight Verification
1. Launch NearShare on PC A and PC B.
2. Confirm both machines report Mode: `⚡ Direct`.
3. Verify zero router connection indicator.

### Step 2: Discovery & Advertisement
1. On PC B (Receiver): Enter Direct Mode and begin receiving.
2. On PC A (Sender): Enter Direct Mode and start discovery.
3. Verify PC B appears in PC A's discovery vessel within 5 seconds.
4. Verify displayName matches PC B's sanitized profile name.

### Step 3: Pairing & Session Establishment
1. Select PC B on PC A.
2. Verify pairing prompt appears on PC B with matching 6-digit SAS verification code.
3. Confirm pairing on both devices.
4. Verify secure session established (ECDH P-256 key exchange).

### Step 4: Transfer Scenarios
Execute the following sequential transfers and record outcomes:

| Test ID | Test Scenario | Payload Size | Expected Integrity | Pass / Fail Criteria |
|:---|:---|:---:|:---:|:---|
| **WIN-DIR-01** | Zero-Byte Control File | `0 B` | SHA-256 match | Instant completion, 0 B transferred |
| **WIN-DIR-02** | Small Document | `64 KiB` | SHA-256 match | Single chunk write & receive |
| **WIN-DIR-03** | Medium Asset | `10 MiB` | SHA-256 match | Multi-chunk streaming with progress |
| **WIN-DIR-04** | Large Binary | `100 MiB` | SHA-256 match | Bounded buffer, zero memory spikes |
| **WIN-DIR-05** | Very Large Archive | `1 GiB` | SHA-256 match | Continuous streaming, throughput recorded |
| **WIN-DIR-06** | Multi-File Batch | 10 files (25 MiB total) | All digests match | Queue ordering preserved |
| **WIN-DIR-07** | Folder Structure | 3 nested directories | Tree preserved | Manifest validated |
| **WIN-DIR-08** | Pause & Resume | `50 MiB` file paused at 50% | Missing range resumed | Accurate checkpoint resumption |
| **WIN-DIR-09** | Cancellation | `100 MiB` file cancelled at 30% | Cleanup confirmed | Streams closed, partial data cleaned |
| **WIN-DIR-10** | Disconnect & Reconnect | Wi-Fi toggled during transfer | Auto-recovery / error state | Clean teardown without crash |

---

## 3. Physical Evidence Rules

A test may only be marked **`PASS`** if:
1. `environment === 'physicalDirect'`
2. `transportUsed === 'DIRECT_NATIVE'`
3. Two distinct physical hardware device IDs are recorded.
4. Transferred bytes > 0 for non-zero files.
5. SHA-256 checksum of received file matches source exactly.

**Current Evidence Status**: `NOT_RUN / HARDWARE UNAVAILABLE`
