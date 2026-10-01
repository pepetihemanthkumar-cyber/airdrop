# NearShare Transfer Pipeline Audit & Resource Discipline (Step 60)

## 1. End-to-End Transfer Pipeline Architecture

```
File Selection / Native Picker
          ↓
NativeFolderTransferSource / FileManifest
          ↓
TransferQueueContext (Queue state & deterministic sequencing)
          ↓
Protocol Manifest (Hardened & validated relative paths)
          ↓
SecureTransportSession (ECDH P-256 + AES-256-GCM AEAD)
          ↓
TransportAdapter (Direct Mode / Local Wi-Fi Mode)
          ↓
TransferBackpressureController (Bounded in-flight chunk permits)
          ↓
NativeFileWriter / NativeReceiveFileDestination
          ↓
Receiver-Authoritative Missing-Range & Whole-File SHA-256 Integrity Verification
          ↓
Aggregated Transfer Telemetry Summary
          ↓
Durable Transfer History Record & Checkpoint Cleanup
```

---

## 2. Comprehensive Pipeline Audit Findings

| Pipeline Phase | Potential Vulnerability / Risk | Hardening Mitigation Implemented |
| :--- | :--- | :--- |
| **File Selection** | Absolute path leakage from host OS (`/Users/...`, `C:\...`) | Strict relative path normalization via `PathSafety` and `TransferManifestHardener`. |
| **Manifest Parsing** | Path traversal (`../`, `..\`, null bytes) and duplicate files | `normalizeSafeRelativePath` rejects traversal, null characters, and Windows drive/UNC prefixes. |
| **Queue Scheduling** | Unbounded queue growth, concurrent collision | Enforces `maxQueuedTransfers = 100`, single active transfer concurrency (`maxConcurrentTransfers = 1`). |
| **Chunk Production** | Memory explosion when reading large files faster than network output | `TransferBackpressureController` limits in-flight chunks (`maxInFlightChunks = 16`, `maxChunkBufferBytes = 64 MiB`). |
| **Transport Streaming** | Premature completion event racing with last chunk disk flush | Strict sequential barrier between `FILE_COMPLETE` and `NEXT_FILE_START`. |
| **Transfer Interruption** | Re-transferring already acknowledged files/chunks | Receiver-authoritative range calculation and atomic checkpoint state persistence. |
| **Cancellation** | Lingering timers and orphaned in-flight buffers | `cancel()` synchronously drains waiting backpressure permits and clears native file handles. |
| **History Logging** | Duplicate history entries created on each reconnect/resume | Canonical transferId deduplication ensuring exactly one logical record per transfer session. |

---

## 3. Resource Quotas Summary

* **Max Concurrent Active Transfers**: `1`
* **Max Queued Items**: `100`
* **Max In-Flight Chunks**: `16` (64 MiB memory envelope)
* **Max Manifest File Count**: `25,000`
* **Max Manifest Payload**: `10 MiB`
* **Max Folder Depth**: `32`
* **Max Filename Length**: `255` characters
* **Max Folder Logical Size**: `10 TiB`
