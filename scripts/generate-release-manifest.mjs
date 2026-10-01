#!/usr/bin/env node

/**
 * NearShare Release Artifact Manifest Generator
 *
 * Scans built release artifacts, calculates cryptographic SHA-256 checksums,
 * and produces a verified release-manifest.json.
 *
 * Usage:
 *   node scripts/generate-release-manifest.mjs [artifactsDir] [outputFile]
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

export function detectArtifactPlatformAndArch(filename) {
  const lower = filename.toLowerCase();
  let platform = 'unknown';
  let architecture = 'unknown';

  if (lower.endsWith('.dmg') || lower.includes('macos') || lower.endsWith('.app')) {
    platform = 'macos';
  } else if (lower.endsWith('.exe') || lower.includes('setup') || lower.endsWith('.msi')) {
    platform = 'windows';
  }

  if (lower.includes('aarch64') || lower.includes('arm64')) {
    architecture = 'arm64';
  } else if (lower.includes('x64') || lower.includes('x86_64')) {
    architecture = 'x86_64';
  } else if (lower.includes('universal')) {
    architecture = 'universal';
  }

  return { platform, architecture };
}

export function generateReleaseManifest(options = {}) {
  const version = options.version || '0.1.0';
  const product = options.product || 'NearShare';
  const channel = options.channel || 'stable';
  const gitCommit = options.gitCommit || process.env.GITHUB_SHA || 'local-build';
  const artifactsDir = options.artifactsDir || path.join(ROOT_DIR, 'src-tauri', 'target', 'release', 'bundle');
  const artifacts = [];

  if (fs.existsSync(artifactsDir)) {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // If it's a .app bundle on macOS, treat the bundle as an entry or inspect archive
          if (!entry.name.endsWith('.app')) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.dmg', '.exe', '.gz', '.zip', '.msi'].includes(ext)) {
            const { platform, architecture } = detectArtifactPlatformAndArch(entry.name);
            const sha256 = calculateFileSha256(fullPath);
            const stat = fs.statSync(fullPath);
            artifacts.push({
              platform,
              architecture,
              filename: entry.name,
              relativePath: path.relative(artifactsDir, fullPath).replace(/\\/g, '/'),
              sha256,
              sizeBytes: stat.size,
            });
          }
        }
      }
    };
    walk(artifactsDir);
  }

  return {
    product,
    version,
    channel,
    gitCommit,
    generatedAt: options.timestamp || new Date().toISOString(),
    artifacts,
  };
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const customDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : undefined;
  const outputFile = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : path.join(ROOT_DIR, 'release-manifest.json');

  console.log('[Manifest Generator] Scanning for release artifacts...');
  const manifest = generateReleaseManifest({ artifactsDir: customDir });
  fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`[Manifest Generator] Successfully wrote manifest with ${manifest.artifacts.length} artifacts to: ${outputFile}`);
}
