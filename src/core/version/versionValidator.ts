/**
 * Version Validation & SemVer Release Tag Utilities
 */

declare const process: any;

export interface VersionManifests {
  packageJson: string;
  appVersionTs: string;
  tauriConf: string;
  cargoToml: string;
}

export interface ParsedTag {
  raw: string;
  isValidSemver: boolean;
  baseVersion?: string;
  prerelease?: string;
  error?: string;
}

/**
 * Strict SemVer tag parser: supports optional 'v' prefix and optional prerelease suffix (e.g., -rc1, -rc2, -beta.1).
 */
export function parseTagVersion(tag: string): ParsedTag {
  const cleanTag = tag.replace(/^refs\/tags\//, '');
  // SemVer pattern: optional 'v', major.minor.patch, optional -prerelease
  const semverRegex = /^v?(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/;
  const match = cleanTag.match(semverRegex);
  if (!match) {
    return {
      raw: tag,
      isValidSemver: false,
      error: `Tag '${tag}' is not a valid SemVer release tag (expected e.g. v0.1.0, v0.1.0-rc1, v0.1.0-beta.1)`,
    };
  }
  return {
    raw: tag,
    isValidSemver: true,
    baseVersion: match[1],
    prerelease: match[2],
  };
}

/**
 * Resolves the tag argument, safely distinguishing branch CI runs from actual release tag validation.
 */
export function resolveTagArg(
  cliArg?: string,
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): string | undefined {
  if (cliArg) {
    // If CLI argument is explicitly a branch ref (e.g., refs/heads/main), skip tag validation
    if (cliArg.startsWith('refs/heads/')) {
      return undefined;
    }
    return cliArg;
  }

  // If running in GitHub Actions:
  // Only treat GITHUB_REF / GITHUB_REF_NAME as a tag when GITHUB_REF_TYPE is 'tag' or ref starts with refs/tags/
  if (env.GITHUB_REF_TYPE === 'tag' && env.GITHUB_REF_NAME) {
    return env.GITHUB_REF_NAME;
  }
  if (env.GITHUB_REF && env.GITHUB_REF.startsWith('refs/tags/')) {
    return env.GITHUB_REF;
  }

  // Branch CI pushes (e.g. GITHUB_REF='refs/heads/main' or GITHUB_REF_NAME='main' with GITHUB_REF_TYPE='branch')
  return undefined;
}

export function validateVersions(
  versions: VersionManifests,
  expectedTag?: string
): { isValid: boolean; targetVersion: string; errors: string[] } {
  const errors: string[] = [];
  const targetVersion = versions.packageJson;

  if (versions.appVersionTs !== targetVersion) {
    errors.push(`src/core/appVersion.ts (${versions.appVersionTs}) != package.json (${targetVersion})`);
  }
  if (versions.tauriConf !== targetVersion) {
    errors.push(`src-tauri/tauri.conf.json (${versions.tauriConf}) != package.json (${targetVersion})`);
  }
  if (versions.cargoToml !== targetVersion) {
    errors.push(`src-tauri/Cargo.toml (${versions.cargoToml}) != package.json (${targetVersion})`);
  }

  if (expectedTag) {
    const parsed = parseTagVersion(expectedTag);
    if (!parsed.isValidSemver) {
      errors.push(parsed.error || `Git tag '${expectedTag}' is malformed`);
    } else if (parsed.baseVersion !== targetVersion) {
      errors.push(`Git tag '${expectedTag}' (base version '${parsed.baseVersion}') does not match release version '${targetVersion}'`);
    }
  }

  return {
    isValid: errors.length === 0,
    targetVersion,
    errors,
  };
}
