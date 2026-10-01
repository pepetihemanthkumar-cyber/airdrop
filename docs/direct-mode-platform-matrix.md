# NearShare Direct Mode — Platform Capabilities Matrix (Step 55)

## 1. Matrix Overview

| Platform | Candidate Discovery | Candidate Link / Transport | Native APIs | Permissions Required | Arbitrary TCP/UDP Exposed? | Advertise / Host | Discover / Scan | Bidirectional Data Channel | Large File Practicability | Resume Practicability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **macOS** | BLE, Multipeer, Bonjour (P2P) | Apple Wireless Direct Link (AWDL), Multipeer Stream, Native TCP Socket | `MultipeerConnectivity`, `Network.framework` (`NWListener`/`NWConnection`), `CoreBluetooth` | Local Network (`NSLocalNetworkUsageDescription`), Bluetooth (`NSBluetoothAlwaysUsageDescription`) | **Yes** via `Network.framework` P2P or Multipeer Stream | **Yes** (MCNearbyServiceAdvertiser / NWListener) | **Yes** (MCNearbyServiceBrowser / NWBrowser) | **Yes** (Stream / Socket) | **Excellent** (30–60 MB/s typical AWDL) | **Yes** (Durable checkpointing) |
| **Windows** | BLE Advertisement, Wi-Fi Direct Beacon | Wi-Fi Direct, Wi-Fi Direct Services (WFDS), SoftAP + TCP Socket | `Windows.Devices.WiFiDirect`, `Windows.Networking.Sockets`, `WinRT BluetoothLEAdvertisement` | Wi-Fi adapter control, Windows Firewall exception, Location/Radio permissions | **Yes** via `StreamSocket` over Wi-Fi Direct IP layer | **Yes** (WiFiDirectAdvertisementPublisher) | **Yes** (WiFiDirectDevice / DeviceWatcher) | **Yes** (StreamSocket TCP) | **Excellent** (25–50 MB/s Wi-Fi Direct) | **Yes** (Durable checkpointing) |
| **Android** | BLE, Wi-Fi Direct Discovery, Wi-Fi Aware (NAN) | Wi-Fi Direct (P2P Group Owner / Client), Wi-Fi Aware Data Path, Local Hotspot | `android.net.wifi.p2p.WifiP2pManager`, `android.net.wifi.aware.WifiAwareManager`, Java `ServerSocket`/`Socket` | `NEARBY_WIFI_DEVICES`, `ACCESS_FINE_LOCATION`, `BLUETOOTH_SCAN`/`ADVERTISE` | **Yes** (Standard Java/Kotlin TCP sockets over P2P Group) | **Yes** (P2P Group Owner / Aware Publisher) | **Yes** (P2P Discovery / Aware Subscriber) | **Yes** (Standard TCP Socket) | **Excellent** (30–70 MB/s Wi-Fi Direct) | **Yes** (Durable checkpointing) |
| **iOS / iPadOS** | BLE, Multipeer Discovery, Bonjour P2P | MultipeerConnectivity, `Network.framework` (Peer-to-Peer Wi-Fi) | `MultipeerConnectivity`, `Network.framework` (`NWListener`/`NWConnection` with `.includePeerToPeer`) | `NSLocalNetworkUsageDescription`, `NSBluetoothAlwaysUsageDescription`, `NSBonjourServices` | **Yes** via `NWConnection` P2P or `MCSession.startStream` | **Yes** (Advertiser) | **Yes** (Browser) | **Yes** (Stream / NWConnection) | **Good** (Subject to foreground suspension) | **Yes** (Subject to background session time) |

---

## 2. Deep Platform Analysis

### macOS (Apple Silicon & Intel)
1. **Discovery**: `CoreBluetooth` handles low-power background presence; `MultipeerConnectivity` (`MCNearbyServiceAdvertiser`/`Browser`) or `NWBrowser` (`.includePeerToPeer = true`) discovers nearby Macs and iOS devices over AWDL without an external router.
2. **Transport**: `Network.framework` exposes native TCP listeners over peer-to-peer interfaces, allowing direct byte streaming into the NearShare `ProtocolStateMachine`.
3. **Background Behavior**: Desktop app continues running uninterrupted in system tray / background.
4. **Interoperability**: Native AWDL interoperates seamlessly with other Apple devices (macOS $\leftrightarrow$ macOS, macOS $\leftrightarrow$ iOS). Connecting to Windows or Android requires SoftAP / Wi-Fi Direct bridging.

### Windows (10/11)
1. **Discovery**: Windows Wi-Fi Direct Advertisement (`WiFiDirectAdvertisementPublisher`) broadcasts pairing beacons; WinRT BLE advertisements support auxiliary bootstrapping.
2. **Transport**: Wi-Fi Direct negotiates a Group Owner and assigns link-local IPv4 addresses (192.168.49.x), over which standard Tokio async TCP sockets operate.
3. **Background Behavior**: Windows Desktop background execution supported via system tray and background task tokens.
4. **Interoperability**: Windows Wi-Fi Direct adheres to Wi-Fi Alliance P2P standards, enabling native interop with Android Wi-Fi Direct. macOS interop requires bridging.

### Android (API 29+)
1. **Discovery**: `WifiP2pManager.discoverPeers()` discovers Wi-Fi Direct candidates; Wi-Fi Aware (NAN) provides zero-connection discovery on supported hardware.
2. **Transport**: Android establishes a P2P Group where one device becomes Group Owner (GO). Standard TCP socket connections transfer NearShare frames.
3. **Background Behavior**: Foreground Service with `dataSync` type is required to prevent OS killing during large transfers.
4. **Interoperability**: Native interop with Windows Wi-Fi Direct and other Android devices.

### iOS / iPadOS
1. **Discovery**: `MultipeerConnectivity` or `NWBrowser` discovers Apple peers over AWDL/Bluetooth.
2. **Transport**: `MCSession.startStream()` or `NWConnection` provides bidirectional streams.
3. **Background Limitations**: iOS suspends background sockets within ~30 seconds unless a background audio, VoIP, or location entitlement is granted. Transfers must utilize `BGProcessingTask` or require app in foreground.
4. **Interoperability**: Interoperates with macOS and iOS. Cross-vendor to Windows/Android requires SoftAP hotspot connection.
