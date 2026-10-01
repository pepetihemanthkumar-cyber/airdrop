# NearShare — macOS Direct Mode Memory & Buffering Model

## 1. Executive Summary

NearShare enforces strict upper bounds on memory allocation during direct file transfers. It prevents out-of-memory crashes on multi-gigabyte or multi-terabyte transfers by combining cooperative producer-consumer flow control, fixed-size stream chunking, and immediate buffer reclamation.

---

## 2. Memory Budget & Buffer Breakdown

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TOTAL MEMORY ALLOCATION CEILING                    │
│                        Target Cap: <= 80 MiB Heap                        │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. FileEngine Chunk Pool:            <= 64.0 MiB (16 chunks x 4 MiB)    │
│ 2. Protocol & AEAD Crypto Overhead:  <=  0.5 MiB (Tags, Nonces, Headers)│
│ 3. Native Swift Stream Ring Buffers: <=  1.0 MiB (16 x 64 KiB reads)    │
│ 4. Tauri IPC Base64 Temporary Buffer:<=  5.5 MiB (Single chunk in FFI)  │
│ 5. Base App Runtime & Metadata:      <=  9.0 MiB                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Memory Controls

### 1. `TransferBackpressureController` (Authoritative Flow Governor)
- **Max In-Flight Chunks**: `16` unacknowledged chunks.
- **Max In-Flight Bytes**: `64 MiB` (`67,108,864` bytes).
- **Behavior**: When the transmitter has read and queued 16 chunks, `acquireChunkPermit()` suspends file reading. As the receiver confirms chunk writes via `CHUNK_ACK`, capacity is restored and subsequent permits are resolved.

### 2. Protocol Frame & Cryptographic Boundary
- **Chunk Framing**: Protocol chunk envelopes wrap each 4 MiB slice with a 4-byte BE length prefix and message headers.
- **AEAD Encrypted Envelopes**: `SecureTransportSession` adds a 12-byte nonce, 16-byte authentication tag, and cryptographic headers (~64 bytes overhead per 4 MiB chunk).
- **Ephemeral Keys**: Key material is stored in non-exportable `CryptoKey` handles and wiped on session invalidation.

### 3. Native Swift Stream Buffers (`NearShareDirectSession`)
- **Read Buffer Size**: Fixed `65,536` bytes (`64 KiB`) per stream read event (`.hasBytesAvailable`).
- **Zero Unbounded Accumulation**: Swift NEVER accumulates incoming stream chunks in an unbounded array or `NSMutableData`. Each incoming 64 KiB buffer is forwarded immediately to Rust/Tauri IPC via `onDataReceived` callback and reclaimed.
- **Write Control**: `sendBytes` checks `stream.hasSpaceAvailable` before writing. If the underlying OS pipe is full, it returns `-1` to throttle upstream transmission without buffering memory in Swift.

---

## 4. Why Memory Never Grows with File Size

1. **Streaming vs In-Memory Slurping**: Files are never loaded wholly into RAM. Whether transferring a 1 MiB document or a 100 GiB video, RAM consumption remains fixed within the ~64–80 MiB ceiling.
2. **Immediate Garbage Collection**: Transmitted chunks are dereferenced immediately once passed into native transport.
3. **Atomic Disk Flush**: The receiver writes chunks directly to disk (`.part` file) using `std::fs::File.sync_data()` and frees heap space.
