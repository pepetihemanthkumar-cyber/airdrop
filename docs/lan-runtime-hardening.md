# Production LAN Runtime Hardening Architecture

## Overview
NearShare's Production LAN Transport (`ProductionLanTransportAdapter`) implements industrial-grade TCP socket framing, bounded memory management, strict state machine transitions, and resilient error sanitization.

## 1. TCP Length-Prefixed Binary Framing
Because TCP is a stream-oriented protocol with arbitrary chunk boundaries (i.e. one `recv` call does not equal one application frame), `ProductionLanTransportAdapter` enforces 4-byte Big-Endian length-prefixed framing:

```
+--------------------------+------------------------------------+
| 4-Byte Frame Length (BE) | Payload Data (1 B .. 1 MiB)        |
+--------------------------+------------------------------------+
```

### Safety Rules:
- **Max Frame Limit**: `MAX_LAN_FRAME_BYTES = 1,048,576 bytes` (1 MiB).
- **Global Buffer Limit**: `MAX_LAN_BUFFER_BYTES = 67,108,864 bytes` (64 MiB).
- **Partial Stream Assembly**: Incomplete frame fragments are accumulated in per-connection memory buffers until the complete frame payload arrives.
- **Combined Packet Extraction**: If multiple frames arrive in a single TCP read buffer, the adapter splits and extracts each frame sequentially.
- **Malformed / Corrupted Header Protection**: Any header declaring a size $> 1\text{ MiB}$ or negative value is flagged as malformed, closing the socket immediately and dropping corrupted bytes.

## 2. Connection State Machine
The adapter strictly enforces legal state transitions:

```
idle
 ├──> discovering
 └──> connecting
       └──> authenticating
             └──> connected
                   ├──> transferring ──> completed
                   ├──> paused
                   └──> reconnecting ──> connected
```

Failure and terminal states (`failed`, `disconnected`, `cancelled`) are handled safely without dangling socket handles or memory leaks. Duplicate operations (e.g. repeated `connect`, `disconnect`, `pause`, `resume`) are guaranteed idempotent.

## 3. Discovery Hardening & Stale Peer Eviction
- **Bounded Discovery Cache**: Capped at `MAX_DISCOVERED_PEERS = 50` to protect memory under congested network broadcasts.
- **TTL Eviction Loop**: Runs every 5 seconds; peers whose beacons have not been refreshed within 15 seconds are evicted with a `deviceLost` event.
- **Duplicate Suppression**: Re-broadcasts from known active peers refresh the `lastSeenAt` timestamp without emitting redundant discovery events.
- **Zero Secret Exposure**: Beacons only transmit safe device discovery metadata (`deviceId`, `deviceName`, `platform`, `mode`). Private keys and cryptographic parameters are strictly barred from discovery packets.

## 4. Evidence Classification & Physical Status
- **Localhost / Deterministic Suite**: `PASS` (LAN-RUNTIME-001 through LAN-RUNTIME-020).
- **Physical Multi-Device LAN Transfer**: `BLOCKED` (Single physical Mac host in test environment).
