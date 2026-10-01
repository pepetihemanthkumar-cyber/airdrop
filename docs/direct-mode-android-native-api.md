# NearShare — Android Native Direct Mode (Wi-Fi Direct & Wi-Fi Aware) API Feasibility

## 1. Executive Summary

NearShare Direct Mode requires an off-grid, zero-router, zero-internet peer-to-peer transport primitive that operates within a 30-meter product/UX proximity boundary. On Android (API 29+ / Android 10 to Android 15), there are two primary native peer-to-peer wireless technologies:
1. **Wi-Fi Direct (Wi-Fi P2P)** via `android.net.wifi.p2p.WifiP2pManager`
2. **Wi-Fi Aware (Neighbor Awareness Networking / NAN)** via `android.net.wifi.aware.WifiAwareManager`

This document analyzes both APIs, connection lifecycles, permissions, background constraints, and interoperability with other operating systems.

---

## 2. Distinction: Public Android APIs vs Hardware Capabilities

```
┌──────────────────────────────────────────────────────────────────┐
│                   NearShare Application Layer                   │
│   (ProtocolStateMachine, PairingManager, SecureTransportSession) │
├──────────────────────────────────────────────────────────────────┤
│                  Supported Public Android APIs                   │
│    • android.net.wifi.p2p.WifiP2pManager (Wi-Fi Direct)         │
│    • android.net.wifi.aware.WifiAwareManager (Wi-Fi Aware/NAN)   │
│    • java.net.Socket / java.net.ServerSocket                    │
│    • android.bluetooth.le.BluetoothLeScanner (Auxiliary BLE)    │
├──────────────────────────────────────────────────────────────────┤
│             Android System Services & Wi-Fi HAL                 │
│    • wpa_supplicant / wificond P2P daemon                        │
│    • Wi-Fi Direct Group Owner (GO) / P2P Client negotiation      │
│    • Virtual network interface provisioning (p2p0 / wlan1)       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Evaluation Matrix

| Criterion | Wi-Fi Direct (`WifiP2pManager`) | Wi-Fi Aware / NAN (`WifiAwareManager`) | Local-Only Hotspot (`WifiManager.startLocalOnlyHotspot`) | Bluetooth LE (GATT) |
| :--- | :--- | :--- | :--- | :--- |
| **API Availability** | Android 4.0+ (API 14+) | Android 8.0+ (API 26+) | Android 8.0+ (API 26+) | Android 5.0+ (API 21+) |
| **Hardware Dependency** | Universal on 99%+ of Android devices | Requires Wi-Fi chip NAN support (~35% of devices) | Universal on modern Android | Universal |
| **Router Required** | **NO** | **NO** | **NO** | **NO** |
| **Internet Required** | **NO** | **NO** | **NO** | **NO** |
| **Discovery Mechanism** | `discoverPeers()` / `discoverServices()` | `publish()` / `subscribe()` | Standard SSID Broadcast | `BluetoothLeScanner` |
| **Connection Primitive** | Group Owner Negotiation | `WifiAwareSession` + `ConnectivityManager` | Client connects via WPA2 passphrase | GATT Connection |
| **Data Channel** | Bidirectional TCP `Socket` over `192.168.49.1` | Bidirectional TCP `Socket` over IPv6 Link-Local | Bidirectional TCP `Socket` over DHCP IP | Tiny BLE GATT packets |
| **Throughput Suitability** | High (20–70 MB/s via 5GHz) | High (15–50 MB/s) | High (20–70 MB/s) | Extremely Low (< 0.1 MB/s) |
| **Large File Feasibility** | **YES** | **YES** | **YES** | **NO** |
| **Resume Feasibility** | **YES** (via chunk checkpoints) | **YES** | **YES** | **NO** |
| **Cross-Platform Interop** | Windows (WFD), Android (WFD) | Android $\leftrightarrow$ Android only | Any Wi-Fi Client (Windows, Mac, iOS) | Universal (Discovery only) |

---

## 4. Recommended Native Strategy for Android Direct Mode

### Primary Transport: `WifiP2pManager` (Wi-Fi Direct) with TCP Streaming Sockets
- Universal compatibility across Android devices.
- Group Owner negotiation provisions standard IPv4 socket endpoints (`192.168.49.1`).
- Interoperates with Windows WinRT Wi-Fi Direct natively.

### Cross-Platform Fallback: `WifiManager.startLocalOnlyHotspot` (Intermediary SoftAP)
- Used when connecting to Apple devices (macOS / iOS) which do not support Wi-Fi Direct client negotiation.
- Generates a local WPA2 SoftAP with QR code bootstrap; peer connects and establishes TCP streaming without internet.

---

## 5. Permissions & Android OS Requirements

### Android Manifest Permissions (`AndroidManifest.xml`):
```xml
<!-- Required for Wi-Fi Direct discovery and group creation -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.INTERNET" />

<!-- Optional auxiliary BLE discovery -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Foreground service persistence for active transfers -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Background Execution & Battery Optimization:
- Android kills background network tasks when an activity pauses unless a **Foreground Service** (`ForegroundServiceType.CONNECTED_DEVICE`) is active with a persistent notification.
- NearShare creates a Foreground Service while transfers are active and releases it immediately upon transfer completion or cancellation.

---

## 6. Verification Status

| Milestone | Status | Validation Method |
| :--- | :--- | :--- |
| **API Architecture Specification** | `COMPLETE` | Documented in this specification |
| **TypeScript Native Bridge Contract** | `COMPLETE` | `src/core/native/android/AndroidDirectPeerBridge.ts` |
| **Android Mobile Native Boundary** | `COMPLETE` | `docs/direct-mode-mobile-native-boundary.md` |
| **Android Runtime Execution** | `NOT_VERIFIED` | Requires Android physical device or Android Emulator |
| **Physical Wi-Fi Direct Transfer** | `NOT_VERIFIED` | Requires two physical devices |
