# NearShare Code Signing & Notarization Integration Guide

## 1. Overview & Security Policy

NearShare desktop binaries distributed to end users on public channels must be cryptographically signed and notarized to ensure executable integrity, provenance, and prevent OS security warnings (e.g. macOS Gatekeeper, Windows SmartScreen).

### Critical Security Invariants
- **No Hardcoded Credentials**: Certificates, passwords, private keys, and Apple IDs must **never** be checked into the source tree or configuration files.
- **Graceful Unsigned Fallback**: When signing secrets are not present in the environment (e.g. local developer builds, PR runs), the build produces an explicitly labeled `UNSIGNED` binary without failing the compilation.
- **Honest Status Reporting**: Builds without signing credentials are never reported as signed or notarized.

---

## 2. macOS Code Signing & Notarization

### Required Environment Variables / GitHub Secrets
| Secret / Variable Name | Description | Example / Format |
| :--- | :--- | :--- |
| `APPLE_CERTIFICATE` | Base64-encoded Apple Developer ID Application certificate (`.p12`). | Base64 string |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting the `.p12` certificate. | Secure string |
| `APPLE_SIGNING_IDENTITY` | Full common name of the signing certificate. | `Developer ID Application: Team Name (10CHARID)` |
| `APPLE_ID` | Apple Developer Account email address. | `developer@example.com` |
| `APPLE_PASSWORD` | App-specific password generated on appleid.apple.com. | `xxxx-xxxx-xxxx-xxxx` |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team Identifier. | `ABC1234XYZ` |

### Signing & Notarization Process
1. Tauri signs the `.app` bundle using `codesign` with hardened runtime enabled (`--options runtime`).
2. Tauri packages the `.app` into a signed `.dmg` disk image.
3. The `.dmg` is submitted to Apple Notary Service (`notarytool`).
4. Upon successful notarization, the ticket is stapled to the DMG (`stapler staple`).

---

## 3. Windows Authenticode Code Signing

### Required Environment Variables / GitHub Secrets
| Secret / Variable Name | Description | Example / Format |
| :--- | :--- | :--- |
| `WINDOWS_CERTIFICATE` | Base64-encoded Microsoft Authenticode Code Signing certificate (`.pfx`). | Base64 string |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password protecting the `.pfx` certificate. | Secure string |

### Signing Process
1. Tauri signs the binary and the generated NSIS installer using `signtool.exe` using SHA-256 digest and RFC 3161 timestamping server (`http://timestamp.digicert.com`).

---

## 4. Unsigned Build Behavior

When `APPLE_CERTIFICATE` or `WINDOWS_CERTIFICATE` is not provided:
- **macOS**: Bundle is signed with ad-hoc signature (`-`). DMG displays an OS Gatekeeper prompt upon first launch ("macOS cannot verify the developer").
- **Windows**: Installer is built without Authenticode stamp. Windows SmartScreen displays an unknown publisher prompt upon execution.
- **Release Manifest**: Records `signed: false` and `notarized: false`.
