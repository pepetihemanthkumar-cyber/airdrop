/**
 * NearShare Platform Bridge Factory
 *
 * Resolves the appropriate NativeBridge implementation based on the detected runtime platform.
 * Ensures honest reporting: mock or web runtime never pretends to be a native shell.
 */

import type { NativeBridge } from './NativeBridge';
import type { NativePlatform } from './types';
import { MockNativeBridge } from './mock/MockNativeBridge';
import { TauriNativeBridge } from './tauri/TauriNativeBridge';

export class PlatformBridgeFactory {
  /**
   * Creates or resolves the bridge instance for a platform target.
   */
  static createBridge(platform: NativePlatform = 'web'): NativeBridge {
    if (TauriNativeBridge.isTauriDetected()) {
      return new TauriNativeBridge(platform);
    }

    switch (platform) {
      case 'web':
      case 'unknown':
        return new MockNativeBridge();

      case 'macos':
      case 'windows':
      case 'android':
      case 'ios':
        // Fallback to MockNativeBridge when not running inside native shell
        return new MockNativeBridge();

      default:
        return new MockNativeBridge();
    }
  }

  /**
   * Detects the host environment platform string.
   */
  static detectPlatform(): NativePlatform {
    if (typeof window === 'undefined') return 'unknown';

    // Check if custom native bridge global is injected
    if ((window as any).__NEARSHARE_NATIVE_BRIDGE__) {
      return (window as any).__NEARSHARE_NATIVE_BRIDGE__.platform || 'unknown';
    }

    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('macintosh') || ua.includes('mac os x')) return 'macos';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';

    return 'web';
  }
}
