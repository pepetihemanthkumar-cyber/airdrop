# Production LAN Transport Architecture

## Overview
The NearShare Production LAN Transport (`ProductionLanTransportAdapter`) provides high-speed, local area network peer-to-peer file transfer over Wi-Fi/Ethernet without requiring internet connectivity or cloud servers.

## Architectural Layers
1. **Discovery Layer**:
   - Native UDP broadcast/multicast discovery (`_nearshare._udp`).
   - Discovers nearby active NearShare instances on the local subnet.
   - Bounded discovery cache and safe metadata emission.
2. **Framing & Transport Layer**:
   - Tokio asynchronous TCP socket engine in Rust host shell.
   - Length-prefixed binary framing with 1 MiB maximum frame constraint.
   - Stream backpressure and monotonic sequence indexing.
3. **Security Layer**:
   - NIST P-256 ECDH ephemeral key agreement.
   - HKDF-SHA256 key derivation.
   - AES-256-GCM authenticated encryption.
   - Out-of-band Short Authentication String (SAS) verification.
4. **Transfer Engine**:
   - Manifest validation and permission review.
   - 4 MiB chunk streaming with 16 in-flight window.
   - SHA-256 end-to-end integrity verification.

## Lifecycle States
`idle` $\rightarrow$ `discovering` $\rightarrow$ `connecting` $\rightarrow$ `authenticating` $\rightarrow$ `connected` $\rightarrow$ `transferring` $\rightarrow$ `completed`

## Error Handling & Sanitization
All raw network and Rust socket exceptions pass through `SafeErrorMapper` to prevent internal host path or credential leakage.

## Physical Validation Status
- **Localhost Loopback & Deterministic Suite**: PASS (LAN-001 through LAN-015)
- **Physical Multi-Device LAN Transfer**: BLOCKED — no second device available in test environment.
