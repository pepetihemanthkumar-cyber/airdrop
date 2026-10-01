# NearShare Direct Mode — Android Architecture Specification (Step 55)

## 1. Native Android Direct Architecture

Android provides two primary peer-to-peer wireless stacks:

### A. Wi-Fi Direct (`android.net.wifi.p2p`)
1. **Discovery**: `WifiP2pManager.discoverPeers(channel, actionListener)` broadcasts probe requests and scans beacon responses.
2. **Connection**: `WifiP2pManager.connect(channel, config, actionListener)` initiates Wi-Fi Direct P2P Group negotiation.
3. **Socket Channel**: Once connected, the Group Owner (GO) IP is retrieved via `WifiP2pInfo.groupOwnerAddress`. A Java `ServerSocket` / `Socket` or Rust Tokio socket streams NearShare frames.

### B. Wi-Fi Aware / Neighbor Awareness Networking (`android.net.wifi.aware`)
- Supported on Android 8.0+ hardware with Wi-Fi Aware certified chipsets.
- Enables discovery and small data exchanges without forming a full P2P group, reducing battery draw during passive discovery.

### C. Auxiliary BLE Discovery
- `BluetoothLeScanner` and `BluetoothLeAdvertiser` broadcast 16-byte NearShare presence beacons containing the device profile hash and Direct Mode readiness flags.

---

## 2. Android Permissions (`AndroidManifest.xml`)

```xml
<!-- Android 13+ (API 33+) Nearby Wi-Fi & Bluetooth Permissions -->
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Legacy Location for Wi-Fi scanning on Android 12 and below -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Foreground Service for large transfers -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

---

## 3. Background Limitations & Lifecycles

- **Foreground Service Requirement**: Android Doze and app standby kill background sockets within minutes unless an active `ForegroundService` with notification channel and `dataSync` foreground service type is maintained.
- **Durable Checkpointing**: If the OS terminates the activity during background transfer, NearShare's persistent checkpoint log (`TransferSessionRecoveryManager`) allows the user to resume seamlessly upon reopening.

---

## 4. Verification Status
- **Architecture**: `COMPLETE`
- **Android Physical Direct Radio**: `NOT VERIFIED` (Physical Android device unavailable in current macOS build session).
