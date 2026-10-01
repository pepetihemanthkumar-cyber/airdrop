# NearShare — Direct Mode Intermediary Network (Device-Hosted SoftAP) Architecture

## 1. Distinction: Pure P2P Direct vs Device-Hosted SoftAP vs Existing LAN

NearShare distinguishes three modes of local wireless connectivity:

```
1. Pure Peer-to-Peer Direct
   (Wi-Fi Direct / Apple Multipeer / AWDL)
   • Zero router required.
   • Zero AP creation required.
   • Radio negotiated dynamically between peers.
   • Same-ecosystem (Apple ↔ Apple, Android ↔ Windows).

2. Device-Hosted Local SoftAP
   (Local-Only Hotspot / Autonomous Group Owner)
   • Zero external router required.
   • Zero internet required.
   • Host device acts as temporary WPA2 Access Point.
   • Client device associates via QR Code / BLE.
   • Cross-ecosystem bridge (Apple ↔ Android, Apple ↔ Windows).

3. Existing Local Area Network (Wi-Fi Mode)
   • Standard Wi-Fi router / subnet required.
   • Zero internet required.
   • Peers discover each other via mDNS / UDP broadcast.
```

---

## 2. Intermediary SoftAP Workflow (e.g. Android Host ↔ iOS Receiver)

```
┌──────────────────────────────┐              ┌──────────────────────────────┐
│        Android Host          │              │         iOS Receiver         │
├──────────────────────────────┤              ├──────────────────────────────┤
│ 1. Start LocalOnlyHotspot    │              │                              │
│    (SSID: NS-HOTSPOT-8492)   │              │                              │
│    (Pass: xk92-m847-p921)    │              │                              │
│ 2. Display Dynamic QR Code   │ ──Scan QR──> │ 3. Camera scans QR Code      │
│                              │              │ 4. NEHotspotConfiguration    │
│                              │              │    prompts: "Join Network?"  │
│ 5. iOS joins local SoftAP    │ <──Associate─┤ 5. Associated to Hotspot     │
│ 6. TCP Server accepts socket │ <──Connect───┤ 6. TCP Client connects       │
├──────────────────────────────┴──────────────┴──────────────────────────────┤
│                    NearShare Protocol Exchange                             │
│                    1. HELLO + CAPABILITIES                                 │
│                    2. 6-digit PIN Confirmation Handshake                   │
│                    3. AES-256-GCM SecureTransportSession                   │
│                    4. FileEngine High-Throughput Transfer (20–60 MB/s)     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Platform Capabilities for Device-Hosted SoftAP

| Host Platform | SoftAP API | Client Join Support | User Friction |
| :--- | :--- | :--- | :--- |
| **Android 8.0+** | `WifiManager.startLocalOnlyHotspot` | Universal (Any Wi-Fi device) | Zero configuration; dynamic QR code |
| **Windows 10/11** | `WiFiDirectAdvertisementPublisher` (SoftAP method) | Universal | Zero configuration; dynamic QR code |
| **macOS 12+** | `CoreWLAN` (requires system credentials) | Universal | System prompt required |
| **iOS / iPadOS** | Unsupported as Host (Personal Hotspot requires cellular) | `NEHotspotConfigurationManager` (Client) | One-tap system prompt confirmation |

---

## 4. Technical Honesty Invariants

- Device-Hosted SoftAP is an **intermediary cross-platform strategy**, *not* pure Wi-Fi Direct.
- The UI must transparently inform the user when a temporary device hotspot is being created for cross-ecosystem transfers.
