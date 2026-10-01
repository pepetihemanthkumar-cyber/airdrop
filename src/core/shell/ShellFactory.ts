/**
 * NearShare Native Shell Factory
 *
 * Resolves or instantiates the appropriate NativeShell for the target platform.
 */

import type { NativeShell } from './NativeShell';
import type { NativeShellPlatform } from './types';
import { MockNativeShell } from './mock/MockNativeShell';

export class ShellFactory {
  static createShell(platform: NativeShellPlatform = 'mock'): NativeShell {
    switch (platform) {
      case 'mock':
      case 'web':
        return new MockNativeShell();
      case 'macos':
      case 'windows':
      case 'android':
      case 'ios':
        // Fallback to MockNativeShell with appropriate mock capabilities
        return new MockNativeShell();
      default:
        return new MockNativeShell();
    }
  }

  static detectPlatform(): NativeShellPlatform {
    if (typeof window === 'undefined') return 'unknown';

    if ((window as any).__NEARSHARE_SHELL__) {
      return (window as any).__NEARSHARE_SHELL__.platform || 'unknown';
    }

    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('macintosh') || ua.includes('mac os x')) return 'macos';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';

    return 'web';
  }
}
