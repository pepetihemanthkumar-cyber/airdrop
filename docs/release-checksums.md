# NearShare 0.1.0 — Release Artifact SHA-256 Checksums

> Generated: 2026-10-01 (Local build on macOS arm64)  
> Version: `0.1.0`  
> Platform: macOS (Darwin arm64, Apple Silicon)  
> Build Tool: `cargo tauri build` (Tauri v2.12.0)

---

## macOS Release Artifacts

| Artifact | Version | Platform | Architecture | SHA-256 |
|:---|:---|:---|:---|:---|
| `NearShare.app/Contents/MacOS/app` | 0.1.0 | macOS | arm64 | `ec7ed25ceb7f2bc79eeb00f5934a47d3d4e3d789076e305af71350c07ec9e47b` |
| `NearShare_0.1.0_aarch64.dmg` | 0.1.0 | macOS | arm64 | `4acdad7e9d4bf3e65690da180759a101779447d7ce10c9daa24ba5d33b3c3da9` |

---

## Artifact Sizes

| Artifact | Size |
|:---|:---|
| `NearShare.app/Contents/MacOS/app` | 11.47 MiB (7,454,720 B) |
| `NearShare_0.1.0_aarch64.dmg` | 3.77 MiB (3,950,543 B) |

---

## Windows Release Artifacts

| Artifact | Status |
|:---|:---|
| `NearShare_0.1.0_x64-setup.exe` | `NOT_BUILT_LOCALLY` — Windows hardware unavailable. Workflow configured in `.github/workflows/release.yml`. |

---

## Notes

- **Checksum ≠ Digital Signature**: SHA-256 checksums verify artifact integrity but do NOT constitute a developer identity signature.
- **Signing**: macOS artifact carries an **ad-hoc linker signature only**. Developer ID Application signature requires Apple Developer Program credentials (not present in current environment).
- **Notarization**: NOT PERFORMED. Requires Apple notary service credentials.
- **Gatekeeper**: Ad-hoc signed binaries will require Gatekeeper override (`xattr -cr NearShare.app`) on end-user systems until Developer ID signing is applied.

---

## Frameworks Linked in macOS Binary

| Framework | Version |
|:---|:---|
| `MultipeerConnectivity` | 179.255.1 |
| `Network` | 5812.121.1 |
| `Foundation` | 5026.5.4 |
| `CoreFoundation` | 5026.5.4 |
| `WebKit` | 624.2.5 |

---

## Binary Details

| Property | Value |
|:---|:---|
| Bundle ID | `com.nearshare.desktop` |
| Version | `0.1.0` |
| Architecture | `Mach-O 64-bit executable arm64` |
| Minimum macOS | `11.0` |
| Code Signature | `adhoc` (linker-signed, not Developer ID) |
| Native Direct Module | `NearShareDirect` (Swift — symbols verified in binary) |
