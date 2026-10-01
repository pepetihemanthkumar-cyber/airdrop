/**
 * NearShare Platform Capability Resolver
 *
 * Resolves platform capabilities, strategies, and availability statuses.
 * Distinguishes between native capabilities, development mock simulations, and platform restrictions.
 */

import type { PlatformType } from './PlatformAdapter';
import type {
  PlatformCapability,
  CapabilityAvailability,
  CapabilityPath,
  DetailedCapabilityStatus,
} from './capabilities';
import type { PlatformTransferStrategy } from './PlatformStrategy';
import {
  PLATFORM_CAPABILITIES_MAP,
  PLATFORM_STRATEGY_MAP,
} from './platformCapabilities';

export class CapabilityResolver {
  /**
   * Retrieves the comprehensive capability profile for the target platform.
   */
  public static getPlatformCapabilities(platform: PlatformType): PlatformCapability {
    return PLATFORM_CAPABILITIES_MAP[platform] || PLATFORM_CAPABILITIES_MAP.Web;
  }

  /**
   * Retrieves the candidate native integration strategy for the target platform.
   */
  public static getPlatformStrategy(platform: PlatformType): PlatformTransferStrategy {
    return PLATFORM_STRATEGY_MAP[platform] || PLATFORM_STRATEGY_MAP.Web;
  }

  /**
   * Evaluates the availability tier for a specific platform capability path.
   */
  public static getCapabilityAvailability(
    platform: PlatformType,
    capability: CapabilityPath
  ): CapabilityAvailability {
    // In current development phase, Web running in browser is strictly mockOnly or restricted
    if (platform === 'Web') {
      if (capability.startsWith('transferModes.') || capability.startsWith('discovery.')) {
        return 'mockOnly';
      }
      if (
        capability === 'files.folderPicker' ||
        capability === 'files.folderTransfer' ||
        capability === 'transfer.largeFiles' ||
        capability === 'transfer.streaming' ||
        capability === 'transfer.background' ||
        capability === 'system.openFile' ||
        capability === 'system.revealInFolder' ||
        capability === 'system.notifications'
      ) {
        return 'requiresNative';
      }
      return 'supported';
    }

    // Check platform architecture capabilities
    const caps = this.getPlatformCapabilities(platform);
    const supported = this.readCapabilityValue(caps, capability);

    if (!supported) {
      if (capability === 'transfer.background' && platform === 'iOS') {
        return 'restricted';
      }
      if (capability === 'files.folderPicker' && platform === 'iOS') {
        return 'unsupported';
      }
      return 'unsupported';
    }

    // Platform supports it architecturally, but requires native runtime implementation
    return 'requiresNative';
  }

  /**
   * Evaluates detailed multi-tiered capability status distinguishing architectural, runtime, and physical validation.
   */
  public static getDetailedCapabilityStatus(
    platform: PlatformType,
    capability: CapabilityPath
  ): DetailedCapabilityStatus {
    const availability = this.getCapabilityAvailability(platform, capability);
    const caps = this.getPlatformCapabilities(platform);
    const architecturalSupport = this.readCapabilityValue(caps, capability);
    const reason = this.getUnavailableReason(platform, capability);

    let runtimeSupport: DetailedCapabilityStatus['runtimeSupport'] = 'unavailable';
    let physicalValidation: DetailedCapabilityStatus['physicalValidation'] = 'unverified';

    if (platform === 'Web') {
      runtimeSupport = 'mock';
      physicalValidation = 'unverified';
    } else if (platform === 'macOS') {
      if (capability === 'transferModes.direct' || capability === 'transferModes.wifi') {
        runtimeSupport = 'implemented';
        physicalValidation = 'unverified';
      } else {
        runtimeSupport = architecturalSupport ? 'implemented' : 'unavailable';
      }
    } else if (platform === 'Windows') {
      if (capability === 'transferModes.direct' || capability === 'transferModes.wifi') {
        runtimeSupport = 'implemented';
        physicalValidation = 'unverified';
      } else {
        runtimeSupport = architecturalSupport ? 'implemented' : 'unavailable';
      }
    } else if (platform === 'Android') {
      if (capability === 'transferModes.direct' || capability === 'transferModes.wifi') {
        runtimeSupport = 'implemented';
        physicalValidation = 'unverified';
      } else {
        runtimeSupport = architecturalSupport ? 'implemented' : 'unavailable';
      }
    } else if (platform === 'iOS') {
      if (capability === 'transferModes.direct') {
        runtimeSupport = 'implemented';
        physicalValidation = 'unverified';
      } else if (capability === 'transferModes.wifi') {
        runtimeSupport = 'scaffold';
        physicalValidation = 'blocked_by_hardware';
      } else {
        runtimeSupport = architecturalSupport ? 'implemented' : 'unavailable';
      }
    }

    return {
      availability,
      architecturalSupport,
      runtimeSupport,
      physicalValidation,
      reason,
    };
  }

  /**
   * Checks whether a capability is supported or accessible in mock development mode.
   */
  public static isCapabilityAvailable(
    platform: PlatformType,
    capability: CapabilityPath
  ): boolean {
    const availability = this.getCapabilityAvailability(platform, capability);
    return (
      availability === 'supported' ||
      availability === 'mockOnly' ||
      availability === 'requiresNative'
    );
  }

  /**
   * Returns a user-friendly explanatory reason when a capability is unavailable or restricted.
   */
  public static getUnavailableReason(
    platform: PlatformType,
    capability: CapabilityPath
  ): string | null {
    const availability = this.getCapabilityAvailability(platform, capability);

    switch (availability) {
      case 'supported':
        return null;
      case 'mockOnly':
        return 'Native hardware capabilities are simulated in this development environment.';
      case 'requiresNative':
        return `Requires the native ${platform} NearShare application.`;
      case 'restricted':
        if (platform === 'iOS' && capability === 'transfer.background') {
          return 'iOS app lifecycle restrictions limit background transfer duration.';
        }
        return `Restricted by ${platform} operating system policies.`;
      case 'unsupported':
        return `Not supported on ${platform}.`;
      case 'notImplemented':
        return `Feature is currently not implemented for ${platform}.`;
      case 'unknown':
      default:
        return `Unknown capability status for ${platform}.`;
    }
  }

  /**
   * Returns the technically configured/available transfer mode for the platform.
   * Direct mode is preferred when available.
   */
  public static getRecommendedMode(platform: PlatformType): 'direct' | 'wifi' {
    const caps = this.getPlatformCapabilities(platform);
    if (caps.transferModes.direct) {
      return 'direct';
    }
    return 'wifi';
  }

  /**
   * Checks if actual native binary drivers are compiled in (currently false in mock development).
   */
  public static isNativeImplementationPresent(_platform: PlatformType): boolean {
    return false;
  }

  private static readCapabilityValue(
    caps: PlatformCapability,
    path: CapabilityPath
  ): boolean {
    const parts = path.split('.');
    let current: unknown = caps;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return false;
      }
    }
    return Boolean(current);
  }
}
