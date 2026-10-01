# NearShare — iOS/iPadOS Native Direct Mode API Feasibility & Boundaries

## 1. Executive Summary

NearShare Direct Mode requires an off-grid, zero-router, zero-internet peer-to-peer transport primitive operating within a 30-meter product/UX proximity boundary. On iOS and iPadOS (iOS 14 to iOS 18+), peer-to-peer connectivity is strictly governed by Apple sandbox policies and public SDK capabilities.

### Critical iOS Platform Boundaries:
1. **NO Arbitrary Wi-Fi Direct API**: iOS does **NOT** expose Wi-Fi Alliance Wi-Fi Direct (P2P Group) APIs. Third-party iOS apps cannot act as Wi-Fi Direct Group Owners or join Wi-Fi Direct groups programmatically.
2. **Supported Peer-to-Peer Framework**: Apple's supported off-grid peer-to-peer framework is **`MultipeerConnectivity`** and **`Network.framework`** with `NWParameters.includePeerToPeer = true`.
3. **Cross-Platform Local Network Join**: iOS can programmatically join a temporary device-hosted SoftAP (e.g. hosted by Android or Windows) using **`NetworkExtension.NEHotspotConfigurationManager`** upon user confirmation.

---

## 2. Technology Evaluation Matrix

| Criterion | MultipeerConnectivity | Network.framework (P2P) | NEHotspotConfigurationManager (SoftAP Join) | CoreBluetooth (BLE) |
| :--- | :--- | :--- | :--- | :--- |
| **API Availability** | iOS 7.0+ | iOS 12.0+ | iOS 11.0+ | iOS 5.0+ |
| **Router Required** | **NO** | **NO** | **NO** (Connects to peer SoftAP) | **NO** |
| **Internet Required** | **NO** | **NO** | **NO** | **NO** |
| **Discovery Mechanism** | `MCNearbyServiceBrowser` | `NWBrowser` (`.bonjour`) | Wi-Fi Scan / QR Code Parse | `CBCentralManager` |
| **Connection Primitive** | `MCSession` | `NWConnection` | Wi-Fi Profile Association | `CBPeripheral` / GATT |
| **Data Channel** | Bidirectional Byte Stream (`startStream`) | Bidirectional TCP/UDP Stream | Bidirectional TCP Socket | BLE GATT Packets |
| **Throughput Suitability** | High (15–45 MB/s via Wi-Fi/AWDL) | High (20–55 MB/s) | High (20–60 MB/s) | Extremely Low (< 0.1 MB/s) |
| **Large File Feasibility** | **YES** | **YES** | **YES** | **NO** |
| **Resume Feasibility** | **YES** (via chunk checkpoints) | **YES** | **YES** | **NO** |
| **Cross-Platform Interop** | iOS $\leftrightarrow$ iOS, iOS $\leftrightarrow$ macOS | Apple Ecosystem only | iOS $\leftrightarrow$ Android (SoftAP), iOS $\leftrightarrow$ Windows (SoftAP) | Universal (Discovery only) |

---

## 3. Permissions, Entitlements & Info.plist Requirements

### Info.plist Privacy Keys:
```xml
<key>NSLocalNetworkUsageDescription</key>
<string>NearShare discovers and securely transfers files to nearby Apple devices without internet.</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>NearShare uses Bluetooth to broadcast presence and establish fast peer-to-peer connections.</string>
<key>NSBonjourServices</key>
<array>
    <string>_nearshare-p2p._tcp</string>
    <string>_nearshare-p2p._udp</string>
</array>
```

### Background Execution Constraints:
- iOS suspends background applications after approximately 30 seconds unless configured with specific background tasks.
- If the app is sent to the background during a large transfer, socket connections will be terminated by iOS.
- **NearShare Mitigation**:
  1. Requests `beginBackgroundTask(withName:expirationHandler:)` to extend execution for up to 3 minutes to complete small files.
  2. Durable checkpoint architecture saves progress so transfer resumes instantly upon returning to the foreground.

---

## 4. Verification Status

| Milestone | Status | Validation Method |
| :--- | :--- | :--- |
| **API Architecture Specification** | `COMPLETE` | Documented in this specification |
| **TypeScript Native Bridge Contract** | `COMPLETE` | `src/core/native/ios/IOSDirectPeerBridge.ts` |
| **iOS Mobile Native Boundary** | `COMPLETE` | `docs/direct-mode-mobile-native-boundary.md` |
| **iOS Runtime Execution** | `NOT_VERIFIED` | Requires physical iOS device or Xcode iOS Simulator |
| **Physical Direct Transfer** | `NOT_VERIFIED` | Requires physical iOS hardware |
