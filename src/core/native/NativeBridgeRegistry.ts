/**
 * NearShare Native Bridge Registry
 *
 * Central registry managing platform bridge factories and active NativeBridge instances.
 */

import type { NativeBridge } from './NativeBridge';
import type { NativePlatform } from './types';
import { MockNativeBridge } from './mock/MockNativeBridge';

export class NativeBridgeRegistry {
  private static instance: NativeBridgeRegistry | null = null;
  private bridges = new Map<NativePlatform, () => NativeBridge>();
  private activeBridge: NativeBridge | null = null;

  private constructor() {
    this.register('web', () => new MockNativeBridge());
    this.register('unknown', () => new MockNativeBridge());
    this.register('macos', () => new MockNativeBridge());
    this.register('windows', () => new MockNativeBridge());
    this.register('android', () => new MockNativeBridge());
    this.register('ios', () => new MockNativeBridge());
  }

  public static getInstance(): NativeBridgeRegistry {
    if (!NativeBridgeRegistry.instance) {
      NativeBridgeRegistry.instance = new NativeBridgeRegistry();
    }
    return NativeBridgeRegistry.instance;
  }

  public register(platform: NativePlatform, factory: () => NativeBridge): void {
    this.bridges.set(platform, factory);
  }

  public unregister(platform: NativePlatform): void {
    this.bridges.delete(platform);
  }

  public getBridge(platform: NativePlatform = 'web'): NativeBridge {
    if (this.activeBridge && this.activeBridge.platform === platform) {
      return this.activeBridge;
    }

    const factory = this.bridges.get(platform) ?? this.bridges.get('web') ?? (() => new MockNativeBridge());
    this.activeBridge = factory();
    return this.activeBridge;
  }

  public setActiveBridge(bridge: NativeBridge): void {
    this.activeBridge = bridge;
  }

  public listRegisteredPlatforms(): NativePlatform[] {
    return Array.from(this.bridges.keys());
  }

  public isAvailable(platform: NativePlatform): boolean {
    const bridge = this.getBridge(platform);
    return bridge.isAvailable();
  }

  public static resetInstance(): void {
    NativeBridgeRegistry.instance = null;
  }
}
