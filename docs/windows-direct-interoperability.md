# NearShare Cross-Platform Direct Mode Interoperability Analysis

## Overview
This document evaluates direct off-grid interoperability between Apple macOS / iOS (`MultipeerConnectivity` / `NWListener` / AWDL) and Microsoft Windows (`WiFiDirectAdvertisementPublisher` / Wi-Fi Direct).

---

## 1. Physical Layer & Radio Protocols

| Platform | Native Radio Technology | Link Layer Protocol | Service Discovery |
|:---|:---|:---|:---|
| **macOS / iOS** | Apple Wireless Direct Link (AWDL) / Wi-Fi Direct | Apple Multipeer P2P framing | Bonjour / DNS-SD over AWDL |
| **Windows** | Wi-Fi Direct (P2P Wi-Fi Alliance) | 802.11 Wi-Fi Direct SoftAP / GO | Wi-Fi Direct Information Elements |

---

## 2. Cross-Platform Off-Grid Direct Interoperability Status

### macOS ↔ Windows Direct Mode
- **Status**: `UNSUPPORTED_DIRECT_RADIO`
- **Technical Explanation**:
  - Apple `MultipeerConnectivity` operates strictly across Apple silicon / macOS / iOS radios over proprietary AWDL protocol frames.
  - Microsoft Windows `Windows.Devices.WiFiDirect` uses Wi-Fi Alliance P2P Group Owner negotiation.
  - A Mac cannot directly join a Windows Wi-Fi Direct P2P Group without custom low-level Wi-Fi driver reconfiguration or operating in standard infrastructure Wi-Fi / Hotspot mode.
- **NearShare Policy**:
  - NearShare **never** fakes cross-platform Direct transfer.
  - Cross-platform file transfers between macOS and Windows are performed via **⚡ LAN Mode** (when both devices share a local subnet) or **⚡ Hotspot Mode** (where one device hosts a standard Wi-Fi SoftAP).
  - No silent fallback from Direct to LAN is ever executed.

---

## 3. Platform Direct Support Matrix

| Source \ Target | macOS | Windows | Android (Future) | iOS |
|:---|:---:|:---:|:---:|:---:|
| **macOS** | **REAL NATIVE (Multipeer)** | `REQUIRES_LAN_OR_HOTSPOT` | `REQUIRES_LAN_OR_HOTSPOT` | **REAL NATIVE (Multipeer)** |
| **Windows** | `REQUIRES_LAN_OR_HOTSPOT` | **REAL NATIVE (Wi-Fi Direct)** | `P2P COMPATIBLE (Future)` | `REQUIRES_LAN_OR_HOTSPOT` |
| **Android** | `REQUIRES_LAN_OR_HOTSPOT` | `P2P COMPATIBLE (Future)` | **Wi-Fi Direct P2P** | `REQUIRES_LAN_OR_HOTSPOT` |
| **iOS** | **REAL NATIVE (Multipeer)** | `REQUIRES_LAN_OR_HOTSPOT` | `REQUIRES_LAN_OR_HOTSPOT` | **REAL NATIVE (Multipeer)** |
