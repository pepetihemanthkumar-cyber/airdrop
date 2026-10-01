# NearShare Direct Mode — macOS Feasibility & Native Spike Specification (Step 56)

## 1. Native API Architecture on macOS

On macOS, true off-grid Direct Mode (peer-to-peer without an existing Wi-Fi router or internet) operates over Apple's peer-to-peer wireless subsystem via supported public Apple APIs:

### Primary Candidate: `MultipeerConnectivity` Framework
```swift
import MultipeerConnectivity

let peerId = MCPeerID(displayName: "NS-MAC-STUDIO-01")
let session = MCSession(peer: peerId, securityIdentity: nil, encryptionPreference: .none)
let advertiser = MCNearbyServiceAdvertiser(peer: peerId, discoveryInfo: nil, serviceType: "nearshare-p2p")
let browser = MCNearbyServiceBrowser(peer: peerId, serviceType: "nearshare-p2p")

// Establishing bidirectional byte stream
let outputStream = try session.startStream(withName: "NearShareChannel", toPeer: targetPeer)
```

### Secondary Candidate: `Network.framework` Peer-to-Peer
```swift
import Network

let tcpOptions = NWProtocolTCP.Options()
let params = NWParameters(tls: nil, tcp: tcpOptions)
params.includePeerToPeer = true // Enables AWDL radio routing without infrastructure Wi-Fi

let listener = try NWListener(using: params)
listener.service = NWListener.Service(name: "NearShare-Host", type: "_nearshare-p2p._tcp")
listener.start(queue: .main)
```

---

## 2. Entitlements & Permissions Required

### macOS App Sandbox Entitlements (`NearShare.entitlements`)
```xml
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
<key>com.apple.security.device.bluetooth</key>
<true/>
```

### Info.plist Privacy Descriptions
```xml
<key>NSLocalNetworkUsageDescription</key>
<string>NearShare discovers and connects to nearby devices without requiring an external internet connection.</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>NearShare uses Bluetooth Low Energy to broadcast presence and establish fast peer-to-peer transfers.</string>
<key>NSBonjourServices</key>
<array>
    <string>_nearshare-p2p._tcp</string>
    <string>_nearshare-p2p._udp</string>
</array>
```

---

## 3. Implementation Status Boundary

| Layer / Component | Step 56 Status | Notes |
| :--- | :--- | :--- |
| **API Boundary Research** | `ARCHITECTURE COMPLETE` | `docs/direct-mode-macos-native-api.md` |
| **TypeScript Native Bridge** | `NATIVE BRIDGE IMPLEMENTED` | `src/core/native/macos/MacOSDirectPeerBridge.ts` |
| **Tauri Rust IPC Layer** | `NATIVE BRIDGE IMPLEMENTED` | `src-tauri/src/macos_direct.rs` |
| **Dev Diagnostics Inspector** | `IMPLEMENTED` | `src/components/DirectModeInspector.tsx` |
| **Local Runtime Tests** | `LOCAL RUNTIME VERIFIED` | 442/442 deterministic tests passing |
| **Physical Two-Mac Direct Test** | `NOT_VERIFIED` | Requires two physical Macs tested under off-grid conditions |

---

## 4. Exact Physical Testing Procedure

When a second physical Mac becomes available, follow [`docs/direct-mode-macos-physical-test.md`](file:///Users/pepetihemanthkumar/Documents/SYNTRA/docs/direct-mode-macos-physical-test.md) for the complete 10-gate physical verification protocol.
