# NearShare Native File-System Adapter Contract (v1.0)

This document defines the platform-neutral **Native File-System Adapter** layer. It establishes how NearShare interacts with storage subsystems across macOS, Windows, Android, iOS, and Web without coupling high-level protocol or UI layers to host operating system APIs.

---

## 1. Architectural Hierarchy & Dependency Flow

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
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   FileSystemManager                    │
│      (Active Adapter Selection & Operation Dispatch)   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   FileSystemAdapter                    │
│      (Platform-Neutral Read/Write/Scan Contract)       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│          Native Platform Implementations (Future)      │
│      (macOS POSIX, Windows Win32, Android SAF, iOS)    │
└────────────────────────────────────────────────────────┘
```

### Critical Architectural Boundary:
> **"NearShare protocol messages must never contain native absolute filesystem paths."**

Absolute filesystem paths (e.g. `/Users/hemanth/...`, `C:\Users\...`, `/storage/emulated/0/...`) remain strictly quarantined inside the platform-specific `FileSystemAdapter`. The protocol and UI layers only ever receive opaque identifiers (`nativeReferenceId`) and transfer-relative paths (`relativePath`).

---

## 2. Layer Separation & Responsibilities

1. **FileSystemAdapter ↔ FileEngine Boundary**:
   - `FileSystemAdapter` owns reading native disk bytes, creating destination storage handles, scanning directory trees, and deleting temporary spool files.
   - `FileEngine` owns chunk boundary math, resume checkpoints, assembly logic, and transfer staging buffers.
   - `FileEngine` does not know whether the adapter is native macOS, Android SAF, or in-memory simulation.

2. **FileSystemAdapter ↔ Protocol Boundary**:
   - `FileMetadataReader` normalizes native metadata into `FileManifestEntry` items.
   - All paths are converted into safe canonical relative paths (e.g. `Project/src/App.tsx`).
   - The protocol transports manifests and chunks without needing host storage knowledge.

3. **FileSystemAdapter ↔ Transport Boundary**:
   - Transport is solely responsible for moving bytes across Direct Nearby or Wi-Fi channels.
   - Transport never reads from or writes to the filesystem directly.

4. **FileSystemAdapter ↔ Security Boundary**:
   - Security controls pairing, trust, and authorization.
   - `FileSystemAdapter` assumes write permissions are granted only after session handshake approval.

---

## 3. Path Safety & Traversal Prevention (`PathSafety.ts`)

To protect devices from malicious sender manifests, `PathSafety` strictly enforces transfer-relative path constraints:

- **Rejected Patterns**:
  - Parent directory traversal: `../` or `..\`
  - POSIX root slashes: `/etc/passwd`
  - Windows drive letters: `C:\Windows`
  - Windows UNC network shares: `\\server\share`
  - Null-byte injections: `\0`
  - Duplicate slashes designed to bypass path filters.
- **Accepted Formats**:
  - Safe relative paths: `photo.jpg`, `Documents/Report.pdf`, `Project/src/App.tsx`
  - Folders with trailing slashes: `Project/src/`

---

## 4. Capability Model (`FileSystemCapabilities.ts`)

| Capability | Description | Mock Adapter Support |
| :--- | :--- | :--- |
| `readFiles` | Read binary byte streams from file references | Supported |
| `writeFiles` | Stage and write binary byte streams to destination | Supported |
| `readFolders` | Recursively enumerate directory hierarchies | Supported |
| `writeFolders` | Create directory hierarchies at destination | Supported |
| `streamingRead` | Stream file data in discrete chunk segments | Supported |
| `streamingWrite` | Stream incoming chunk frames into target files | Supported |
| `randomAccessRead` | Read bytes at arbitrary byte offsets | Supported |
| `randomAccessWrite` | Write bytes at arbitrary byte offsets out-of-order | Supported |
| `filePicker` | Native OS file selection dialog | Supported (Mock) |
| `directoryPicker` | Native OS folder selection dialog | Supported (Mock) |
| `persistentAccess` | Retain access permissions across app launches | Supported (Mock) |
| `backgroundAccess` | Write files while application is in background | Supported (Mock) |
| `customDestination`| User-selected custom destination directory | Supported |

---

## 5. Mock Filesystem Adapter (`MockFileSystemAdapter.ts`)

The development and test harness includes a deterministic, in-memory implementation seeded with realistic items:
- `photo.jpg` (2.5 MB)
- `video.mp4` (8.9 MB)
- `document.pdf` (1.2 MB)
- `archive.zip` (5.3 MB)
- `application.apk` (15.7 MB)
- `project/` (Folder hierarchy containing `App.tsx`, `main.tsx`, `package.json`)

---

## 6. Future Native Platform Adapter Strategies (Candidates)

*Note: The following are architectural candidate strategies for future implementation phases:*

1. **macOS / iOS (Apple Platforms)**:
   - **Candidate Strategy**: Swift/Objective-C native bridge using `NSFileCoordinator`, `NSFilePresenter`, and Security-Scoped Bookmarks (`startAccessingSecurityScopedResource`).
   - **Streaming**: Native POSIX file descriptors (`open`, `pread`, `pwrite`, `close`) for zero-copy chunk streaming.

2. **Windows (Win32 / UWP / WinUI)**:
   - **Candidate Strategy**: Win32 native bridge or Windows Storage APIs (`Windows.Storage.StorageFile`, `StorageFolder`).
   - **Streaming**: `CreateFileW`, `SetFilePointerEx`, `ReadFile`, `WriteFile` with `FILE_FLAG_NO_BUFFERING` or `FILE_FLAG_SEQUENTIAL_SCAN`.

3. **Android**:
   - **Candidate Strategy**: Kotlin native bridge via Android Storage Access Framework (SAF) (`DocumentsContract`, `ContentResolver.openFileDescriptor`).
   - **Streaming**: Native Linux file descriptors (`ParcelFileDescriptor`) piped to Rust/C++ or Kotlin coroutine streams.

4. **Web / PWA**:
   - **Candidate Strategy**: File System Access API (`showOpenFilePicker`, `FileSystemFileHandle`, `createWritable`).

---

## 7. Deterministic Test Suite (`mockFileSystemTestSuite.ts`)

Covers 17 key scenarios:
1. Read Metadata
2. Read First Chunk
3. Read Final Partial Chunk
4. Zero-Byte File Handling
5. Create Destination File
6. Write Chunk Sequentially
7. Out-of-Order Chunk Writes
8. Duplicate Chunk Write Idempotency
9. Folder Hierarchy Scan
10. Relative Path Preservation
11. Path Traversal Rejection (`../`)
12. Absolute Path Rejection (`/`, `C:\`, `\\`)
13. Missing Reference Detection
14. Unsupported Operation Guard
15. Destination Resolution
16. Atomic File Finalization
17. Temporary File Cleanup
