# NearShare Transfer Memory Model & Buffer Lifecycle

## 1. Buffer Flow & Boundary Analysis

To provide true resource discipline, NearShare tracks every buffer allocation across the application stack.

```
┌────────────────────────────────────────────────────────┐
│                   TypeScript Engine                    │
│  - Bounded In-Flight Queue (max 16 chunks * 4 MiB)    │
│  - Uint8Array / Base64 Framed Payload                  │
└───────────────────────────┬────────────────────────────┘
                            │ (Tauri IPC / Web MessageChannel)
┌───────────────────────────▼────────────────────────────┐
│                    Tauri Native Core                   │
│  - Zero-Copy or Stream Splice to Rust async Tokio      │
│  - Framing (4-byte Big-Endian Length Prefix)           │
└───────────────────────────┬────────────────────────────┘
                            │ (Direct TCP Socket / AWDL / Wi-Fi Direct)
┌───────────────────────────▼────────────────────────────┐
│                   Operating System                     │
│  - Kernel Socket Send Buffer (SO_SNDBUF)               │
│  - Network Interface Controller (NIC) DMA Buffer       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Realistic "Zero-Copy" Boundary Assessment

* **Within Native Rust**: Rust uses async `tokio::io::AsyncReadExt` directly into socket buffers without heap duplication.
* **Across Tauri IPC Boundary**: Communication between web frontend and Tauri Rust backend uses binary IPC buffers. We do **not** claim full zero-copy across the JS/Wasm/Rust boundary because V8 garbage collector heap semantics require typed array marshalling.
* **Cooperative Buffer Disposal**: Chunks in TypeScript are released immediately upon receiving the transport layer's chunk acknowledgment (`CHUNK_ACK`) or when the transfer is paused/cancelled.

---

## 3. In-Flight Memory Invariants

1. Total buffer allocation during transfer $\le \text{maxInFlightChunks} \times \text{DEFAULT\_CHUNK\_SIZE} + \text{metadata} \approx 64\text{ MiB}$.
2. Memory consumption does **not** scale with file size (e.g. a 500 GB file consumes the same $\sim 64\text{ MiB}$ buffer footprint as a 500 MB file).
3. Memory consumption does **not** scale with folder file count (large manifests stream file descriptors iteratively).
