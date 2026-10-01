# NearShare Direct Mode — Windows Architecture & Native Bridge Specification (Step 57)

## 1. Native Windows Wi-Fi Direct Architecture

Windows 10 and 11 provide native peer-to-peer radio support via the **Windows Runtime (WinRT)** Wi-Fi Direct APIs and `Windows.Networking.Sockets`:

### 1. Discovery & Advertisement
- **Publisher**: `Windows.Devices.WiFiDirect.WiFiDirectAdvertisementPublisher` advertises the NearShare service name (`nearshare-p2p`) and custom IE (Information Element) metadata.
- **Watcher**: `Windows.Devices.Enumeration.DeviceInformation.CreateWatcher(WiFiDirectDevice.GetDeviceSelector())` scans for nearby Wi-Fi Direct beacons.

### 2. Peer Link Negotiation
- When a user selects a discovered device, the native Windows driver invokes `WiFiDirectDevice.FromIdAsync(deviceId)`.
- The two Wi-Fi adapters negotiate Group Owner (GO) status using WPS (Wi-Fi Protected Setup) Push Button or PIN configuration.
- A virtual network adapter (e.g. `Wi-Fi Direct Virtual Adapter`) is dynamically created with an assigned link-local IPv4 subnet (typically `192.168.137.x` or `192.168.49.x`).

### 3. Socket Data Channel
- Standard Tokio / Winsock TCP streams bind to the Wi-Fi Direct interface endpoint:
  ```rust
  // Native Rust / WinRT integration via windows-rs (guarded by #[cfg(target_os = "windows")])
  use windows::Devices::WiFiDirect::*;
  use windows::Networking::Sockets::*;
  ```
- NearShare binary protocol frames stream identically over this TCP socket.

---

## 2. Windows Manifest Capabilities & Firewall Rules

### `Package.appxmanifest` / MSIX Configuration
```xml
<Capabilities>
    <Capability Name="privateNetworkClientServer" />
    <Capability Name="internetClientServer" />
    <DeviceCapability Name="wiFiDirect" />
    <DeviceCapability Name="bluetooth" />
</Capabilities>
```

### Windows Defender Firewall Configuration
- NearShare registers inbound and outbound firewall rule exceptions for TCP port ranges during NSIS/MSIX installation.

---

## 3. Implementation Status Boundary (Step 57)

| Layer / Component | Step 57 Status | Notes |
| :--- | :--- | :--- |
| **API Boundary Research** | `ARCHITECTURE COMPLETE` | `docs/direct-mode-windows-native-api.md` |
| **Permissions & Firewall** | `COMPLETE` | `docs/direct-mode-windows-permissions.md` |
| **TypeScript Native Bridge** | `NATIVE BRIDGE CONTRACT COMPLETE` | `src/core/native/windows/WindowsDirectPeerBridge.ts` |
| **Tauri Rust Native Interface** | `IMPLEMENTED` | `src-tauri/src/windows_direct.rs` (guarded by `#[cfg(target_os = "windows")]`) |
| **Dev Diagnostics Inspector** | `IMPLEMENTED` | `src/components/DirectModeInspector.tsx` (Windows tab support) |
| **Local Runtime Tests** | `LOCAL RUNTIME VERIFIED` | 454/454 deterministic tests passing |
| **Windows Native Runtime Execution** | `NOT_VERIFIED (NOT AVAILABLE ON MACOS)` | Requires Windows 10/11 physical runner |
| **Physical Wi-Fi Direct Transfer** | `NOT_VERIFIED` | Requires physical Windows devices |
