# NearShare — Bluetooth Low Energy (BLE) Auxiliary Discovery & Bootstrap Architecture

## 1. Executive Summary

Bluetooth Low Energy (BLE) provides universal, low-power proximity discovery across macOS, Windows, Android, and iOS. However, BLE throughput is physically constrained to **100–250 KB/s in real-world conditions**, making it completely unsuitable for multi-megabyte or gigabyte file transfers.

In NearShare, **BLE is strictly utilized as an auxiliary discovery and connection bootstrap mechanism**, never as the primary payload transport channel.

---

## 2. BLE Transport Boundaries: Discovery vs Payload Data

```
┌─────────────────────────────────────────────────────────────┐
│                    BLE AUXILIARY CHANNEL                    │
│             (Low Power, Low Bandwidth ~100 KB/s)            │
│  • Device Discovery & Presence Beacons                      │
│  • Ephemeral Public Key Exchange (ECDH P-256)               │
│  • Direct Wi-Fi Channel & Port Bootstrap Negotiation        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Handshake Complete
                               │ Switch to High-Speed Wi-Fi
┌──────────────────────────────▼──────────────────────────────┐
│                  HIGH-SPEED WI-FI CHANNEL                   │
│          (High Power, High Bandwidth 20–80 MB/s)            │
│  • NearShare Protocol Framing (4 MiB Chunks)                │
│  • AES-256-GCM AEAD SecureTransportSession                  │
│  • FileEngine Multi-Gigabyte Stream Serialization           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. BLE Advertisement Payload Specification

NearShare broadcasts a 24-byte compact advertisement payload via Service Data UUID `0xFE9A`:

| Offset (Bytes) | Field Name | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `0..1` | `ProtocolVersion` | NearShare discovery protocol version (Major.Minor) | `0x0100` (v1.0) |
| `2..3` | `TransportFlags` | Capabilities mask (Direct, SoftAP, Wi-Fi Aware) | `0x0007` |
| `4..11` | `DeviceProfileHash` | 64-bit truncated SHA-256 hash of device public key | `0xA849B2C1...` |
| `12..17` | `DisplayNameShort` | 6-byte sanitized UTF-8 device name prefix | `MacAir` |
| `18..21` | `BootstrapPort` | Listening TCP/P2P ephemeral port | `53317` |
| `22..23` | `TxPower` | Transmit power in dBm for RSSI distance calibration | `0x00` |

### Security Constraints:
- Never advertises private keys, authorization PINs, authentication tokens, file names, or host filesystem paths in BLE packets.
- Ephemeral MAC address randomization on mobile OSes is handled natively by the BLE subsystem.
