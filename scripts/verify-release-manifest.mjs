#!/usr/bin/env node

/**
 * NearShare Release Artifact Manifest Verifier
 *
 * Validates that all artifacts listed in release-manifest.json exist
 * and match their cryptographic SHA-256 hashes exactly.
 *
 * Usage:
 *   node scripts/verify-release-manifest.mjs [manifestFile] [artifactsDir]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function calculateFileSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function verifyReleaseManifest(manifestPath, artifactsRootDir) {
  if (!fs.existsSync(manifestPath)) {
    return {
      valid: false,
      error: `Release manifest file not found: ${manifestPath}`,
      verifiedCount: 0,
      mismatches: [],
      missingFiles: [],
    };
  }

  let manifest;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (err) {
    return {
      valid: false,
      error: `Failed to parse manifest JSON: ${err.message}`,
      verifiedCount: 0,
      mismatches: [],
      missingFiles: [],
    };
  }

  if (!manifest.artifacts || !Array.isArray(manifest.artifacts)) {
    return {
      valid: false,
      error: 'Manifest does not contain an "artifacts" array.',
      verifiedCount: 0,
      mismatches: [],
      missingFiles: [],
    };
  }

  const mismatches = [];
  const missingFiles = [];
  let verifiedCount = 0;

  for (const item of manifest.artifacts) {
    const candidatePath = path.isAbsolute(item.relativePath || item.filename)
      ? (item.relativePath || item.filename)
      : path.join(artifactsRootDir, item.relativePath || item.filename);

    // Also check if file exists directly under artifactsRootDir by filename
    const directPath = path.join(artifactsRootDir, item.filename);
    const targetFile = fs.existsSync(candidatePath)
      ? candidatePath
      : (fs.existsSync(directPath) ? directPath : null);

    if (!targetFile) {
      missingFiles.push(item.filename);
      continue;
    }

    const calculatedHash = calculateFileSha256(targetFile);
    if (calculatedHash.toLowerCase() !== (item.sha256 || '').toLowerCase()) {
      mismatches.push({
        filename: item.filename,
        expectedSha256: item.sha256,
        actualSha256: calculatedHash,
      });
    } else {
      verifiedCount++;
    }
  }

  const valid = missingFiles.length === 0 && mismatches.length === 0;

  return {
    valid,
    manifestVersion: manifest.version,
    product: manifest.product,
    totalArtifacts: manifest.artifacts.length,
    verifiedCount,
    missingFiles,
    mismatches,
  };
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifestFile = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.join(ROOT_DIR, 'release-manifest.json');
  const artifactsDir = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : path.join(ROOT_DIR, 'src-tauri', 'target', 'release', 'bundle');

  console.log(`[Manifest Verifier] Verifying ${manifestFile}...`);
  const result = verifyReleaseManifest(manifestFile, artifactsDir);

  if (!result.valid) {
    if (result.error) {
      console.error(`[FAIL] ${result.error}`);
    }
    if (result.missingFiles && result.missingFiles.length > 0) {
      console.error(`[FAIL] Missing artifacts: ${result.missingFiles.join(', ')}`);
    }
    if (result.mismatches && result.mismatches.length > 0) {
      console.error(`[FAIL] Hash mismatches detected:`);
      result.mismatches.forEach((m) => {
        console.error(` - ${m.filename}: expected ${m.expectedSha256}, got ${m.actualSha256}`);
      });
    }
    process.exit(1);
  }

  console.log(`[PASS] All ${result.verifiedCount} artifacts verified matching SHA-256 signatures.`);
}
