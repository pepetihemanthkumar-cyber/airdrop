# NearShare Direct Mode — iOS / iPadOS Architecture Specification (Step 55)

## 1. Native iOS Direct Architecture

iOS and iPadOS operate under sandboxed execution constraints. Direct Mode utilizes Apple Wireless Direct Link (AWDL) and Bluetooth Low Energy via:

### A. `MultipeerConnectivity` Framework
```swift
import MultipeerConnectivity

class NearShareDirectSession: NSObject, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    let peerId = MCPeerID(displayName: UIDevice.current.name)
    var session: MCSession!
    var advertiser: MCNearbyServiceAdvertiser!
    var browser: MCNearbyServiceBrowser!
    
    func start() {
        session = MCSession(peer: peerId, securityIdentity: nil, encryptionPreference: .none)
        session.delegate = self
        
        advertiser = MCNearbyServiceAdvertiser(peer: peerId, discoveryInfo: ["mode": "direct"], serviceType: "nearshare-p2p")
        advertiser.delegate = self
        advertiser.startAdvertisingPeer()
        
        browser = MCNearbyServiceBrowser(peer: peerId, serviceType: "nearshare-p2p")
        browser.delegate = self
        browser.startBrowsingForPeers()
    }
}
```

### B. `Network.framework` Peer-to-Peer (`NWListener` / `NWConnection`)
- Setting `NWParameters.includePeerToPeer = true` allows standard TCP/UDP protocol frames to route over AWDL peer links without joining an external access point.

---

## 2. iOS Privacy & Permissions (`Info.plist`)

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>NearShare discovers nearby Apple and cross-platform devices for direct off-grid file transfers.</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>NearShare broadcasts discovery beacons to pair with nearby devices.</string>
<key>NSBonjourServices</key>
<array>
    <string>_nearshare-p2p._tcp</string>
    <string>_nearshare-p2p._udp</string>
</array>
```

---

## 3. iOS Background Transfer Constraints & Mitigation

1. **Background Socket Suspension**: iOS will freeze network sockets approximately 30 seconds after the user switches apps or locks the screen.
2. **Mitigation Strategy**:
   - `BGProcessingTaskRequest` / `BGAppRefreshTask` triggers resumption windows.
   - For multi-gigabyte transfers, the NearShare UI explicitly instructs users: *"Keep NearShare in the foreground for uninterrupted high-speed direct transfer."*
   - Durable checkpoints ensure that if the app is suspended, transfers resume exactly from the last acknowledged chunk index upon returning to the foreground.

---

## 4. Verification Status
- **Architecture**: `COMPLETE`
- **iOS Physical Direct Radio**: `NOT VERIFIED` (Physical iOS device unavailable in current macOS build session).
