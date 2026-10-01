# NearShare Transfer Resource Lifecycle & Cleanup Specifications

## 1. Lifecycle States & Resource Transitions

```
[INIT / QUEUED] ──► [CONNECTING] ──► [TRANSFERRING] ──► [FINALIZING] ──► [COMPLETED]
       │                  │                 │                  │              │
       ▼                  ▼                 ▼                  ▼              ▼
[CANCELLED]          [FAILED]          [INTERRUPTED]      [FAILED]       [CLEANUP]
                                            │
                                            ▼
                                        [RESUMING]
```

---

## 2. Resource Cleanup Matrix

| Event Trigger | Transport Sockets | In-Flight Buffers | File Readers / Writers | Checkpoint File | History Record | Telemetry Session |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Transfer Completed** | Kept open if reuse, or closed | Released immediately | Closed & flushed to disk | Atomically removed / marked complete | Final summary added (1 record) | Completed & converted to summary |
| **Transfer Paused** | Kept idle / throttled | In-flight drained & released | Paused at chunk boundary | Persisted to disk atomically | State updated to 'paused' | Paused (speed decays to 0) |
| **Transfer Cancelled** | Disconnected | Discarded & purged | Closed & temp file removed | Removed from disk | Marked 'cancelled' | Cleared |
| **Transport Interrupted** | Closed / Reconnecting | Drained | Preserved for resume | Checkpoint persisted | State updated to 'interrupted' | Recorded as interruption |
| **Integrity Failure** | Terminated | Discarded | Closed & quarantine/delete | Marked corrupt | Marked 'failed' (integrity) | Recorded as failure |
| **Security Failure** | Closed immediately | Discarded immediately | Closed | Removed | Marked 'failed' (security) | Recorded as fatal failure |
