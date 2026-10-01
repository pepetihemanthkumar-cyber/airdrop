# NearShare File Engine & Chunk/Resume Contract Specification

This document defines the platform-neutral **NearShare File Engine** architecture, chunk boundaries, assembly mechanics, resume checkpoints, transfer staging, and layer separation.

---

## 1. File Engine Architecture & Flow

The File Engine sits between the application Transfer Queue and the Protocol/Transport stack:

```
┌────────────────────────────────────────────────────────┐
│                   TransferQueue                        │
│             (User & Batch Job Control)                 │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  TransferFileManager                   │
│         (Manifest generation, FileSource setup)        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                       FileEngine                       │
│    (Read Handles, Write Handles, Staging, Checkpoints)  │
└─────────────┬─────────────────────────────┬────────────┘
              │                             │
┌─────────────▼─────────────┐ ┌─────────────▼────────────┐
│       FileReader          │ │        FileWriter        │
│   (Offset & Chunk Read)   │ │  (Out-of-order assembly) │
└─────────────┬─────────────┘ └─────────────┬────────────┘
              │                             │
┌─────────────▼─────────────┐ ┌─────────────▼────────────┐
│       ChunkManager        │ │       ResumeManager      │
│  (Boundary Math, 4 MiB)   │ │  (Checkpoints, Missing)  │
└───────────────────────────┘ └──────────────────────────┘
```

---

## 2. Layer Boundaries

1. **File Engine ↔ Protocol Boundary**:
   - **File Engine** produces `FileManifestPayload`, validates file sources, generates `FileChunk` objects, tracks byte progression, and computes checksums.
   - **Protocol** encapsulates these structures into envelopes (`FILE_MANIFEST`, `CHUNK_DATA`, `CHUNK_ACK`, `TRANSFER_RESUME`) and transmits them.
   - File Engine never transmits network packets directly.

2. **File Engine ↔ Transport Boundary**:
   - The File Engine is completely transport-agnostic. It does not know whether chunks will travel over Direct Nearby, Local Wi-Fi, BLE, or Sockets.
   - Transport handles physical socket channels, latency, and signal quality.

3. **File Engine ↔ Security Boundary**:
   - Security owns device trust, key exchange, encryption, and session permissions.
   - File Engine assumes it is invoked only after a session is successfully established and authorized.

4. **File Engine ↔ UI Boundary**:
   - UI receives formatted data and high-level progress from `useTransferQueue()` and `useFileEngine()`.
   - UI components never interact with native file descriptors or absolute paths.

---

## 3. Core Components

### `FileEngine` Interface (`FileEngine.ts`)
Unified contract for:
- Normalized metadata retrieval (`getMetadata`)
- Read stream creation (`openRead`, `readChunk`, `closeRead`)
- Write staging and assembly (`createWrite`, `writeChunk`, `finalizeWrite`, `abortWrite`)
- Resume checkpoint storage (`getCheckpoint`, `saveCheckpoint`, `clearCheckpoint`)
- Integrity verification (`verifyFile`)
- Transfer cleanup (`cleanupTransfer`)

### `FileReader` (`FileReader.ts`) & `FileWriter` (`FileWriter.ts`)
Abstract interfaces for reading/writing file byte streams:
- `FileReader.read(offset, length)`: Slices byte fragments from file sources.
- `FileWriter.write(offset, data)`: Writes chunks into temporary staging areas.
- `FileWriter.finalize()`: Atomically commits staging to target location and computes final checksum.

### `ChunkManager` (`ChunkManager.ts`)
Deterministic chunk calculations:
- Reuses `DEFAULT_CHUNK_SIZE = 4,194,304` bytes (4 MiB) from `src/core/protocol/messageTypes.ts`.
- `calculateChunkCount(fileSize, chunkSize)`:
  - 0-byte file $\rightarrow$ `0 chunks`
  - 1-byte file $\rightarrow$ `1 chunk`
  - 4 MiB exact $\rightarrow$ `1 chunk`
  - 4 MiB + 1 byte $\rightarrow$ `2 chunks`
- `validateChunk(chunk, fileSize)`: Validates that offset, length, chunk index, and total chunk bounds are strictly within file boundaries.

### `ResumeManager` (`ResumeManager.ts`)
- Tracks per-file `ResumeCheckpoint` (`transferId`, `fileId`, `nextChunkIndex`, `bytesReceived`).
- Calculates missing chunk arrays (`getMissingChunks`) for selective resumptions.

### `FileAssembler` (`FileAssembler.ts`)
- Reassembles incoming chunks into files through `FileWriter`.
- **Out-of-Order Delivery**: Tracks received chunk indexes independently, allowing chunks to arrive in any sequence.
- **Duplicate Protection**: Returns `{ status: 'duplicate' }` when a chunk is re-received, ignoring the payload without writing twice or corrupting the file.

### `TransferStaging` (`TransferStaging.ts`)
- In-flight container managing temporary file fragments.
- Provides `cleanupAbandoned()` to purge incomplete or expired transfer buffers.

### `Integrity` (`Integrity.ts`)
- Computes and verifies chunk/file hashes.
- In simulated web environments, clearly marked as a deterministic development-only integrity simulator. Future native platform adapters replace this with hardware-accelerated SHA-256 routines.

---

## 4. Folder & Relative Path Reconstruction

Folders are represented via logical relative paths:
```
Project/
Project/src/
Project/src/App.tsx
Project/package.json
```
- Sender never transmits absolute paths (e.g. `/Users/hemanth/...` or `C:\...`).
- Receiver reconstructs the folder tree beneath the user-designated target destination folder.

---

## 5. Future Native Platform Implementation

To substitute real disk I/O in native environments:
1. Implement `NativeFileReader` using native platform POSIX/Win32/Android ContentResolver file channels.
2. Implement `NativeFileWriter` using native atomic file staging and temporary spool files (`.syntra_tmp`).
3. Implement `NativeFileEngine` implementing `FileEngine` and register it via `FileEngineManager.getInstance().setEngine(new NativeFileEngine())`.
4. The rest of the NearShare application (Queue, Protocol, Review, Navigation, UI) remains unchanged.
