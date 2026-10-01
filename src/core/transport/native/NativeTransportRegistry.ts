/**
 * NearShare Native Transport Registry
 *
 * Central registry mapping platform transport modes and platforms to NativeTransportBridge instances.
 */

import type { NativeTransportBridge } from './NativeTransportBridge';
import { MockNativeTransportBridge } from './mock/MockNativeTransportBridge';

export class NativeTransportRegistry {
  private static instance: NativeTransportRegistry | null = null;
  private bridges = new Map<string, () => NativeTransportBridge>();
  private activeBridge: NativeTransportBridge | null = null;

  private constructor() {
    this.register('mock', () => new MockNativeTransportBridge());
    this.register('web', () => new MockNativeTransportBridge());
    this.register('macos', () => new MockNativeTransportBridge());
    this.register('windows', () => new MockNativeTransportBridge());
    this.register('android', () => new MockNativeTransportBridge());
    this.register('ios', () => new MockNativeTransportBridge());
  }

  public static getInstance(): NativeTransportRegistry {
    if (!NativeTransportRegistry.instance) {
      NativeTransportRegistry.instance = new NativeTransportRegistry();
    }
    return NativeTransportRegistry.instance;
  }

  public register(platform: string, factory: () => NativeTransportBridge): void {
    this.bridges.set(platform.toLowerCase(), factory);
  }

  public getBridge(platform: string = 'mock'): NativeTransportBridge {
    if (this.activeBridge && this.activeBridge.platform === platform) {
      return this.activeBridge;
    }

    const factory = this.bridges.get(platform.toLowerCase()) ?? this.bridges.get('mock') ?? (() => new MockNativeTransportBridge());
    this.activeBridge = factory();
    return this.activeBridge;
  }

  public setActiveBridge(bridge: NativeTransportBridge): void {
    this.activeBridge = bridge;
  }

  public static resetInstance(): void {
    NativeTransportRegistry.instance = null;
  }
}
