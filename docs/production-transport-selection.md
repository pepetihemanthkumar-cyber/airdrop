# Production Transport Selection Matrix

## Authoritative Transport Resolution

NearShare strictly enforces distinct transport modes without automatic fallback across mode boundaries:

| Mode | Registered Production Adapter | Implementation Type | Capability Tier | Hardware Requirement | Internet Required |
|---|---|---|---|---|---|
| **Direct Mode** (`direct`) | `DirectTransportAdapter` | `native` | `requiresNative` | AWDL / Wi-Fi Direct / Multipeer / BLE | **NO** |
| **Wi-Fi / LAN Mode** (`wifi`) | `ProductionLanTransportAdapter` | `native` | `requiresNative` | Local Area Network (Wi-Fi / Ethernet) | **NO** |

## Mock Isolation
`MockWiFiTransport` and `MockPairingAdapter` are strictly isolated to test fixtures, mock harnesses, and development simulation. They are NEVER registered as default adapters in production `TransportRegistry` or `PairingManager`.

## Mode Isolation Rule
- Direct Mode does NOT fallback to LAN Mode.
- LAN Mode does NOT fallback to Direct Mode.
- Selection is explicit and user-driven.
