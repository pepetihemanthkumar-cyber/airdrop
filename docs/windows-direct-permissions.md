# NearShare Windows Direct Capabilities & Permissions Audit

## Overview
This document specifies the exact Windows capabilities, manifest declarations, and operating system permissions required for Wi-Fi Direct and native socket streaming in NearShare desktop builds.

---

## 1. Windows Capabilities Matrix

| Capability | Name | Scope / App Model | Required for NearShare | Status |
|:---|:---|:---|:---:|:---:|
| **Wi-Fi Direct Device Access** | `wiFiControl` / `wiFiDirect` | Package AppX / MSIX Manifest | YES (for WinRT Wi-Fi Direct) | `CONFIGURED` |
| **Private Networks (Client & Server)** | `privateNetworkClientServer` | Inbound socket connections | YES (for StreamSocketListener) | `CONFIGURED` |
| **Internet (Client & Server)** | `internetClientServer` | Outbound socket connections | YES (for StreamSocket client) | `CONFIGURED` |
| **Location / Proximity** | `proximity` | NFC / Bluetooth tap bootstrap | OPTIONAL (Future bootstrap) | `NOT_REQUESTED` |
| **Unrestricted Filesystem** | `broadFileSystemAccess` | Broad file system access | NO (NearShare uses explicit picker) | `EXCLUDED` |

---

## 2. Desktop Packaging Models

### A. Packaged Application (MSIX / AppX)
- Requires `<DeviceCapability Name="wiFiControl" />` and `<Capability Name="privateNetworkClientServer" />` in `AppxManifest.xml`.
- Sandboxed storage with access to picked folders via Windows File Open/Save Pickers.

### B. Unpackaged Win32 / NSIS Desktop Installer (Current Default)
- Uses standard Win32 / WinRT desktop bridge permissions.
- Windows Defender Firewall prompts user on first launch for inbound socket binding on `nearshare-p2p` (TCP port).
- Wi-Fi Direct requires a physical Wi-Fi network interface supporting Wi-Fi Direct (Virtual Wi-Fi Adapter / NDIS 6.30+).

---

## 3. Wi-Fi Radio Requirements
- **Wi-Fi Radio Power**: Must remain ON (`requiresWiFiRadioOn: true`).
- **No Existing AP Required**: Does NOT require connection to an existing wireless access point or router (`requiresRouter: false`).
- **Zero Internet Access**: Does NOT require internet connectivity (`requiresInternet: false`).
- **Radio Preservation**: NearShare NEVER alters system Wi-Fi connection states or disables the user's active Wi-Fi radio.
