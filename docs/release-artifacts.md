# NearShare Release Artifacts & Checksum Specification

## 1. Standardized Release Artifact Naming

NearShare enforces deterministic, structured artifact naming across all desktop release targets:

| Target Platform | Architecture | Bundle Type | Standard Artifact Filename |
| :--- | :--- | :--- | :--- |
| **macOS** | Apple Silicon (`arm64`) | Disk Image (`.dmg`) | `NearShare_0.1.0_aarch64.dmg` |
| **macOS** | Intel (`x86_64`) | Disk Image (`.dmg`) | `NearShare_0.1.0_x64.dmg` |
| **macOS** | Apple Silicon (`arm64`) | Application Archive | `NearShare-app-macos-aarch64.tar.gz` |
| **Windows** | 64-bit (`x86_64`) | NSIS Installer (`.exe`) | `NearShare_0.1.0_x64_setup.exe` |
| **Cross-Platform** | All | Artifact Manifest | `release-manifest.json` |

---

## 2. Release Artifact Manifest Schema (`release-manifest.json`)

The release manifest catalogs built binaries alongside their cryptographic SHA-256 digests:

```json
{
  "product": "NearShare",
  "version": "0.1.0",
  "channel": "stable",
  "generatedAt": "<ISO timestamp>",
  "artifacts": [
    {
      "platform": "macos",
      "architecture": "arm64",
      "filename": "NearShare_0.1.0_aarch64.dmg",
      "relativePath": "dmg/NearShare_0.1.0_aarch64.dmg",
      "sha256": "<generated at build time — see release-checksums.md>",
      "sizeBytes": 3944448
    },
    {
      "platform": "windows",
      "architecture": "x86_64",
      "filename": "NearShare_0.1.0_x64_setup.exe",
      "relativePath": "nsis/NearShare_0.1.0_x64_setup.exe",
      "sha256": "<NOT_BUILT_LOCALLY — Windows artifact requires windows-latest CI runner>",
      "sizeBytes": 0
    }
  ]
}
```

> **Real checksums from Step 75 macOS local build**: See [release-checksums.md](release-checksums.md)
```

---

## 3. Cryptographic Checksum Verification

### Generation
```bash
node scripts/generate-release-manifest.mjs <bundle-dir> <output-json>
```

### Verification
```bash
node scripts/verify-release-manifest.mjs <manifest-json> <bundle-dir>
```

The verification tool reads the manifest, calculates real-time SHA-256 signatures for each binary, verifies match equality, and exits with a non-zero code if any file is missing or corrupted.
