# NearShare — Desktop Runtime Feasibility Audit (Windows & macOS)

> **Status**: Architectural & Feasibility Audit  
> **Target Platforms**: Windows 10/11 (x64/ARM64) & macOS 12+ (Apple Silicon / Intel)  
> **Document Version**: 1.0  
> **Labels Used**: `[FACT]`, `[CANDIDATE]`, `[ASSUMPTION]`, `[NOT YET VERIFIED]`

---

## 1. Current Repository & Technology Stack Audit

`[FACT]` The repository was thoroughly inspected across configuration files, package manifests, and source modules.

| Metric / Component | Current Project State |
| :--- | :--- |
| **Framework / Core** | React `19.2.8` + React DOM `19.2.8` |
| **Build Tool & Bundler** | Vite `8.3.0` (`@vitejs/plugin-react` `6.1.1`) |
| **TypeScript Version** | TypeScript `~6.0.2` (Configured with `target: ES2023`, `moduleResolution: bundler`, `lib: ["ES2023", "DOM"]`) |
| **Package Manager** | `npm` (with `package-lock.json` lockfile) |
| **Styling & Animation** | Tailwind CSS `v4.3.3` (`@tailwindcss/vite`), Framer Motion `13.4.1`, Lucide React `1.47.0`, Canvas Confetti `1.9.4` |
| **Linter** | `oxlint` `1.81.0` (`.oxlintrc.json`) |
| **Development Command** | `npm run dev` (`vite`) |
| **Production Build Command**| `npm run build` (`tsc -b && vite build`) |
| **Build Output** | Single-page static bundle output to `dist/` (`dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js`) |
| **Routing Architecture** | State-driven / component-level screen navigation via `CentralTransferVessel`, `FloatingNavPill`, and React Context. No browser-only routing libraries (e.g. `react-router` or `history` API manipulation) are hard-coded. |
| **Browser API Usage** | `[FACT]` `localStorage` is used for preferences and mock device persistence. In-memory `Blob` and standard timers (`setTimeout`, `setInterval`) are used in mock engines. |
| **Node.js API Usage** | `[FACT]` Zero Node.js runtime APIs (`fs`, `net`, `child_process`, `crypto`, `path`, etc.) are imported or utilized in `src/`. React components strictly adhere to standard web APIs. |
| **Server-Side Code** | `[FACT]` Zero backend server code exists in the repository. The frontend is fully decoupled and standalone. |

---

## 2. Desktop Runtime Requirements

To transition NearShare from simulated mock operations into a production desktop application for Windows and macOS, the eventual desktop host shell must satisfy concrete OS integration requirements:

### 2.1 Filesystem Capabilities
- `[FACT]` **Native File & Folder Selection**: Access to OS native dialogs (`IFileOpenDialog` on Windows, `NSOpenPanel` on macOS) without browser security restrictions or folder path sanitization.
- `[FACT]` **Persistent Directory Access**: Read/write access to user-selected download folders and drag-and-drop targets without requiring permission re-prompts across launches.
- `[FACT]` **Random-Access Chunked I/O**: Ability to seek, read, and write discrete 4 MiB chunks at specific byte offsets (`readChunk(fileId, offset, length)`, `writeChunk(fileId, offset, data)`) for out-of-order transmission and resume checkpoints.
- `[FACT]` **Large-File Streaming**: Ability to transfer multi-gigabyte files (10 GB – 100 GB+) and APK/bundle files as standard binary streams without loading full file payloads into memory.

### 2.2 Networking Capabilities
- `[FACT]` **Direct Mode (Peer-to-Peer)**: Low-level radio access to establish direct device-to-device peer links without an intermediate Wi-Fi router.
- `[FACT]` **Wi-Fi / LAN Mode**: Local subnet peer discovery via Multicast DNS (mDNS) / SSDP and high-throughput bidirectional TCP/TLS or QUIC socket streams.
- `[FACT]` **Connection Telemetry & Flow Control**: Real-time measurement of RTT latency, socket throughput, backpressure signals, and socket reconnection hooks.
- `[FACT]` **Background Execution**: Prevention of OS process suspension when the window is minimized or closed during active multi-gigabyte transfers.

