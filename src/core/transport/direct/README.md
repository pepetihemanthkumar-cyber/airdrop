# NearShare Direct Transport Module

## Overview
The Direct Transport module defines the architectural contracts, capability models, discovery interfaces, and error structures for off-grid, peer-to-peer file transfers in NearShare.

## Core Rules & Guarantees
1. **Zero External Infrastructure**: Direct Mode operates without an existing local Wi-Fi router, access point, or internet gateway.
2. **Radio State**: Direct Mode does *not* disable Wi-Fi. It uses native wireless hardware (AWDL, Wi-Fi Direct, Wi-Fi Aware, SoftAP) while maintaining normal radio power states.
3. **Product UX Range**: 30 meters is a product design and UX target boundary, *not* an absolute physical radio hardware guarantee.
4. **Separation of Concerns**:
   - Transport layer owns: Discovery, Link negotiation, and Bidirectional byte streaming.
   - Upper layers own: NearShare protocol envelopes, Chunk acknowledgments, End-to-end encryption (AES-256-GCM), and Checkpoint recovery.
5. **Security**: Direct transport reuses the existing `PairingManager`, `SecurityContext`, `DeviceTrustContext`, and `SecureTransportSession`.
6. **No Fake Fallback**: When Direct Mode requires native OS capabilities not available in the current environment, it reports `requiresNative` or `mockOnly` honestly rather than masquerading as a physical Direct transfer.

## Components
- `DirectTransportCapabilities.ts`: Strongly typed capability states and physical validation status.
- `DirectTransportErrors.ts`: Error class hierarchy covering radio states, unreachable peers, and bridge requirements.
- `DirectPeer.ts`: Peer device model with estimated distance and security states.
- `DirectDiscovery.ts`: Typed event-driven discovery provider interface with trust filtering.
- `DirectTransportAdapter.ts`: Implementation of the NearShare `TransportAdapter` interface.
