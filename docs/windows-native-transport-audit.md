# NearShare — Windows Native Transport & UDP Discovery Audit

**Document Version:** 2.0.0  
**Step:** 46 — Windows UDP Discovery & Physical LAN Validation  
**Author:** NearShare Core Engineering Team  
**Date:** September 29, 2026  
**Status:** Canonical Technical Specification & Architectural Audit  

---

## 1. Executive Summary & Scope

Step 46 completes the implementation of **NearShare LAN Peer Discovery** using UDP multicast/broadcast over local Wi-Fi and Ethernet networks for desktop runtimes (Windows 10/11 and macOS).

### Key Architectural Invariants
1. **Wi-Fi / LAN Mode Only:** UDP multicast peer discovery operates over router-managed local subnets. It is **NOT** Direct Mode (routerless peer-to-peer). No artificial 30-meter distance restrictions apply to LAN mode.
2. **Safe Metadata Boundary:** Discovery packets disseminate strictly bounded, non-sensitive device info (stable device ID, user-friendly device name, platform, local TCP port, capabilities, and expiration timestamp).
   * **FORBIDDEN IN DISCOVERY:** Private keys, device identity public keys/fingerprints, pairing PINs, authorization tokens, file names, file paths, user secrets, session keys, and symmetric encryption keys.
3. **Strict Security Isolation:** Discovery is **NOT** authentication. A discovered device produces only `"Device Discovered"` — **NEVER** `"Device Trusted"`, `"Device Paired"`, or `"Device Authorized"`.
4. **End-to-End Cryptographic Channel:** All subsequent communication proceeds through:
   $$\text{UDP Discovery} \longrightarrow \text{TCP Handshake} \longrightarrow \text{SecureTransportSession (ECDH + AES-GCM)} \longrightarrow \text{ECDSA Identity Verification} \longrightarrow \text{Pairing / Authorization} \longrightarrow \text{Encrypted File Transfer}$$

---

## 2. NearShare LAN Discovery Wire Protocol

### A. Discovery Packet Schema

```typescript
export interface NearShareDiscoveryPacket {
  protocol: 'NearShare';
  version: '1.0';
  type: 'DISCOVERY_ADVERTISEMENT' | 'DISCOVERY_REQUEST' | 'DISCOVERY_RESPONSE' | 'DISCOVERY_GOODBYE';
  deviceId: string;          // Stable cryptographic device ID (1-64 characters)
  profileId?: string;        // Optional user profile identifier
  deviceName: string;        // Sanitized display name (1-64 characters)
  platform: 'windows' | 'macos' | 'android' | 'ios' | 'linux';
  capabilities: string[];    // e.g. ['wifi']
  tcpPort: number;           // Valid TCP port (1-65535)
  timestamp: number;         // Epoch timestamp (ms)
  expiresAt: number;         // Expiration timestamp (ms)
}
```

### B. Packet Constraints & Validation Rules

* **Maximum Packet Size:** 1,024 bytes (strictly bounded buffer allocation; oversized datagrams are rejected before JSON parsing).
* **Protocol & Version Check:** `protocol === 'NearShare'` and `version === '1.0'`.
* **Platform Validation:** Must be one of `['windows', 'macos', 'android', 'ios', 'linux']`.
* **Port Validation:** $1 \le \text{tcpPort} \le 65535$.
* **Expiration Guard:** Packets where $\text{expiresAt} < \text{Date.now()}$ are dropped immediately.
* **Forbidden Fields Guard:** Rejection if any forbidden field (`privateKey`, `pin`, `token`, `secret`, `fingerprint`, `filePath`) is present in payload.

---

## 3. UDP Multicast Architecture & Socket Configuration

* **Default Multicast Group:** `239.255.67.89` (IPv4 Administratively Scoped Multicast space).
* **Default UDP Port:** `52139` (UDP).
* **TTL (Time to Live):** 1 (restricted to local broadcast subnet; packets cannot cross internet routers).
* **Periodic Advertisement Interval:** `5,000 ms`.
* **Stale Timeout Threshold:** `15,000 ms` (transitions device state from `visible` to `stale`).
* **Eviction / Removal Timeout:** `30,000 ms` (removes peer from cache and emits `peerLost`).
* **Explicit Teardown:** Upon graceful shutdown, node broadcasts `DISCOVERY_GOODBYE` to trigger immediate remote eviction without waiting for timeout.

