# NearShare Physical Multi-Device Validation Results

> **Current Environment Baseline**: Single physical host (`macOS Apple Silicon arm64`).  
> **Rule of Evidence**: Deterministic simulation and localhost testing CANNOT be promoted to physical evidence. Only physical multi-device telemetry and cryptographic checksums qualify.

---

## 1. Evidence Level Hierarchy

| Level | Classification | Environment | Rule / Scope |
|:---|:---|:---|:---|
| **LEVEL 0** | Unit / Integration Simulation | In-memory / Mocks | Automated test suites (`npm test`). Cannot satisfy physical gates. |
| **LEVEL 1** | Localhost / Single-Node | Loopback TCP (`127.0.0.1`) | Single host process-to-process. Does not validate physical network. |
| **LEVEL 2** | Same-Machine Native Runtime | Native OS API loopback | Tests native platform bridges locally. |
| **LEVEL 3** | Physical LAN | 2+ Distinct Physical Devices | Local Wi-Fi subnet / router. Required for `GATE-PHYSICAL-LAN`. |
| **LEVEL 4** | Physical Direct | 2+ Distinct Physical Devices | Direct P2P radio (AWDL/NAN/Wi-Fi Direct). Required for `GATE-PHYSICAL-DIRECT`. |

---

## 2. Canonical Physical Validation Results Matrix

| Test | Device Pair | Mode | Evidence Level | Result | Integrity | Security |
|:---|:---|:---|:---|:---|:---|:---|
| `PHYS-001..032` | macOS ↔ macOS | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ macOS | Direct (AWDL) | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ Windows | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ Windows | Direct | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Windows ↔ Windows | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Windows ↔ Windows | Direct | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ Android | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ Android | Direct | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ iOS | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | macOS ↔ iOS | Direct (Multipeer) | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Windows ↔ Android | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Windows ↔ Android | Direct | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Windows ↔ iOS | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Windows ↔ iOS | Direct | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Android ↔ Android | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Android ↔ Android | Direct (P2P) | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Android ↔ iOS | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | Android ↔ iOS | Direct | LEVEL 4 | `NOT_SUPPORTED` | `NOT_SUPPORTED` | `NOT_SUPPORTED` |
| `PHYS-001..032` | iOS ↔ iOS | Wi-Fi / LAN | LEVEL 3 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |
| `PHYS-001..032` | iOS ↔ iOS | Direct (Multipeer) | LEVEL 4 | `BLOCKED` | `UNVERIFIED` | `UNVERIFIED` |

---

## 3. Recovery Progression Scenarios

| Scenario ID | Name | Trigger Point | Expected Behavior | Physical Status |
|:---|:---|:---|:---|:---|
| `RECOVERY-25` | Recovery at 25% | Force break at ~25% transmitted bytes | Checkpoint saved; resume negotiation; gap transfer completes with SHA-256 match | `BLOCKED — HARDWARE UNAVAILABLE` |
| `RECOVERY-50` | Recovery at 50% | Force break at ~50% transmitted bytes | Checkpoint saved; resume negotiation; gap transfer completes with SHA-256 match | `BLOCKED — HARDWARE UNAVAILABLE` |
| `RECOVERY-75` | Recovery at 75% | Force break at ~75% transmitted bytes | Checkpoint saved; resume negotiation; gap transfer completes with SHA-256 match | `BLOCKED — HARDWARE UNAVAILABLE` |
| `RECOVERY-90` | Recovery at 90% | Force break at ~90% transmitted bytes | Checkpoint saved; final chunk transferred; complete verification | `BLOCKED — HARDWARE UNAVAILABLE` |

---

## 4. Release Gates Audit

| Gate ID | Description | Current Status | Rationale |
|:---|:---|:---|:---|
| `GATE-PHYSICAL-LAN` | Real LAN transmission across separate physical peers | `BLOCKED` | Only 1 physical Mac present in environment |
| `GATE-PHYSICAL-DIRECT` | Real Direct Mode transmission across separate physical radios | `BLOCKED` | Only 1 physical Mac present in environment |
| `GATE-SECURITY` | Cryptographic pairing, dynamic SAS, session authorization | `PASS (SIM)` | 100% deterministic & local crypto test suites pass |
| `GATE-INTEGRITY` | Bidirectional SHA-256 chunk & manifest validation | `PASS (SIM)` | Zero checksum corruption detected in local tests |
| `GATE-RECOVERY` | Checkpoint resumption & range reconstruction | `PASS (SIM)` | Checkpoint store and recovery engine pass local tests |
| `GATE-PERFORMANCE` | Real-world physical network throughput & latency | `NOT_MEASURED` | Physical measurement pending multi-device testbed |
