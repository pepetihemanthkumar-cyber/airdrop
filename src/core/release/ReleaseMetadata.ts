/**
 * NearShare Release Metadata & Channel Specification
 *
 * Defines typed release metadata, deployment channels, target architectures,
 * and artifact naming contracts. Independent from transport and React UI layers.
 */

import { APP_NAME, APP_VERSION, APP_METADATA } from '../appVersion';

export type ReleaseChannel = 'development' | 'nightly' | 'beta' | 'stable';
export type ReleaseTargetPlatform = 'macOS' | 'Windows' | 'Android' | 'iOS' | 'Web';
export type ReleaseArchitecture = 'arm64' | 'x86_64' | 'universal' | 'unknown';
export type ReleaseBuildType = 'debug' | 'release' | 'test';

export interface ReleaseMetadata {
  appName: string;
  version: string;
  channel: ReleaseChannel;
  targetPlatform: ReleaseTargetPlatform;
  architecture: ReleaseArchitecture;
  buildType: ReleaseBuildType;
  commitSha?: string;
  buildTimestamp: number;
  releaseTag: string;
  bundleIdentifier: string;
  protocolVersion: string;
}

export interface ReleaseArtifactInfo {
  platform: ReleaseTargetPlatform;
  architecture: ReleaseArchitecture;
  filename: string;
  extension: string;
  sha256?: string;
  signed: boolean;
  notarized: boolean;
}

export const CURRENT_BUNDLE_IDENTIFIER = 'com.nearshare.desktop' as const;

/**
 * Resolves current release metadata from build-time context.
 */
export function getCurrentReleaseMetadata(overrides?: Partial<ReleaseMetadata>): ReleaseMetadata {
  const isProd =
    (typeof import.meta !== 'undefined' && import.meta.env?.PROD) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'production');

  const channel: ReleaseChannel = overrides?.channel ?? (isProd ? 'stable' : 'development');
  const buildType: ReleaseBuildType = overrides?.buildType ?? (isProd ? 'release' : 'debug');

  let defaultPlatform: ReleaseTargetPlatform = 'Web';
  let defaultArch: ReleaseArchitecture = 'unknown';

  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) {
      defaultPlatform = 'macOS';
      defaultArch = ua.includes('arm') || ua.includes('apple') ? 'arm64' : 'x86_64';
    } else if (ua.includes('win')) {
      defaultPlatform = 'Windows';
      defaultArch = 'x86_64';
    } else if (ua.includes('android')) {
      defaultPlatform = 'Android';
      defaultArch = 'arm64';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      defaultPlatform = 'iOS';
      defaultArch = 'arm64';
    }
  }

  return {
    appName: APP_NAME,
    version: APP_VERSION,
    channel,
    targetPlatform: overrides?.targetPlatform ?? defaultPlatform,
    architecture: overrides?.architecture ?? defaultArch,
    buildType,
    commitSha: overrides?.commitSha,
    buildTimestamp: overrides?.buildTimestamp ?? Date.now(),
    releaseTag: overrides?.releaseTag ?? `v${APP_VERSION}`,
    bundleIdentifier: CURRENT_BUNDLE_IDENTIFIER,
    protocolVersion: APP_METADATA.protocolVersion,
  };
}

/**
 * Validates that a git tag adheres to semantic versioning format matching the target version.
 */
export function validateReleaseTag(
  tag: string,
  expectedVersion: string = APP_VERSION
): { valid: boolean; error?: string } {
  const trimmed = tag.trim();
  if (!trimmed.startsWith('v')) {
    return { valid: false, error: `Release tag must start with 'v' prefix (e.g. 'v${expectedVersion}'). Received: '${tag}'` };
  }

  const versionPart = trimmed.substring(1);
  if (versionPart !== expectedVersion) {
    return {
      valid: false,
      error: `Release tag version mismatch: Tag '${trimmed}' specifies '${versionPart}' but codebase expects '${expectedVersion}'`,
    };
  }

  const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
  if (!semverRegex.test(versionPart)) {
    return { valid: false, error: `Version string '${versionPart}' is not valid semantic versioning.` };
  }

  return { valid: true };
}

/**
 * Standardizes desktop release artifact naming.
 */
export function formatReleaseArtifactName(
  appName: string,
  version: string,
  platform: ReleaseTargetPlatform,
  arch: ReleaseArchitecture,
  extension: string
): string {
  const safeName = appName.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanExt = extension.startsWith('.') ? extension.substring(1) : extension;

  switch (platform) {
    case 'macOS':
      if (cleanExt === 'dmg') {
        return `${safeName}_${version}_${arch}.dmg`;
      }
      return `${safeName}-${version}-${arch}.tar.gz`;
    case 'Windows':
      return `${safeName}_${version}_${arch}_setup.exe`;
    default:
      return `${safeName}_${version}_${platform.toLowerCase()}_${arch}.${cleanExt}`;
  }
}
