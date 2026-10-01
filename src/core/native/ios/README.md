# NearShare iOS Native Direct Architecture

This directory defines the TypeScript native bridge boundary for iOS/iPadOS direct peer-to-peer operations.

## Architectural Principles

1. **Opaque Types**: iOS native framework object references (`MCSession`, `MCPeerID`, `NWConnection`, `NWBrowser`, `NWListener`) are strictly isolated inside the native layer and never exposed to React or higher-level TypeScript modules.
2. **Standard Interfaces**: Implements the platform-neutral `DirectDiscoveryProvider` interface and outputs domain `DirectPeer` records.
3. **Apple Peer-to-Peer Primitives**:
   - `supportsWifiDirect` is explicitly marked `unsupported` because Apple does not provide a public Wi-Fi Direct API on iOS.
   - `MultipeerConnectivity` and `Network.framework` (AWDL) provide the native ad-hoc peer transport.
4. **Honest Validation State**: `physicalValidation` is strictly `not_verified` in the desktop environment.
