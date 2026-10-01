# NearShare iOS Direct Threading & Memory Model

**Document Version:** 1.0.0  
**Date:** 2026-10-01  
**Author:** Antigravity Engineering

---

## 1. Concurrency Model

MultipeerConnectivity delegate callbacks are dispatched by the iOS kernel on arbitrary private GCD queues. To prevent data races and lock contention, the native Swift layer enforces a strict serialization architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                 External Multipeer Callbacks                │
│    (MCSessionDelegate, AdvertiserDelegate, BrowserDelegate)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           Serial Dispatch Queue: com.nearshare.ios.direct    │
│    - Synchronizes discovered peer dictionary mutations      │
│    - Synchronizes stream lifecycle (open/close)             │
│    - Synchronizes invitation queue & handlers               │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Asynchronous Background I/O                │
│    - Dedicated InputStream reading loop (64 KiB chunks)     │
│    - Non-blocking OutputStream writes                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ C-ABI / IPC Notification
┌──────────────────────────────▼──────────────────────────────┐
│                    Tauri IPC & React UI                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Memory Safety & Resource Management

1. **Weak References**: Delegate handlers and background read blocks use `[weak self, weak stream]` captures to prevent retain cycles.
2. **Deterministic Teardown**: `teardown()` halts browser/advertiser delegates, closes active streams, disconnects MCSession, and releases references.
3. **Bounded Buffers**: Maximum chunk size is fixed at 64 KiB (65,536 bytes) per read/write iteration to guarantee bounded memory utilization even during multi-gigabyte transfers.
4. **No UI Contention**: No Swift native callbacks directly mutate React state; all notifications flow across the thread-safe Tauri IPC bridge.
