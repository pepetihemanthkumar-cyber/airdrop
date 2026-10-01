# NearShare Android Direct Mode Interoperability Analysis

## Overview
This document evaluates direct off-grid interoperability between Android (`android.net.wifi.p2p.WifiP2pManager`) and other operating systems.

---

## 1. Physical Layer & Radio Protocols

| Platform | Native Radio Technology | Link Layer Protocol | Service Discovery |
|:---|:---|:---|:---|
| **Android** | Wi-Fi Direct (P2P) / Wi-Fi Aware | 802.11 Wi-Fi Direct SoftAP / GO | DNS-SD over Wi-Fi P2P |
| **Windows** | Wi-Fi Direct (P2P Wi-Fi Alliance) | 802.11 Wi-Fi Direct SoftAP / GO | Wi-Fi Direct Information Elements |
| **macOS / iOS** | Apple Wireless Direct Link (AWDL) | Apple Multipeer P2P framing | Bonjour / DNS-SD over AWDL |

---

## 2. Cross-Platform Off-Grid Direct Interoperability Status

### Android ↔ Windows Direct Mode
- **Status**: `POTENTIALLY_COMPATIBLE_P2P_LINK (EXPERIMENTAL)`
- Both platforms implement the standard Wi-Fi Alliance Wi-Fi Direct specification (Autonomous Group Owner negotiation and DHCP link-local subnetting).
- However, physical interoperability must be validated on physical hardware before claiming verified support.

### Android ↔ Apple (macOS / iOS) Direct Mode
- **Status**: `UNSUPPORTED_DIRECT_RADIO`
- Apple devices use proprietary AWDL frames on channel 6/44/149; Android standard Wi-Fi Direct cannot negotiate an AWDL session.
- Cross-platform transfers require standard **⚡ LAN Mode** or **⚡ Hotspot Mode** (SoftAP).
- NearShare **never** executes a silent fallback from Direct to LAN.

---

## 3. Platform Direct Support Matrix

| Source \ Target | macOS | Windows | Android | iOS |
|:---|:---:|:---:|:---:|:---:|
| **macOS** | **REAL NATIVE (Multipeer)** | `REQUIRES_LAN_OR_HOTSPOT` | `REQUIRES_LAN_OR_HOTSPOT` | **REAL NATIVE (Multipeer)** |
| **Windows** | `REQUIRES_LAN_OR_HOTSPOT` | **REAL NATIVE (Wi-Fi Direct)** | `P2P COMPATIBLE (Unverified)` | `REQUIRES_LAN_OR_HOTSPOT` |
| **Android** | `REQUIRES_LAN_OR_HOTSPOT` | `P2P COMPATIBLE (Unverified)` | **REAL NATIVE (Wi-Fi Direct)** | `REQUIRES_LAN_OR_HOTSPOT` |
| **iOS** | **REAL NATIVE (Multipeer)** | `REQUIRES_LAN_OR_HOTSPOT` | `REQUIRES_LAN_OR_HOTSPOT` | **REAL NATIVE (Multipeer)** |
