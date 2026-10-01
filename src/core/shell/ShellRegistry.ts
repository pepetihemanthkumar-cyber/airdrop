/**
 * NearShare Native Shell Registry
 *
 * Central registry managing platform shell instances and factories.
 * Independent from React.
 */

import type { NativeShell } from './NativeShell';
import type { NativeShellPlatform } from './types';
import { MockNativeShell } from './mock/MockNativeShell';

export class ShellRegistry {
  private static instance: ShellRegistry | null = null;
  private shells = new Map<NativeShellPlatform, () => NativeShell>();
  private activeShell: NativeShell | null = null;

  private constructor() {
    this.register('mock', () => new MockNativeShell());
    this.register('web', () => new MockNativeShell());
    this.register('macos', () => new MockNativeShell());
    this.register('windows', () => new MockNativeShell());
    this.register('android', () => new MockNativeShell());
    this.register('ios', () => new MockNativeShell());
    this.register('unknown', () => new MockNativeShell());
  }

  public static getInstance(): ShellRegistry {
    if (!ShellRegistry.instance) {
      ShellRegistry.instance = new ShellRegistry();
    }
    return ShellRegistry.instance;
  }

  public register(platform: NativeShellPlatform, factory: () => NativeShell): void {
    this.shells.set(platform, factory);
  }

  public unregister(platform: NativeShellPlatform): void {
    this.shells.delete(platform);
  }

  public resolve(platform: NativeShellPlatform = 'mock'): NativeShell {
    if (this.activeShell && this.activeShell.platform === platform) {
      return this.activeShell;
    }

    const factory = this.shells.get(platform) ?? this.shells.get('mock') ?? (() => new MockNativeShell());
    this.activeShell = factory();
    return this.activeShell;
  }

  public list(): NativeShellPlatform[] {
    return Array.from(this.shells.keys());
  }

  public has(platform: NativeShellPlatform): boolean {
    return this.shells.has(platform);
  }

  public setActiveShell(shell: NativeShell): void {
    this.activeShell = shell;
  }

  public static resetInstance(): void {
    ShellRegistry.instance = null;
  }
}