---

## 4. Device Lifecycle State Machine

```
[ Incoming Packet ]
       ↓
  DISCOVERED  (First packet seen, validated)
       ↓
   VISIBLE    (Active, receiving periodic beacons)
       ↓
    STALE     (No beacons for > 15s)
       ↓
   REMOVED    (No beacons for > 30s OR DISCOVERY_GOODBYE received)
```

* **Identity Keying:** Peers are strictly keyed by **stable `deviceId`**, never by IP address (since DHCP leases may reassign IP addresses).
* **Duplicate Suppression:** Repeated beacons refresh `lastSeen`, `expiresAt`, and update mutable fields (e.g. `deviceName`) without creating duplicate UI records.

---

## 5. Windows Defender Firewall & Permission Considerations

1. **Firewall Inbound Prompt:**
   * On Windows 10/11, opening a listening socket (`UdpSocket::bind` on port 52139 or `TcpListener::bind`) will trigger a standard Windows Defender Firewall prompt asking to allow NearShare on Private and/or Public networks.
   * NearShare requires Private network access for LAN multicast discovery.
2. **Error Normalization:**
   * If firewall blocks UDP multicast, NearShare distinguishes:
     - `NETWORK_UNAVAILABLE`: No network interface active.
     - `FIREWALL_BLOCKED`: Socket bind or multicast join rejected by OS policy.
     - `MULTICAST_UNAVAILABLE`: Router IGMP snooping / multicast filtering active.
     - `DISCOVERY_TIMEOUT`: No peers advertising on subnet.
   * These errors are clearly reported in diagnostics and never falsely displayed as "no devices nearby".

---

## 6. macOS & Cross-Platform Compatibility Boundary

* **Platform-Neutral Packet Structure:** The JSON wire structure of `NearShareDiscoveryPacket` is platform-agnostic and fully parseable on macOS, Windows, Linux, Android, and iOS.
* **Rust Native Bridge:** The Tauri Rust backend (`start_udp_discovery`, `stop_udp_discovery`, `send_discovery_advertisement`, `get_discovered_peers`) utilizes standard library `std::net::UdpSocket` with platform-agnostic multicast membership commands (`join_multicast_v4`), compiling seamlessly across Darwin and Windows MSVC/GNU targets.

---

## 7. Windows Native Capability Matrix (Step 46)

```typescript
export const WINDOWS_NATIVE_CAPABILITIES: WindowsCapabilityMatrix = {
  filesystem: 'requiresNative',
  filePicker: 'requiresNative',
  folderPicker: 'requiresNative',
  streamingRead: 'requiresNative',
  streamingWrite: 'requiresNative',
  randomAccessRead: 'requiresNative',
  randomAccessWrite: 'requiresNative',
  tcpLan: 'supported',
  udpDiscovery: 'supported',          // Implemented in Step 46
  directNearby: 'notImplemented',
  wifiDirect: 'notImplemented',
  bluetooth: 'notImplemented',
  backgroundTransfer: 'restricted',
};
```

---

## 8. Verification Status & Test Results

* **Host Environment:** macOS (Darwin 25.3.0, Apple Silicon ARM64), Rust 1.98.1, Node v24.13.0, npm 11.6.2.
* **Deterministic Test Suite:** **300 / 300 tests passed** (including DISC-001 through DISC-020).
* **TypeScript & Vite Build:** `npm run build` succeeded with 0 errors.
* **OxLint:** `npm run lint` succeeded with 0 errors.
* **Rust Backend Compilation:** `cargo check` and `cargo build` succeeded with 0 errors.
* **Physical Hardware Validation:**
  * Physical 2-device Windows 10/11 execution: **UNVERIFIED (No physical Windows test harness attached)**.
  * Physical Windows $\leftrightarrow$ macOS LAN transfer: **UNVERIFIED (Requires real dual-machine test environment)**.
  * Local simulated UDP multicast, lifecycle state machine, and packet validation: **VERIFIED**.
