/**
 * NearShare Transport Registry
 *
 * Maintains the active transport adapter instances for 'direct' and 'wifi' modes.
 * Tracks implementation status ('mock' | 'native' | 'unavailable') and capability tiers.
 * Enables zero-refactor injection of native platform adapters in future releases.
 */

import type { TransportAdapter } from './TransportAdapter';
import type { TransportMode } from './types';
import type { PlatformType } from '../platform/PlatformAdapter';
import type { CapabilityAvailability } from '../platform/capabilities';
import { DirectTransportAdapter } from './direct/DirectTransportAdapter';
import { ProductionLanTransportAdapter } from './native/ProductionLanTransportAdapter';

export type TransportImplementationType = 'mock' | 'native' | 'unavailable';

export interface TransportRegistrationMetadata {
  mode: TransportMode;
  platform: PlatformType;
  implementation: TransportImplementationType;
  capability: CapabilityAvailability;
  adapter: TransportAdapter;
}

export class TransportRegistry {
  private static instance: TransportRegistry;
  private registrations: Map<TransportMode, TransportRegistrationMetadata> = new Map();

  private constructor() {
    // Register standard DirectTransportAdapter with honest requiresNative status
    this.registerAdapter('direct', new DirectTransportAdapter({ directNearby: 'requiresNative', physicalValidationStatus: 'not_verified' }), 'macOS', 'native', 'requiresNative');
    // Register real production LAN transport adapter for Wi-Fi mode
    this.registerAdapter('wifi', new ProductionLanTransportAdapter(), 'macOS', 'native', 'requiresNative');
  }

  public static getInstance(): TransportRegistry {
    if (!TransportRegistry.instance) {
      TransportRegistry.instance = new TransportRegistry();
    }
    return TransportRegistry.instance;
  }

  /**
   * Registers or replaces an adapter for a specific mode with capability metadata.
   * Future native implementations (e.g. NativeAWDLTransport, NativeWiFiDirectTransport)
   * can register here at bootstrap time.
   */
  public registerAdapter(
    mode: TransportMode,
    adapter: TransportAdapter,
    platform: PlatformType = 'macOS',
    implementation: TransportImplementationType = 'mock',
    capability: CapabilityAvailability = 'mockOnly'
  ): void {
    const existing = this.registrations.get(mode);
    if (existing && existing.adapter !== adapter) {
      existing.adapter.destroy();
    }
    this.registrations.set(mode, {
      mode,
      platform,
      implementation,
      capability,
      adapter,
    });
  }

  /**
   * Retrieves the registered adapter for the requested mode.
   */
  public getAdapter(mode: TransportMode): TransportAdapter {
    const registration = this.registrations.get(mode);
    if (!registration) {
      throw new Error(`[TransportRegistry] No transport adapter registered for mode: "${mode}"`);
    }
    return registration.adapter;
  }

  /**
   * Retrieves full registration metadata for the mode.
   */
  public getRegistration(mode: TransportMode): TransportRegistrationMetadata | undefined {
    return this.registrations.get(mode);
  }

  /**
   * Returns all registered transport metadata.
   */
  public getAllRegistrations(): TransportRegistrationMetadata[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Cleans up all registered adapters.
   */
  public destroyAll(): void {
    this.registrations.forEach((reg) => reg.adapter.destroy());
    this.registrations.clear();
  }
}
