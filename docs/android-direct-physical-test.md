# NearShare Android Direct Physical Two-Device Validation Runbook

## Objective
Verify true physical off-grid peer-to-peer file transfer between two distinct Android 12+ physical devices using NearShare's native Wi-Fi Direct transport.

---

## 1. Hardware & Environment Requirements
- **Device A (Sender)**: Android 12+ smartphone/tablet with Wi-Fi Direct support.
- **Device B (Receiver)**: Android 12+ smartphone/tablet with Wi-Fi Direct support.
- **Network Environment**: Off-grid (disconnect both devices from Wi-Fi access points and cellular mobile data; ensure Wi-Fi radio is toggled ON).
- **Application Build**: NearShare Android APK release build.

---

## 2. Step-by-Step Two-Device Validation Protocol

### Step 1: Pre-Flight Verification
1. Launch NearShare on Device A and Device B.
2. Confirm both report Mode: `⚡ Direct`.
3. Verify zero router / access point indicator.

### Step 2: Discovery & Advertisement
1. On Device B (Receiver): Start Direct Mode advertising.
2. On Device A (Sender): Start Direct Mode discovery.
3. Verify Device B appears in Device A's discovery vessel within 5 seconds.
4. Verify displayName matches Device B's sanitized profile name.

### Step 3: Pairing & Session Establishment
1. Select Device B on Device A.
2. Verify pairing prompt appears on Device B with matching 6-digit SAS verification code.
3. Confirm pairing on both devices.
4. Verify secure session established (ECDH P-256 key exchange).

### Step 4: Transfer Scenarios
Execute the following sequential transfers and record outcomes:

| Test ID | Test Scenario | Payload Size | Expected Integrity | Pass / Fail Criteria |
|:---|:---|:---:|:---:|:---|
| **AND-DIR-01** | Zero-Byte Control File | `0 B` | SHA-256 match | Instant completion, 0 B transferred |
| **AND-DIR-02** | Small Document | `64 KiB` | SHA-256 match | Single chunk write & receive |
| **AND-DIR-03** | Medium Asset | `10 MiB` | SHA-256 match | Multi-chunk streaming with progress |
| **AND-DIR-04** | Large Binary | `100 MiB` | SHA-256 match | Bounded buffer, zero memory spikes |
| **AND-DIR-05** | Very Large Archive | `1 GiB` | SHA-256 match | Continuous streaming, throughput recorded |
| **AND-DIR-06** | Multi-File Batch | 10 files (25 MiB total) | All digests match | Queue ordering preserved |
| **AND-DIR-07** | Folder Structure | 3 nested directories | Tree preserved | Manifest validated |
| **AND-DIR-08** | Pause & Resume | `50 MiB` file paused at 50% | Missing range resumed | Accurate checkpoint resumption |
| **AND-DIR-09** | Cancellation | `100 MiB` file cancelled at 30% | Cleanup confirmed | Streams closed, partial data cleaned |
| **AND-DIR-10** | Foreground Service Continuity | App minimized during 100 MiB transfer | Transfer completes in background | Notification active, zero disconnect |

---

## 3. Physical Evidence Rules

A test may only be marked **`PASS`** if:
1. `environment === 'physicalDirect'`
2. `transportUsed === 'DIRECT_NATIVE'`
3. Two distinct physical hardware device IDs are recorded.
4. Transferred bytes > 0 for non-zero files.
5. SHA-256 checksum of received file matches source exactly.

**Current Evidence Status**: `NOT_RUN / HARDWARE UNAVAILABLE`
