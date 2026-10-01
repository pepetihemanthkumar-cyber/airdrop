# NearShare Native Shell Architecture Specification (v1.0)

This document defines the host application shell architecture that encapsulates NearShare across desktop (macOS, Windows) and mobile (Android, iOS) platforms.

---

## 1. Native Shell Architecture

The `NativeShell` interface provides the platform-neutral boundary for operating system services:

```
┌────────────────────────────────────────────────────────┐
│                      React UI                          │
│             (Vessel, Queue, Review, Settings)          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                     ShellManager                       │
│           (Singleton Lifecycle & Service Hub)          │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      NativeShell                       │
│        (Platform Lifecycle, Storage, Notifications)    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│         Host Application Native Runtime Shell          │
│        (macOS / Windows / Android / iOS / Web)         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Shell Lifecycle States

| State | Description |
| :--- | :--- |
| `starting` | Host shell initialization and dependency bootstrap |
| `ready` | Core runtime initialized; UI active and listening |
| `background` | Minimized to tray (desktop) or background state (mobile) |
| `foreground` | Window active and visible to user |
| `suspending` | System preparing for sleep or background throttling |
| `stopping` | Graceful shutdown sequence |
| `stopped` | Application terminated; resources released |
| `error` | Unrecoverable shell failure |

---

## 3. Cross-Platform Shell Services

- **Notifications**: Delivers native system notifications for transfer completion, arrival, and pairing requests.
- **Clipboard**: Reads/writes text for quick verification PINs and sharing.
- **Secure Storage**: Accesses OS-level keychain/keystore for cryptographic keys.
- **Deep Links**: Handles custom URI scheme triggers (`nearshare://...`).
- **File Associations**: Opens `.syntra` or shared file bundles directly in NearShare.
