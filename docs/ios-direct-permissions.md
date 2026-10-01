# NearShare iOS Direct Permissions & Entitlements

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering

---

## 1. Required Info.plist Permissions

To operate MultipeerConnectivity on iOS 14.0+, the application bundle must declare explicit privacy usage descriptions in `Info.plist`:

### 1. Local Network Privacy Usage
```xml
<key>NSLocalNetworkUsageDescription</key>
<string>NearShare requires local network access to discover and securely transfer files directly to nearby Apple devices.</string>
```

### 2. Bonjour Service Declarations
MultipeerConnectivity uses Bonjour under the hood with 1-15 character service types:
```xml
<key>NSBonjourServices</key>
<array>
    <string>_nearshare-p2p._tcp</string>
    <string>_nearshare-p2p._udp</string>
</array>
```

---

## 2. Runtime Permission Prompts & Failure Modes

1. **First Discovery / Advertising Request**: iOS presents the standard system prompt: *"NearShare would like to find and connect to devices on your local network"*.
2. **User Granted**: Multipeer discovery proceeds normally; `MCNearbyServiceBrowser` finds peers.
3. **User Denied / Restricted**:
   - `startDiscovery()` or `startAdvertising()` triggers delegate failure.
   - Bridge emits `nativeError` event (`PERMISSION_DENIED` / `RESTRICTED`).
   - Capability status reports `restricted` / `requiresPermission`.
   - UI displays honest permission notice guiding user to iOS Settings > Privacy > Local Network.
   - No silent fallback to internet or cloud relays.

---

## 3. Bluetooth & Wi-Fi Invariants

- **Bluetooth**: Not required for Multipeer stream data transfer; no `NSBluetoothAlwaysUsageDescription` required.
- **Wi-Fi Radio**: Wi-Fi radio must be powered ON in iOS Control Center to enable Apple Wireless Direct Link (AWDL).
