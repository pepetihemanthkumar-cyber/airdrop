/**
 * NearShare Filesystem Registry
 *
 * Central registry mapping platform keys to concrete FileSystemAdapter implementations.
 * Decoupled from React. Defaults to MockFileSystemAdapter during frontend simulation.
 */

import type { FileSystemAdapter } from './FileSystemAdapter';
import { MockFileSystemAdapter } from './mock/MockFileSystemAdapter';

export class FileSystemRegistry {
  private static instance: FileSystemRegistry | null = null;
  private adapters = new Map<string, () => FileSystemAdapter>();
  private activeAdapter: FileSystemAdapter | null = null;

  private constructor() {
    this.register('mock', () => new MockFileSystemAdapter());
    this.register('web', () => new MockFileSystemAdapter());
    this.register('macos', () => new MockFileSystemAdapter());
    this.register('windows', () => new MockFileSystemAdapter());
    this.register('android', () => new MockFileSystemAdapter());
    this.register('ios', () => new MockFileSystemAdapter());
  }

  public static getInstance(): FileSystemRegistry {
    if (!FileSystemRegistry.instance) {
      FileSystemRegistry.instance = new FileSystemRegistry();
    }
    return FileSystemRegistry.instance;
  }

  /**
   * Registers an adapter factory for a target platform.
   */
  public register(platform: string, factory: () => FileSystemAdapter): void {
    this.adapters.set(platform.toLowerCase(), factory);
  }

  /**
   * Retrieves or instantiates the adapter for the requested platform.
   */
  public getAdapter(platform: string = 'mock'): FileSystemAdapter {
    if (this.activeAdapter && this.activeAdapter.platform === platform) {
      return this.activeAdapter;
    }

    const factory = this.adapters.get(platform.toLowerCase()) ?? this.adapters.get('mock');
    if (!factory) {
      this.activeAdapter = new MockFileSystemAdapter();
    } else {
      this.activeAdapter = factory();
    }

    return this.activeAdapter;
  }

  public setActiveAdapter(adapter: FileSystemAdapter): void {
    this.activeAdapter = adapter;
  }

  public static resetInstance(): void {
    FileSystemRegistry.instance = null;
  }
}
