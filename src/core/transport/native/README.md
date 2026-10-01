# NearShare Native Direct Transport Architecture (v1.0)

This document specifies the native direct and local-network transport architecture for NearShare across macOS, Windows, Android, and iOS.

---

## 1. Transport Architectural Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                   TransferQueue                        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  TransportManager                      │
│        (Unified Mode Dispatch & Session Controller)    │
└─────────────┬─────────────────────────────┬────────────┘
              │                             │
┌─────────────▼─────────────┐ ┌─────────────▼────────────┐
│ MockDirectNearbyTransport │ │   MockWiFiTransport      │
│  (Existing Simulation)    │ │   (Existing Simulation)  │
└─────────────┬─────────────┘ └─────────────┬────────────┘
              │                             │
┌─────────────▼─────────────────────────────▼────────────┐
│                NativeTransportManager                  │
│       (Platform Bridge Selection & Telemetry Sync)     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                NativeTransportBridge                   │
│           (Native Sockets & Radio Interface)           │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│           Host OS Radio & Network Subsystems           │
│   (macOS / Windows / Android / iOS Native Drivers)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. NearShare Mode Semantics

### Direct Mode
- **Zero Network Infrastructure Required**: Does not require an existing Wi-Fi router, access point, or internet connection.
- **Peer-to-Peer Radio Channels**: May establish ad-hoc Wi-Fi Direct, Wi-Fi Aware, or Multipeer links.
- **Product UX Boundary (~30m)**: 30 meters is a product design guideline for nearby proximity UX, not a guaranteed physical hardware limit. Actual range varies with obstacles and hardware.
- **Clarification**: Direct mode **never** means "turning Wi-Fi off". It utilizes Wi-Fi radios in peer-to-peer or SoftAP configurations.

### Wi-Fi Mode
- **Local Network / LAN**: Operates over an existing local area network (LAN/WLAN).
- **Internet Not Required**: All traffic remains local within the subnet.
- **No Distance Boundary**: Does not enforce the 30m direct proximity boundary.

---

## 3. Platform Transport Strategy Matrix

| Feature | macOS | Windows | Android | iOS |
| :--- | :--- | :--- | :--- | :--- |
| **Direct P2P Candidate** | `MultipeerConnectivity` / Apple P2P | Wi-Fi Direct (`Windows.Devices.WiFiDirect`) | Wi-Fi Direct (`WifiP2pManager`) / Nearby Connections | `MultipeerConnectivity` |
| **Wi-Fi Discovery** | `NWBrowser` / Bonjour | mDNS (`Windows.Networking.Sockets`) | Android `NsdManager` (mDNS) | `NWBrowser` (Bonjour) |
| **Bluetooth Role** | Proximity / BLE Beaconing | BLE Advertisement | BLE Advertiser / Scanner | CoreBluetooth Peripheral / Central |
| **Background Transfer** | Background URLSession / Process daemon | Background task host | Foreground Service (Notification required) | Background URLSession / Multipeer background mode |
| **Required Permissions** | Local Network, Bluetooth | Local Network, Bluetooth | Nearby Devices (`BLUETOOTH_SCAN`), Location | Local Network, Bluetooth |

---

## 4. Why Bluetooth is NOT the Primary Large-File Transport

Bluetooth Low Energy (BLE) operates at physical data rates of ~1–2 Mbps (practical throughput < 100 KB/s). 
- In NearShare, Bluetooth is strictly an **auxiliary discovery channel** for exchanging device beacons, pairing PINs, and bootstrapping high-speed Wi-Fi Direct / LAN connections.
- All high-speed file chunk payloads stream over Direct Wi-Fi or LAN TCP/QUIC streams (30–90+ MB/s).

---

## 5. Why No Single Universal Direct Technology Exists

No single native API functions identically across all 4 platforms:
- Apple's `MultipeerConnectivity` does not run on Windows or Android.
- Android's `WifiP2pManager` (Wi-Fi Direct) does not communicate directly with iOS without SoftAP or cross-platform bridges.
- Therefore, NearShare uses a **shared protocol envelope and state machine**, while the underlying `NativeTransportBridge` adapts to the respective native OS channel.
