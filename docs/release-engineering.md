# NearShare Desktop Release Engineering Architecture

## 1. Overview & Desktop Release Targets

NearShare desktop release engineering targets two primary desktop platforms:

1. **macOS**:
   - Runtime: Apple Silicon (`arm64` / `aarch64`) and Intel (`x86_64`) architecture support.
   - Bundle Format: `.app` (Application Bundle) and `.dmg` (Apple Disk Image).
   - Minimum OS Version: macOS 11.0 (Big Sur) and higher.
   - Packaging Engine: Tauri v2 Bundler.

2. **Windows**:
   - Runtime: Windows 10/11 64-bit (`x86_64`).
   - Bundle Format: NSIS Installer (`.exe`) configured for `currentUser` installation.
   - Packaging Engine: Tauri v2 NSIS Bundler.

*Scope Note*: Linux packaging (`.AppImage`, `.deb`) is explicitly excluded from this release scope and documented as not-targeted.

---

## 2. Release Channels

| Channel | Description | Distribution Mechanism | Signing & Notarization Policy |
| :--- | :--- | :--- | :--- |
| **`development`** | Local builds created on developer workstations for debugging. | Local `npm run tauri:dev` or `npm run tauri:build`. | Optional (Unsigned / Ad-hoc). |
| **`nightly`** | Automated builds produced by CI on development branch commits. | GitHub Actions Artifacts / Nightly releases. | Optional (Labeled `UNSIGNED`). |
| **`beta`** | Pre-release candidate builds for validation and staging. | GitHub Releases (Draft/Pre-release). | Recommended signing when credentials present. |
| **`stable`** | Official production releases tied to semantic version tags (`v*`). | GitHub Releases (Public). | Mandatory Apple Developer ID signing & notarization (macOS) and Authenticode signing (Windows). |

---

## 3. Local Release Build vs. CI Matrix

### Local macOS Build
```bash
# Verify integrity, version, and secrets
npm run validate:version
npm run check:secrets
npm test
npm run lint

# Build frontend and production Tauri bundle
npm run tauri:build

# Generate and verify artifact manifest
npm run manifest:generate
npm run manifest:verify
```

### GitHub Actions CI Matrix (`.github/workflows/release.yml`)
- Triggered by semantic version tags (`v*`) or manual `workflow_dispatch`.
- `build-macos` runs on GitHub `macos-14` (Apple Silicon).
- `build-windows` runs on GitHub `windows-latest` (`x86_64`).
- Computes SHA-256 checksums and validates `release-manifest.json` before publishing artifacts.

---

## 4. Upgrade & Data Safety Invariants

1. **Persistent Data Isolation**: Application state, trusted peer keys, transfer history, and recovery checkpoints reside in OS-standard app data paths (`~/Library/Application Support/com.nearshare.desktop` on macOS, `%APPDATA%\com.nearshare.desktop` on Windows).
2. **Non-Destructive Installer**: Upgrades between patch/minor versions (e.g. `0.1.0` -> `0.1.1`) preserve existing transfer history, trusted device pairings, and durable checkpoints without schema corruption.
3. **No Automatic Incompatible Migrations**: Checkpoint schema versions are strictly validated by `validateCheckpointSafety()`; stale or corrupted records are safely quarantined.
