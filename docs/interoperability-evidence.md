# NearShare Cross-Platform Interoperability Evidence Invariants

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering

---

## 1. Evidence Environment Hierarchy

NearShare enforces a non-promotable hierarchy of testing evidence:

1. **`deterministic`**: In-memory unit tests validating message formatting, sequence numbering, schema conformity, and byte packing.
2. **`localhost`**: Loopback TCP socket connections and local IPC bindings executed on a single host.
3. **`lan`**: Emulated or virtual local area network testing across virtual network interfaces.
4. **`physicalLan`**: Two distinct physical devices communicating over a shared physical Wi-Fi router / subnet.
5. **`physicalDirect`**: Two distinct physical devices communicating point-to-point over native off-grid peer-to-peer radio (AWDL, Wi-Fi Direct, Multipeer).

---

## 2. Invariant Promotion Rules

- **RULE 1**: `deterministic` test results CANNOT be recorded as physical evidence.
- **RULE 2**: `localhost` test results CANNOT be recorded as multi-device evidence.
- **RULE 3**: `physicalLan` transfers CANNOT be claimed as `physicalDirect` transfers.
- **RULE 4**: A physical validation record is only valid if `deviceIdA !== deviceIdB` and `sha256Sender === sha256Receiver`.
- **RULE 5**: Passwords, private keys, authentication secrets, and absolute filesystem paths must NEVER be stored in evidence records.
