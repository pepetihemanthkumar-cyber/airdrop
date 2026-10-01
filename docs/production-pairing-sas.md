# Production Short Authentication String (SAS) Architecture

## Overview
NearShare employs an out-of-band Short Authentication String (SAS) protocol to prevent Man-in-the-Middle (MITM) attacks during device pairing and transfer verification.

## Cryptographic Derivation
The SAS is derived deterministically from the authenticated session transcript using SHA-256:

$$\text{Transcript} = \text{ProtocolVersion} \parallel \text{SessionId} \parallel \text{Fingerprint}_A \parallel \text{Fingerprint}_B \parallel \text{EphemeralPub}_A \parallel \text{EphemeralPub}_B \parallel \text{Label}$$

1. **Transcript Ordering**: Peer fingerprints and ephemeral public keys are sorted canonically so that both initiator and responder generate identical canonical byte sequences regardless of connection direction.
2. **Hashing**: The canonical transcript is hashed via SHA-256.
3. **Extraction**: The first 4 bytes of the digest are read as a big-endian `uint32`.
4. **Modulo Reduction**: `rawNumeric = uint32Value % 1_000_000` to yield a 6-digit number in the range `[000000, 999999]`.
5. **Formatting**: Formatted as `XXX YYY` (e.g. `123 456`) for human readability.

## Security Properties
- **Dynamic**: Never hardcoded (previous development value `482917` removed from all production paths).
- **Session-Bound**: Changing the session ID, ephemeral key, or peer identity changes the SAS.
- **Bounded Lifetime**: Valid for 60,000 ms (60 seconds) by default. Expired SAS codes are immediately rejected.
- **Zero Secret Leakage**: Derivation does not expose long-term private keys or session encryption keys.
- **Single-Use**: Upon successful verification or expiry, SAS state is wiped from memory.

## Verification Lifecycle
```
[User initiates pairing]
        ↓
State: requested
        ↓
Derive SAS asynchronously
        ↓
State: awaitingVerification (displays "XXX YYY")
        ↓
User confirms matching code on both devices
        ↓
State: verifying
        ↓
Code match? ─── NO ───→ State: awaitingVerification / failed, session rejected
        ↓ YES
State: paired (trust established, SAS wiped)
```

## Physical Validation Status
- **Localhost / Deterministic Simulation**: PASS (SAS-001 through SAS-010)
- **Physical Multi-Device Validation**: BLOCKED (Single Mac development host; physical multi-device validation blocked pending multi-device test lab).
