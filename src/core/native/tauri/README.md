# NearShare Tauri Native Bridge Spike (v1.0)

> **"Tauri runtime availability ≠ native transport availability."**

This module provides the Tauri v2 bridge boundary connecting NearShare's React core to the Rust host shell.

---

## 1. Scope of the Spike

- **Implemented**:
  - Detection of the Tauri v2 webview injection (`window.__TAURI_INTERNALS__`).
  - Bridge interface instantiation conforming to `NativeBridge`.
  - Serialized runtime info (`TauriRuntimeInfo`).
  - Honest capability reporting: all native networking and filesystem capabilities are marked as `'notImplemented'`.
  - Seamless fallback to `MockNativeBridge` in standard web browsers.

- **NOT Implemented**:
  - Native filesystem access (no file reading, writing, or folder picking).
  - Native direct P2P networking (no Wi-Fi Direct, AWDL, or Multipeer).
  - Native LAN sockets (no TCP, UDP, or mDNS).
  - Custom IPC commands for transfer data.

---

## 2. IPC Flow (Future Phase)

```
┌────────────────────────────────────────────────────────┐
│                      React UI                          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  PlatformBridgeFactory                 │
│         (Resolves TauriNativeBridge if in Tauri)       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    TauriNativeBridge                   │
│       (Implements NativeBridge, invokes Rust IPC)      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                     Rust Host Shell                    │
│            (src-tauri/src/lib.rs / main.rs)            │
└────────────────────────────────────────────────────────┘
```
