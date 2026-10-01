# NearShare Native Platform Adapter Strategy & Bridge Contract (v1.0)

> **"NativeBridge is a boundary contract, not a claim that native platform support is already implemented."**

This document specifies the production architecture connecting NearShare's platform-neutral `FileSystemAdapter` and application stack to native operating system hosts across macOS, Windows, Android, and iOS.

---

## 1. Why `NativeBridge` Exists

NearShare's frontend application is built in React and TypeScript. In production, NearShare must execute inside native desktop and mobile application shells while preserving total isolation from platform-specific APIs.

### Difference Between `FileSystemAdapter` and `NativeBridge`:
- **`FileSystemAdapter` (`src/core/filesystem/`)**:
  - Exposes file-centric operations (`read`, `write`, `scanDirectory`, `resolveDestination`) to the `FileEngine`.
  - Operates purely in terms of `FileReference` and `FileMetadata`.
- **`NativeBridge` (`src/core/native/`)**:
  - Low-level asynchronous IPC boundary connecting the web/JS runtime to the host operating system shell (e.g. Swift, Kotlin, Win32, C++).
  - Handles broader platform services: runtime permissions, native file/folder pickers, background execution modes, and lifecycle state changes.

```
┌────────────────────────────────────────────────────────┐
│                      React UI                          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│          Core Contracts (TransferQueue, FileEngine)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    FileSystemAdapter                   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      NativeBridge                      │
│             (IPC Message Passing Contract)             │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│          Desktop / Mobile Host Application Shell       │
│      (Swift / Kotlin / Win32 / Platform Run-time)      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Desktop vs Mobile Platform Boundary

The React application code must never contain platform-specific imports (e.g. `import fs from 'fs'` or Android `ContentResolver` references).

| Concern | Desktop (macOS / Windows) | Mobile (Android / iOS) |
| :--- | :--- | :--- |
| **File Selection** | System File / Folder dialogs (`NSOpenPanel`, `IFileOpenDialog`) | Document Picker / SAF (`UIDocumentPickerViewController`, `ACTION_OPEN_DOCUMENT`) |
| **Storage Access** | POSIX / Win32 paths, security-scoped bookmarks | Scoped storage, persisted content URIs (`takePersistableUriPermission`) |
| **Background Execution**| Process remains active in menu bar / system tray | Strictly throttled by OS; requires Foreground Service / Background Session |
| **Local Discovery** | Multicast DNS / Bonjour / SSDP / BLE Peripheral | Local network permission prompt, Bluetooth peripheral background modes |

---

## 3. Binary Data Transfer Contract

When streaming multi-gigabyte files across the bridge:
1. **No Massive Memory Buffers**: Avoid transferring whole files across IPC in a single buffer.
2. **Chunked Streaming**: Binary data moves in discrete chunks (e.g. 4 MiB `DEFAULT_CHUNK_SIZE`).
3. **No Unnecessary Base64 Overhead**: For production bridges, binary data will cross using zero-copy shared memory buffers, direct ArrayBuffer transfer, or file descriptor streaming rather than base64 strings.
4. **Backpressure & Cancellation**: Every chunk read/write request carries a distinct `requestId` enabling cooperative pause and cancellation.

---

## 4. Opaque References & Security Isolation

- React and protocol messages only see opaque identifiers:
  ```typescript
  export interface NativeFileReference {
    id: string;
    platform: NativePlatform;
    kind: 'file' | 'folder';
    displayName: string;
    opaqueHandle?: string; // Internal token known only to platform adapter
  }
  ```
- **Rule**: Host absolute paths (`/Users/...`, `C:\...`, `/storage/emulated/0/...`) must **never** be exposed in protocol messages or UI state.

---

## 5. Permission Model (`PermissionState`)

Permissions are modeled across platform-neutral states:
- `unknown`, `requesting`, `granted`, `denied`, `restricted`, `expired`, `revoked`, `unsupported`.

**Rule**: Permissions are requested on demand when a feature is activated, never aggressively on application startup.

---

## 6. Candidate Platform Implementation Strategies

*(The following are architectural candidates for future native shell implementation)*

### macOS Candidate Architecture
- **Host**: Swift native shell (Cocoa / AppKit).
- **File Access**: `NSFileCoordinator` with `startAccessingSecurityScopedResource()` for sandbox bookmarks.
- **Chunk I/O**: High-performance POSIX `pread`/`pwrite` on file descriptors.
- **Networking**: Apple `Network.framework` (`NWBrowser`, `NWListener`) and `CoreBluetooth`.

### Windows Candidate Architecture
- **Host**: C++ / C# WinUI 3 or lightweight WebView2 host.
- **File Access**: `Windows.Storage.Pickers` and standard Win32 `CreateFileW` with `FILE_FLAG_SEQUENTIAL_SCAN`.
- **Chunk I/O**: Asynchronous overlapped I/O (`ReadFile`, `WriteFile`).
- **Networking**: Windows Sockets 2 (Winsock) and `Windows.Devices.Bluetooth`.

### Android Candidate Architecture
- **Host**: Kotlin Android application shell.
- **File Access**: Storage Access Framework (SAF) (`DocumentsContract`, `ContentResolver.openFileDescriptor`).
- **Chunk I/O**: `ParcelFileDescriptor` channel streaming.
- **Networking**: `WifiP2pManager` (Wi-Fi Direct), `Nearby Connections API`, and `BluetoothLeAdvertiser`.

### iOS Candidate Architecture
- **Host**: Swift iOS application shell.
- **File Access**: `UIDocumentPickerViewController` with security-scoped URL coordination.
- **Chunk I/O**: Sandboxed app container file reads and Background URLSession tasks.
- **Networking**: `MultipeerConnectivity` or `Network.framework` local peer-to-peer listeners.

---

## 7. Deterministic Test Suite (`mockNativeBridgeTestSuite.ts`)

Covers 17 key bridge contract operations:
1. Resolve Platform Target
2. Retrieve Bridge Capabilities
3. Request Runtime Permission
4. Simulate Native File Picker
5. Simulate Native Directory Picker
6. Read File Metadata via Bridge
7. Read Binary Chunk via Bridge
8. Create Destination File via Bridge
9. Write Binary Chunk via Bridge
10. Finalize File via Bridge
11. Scan Folder via Bridge
12. Resolve Destination Descriptor
13. Delete Temporary File via Bridge
14. Release Reference Handle
15. Native Error Normalization
16. Native Exception Propagation
17. Bridge Availability Verification
