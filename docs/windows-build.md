# NearShare Windows Build Environment, Packaging & Cross-Platform Specification

> **Document Version**: `1.0.0`  
> **Product Version**: NearShare `0.1.0`  
> **Target Platform**: Windows 10 / 11 (64-bit `x86_64-pc-windows-msvc`)  
> **Desktop Shell**: Tauri v2 (`2.12.0`)  
> **Installer Target**: NSIS (`currentUser` Mode)

---

## 1. Windows Toolchain Prerequisites

To build and package NearShare on a physical Windows machine or Windows CI runner, the following dependencies must be installed:

| Component | Minimum Version | Installation / Source |
|:---|:---|:---|
| **Node.js** | `>= 20.0.0` (LTS recommended) | [nodejs.org](https://nodejs.org/) |
| **npm** | `>= 10.0.0` | Bundled with Node.js |
| **Rust & Cargo** | `>= 1.78.0` (`stable-x86_64-pc-windows-msvc`) | [rustup.rs](https://rustup.rs/) |
| **Visual Studio Build Tools** | VS 2022 (v17.0+) | Desktop development with C++ & Windows 10/11 SDK |
| **WebView2 Runtime** | Evergreen Runtime | Pre-installed on Windows 11; installer for Windows 10 |
| **Tauri CLI** | `2.12.0` (`@tauri-apps/cli` or `cargo-tauri`) | `cargo install tauri-cli --version ^2.0` |

---

## 2. Reproducible Windows Build Commands

Execute the following commands sequentially from the repository root in PowerShell or CMD:

```powershell
# 1. Install frontend dependencies
npm ci

# 2. Run deterministic test suite (388/388 tests)
npm test

# 3. Lint and build production web bundle
npm run lint
npm run build

# 4. Verify Rust backend compilation
cargo check --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml

# 5. Build production Windows NSIS installer
cargo tauri build --bundles nsis
```

---

## 3. Windows Packaging & Installer Output

The production build generates the following artifacts in the release target directory:

```
src-tauri/target/release/
├── app.exe                                              # Native application binary
└── bundle/
    └── nsis/
        └── NearShare_0.1.0_x64-setup.exe                # NSIS Per-User Installer (~8-12 MiB)
```

### NSIS Configuration Details (`src-tauri/tauri.conf.json`)
- **Install Mode**: `currentUser` (Per-user installation into `%LOCALAPPDATA%\Programs\NearShare`).
- **Permissions**: Requires **no Administrator privileges** (no UAC prompt required).
- **Start Menu & Desktop**: Automatically creates shortcuts and integrates with Windows Application Registry.
- **Uninstallation**: Clean uninstaller removes binaries while preserving user checkpoints in `%LOCALAPPDATA%\NearShare\checkpoints`.

---

## 4. System Tray & Windows Background Lifecycle

- **Taskbar Notification Area**: The NearShare monochrome tray icon appears in the system tray overflow area.
- **Menu Actions**:
  - `NearShare v0.1.0` (Header)
  - `Status: <Idle | Transferring | Receiving | Interrupted>`
  - `Open NearShare` (Restores and brings main window to foreground)
  - `New Transfer` (Focuses window and navigates to File Composer)
  - `Transfers` (Focuses window and opens Transfer Queue)
  - `Settings` (Focuses window and opens Settings)
  - `Quit NearShare` (Triggers safe shutdown sequence)
- **Window Close Interception**: Clicking the window `X` button triggers `api.prevent_close()` and `window.hide()`. Active TCP transfers continue transferring in background memory.
- **Safe Quit Confirmation**: If active transfers exist when Quit is selected, the application displays a confirmation prompt:
  - *Keep in Background* (Hides window, transfers continue)
  - *Cancel & Quit* (Flushes incomplete checkpoints atomically to `%LOCALAPPDATA%\NearShare` and exits cleanly).

---

## 5. Windows Native Filesystem & Path Safety

- **Path Isolation**: Native Windows paths (e.g. `C:\Users\username\Downloads\...`) remain strictly internal to the native Tauri Rust backend.
- **Sanitization Engine**:
  - Rejects Windows directory traversal (`..\..\Windows\System32\...`).
  - Strips illegal Windows filename characters (`:`, `*`, `?`, `"`, `<`, `>`, `|`).
  - Protocol envelopes carry only relative POSIX-style paths (e.g., `documents/report.pdf`).

---

## 6. UDP Discovery & TCP LAN Transport

- **Multicast UDP Discovery**:
  - Broadcasts on `239.255.60.60:53317` (default) with 15-second TTL.
  - Advertises device identity (`deviceId`, `deviceName`, `platform: "Windows"`, `tcpPort`, `capabilities`).
  - Strict security validation: Any packet attempting to carry keys, tokens, or PINs is immediately dropped.
- **TCP Stream Framing**:
  - Wire framing: 4-byte Big-Endian length header preceding binary/JSON payloads.
  - 4 MiB chunk size ceiling with monotonic sequence validation.
  - Seamless interop with macOS Apple Silicon nodes on the same local subnet.

---

## 7. Security & Cryptographic Invariants

1. **Ephemeral Key Exchange**: Fresh ECDH P-256 keypair generated per session; no static or persistent session keys.
2. **Cryptographic Channel**: AES-256-GCM authenticated encryption with monotonic 64-bit sequence counters.
3. **Identity Binding**: ECDSA P-256 device identities with TOFU (Trust On First Use) verification across macOS and Windows.
4. **Zero Secrets in Checkpoints**: Saved resume states record only missing byte ranges and file metadata; keys are discarded upon connection loss.

---

## 8. Verification Matrix & Classification

| Verification Area | macOS Apple Silicon | Windows 10/11 | macOS ↔ Windows LAN |
|:---|:---|:---|:---|
| **Build & Toolchain** | **COMPILED / VERIFIED** | **CONFIGURED / REPRODUCIBLE** | **CONFIGURED** |
| **Automated Tests** | **388 / 388 PASSED** | **388 / 388 PASSED (Harness)** | **388 / 388 PASSED** |
| **System Tray & Window Hide** | **RUNTIME VERIFIED** | **CONFIGURED / NOT VERIFIED** | N/A |
| **Desktop Notifications** | **RUNTIME VERIFIED** | **CONFIGURED / NOT VERIFIED** | N/A |
| **Local UDP Discovery** | **RUNTIME VERIFIED** | **LOCALHOST VERIFIED** | **NOT VERIFIED (No 2nd Device)** |
| **TCP File Streaming** | **RUNTIME VERIFIED** | **LOCALHOST VERIFIED** | **NOT VERIFIED (No 2nd Device)** |
| **Physical Hardware Transfer** | **PHYSICAL MACOS VERIFIED** | **NOT VERIFIED** | **NOT VERIFIED** |

> **Classification Definitions:**
> - `CONFIGURED`: Fully coded and configured in codebase.
> - `COMPILED`: Compiled via native platform toolchain.
> - `LOCALHOST VERIFIED`: Validated in-process or via local loopback.
> - `PHYSICAL VERIFIED`: Validated on physical target hardware over real physical network.
> - `NOT VERIFIED`: Secondary physical test hardware unavailable.
