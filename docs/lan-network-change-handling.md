# LAN Network Change & Recovery Handling

## Overview
This document specifies how NearShare handles network interface events, subnet transitions, Wi-Fi disconnections, and connection recovery during active LAN transfers.

## 1. Network Disconnection Events
When a network interface event occurs (e.g. Wi-Fi disabled or network unreachable):
1. **Socket State Transition**: All active connections transition from `connected` or `transferring` to `reconnecting`.
2. **Discovery Invalidation**: Discovered peer cache is wiped clean.
3. **Event Notification**: Emits `reconnecting` event with attempt counter.
4. **No Cross-Mode Fallback**: The adapter **NEVER** silently falls back to Direct mode. Transfer preferences and transport modes remain strictly authoritative.

## 2. IP / Subnet Change Events
When an IP change is detected:
1. Active TCP listeners are bound to the new local interface address.
2. UDP multicast discovery beacons are re-broadcasted.
3. In-flight transfer checkpoints are retained for resumption without byte-zero restarts.

## 3. Crash-Resilient Checkpoint Resumption
- Checkpoints are saved atomically to disk (`<transferId>.json`).
- If a connection is severed, `TransferSessionRecoveryManager` uses missing byte range descriptors to resume only untransferred segments upon peer reconnection.
