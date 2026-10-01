#!/usr/bin/env node
/**
 * NearShare Version Synchronization & Git Tag Validator
 *
 * Verifies that application versions match across:
 * 1. package.json
 * 2. src/core/appVersion.ts
 * 3. src-tauri/tauri.conf.json
 * 4. src-tauri/Cargo.toml
 * 5. (Optional) Git Tag passed via CLI argument or GITHUB_REF
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  type VersionManifests,
  parseTagVersion,
  resolveTagArg,
  validateVersions,
} from '../src/core/version/versionValidator';

export { parseTagVersion, resolveTagArg, validateVersions, type VersionManifests };

export function readProjectVersions(rootDir: string = process.cwd()): VersionManifests {
  // 1. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const packageJson = pkg.version;

  // 2. src/core/appVersion.ts
  const appVersionPath = path.join(rootDir, 'src', 'core', 'appVersion.ts');
  const appVersionContent = fs.readFileSync(appVersionPath, 'utf8');
  const appVersionMatch = appVersionContent.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!appVersionMatch) {
    throw new Error(`Failed to extract APP_VERSION from ${appVersionPath}`);
  }
  const appVersionTs = appVersionMatch[1];

  // 3. src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  const tauriConfVersion = tauriConf.version;

  // 4. src-tauri/Cargo.toml
  const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
  const cargoVersionMatch = cargoTomlContent.match(/\[package\][\s\S]*?version\s*=\s*['"]([^'"]+)['"]/);
  if (!cargoVersionMatch) {
    throw new Error(`Failed to extract [package].version from ${cargoTomlPath}`);
  }
  const cargoToml = cargoVersionMatch[1];

  return {
    packageJson,
    appVersionTs,
    tauriConf: tauriConfVersion,
    cargoToml,
  };
}

// CLI Execution Entrypoint
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('validate-version.ts') || process.argv[1].endsWith('validate-version.js'));

if (isMain) {
  try {
    const resolvedTag = resolveTagArg(process.argv[2]);
    const versions = readProjectVersions();
    const result = validateVersions(versions, resolvedTag);

    console.log(`[Version Validator] Target Version: ${result.targetVersion}`);
    console.log(` - package.json:             ${versions.packageJson}`);
    console.log(` - src/core/appVersion.ts:   ${versions.appVersionTs}`);
    console.log(` - src-tauri/tauri.conf.json:${versions.tauriConf}`);
    console.log(` - src-tauri/Cargo.toml:     ${versions.cargoToml}`);
    if (resolvedTag) {
      console.log(` - Git Tag Target:           ${resolvedTag}`);
    }

    if (!result.isValid) {
      console.error('\n[ERROR] Version synchronization mismatch detected:');
      result.errors.forEach((err) => console.error(`  ✖ ${err}`));
      process.exit(1);
    }

    console.log('\n[PASS] All application and package versions are synchronized.');
  } catch (err: any) {
    console.error(`\n[FATAL] Version validation error: ${err.message}`);
    process.exit(1);
  }
}
