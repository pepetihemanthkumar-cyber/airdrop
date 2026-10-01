#!/usr/bin/env node
/**
 * NearShare Security & Accidental Secret Scanner
 *
 * Scans repository source files before CI packaging to ensure no live
 * certificates, private keys, authentication tokens, or credentials are committed.
 *
 * INVARIANTS:
 * 1. Zero Secret Echoing: Never prints matched secret values to stdout/stderr.
 * 2. Whitelisted Test Harnesses: Differentiates synthetic mock test strings from live keys.
 * 3. Fast & Focused: Skips build directories, binaries, and node_modules.
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  allowInFiles?: RegExp[];
}

const SECRET_RULES: SecretRule[] = [
  {
    id: 'SEC_RULE_PRIVATE_KEY',
    name: 'Unencrypted Private Key Block',
    pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH|ENCRYPTED|PRIVATE) KEY-----/,
    allowInFiles: [/tauriBridgeTest\.ts$/, /check-secrets\.ts$/],
  },
  {
    id: 'SEC_RULE_GITHUB_PAT',
    name: 'GitHub Personal Access Token',
    pattern: /(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})/,
  },
  {
    id: 'SEC_RULE_AWS_KEY',
    name: 'AWS Access Key Identifier',
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    id: 'SEC_RULE_SLACK_WEBHOOK',
    name: 'Slack Incoming Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Za-z_]+\/B[0-9A-Za-z_]+\/[0-9A-Za-z_]+/,
  },
  {
    id: 'SEC_RULE_DISCORD_WEBHOOK',
    name: 'Discord Webhook URL',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/,
  },
];

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  'target',
  '.git',
  '.system_generated',
]);

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.icns',
  '.dmg',
  '.app',
  '.exe',
  '.dll',
  '.dylib',
  '.so',
  '.zip',
  '.tar',
  '.gz',
  '.pdf',
  '.DS_Store',
]);

export interface SecretFinding {
  filePath: string;
  ruleId: string;
  ruleName: string;
  line: number;
}

export function scanFile(filePath: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    for (const rule of SECRET_RULES) {
      if (rule.allowInFiles && rule.allowInFiles.some((regex) => regex.test(filePath))) {
        continue;
      }
      if (rule.pattern.test(lineContent)) {
        findings.push({
          filePath,
          ruleId: rule.id,
          ruleName: rule.name,
          line: i + 1,
        });
      }
    }
  }

  return findings;
}

export function scanDirectory(dir: string, rootDir: string = dir): SecretFinding[] {
  let findings: SecretFinding[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        findings = findings.concat(scanDirectory(fullPath, rootDir));
      }
      continue;
    }

    const ext = path.extname(entry.name);
    if (IGNORED_EXTENSIONS.has(ext)) {
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const fileFindings = scanFile(relPath, content);
      findings = findings.concat(fileFindings);
    } catch {
      // Ignore unreadable or binary files
    }
  }

  return findings;
}

// Check for forbidden .env files containing potential secrets
export function checkEnvFiles(rootDir: string = process.cwd()): string[] {
  const forbidden = ['.env', '.env.local', '.env.production'];
  const detected: string[] = [];
  for (const f of forbidden) {
    const envPath = path.join(rootDir, f);
    if (fs.existsSync(envPath)) {
      detected.push(f);
    }
  }
  return detected;
}

// CLI Execution Entrypoint
const isMain = process.argv[1] && (process.argv[1].endsWith('check-secrets.ts') || process.argv[1].endsWith('check-secrets.js'));
if (isMain) {
  const rootDir = process.cwd();
  console.log('[Secret Scanner] Scanning repository source tree...');

  const envFiles = checkEnvFiles(rootDir);
  const secretFindings = scanDirectory(rootDir, rootDir);

  let hasError = false;

  if (envFiles.length > 0) {
    console.error('\n[ERROR] Uncommitted environment files detected:');
    envFiles.forEach((f) => console.error(`  ✖ Found uncommitted env file: ${f}`));
    hasError = true;
  }

  if (secretFindings.length > 0) {
    console.error('\n[ERROR] Potential secret patterns detected:');
    secretFindings.forEach((finding) => {
      console.error(`  ✖ [${finding.ruleId}] ${finding.ruleName} in ${finding.filePath}:${finding.line}`);
    });
    hasError = true;
  }

  if (hasError) {
    console.error('\n[FATAL] Secret audit failed. Clean up sensitive files before packaging.');
    process.exit(1);
  }

  console.log('[PASS] Zero exposed secrets, live private keys, or .env files detected.');
}
