# NearShare iOS Direct Cross-Platform Interoperability Matrix

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering

---

## 1. Direct Radio Layer Compatibility Matrix

| Source Platform | Target Platform | Direct Radio Technology | Interoperability Status | Notes |
|---|---|---|---|---|
| **iOS** | **iOS** | MultipeerConnectivity / AWDL | **COMPATIBLE (Native)** | Uses Apple Multipeer framework |
| **iOS** | **macOS** | MultipeerConnectivity / AWDL | **COMPATIBLE (Native Apple)** | Both macOS and iOS support MultipeerConnectivity |
| **iOS** | **Windows** | Multipeer vs Wi-Fi Direct (WinRT) | **INCOMPATIBLE (Direct Radio)** | Apple AWDL cannot pair directly with standard Windows Wi-Fi Direct |
| **iOS** | **Android** | Multipeer vs Wi-Fi Direct (P2P-GO) | **INCOMPATIBLE (Direct Radio)** | Apple Multipeer is proprietary; Android uses Wi-Fi P2P |

---

## 2. Cross-Ecosystem Fallback Strategy

When transferring between heterogeneous platforms (e.g. **iOS ↔ Android** or **iOS ↔ Windows**):
1. **No Silent Mode Switching**: NearShare NEVER silently falls back without user intent.
2. **Local Network (Wi-Fi Mode)**: The user explicitly selects Local Network Mode (using standard UDP Multicast discovery and TCP stream transfer over the shared router or mobile hotspot).
3. **Web Portal Mode**: Alternatively, NearShare Web Portal mode can be engaged without requiring client installations on the recipient device.
