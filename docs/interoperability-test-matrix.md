# NearShare Cross-Platform Interoperability Test Matrix

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering

---

## 1. 20-Pair Complete Cross-Platform Matrix

| Pair ID | Platform A | Platform B | Mode | Radio Compatibility | Physical Status | Blocker / Hardware Requirement |
|---|---|---|---|---|---|---|
| `INTEROP-MAC-MAC-DIRECT` | macOS | macOS | ⚡ Direct | `NATIVE_COMPATIBLE` | `BLOCKED` | 2x Physical Macs in wireless range |
| `INTEROP-MAC-MAC-LAN` | macOS | macOS | 📶 Wi-Fi | `NATIVE_COMPATIBLE` | `BLOCKED` | 2x Physical Macs on shared local subnet |
| `INTEROP-MAC-WIN-DIRECT` | macOS | Windows | ⚡ Direct | `RADIO_INCOMPATIBLE` | `NOT_AVAILABLE` | AWDL vs Wi-Fi Direct incompatible |
| `INTEROP-MAC-WIN-LAN` | macOS | Windows | 📶 Wi-Fi | `RADIO_INCOMPATIBLE` | `BLOCKED` | 1x Mac + 1x Windows PC on shared LAN |
| `INTEROP-MAC-AND-DIRECT` | macOS | Android | ⚡ Direct | `RADIO_INCOMPATIBLE` | `NOT_AVAILABLE` | AWDL vs Wi-Fi P2P incompatible |
| `INTEROP-MAC-AND-LAN` | macOS | Android | 📶 Wi-Fi | `RADIO_INCOMPATIBLE` | `BLOCKED` | 1x Mac + 1x Android Phone on shared LAN |
| `INTEROP-MAC-IOS-DIRECT` | macOS | iOS | ⚡ Direct | `NATIVE_COMPATIBLE` | `BLOCKED` | 1x Mac + 1x iPhone (Multipeer testbed) |
| `INTEROP-MAC-IOS-LAN` | macOS | iOS | 📶 Wi-Fi | `NATIVE_COMPATIBLE` | `BLOCKED` | 1x Mac + 1x iPhone on shared LAN |
| `INTEROP-WIN-WIN-DIRECT` | Windows | Windows | ⚡ Direct | `STANDARDIZED_WIFI_DIRECT` | `BLOCKED` | 2x Windows 10/11 PCs with Wi-Fi Direct |
| `INTEROP-WIN-WIN-LAN` | Windows | Windows | 📶 Wi-Fi | `STANDARDIZED_WIFI_DIRECT` | `BLOCKED` | 2x Windows PCs on shared LAN |
| `INTEROP-WIN-AND-DIRECT` | Windows | Android | ⚡ Direct | `STANDARDIZED_WIFI_DIRECT` | `BLOCKED` | 1x Windows PC + 1x Android Phone |
| `INTEROP-WIN-AND-LAN` | Windows | Android | 📶 Wi-Fi | `STANDARDIZED_WIFI_DIRECT` | `BLOCKED` | 1x Windows PC + 1x Android Phone on LAN |
| `INTEROP-WIN-IOS-DIRECT` | Windows | iOS | ⚡ Direct | `RADIO_INCOMPATIBLE` | `NOT_AVAILABLE` | Wi-Fi Direct vs AWDL incompatible |
| `INTEROP-WIN-IOS-LAN` | Windows | iOS | 📶 Wi-Fi | `RADIO_INCOMPATIBLE` | `BLOCKED` | 1x Windows PC + 1x iPhone on LAN |
| `INTEROP-AND-AND-DIRECT` | Android | Android | ⚡ Direct | `STANDARDIZED_WIFI_DIRECT` | `BLOCKED` | 2x Android 12+ Phones |
| `INTEROP-AND-AND-LAN` | Android | Android | 📶 Wi-Fi | `STANDARDIZED_WIFI_DIRECT` | `BLOCKED` | 2x Android Phones on LAN |
| `INTEROP-AND-IOS-DIRECT` | Android | iOS | ⚡ Direct | `RADIO_INCOMPATIBLE` | `NOT_AVAILABLE` | Wi-Fi P2P vs Multipeer incompatible |
| `INTEROP-AND-IOS-LAN` | Android | iOS | 📶 Wi-Fi | `RADIO_INCOMPATIBLE` | `BLOCKED` | 1x Android + 1x iPhone on LAN |
| `INTEROP-IOS-IOS-DIRECT` | iOS | iOS | ⚡ Direct | `NATIVE_COMPATIBLE` | `BLOCKED` | 2x Physical iPhones in range |
| `INTEROP-IOS-IOS-LAN` | iOS | iOS | 📶 Wi-Fi | `NATIVE_COMPATIBLE` | `BLOCKED` | 2x Physical iPhones on shared LAN |