### 2.3 System & OS Services
- `[FACT]` **System Tray & Menu Bar**: Ability to minimize NearShare to the Windows Taskbar Notification Area or macOS Menu Bar to maintain discovery availability.
- `[FACT]` **Native OS Notifications**: Interactive system notifications for incoming transfer requests, progress milestones, and completion.
- `[FACT]` **Secure Storage**: Access to Windows Credential Manager and macOS Keychain for long-term device identity keys and trusted peer certificates.
- `[FACT]` **Deep Linking & File Associations**: Registration of `nearshare://` URI schemes and `.syntra` file bundle association handlers.
- `[FACT]` **Lifecycle Events**: Notification hooks for system sleep, wake, battery saver mode, and network interface changes.

---

## 3. Candidate Desktop Architecture Evaluation

`[FACT]` No desktop framework has been installed. Below is a factual comparison of candidate desktop architectures evaluated against NearShare's specific performance and networking requirements.

### Candidate A: Tauri (v2) `[CANDIDATE]`
- **Frontend Compatibility**: Direct compatibility with existing React 19 + Vite bundle. Uses OS Webview (`WKWebView` on macOS, `WebView2` on Windows).
- **Native Filesystem Access**: High-performance asynchronous Rust backend with native POSIX/Win32 file streaming, memory-mapped files, and low memory overhead.
- **Native Networking Access**: Rust standard library and crates provide raw TCP/UDP/QUIC sockets, mDNS, and FFI hooks to platform Wi-Fi/Bluetooth C/C++ APIs.
- **Background Execution**: Low background memory footprint (~30–50 MB RAM). Supports system tray, menu bar, and background daemon threads natively.
- **Application Binary Size**: Compact binary size (~10–25 MB installer).
- **Platform Support**: First-class support for macOS (Universal Binary) and Windows (MSI/NSIS).
- **Native Bridge Integration**: Rust IPC commands map 1:1 with `NativeBridge` (`invoke('bridge_request', payload)`).
- **Signing & Notarization**: Standard Apple Developer ID code signing/notarization and Windows Authenticode signing pipelines.
- **Direct Mode Limitations**: `[NOT YET VERIFIED]` Direct Wi-Fi P2P and Apple Multipeer require writing custom Rust FFI bindings to Apple Objective-C/Swift frameworks and Windows WinRT/C++ APIs.

### Candidate B: Electron `[CANDIDATE]`
- **Frontend Compatibility**: Direct 100% compatibility with React 19 + Vite. Bundles dedicated Chromium runtime and Node.js.
- **Native Filesystem Access**: Comprehensive Node.js `fs` streams and file handles. High throughput, but garbage collection and IPC serialization over Electron `contextBridge` require careful buffer management.
- **Native Networking Access**: Node.js `net`, `dgram`, and `tls` sockets. Native direct P2P requires C++ Node-API (`N-API`) native addons.
- **Background Execution**: Supports tray and background tasks, but idle memory footprint is significantly higher (~120–250 MB RAM).
- **Application Binary Size**: Large binary footprint (~80–120 MB compressed installer).
- **Platform Support**: Mature cross-platform support with extensive tooling (Electron Builder).
- **Native Bridge Integration**: Standard IPC `ipcRenderer.invoke` maps cleanly to `NativeBridge`.
- **Direct Mode Limitations**: `[NOT YET VERIFIED]` Interfacing with native Wi-Fi Direct or Multipeer requires compiling and maintaining native C++ Node addons for each platform architecture (x64, arm64).

