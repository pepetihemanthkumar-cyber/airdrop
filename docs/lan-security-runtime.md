# LAN Security Runtime Architecture

## Zero-Trust LAN Principles
NearShare treats all local area networks (public Wi-Fi, shared office LANs, hotel networks) as untrusted. Being co-located on the same local subnet does not provide any implicit security trust.

## Security Layers Enforced on LAN:
1. **Dynamic SAS Derivation**:
   - Both peers dynamically derive matching Short Authentication Strings from the full session transcript.
   - Out-of-band visual verification ensures defense against MITM packet injection.
2. **End-to-End Cryptographic Tunnel**:
   - NIST P-256 ECDH ephemeral key exchange generates directional keys via HKDF-SHA256.
   - AES-256-GCM authenticated encryption with 128-bit integrity tags.
   - 64-bit monotonic sequence numbers reject replayed and reordered TCP frames.
3. **Identity & Blocklist Filtering**:
   - Device identity fingerprints are checked against the local trust store.
   - Blocked or untrusted peers cannot establish unauthenticated transfer sessions.
4. **Whole-File SHA-256 Checksums**:
   - Every file payload is hashed at source and verified at destination prior to final filesystem write.
