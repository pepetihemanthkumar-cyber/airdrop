# NearShare macOS Direct Mode: Security Release Audit

## Target Version: `0.1.0`
## Classification: `SECURITY_RELEASE_AUDITED`

---

## 1. Cryptographic Boundary & Plaintext Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                        │
│  (FileEngine, ProtocolStateMachine, TransferQueueContext)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Plaintext file chunks (Streamed)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 SECURE TRANSPORT SESSION                    │
│  - ECDH P-256 Ephemeral Key Exchange                        │
│  - HKDF-SHA256 Key Derivation                               │
│  - AES-256-GCM Wire Frame Framing                           │
│  - 64-bit Monotonic Sequence Numbers                        │
│  - 128-bit Authentication Tags                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ Authenticated Ciphertext Frames Only
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TAURI FFI & RUST RUNTIME                    │
│  (macos_direct.rs - Memory Bounds & Null-Pointer Safety)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Opaque Binary Payloads
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               SWIFT NATIVE DIRECT SESSION                   │
│  (NearShareDirectSession - Multipeer Stream Transport)     │
│  * ZERO Private Keys Stored                                 │
│  * ZERO Plaintext File Access                               │
│  * ZERO Cryptographic Algorithm Implementations             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Security Invariants Verification

| Invariant | Implementation Mechanism | Audit Result |
|:---|:---|:---|
| **Plaintext Isolation** | File data is encrypted by `SecureTransportSession` before crossing FFI into Swift | `VERIFIED` |
| **Key Secrecy** | Ephemeral private keys and symmetric session keys are retained strictly in TypeScript Web Crypto SubtleCrypto; never passed across FFI | `VERIFIED` |
| **Authentication & Integrity** | 128-bit AES-GCM tags protect both payload and wire headers (AAD); tampered frames fail closed | `VERIFIED` |
| **Replay Protection** | 64-bit strictly increasing sequence numbers prevent replayed packets | `VERIFIED` |
| **Session Isolation** | Ephemeral `connectionId` and `secureSessionId` rotate on every connection attempt | `VERIFIED` |
| **Blocked Device Protection** | Blocked peer IDs are rejected at advertiser/browser invitation boundaries before stream allocation | `VERIFIED` |
| **Key Zeroization** | Revoked session keys are overwritten with zero-bytes and cleared from memory | `VERIFIED` |
| **Privacy Sanitization** | `MCPeerID.displayName` uses sanitized profile names; no hardware MAC, serials, or private IPs | `VERIFIED` |
| **Log Sanitization** | `SafeErrorMapper` and production loggers strip absolute filesystem paths and internal pointers | `VERIFIED` |

---

## 3. Threat Model & Failure Behavior

1. **Corrupted Ciphertext Injection**:
   - *Behavior*: AES-GCM tag verification failure in Web Crypto.
   - *Result*: Session terminates immediately (`fail closed`); zero corrupt bytes committed to disk.

2. **Replayed Packet Injection**:
   - *Behavior*: Duplicate or decreased sequence number detected.
   - *Result*: Packet discarded; stream pipeline halts if out-of-order bounds exceeded.

3. **Mismatched / Expired Session ID**:
   - *Behavior*: Frame header session ID does not match active session state.
   - *Result*: Dropped silently without processing.

4. **Blocked Peer Connection Attempt**:
   - *Behavior*: Advertiser invitation filter checks `DeviceTrustContext`.
   - *Result*: Invitation rejected at OS Multipeer boundary; no session created.