### Candidate C: Pure Native Desktop Shells (Swift/AppKit on macOS + C++/WinUI 3 on Windows) `[CANDIDATE]`
- **Frontend Compatibility**: Hosts the compiled Vite React web app inside native WebViews (`WKWebView` on macOS, `WebView2` on Windows), communicating via `postMessage` / script message handlers.
- **Native Filesystem Access**: Native OS file APIs (`NSFileHandle`, `FileStream`, Win32 Overlapped I/O). Optimal I/O performance.
- **Native Networking Access**: Direct access to native OS networking APIs: `Network.framework` and `MultipeerConnectivity` on macOS; `Windows.Devices.WiFiDirect` and `Windows.Networking.Sockets` on Windows.
- **Background Execution**: Smallest possible memory footprint (< 25 MB RAM). Native background tasks, power assertion APIs (`IOPMAssertionCreateWithName`, Windows Power Availability Requests).
- **Application Binary Size**: Minimal binary size (< 10 MB).
- **Development Complexity**: Highest development complexity — requires maintaining two distinct native codebases (Swift + C#/C++).
- **Direct Mode Advantage**: Direct, unmediated access to low-level peer-to-peer radios without intermediary FFI layers.

### Candidate D: Wails (Go-based) `[CANDIDATE]`
- **Frontend Compatibility**: Full compatibility with Vite/React build. Uses OS WebViews.
- **Native Filesystem & Networking Access**: Go standard library provides robust network sockets, filesystem I/O, and cross-compilation.
- **Direct Mode Limitations**: `[NOT YET VERIFIED]` CGO bindings required to access Apple Multipeer or WinRT Wi-Fi Direct APIs, adding compilation friction.

---

## 4. Analysis: Desktop Shell vs. OS-Native Direct Networking

`[FACT]` A desktop webview or JavaScript runtime environment **alone** is fundamentally incapable of executing NearShare's Direct mode without host OS-native APIs.

### Why Direct Mode Requires OS-Native Subsystems:
1. **No Access Point / Router Dependency**: Direct mode creates an ad-hoc, ephemeral radio link directly between two physical network cards. Standard Web APIs (`fetch`, `WebSocket`, `WebRTC`) assume an existing IP routing infrastructure or signaling server.
2. **Platform-Specific Radio Negotiation**:
   - **macOS / iOS**: Direct peer communication relies on Apple's proprietary AWDL (Apple Wireless Direct Link) or `MultipeerConnectivity` framework.
   - **Windows**: Direct communication uses Wi-Fi Direct (`Windows.Devices.WiFiDirect`) to negotiate P2P Group Owner (GO) and P2P Client roles.
   - **Android**: Direct communication uses Android's `WifiP2pManager` or Google Nearby Connections.
3. **Bluetooth Auxiliary Channel**: Exchanging discovery beacons, connection parameters, and security tokens out-of-band requires OS Bluetooth Low Energy (BLE) peripheral/central APIs (`CoreBluetooth` on macOS, `Windows.Devices.Bluetooth` on Windows).

`[FACT]` The frontend JavaScript code must delegate all radio negotiation, socket binding, and raw chunk transmission to the host shell via `NativeTransportBridge`.

---

## 5. Browser Limitation Audit

The following matrix categorizes NearShare requirements by operational environment boundary:

| Feature / Requirement | Browser Tab (Pure Web) | Browser with Permissions | Requires Native Shell | Requires Platform-Native OS API |
| :--- | :---: | :---: | :---: | :---: |
| UI Rendering & State Management | `[FACT]` Possible | — | — | — |
| Protocol State Machine & Envelopes | `[FACT]` Possible | — | — | — |
| In-Memory Chunk Assembly Simulation | `[FACT]` Possible | — | — | — |
| Local Storage (Settings & History) | `[FACT]` Possible | — | — | — |
| Single File Selection (Read-only) | — | `[FACT]` Possible (`<input type="file">`) | — | — |
| Folder Selection & Tree Reading | — | `[FACT]` Web File System Access API *(Chromium only)* | — | — |
| Persistent Folder Target (No re-prompt) | — | — | `[FACT]` Required | — |
| Random-Access Chunked File Write | — | — | `[FACT]` Required | — |
| 100 GB+ File Stream Without RAM Spikes | — | — | `[FACT]` Required | — |
| System Tray / Menu Bar Resident | — | — | `[FACT]` Required | — |
| Native System Notifications | — | `[FACT]` Web Notifications *(Limited)* | `[FACT]` Required *(Full OS integration)* | — |
| OS Keychain / Credential Manager | — | — | `[FACT]` Required | — |
| Local Subnet Discovery (mDNS / SSDP) | — | — | — | `[FACT]` Required *(Raw UDP multicast)* |
| Local Subnet TCP/TLS Socket Server | — | — | — | `[FACT]` Required *(Listening sockets)* |
| Wi-Fi Direct P2P Group Negotiation | — | — | — | `[FACT]` Required *(Platform Wi-Fi driver)* |
| Apple Multipeer / AWDL Direct Link | — | — | — | `[FACT]` Required (`MultipeerConnectivity`)|
| BLE Beacon Advertising & Scanning | — | `[FACT]` Web Bluetooth *(Client only, no peripheral)* | — | `[FACT]` Required *(Bidirectional BLE)* |
| Sleep Prevention During Active Transfer | — | `[FACT]` Screen Wake Lock *(Screen only)* | `[FACT]` Required *(System power assertion)* | — |

---

## 6. Native Bridge Architectural Mapping

`[FACT]` The existing contracts in `src/core/` remain unchanged. The conceptual IPC mapping across candidate desktop runtimes connects as follows:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Application (Vite)                        │
│                (UI, State, TransferQueue, FileEngine)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    PlatformBridge / NativeBridge                       │
│      (Platform-neutral async IPC request/response & event dispatcher)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
 ┌─────────────▼─────────────┐             ┌─────────────▼─────────────┐
 │       Tauri Backend       │   - OR -    │     Electron Backend      │
 │  (Rust Tauri Commands)    │             │  (Node.js contextBridge)  │
 └─────────────┬─────────────┘             └─────────────┬─────────────┘
               │                                         │
 ┌─────────────▼─────────────┐             ┌─────────────▼─────────────┐
 │      Rust OS Modules      │             │   C++ Node-API Addons     │
 │  (std::fs, tokio, sockets)│             │ (fs, native socket addon) │
 └─────────────┬─────────────┘             └─────────────┬─────────────┘
               │                                         │
               └────────────────────┬────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Host Operating System Services                      │
│     (Windows Win32/WinRT APIs  /  macOS Cocoa/Network.framework)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Filesystem Mapping Strategy (Opaque References)

`[FACT]` NearShare's architecture strictly isolates the UI and network layers from absolute filesystem paths:

1. **Opaque File Handles**:
   ```typescript
   export interface NativeFileReference {
     id: string;
     platform: NativePlatform;
     kind: 'file' | 'folder';
     displayName: string;
     sizeBytes: number;
     opaqueHandle?: string; // Internal token (e.g. UUID, file descriptor index)
   }
   ```
2. **Privacy Boundary**:
   - `React UI`, `TransferQueue`, `TransferHistory`, `SecurityContext`, and `ProtocolStateMachine` **never** receive raw host paths (e.g. `C:\Users\Admin\Documents\secret.pdf` or `/Users/user/Downloads/...`).
   - Only `displayName` and `sizeBytes` are exposed upwards.
3. **Platform-Specific Resolution**:
   - **Windows Host**: Maps `opaqueHandle` internally to a Win32 file path or `IStorageItem`.
   - **macOS Host**: Maps `opaqueHandle` internally to a security-scoped bookmark URL or POSIX path.

---

## 8. Networking Implementation Boundary

`[FACT]` Responsibilities across the networking stack are partitioned to ensure complete architectural decoupling:

```
Layer Ownership Hierarchy:

┌────────────────────────┐
│    TransportManager    │ ───► Owns: High-level mode selection (Direct vs Wi-Fi),
└───────────┬────────────┘            session coordination, UI status reporting.
            │
┌───────────▼────────────┐
│ NativeTransportManager │ ───► Owns: Bridge registration, telemetry synchronization,
└───────────┬────────────┘            lifecycle state validation.
            │
┌───────────▼────────────┐
│  NativeTransportBridge │ ───► Owns: IPC contract for discovery, connection,
└───────────┬────────────┘            chunk streaming, pause/resume, cancel, metrics.
            │
┌───────────▼────────────┐
│  Host OS Native Shell  │ ───► Owns: Actual TCP/UDP sockets, TLS handshake,
└────────────────────────┘            mDNS broadcast, Wi-Fi Direct / Multipeer radio links.
```

- **Layers that DO NOT own raw sockets**: `React UI`, `TransferQueue`, `ProtocolStateMachine`, `FileEngine`.
- **Layers that DO NOT own file chunking/assembly**: `NativeTransportBridge`, host OS networking code (file chunking and checksum verification remain the exclusive responsibility of `FileEngine` and `FileAssembler`).

---

## 9. Security Boundary & Protocol Preservation

`[FACT]` The eventual native desktop runtime integrates with NearShare's security model without modifying existing cryptographic contracts:

1. **Protocol Preservation**:
   - The desktop runtime serves as a binary pipe for `ProtocolEnvelope` messages (`HANDSHAKE_INIT`, `HANDSHAKE_RESP`, `AUTH_CHALLENGE`, `TRANSFER_PROPOSAL`, `TRANSFER_ACCEPT`, `CHUNK_DATA`, `TRANSFER_COMPLETE`).
   - Transport bridges transport raw bytes; they do not alter protocol message semantics.
2. **Pairing & Trust Continuity**:
   - Device identity keys, trust states (`trusted`, `prompt`, `rejected`), and verification PIN generation execute within `DeviceTrustContext` / `SecurityContext`.
   - The desktop runtime provides OS-level secure storage (Keychain on macOS, Data Protection API / Credential Locker on Windows) to persist long-term identity keys.
3. **Mock vs. Production Cryptography**:
   - `[FACT]` Current security modules provide structured contracts and deterministic mock operations for development. Production cryptography (AES-256-GCM / ChaCha20-Poly1305 + Noise Protocol / TLS 1.3 session encryption) will be bound at the native bridge layer.

---

## 10. Build, Packaging & Distribution Strategy

### 10.1 Windows Distribution Requirements `[CANDIDATE]`
- **Packaging Format**: MSIX or standalone NSIS/WiX executable installer.
- **Code Signing**: Microsoft Authenticode digital certificate (EV certificate recommended to prevent Windows SmartScreen warnings).
- **Architecture Targets**: `x86_64` (Standard PCs) and `arm64` (Windows on Snapdragon/ARM).
- **Auto-Update Mechanism**: In-app updater via GitHub Releases / CDN or Microsoft Store package updates.

### 10.2 macOS Distribution Requirements `[CANDIDATE]`
- **Packaging Format**: Signed `.app` bundle packaged inside a `.dmg` disk image or `.pkg` installer.
- **Code Signing & Hardened Runtime**: Apple Developer ID Application certificate with Hardened Runtime entitlements (`com.apple.security.network.client`, `com.apple.security.network.server`, `com.apple.security.files.user-selected.read-write`).
- **Apple Notarization**: Submission to Apple Notarization Service (`xcrun notarytool`) and stapling ticket (`xcrun stapler`) to avoid Gatekeeper blocking.
- **Architecture Targets**: Universal 2 Binary (`arm64` Apple Silicon + `x86_64` Intel).

---

## 11. Recommended Future Project Directory Structure

`[CANDIDATE]` When desktop implementation begins in future steps, the recommended repository structure organizes native code cleanly without disrupting the existing React web application:

```
SYNTRA / NearShare
├── package.json
├── vite.config.ts
├── tsconfig.json
│
├── src/                          # Shared Web Application & Protocol Core
│   ├── components/               # React UI Components (Liquid Vessel, Nav, Inspectors)
│   ├── context/                  # State Providers (Transport, FileEngine, NativeBridge, Shell)
│   ├── core/                     # Platform-neutral Core Engine
│   │   ├── file/                 # File Engine & Assembly
│   │   ├── filesystem/           # Filesystem Adapter Contracts
│   │   ├── native/               # Native Bridge IPC Contracts
│   │   ├── protocol/             # Wire Protocol State Machine
│   │   ├── security/             # Device Trust & Crypto Contracts
│   │   ├── shell/                # Native Shell Contracts
│   │   └── transport/            # Transport Manager & Native Bridges
│   └── index.css                 # Monochrome Design System
│
├── src-tauri/                    # Candidate Desktop Shell (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs               # Shell Entry & Lifecycle
│   │   ├── bridge/               # IPC Command Handlers (NativeBridge implementation)
│   │   ├── filesystem/           # Native File Streaming & Opaque Handles
│   │   └── transport/            # Native Sockets (TCP/mDNS/Direct Radio FFI)
│   └── icons/
│
└── docs/                         # Architecture Specifications & Feasibility Audits
    ├── desktop-runtime-audit.md  # (This Document)
    └── ...
```

---

## 12. Decision Criteria Evaluation Matrix

| Decision Criterion | Tauri (v2) `[CANDIDATE]` | Electron `[CANDIDATE]` | Native AppKit / WinUI `[CANDIDATE]` |
| :--- | :---: | :---: | :---: |
| **Windows + macOS Support** | Tier 1 First-class | Tier 1 First-class | Separate native codebases |
| **React 19 / Vite Compatibility** | 100% Direct | 100% Direct | 100% via WebView |
| **Native Filesystem Performance** | Excellent (Rust async I/O) | Good (Node.js streams) | Maximum (Native OS APIs) |
| **Native Networking Integration** | High (Rust sockets + FFI) | High (Node.js + N-API) | Maximum (Direct OS APIs) |
| **Direct Mode Feasibility** | Viable (FFI to OS radios) | Viable (C++ Addons) | Optimal (Direct Swift/WinRT) |
| **Wi-Fi / LAN Mode Feasibility** | Excellent (Tokio / Socket2) | Excellent (Node net/dgram)| Excellent (OS Sockets) |
| **Large-File Chunk Streaming** | Zero-copy memory mapped | IPC buffer serialization | Direct OS File Descriptors |
| **Background / Tray Execution** | Built-in (~35 MB RAM) | Built-in (~180 MB RAM) | Built-in (< 20 MB RAM) |
| **App Size & Runtime Overhead** | ~15 MB installer | ~90 MB installer | ~8 MB installer |
| **Signing / Notarization Support** | Automated via CLI | Automated via Builder | Xcode / MSBuild native |
| **Long-term Mobile Code Sharing** | High core UI sharing | High core UI sharing | High core UI sharing |

---

## 13. Major Technical Risks

1. **Cross-Platform Direct P2P Interoperability** `[FACT]`:
   - Apple's `MultipeerConnectivity` cannot natively establish Wi-Fi Direct sessions with Windows `WiFiDirect` without a shared intermediary protocol (e.g. ad-hoc SoftAP or local network).
2. **OS Permission Dialogs & Firewall Alerts** `[FACT]`:
   - Windows Defender Firewall prompts the user on first TCP server socket bind (`INADDR_ANY`).
   - macOS requires explicit user approval for Local Network Discovery (`NSLocalNetworkUsageDescription`).
3. **OS Power Throttling & Sleep** `[FACT]`:
   - macOS App Nap and Windows Connected Standby can suspend socket streams if power assertion APIs are not properly acquired during multi-gigabyte transfers.

---

## 14. Open Technical Questions

1. `[NOT YET VERIFIED]` Can macOS `WKWebView` communicate large binary ArrayBuffers to the Rust/Native backend at 100+ MB/s without base64 serialization overhead?
2. `[NOT YET VERIFIED]` What is the optimal cross-platform Direct mode radio fallback strategy between Windows (Wi-Fi Direct) and macOS (Local Hotspot / SoftAP)?
3. `[NOT YET VERIFIED]` Will Windows `WebView2` runtime deployment require evergreen bootstrapper installation on older Windows 10 machines?

---

## 15. Recommended Next Implementation Experiment

`[CANDIDATE]` To validate the desktop architecture safely without committing to heavy dependencies, the recommended next step is:
1. **Create an isolated spike branch** testing a lightweight **Tauri v2** shell encapsulating the current Vite build.
2. **Benchmark Binary IPC**: Test streaming 1 GB of mock chunk data from the Rust backend to the `FileEngine` via `NativeBridge` IPC to measure throughput and memory overhead.
3. **Validate Local Discovery**: Implement an mDNS broadcast experiment in Rust/C++ to confirm cross-subnet discovery between a Windows PC and a Mac.
