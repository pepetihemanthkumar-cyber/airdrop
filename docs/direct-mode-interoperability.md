# NearShare Direct Mode — Cross-Platform Interoperability Matrix (Step 57)

## 1. Platform Pair Interoperability Classification

| Platform Pair | Direct Mode Classification | Primary Direct Transport Primitive | Bootstrap / Discovery Primitive | Physical Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **macOS ↔ macOS** | **POSSIBLE WITH NATIVE BRIDGE** | Apple Wireless Direct Link (AWDL) / Multipeer / `NWConnection` P2P | Multipeer Discovery / BLE | `NOT VERIFIED` (Bridge implemented) |
| **macOS ↔ iOS** | **POSSIBLE WITH NATIVE BRIDGE** | AWDL / MultipeerConnectivity Stream | Multipeer Discovery / BLE | `NOT VERIFIED` |
| **iOS ↔ iOS** | **POSSIBLE WITH NATIVE BRIDGE** | AWDL / MultipeerConnectivity Stream | Multipeer Discovery / BLE | `NOT VERIFIED` |
| **Windows ↔ Windows** | **POSSIBLE WITH NATIVE BRIDGE** | Wi-Fi Direct (P2P Group + TCP Socket via WinRT) | Wi-Fi Direct Beacon / BLE | `NOT VERIFIED` (Bridge contract implemented) |
| **Windows ↔ Android** | **POSSIBLE WITH NATIVE BRIDGE** | Wi-Fi Alliance Wi-Fi Direct (P2P Group + TCP Socket) | Wi-Fi Direct Beacon / BLE / QR | `NOT VERIFIED` |
| **Android ↔ Android** | **POSSIBLE WITH NATIVE BRIDGE** | Wi-Fi Direct / Wi-Fi Aware (NAN Socket) | Wi-Fi Direct / Wi-Fi Aware / BLE | `NOT VERIFIED` |
| **macOS ↔ Windows** | **PLATFORM-DEPENDENT** | Wi-Fi Direct SoftAP + TCP Socket OR Local Wi-Fi | BLE / QR Code Bootstrap | `NOT VERIFIED` |
| **macOS ↔ Android** | **PLATFORM-DEPENDENT** | Android Local Hotspot (SoftAP) + TCP Socket OR Local Wi-Fi | BLE / QR Code Bootstrap | `NOT VERIFIED` |
| **Windows ↔ iOS** | **PLATFORM-DEPENDENT** | Windows SoftAP / iOS Wi-Fi Join + TCP Socket OR Local Wi-Fi | QR Code / Manual Code Bootstrap | `NOT VERIFIED` |
| **Android ↔ iOS** | **PLATFORM-DEPENDENT** | Android SoftAP / iOS Wi-Fi Join + TCP Socket OR Local Wi-Fi | QR Code / BLE Bootstrap | `NOT VERIFIED` |

---

## 2. Technical Explanation of Cross-Vendor Direct Challenges

### Apple Ecosystem (macOS / iOS) ↔ Apple Ecosystem
- **Mechanism**: Apple hardware utilizes proprietary Apple Wireless Direct Link (AWDL) radio scheduling on the Wi-Fi chip. AWDL allows two Apple devices to hop onto a shared channel during dedicated sync windows without requiring an external access point.
- **Data Path**: `Network.framework` or `MultipeerConnectivity` delivers a direct bidirectional TCP stream.

### Wi-Fi Alliance Ecosystem (Windows / Android) ↔ Wi-Fi Alliance Ecosystem
- **Mechanism**: Windows and Android implement the standard Wi-Fi Alliance Wi-Fi Direct (P2P) specification. One device acts as the Autonomous or Negotiated Group Owner (GO) running an internal DHCP server, and the peer connects as a P2P Client.
- **Data Path**: A standard TCP socket over link-local IPv4 (`192.168.137.1` on Windows, `192.168.49.1` on Android) delivers bidirectional NearShare protocol frames.

### Cross-Ecosystem (Apple ↔ Non-Apple)
- **Challenge**: Apple devices do not support Wi-Fi Alliance Wi-Fi Direct client negotiation in third-party public APIs, and non-Apple hardware does not speak AWDL.
- **Solution / Common Primitive**:
  1. One device (e.g. Android or Windows in SoftAP mode) enables a temporary local SoftAP (no internet required).
  2. The peer joins the temporary SoftAP via QR code scanning or auxiliary BLE pairing handshake.
  3. Once associated, standard TCP sockets connect over the ad-hoc wireless link.
  4. The NearShare protocol, cryptographic pairing, and `FileEngine` stream files identically.

---

## 3. The Smallest Common Transport Primitive

```
┌─────────────────────────────────────────────────────────────┐
│                       NearShare UI                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    NearShare FileEngine                     │
│          (Chunking, Checkpointing, Stream Writers)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  SecureTransportSession                     │
│               (AES-256-GCM Cryptographic AEAD)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 NearShare Protocol Engine                   │
│         (Length-prefixed binary frames & envelopes)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│             COMMON DIRECT TRANSPORT PRIMITIVE               │
│          Reliable Bidirectional Byte Stream (TCP)           │
│                                                             │
│  macOS/iOS: AWDL / P2P Socket  │  Win/Android: Wi-Fi Direct │
└─────────────────────────────────────────────────────────────┘
```

By standardizing on a reliable bidirectional byte stream as the transport primitive, NearShare ensures that encryption, pairing, transfer protocol, and file chunking remain 100% shared and platform-agnostic across all operating systems.
