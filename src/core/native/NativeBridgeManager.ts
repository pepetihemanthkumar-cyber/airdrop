/**
 * NearShare Native Bridge Manager
 *
 * Singleton orchestrator providing unified access to the active NativeBridge.
 * Normalizes errors and coordinates platform requests without UI dependencies.
 */

import type { NativeBridge } from './NativeBridge';
import type {
  NativePlatform,
  PermissionKind,
  PermissionResult,
  FilePickerOptions,
  FolderPickerOptions,
  PickerResult,
} from './types';
import type { NativeBridgeCapabilities } from './NativeBridgeCapabilities';
import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from '../filesystem/types';
import { NativeBridgeRegistry } from './NativeBridgeRegistry';
import { PlatformBridgeFactory } from './PlatformBridgeFactory';

export class NativeBridgeManager {
  private static instance: NativeBridgeManager | null = null;
  private bridge: NativeBridge;
  private platform: NativePlatform;

  private constructor(customBridge?: NativeBridge) {
    this.platform = PlatformBridgeFactory.detectPlatform();
    this.bridge = customBridge ?? NativeBridgeRegistry.getInstance().getBridge(this.platform);
  }

  public static getInstance(customBridge?: NativeBridge): NativeBridgeManager {
    if (!NativeBridgeManager.instance) {
      NativeBridgeManager.instance = new NativeBridgeManager(customBridge);
    }
    return NativeBridgeManager.instance;
  }

  public setBridge(bridge: NativeBridge): void {
    this.bridge = bridge;
    this.platform = bridge.getPlatform();
  }

  public getBridge(): NativeBridge {
    return this.bridge;
  }

  public getPlatform(): NativePlatform {
    return this.platform;
  }

  public getCapabilities(): NativeBridgeCapabilities {
    return this.bridge.getCapabilities();
  }

  public isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  public async requestPermission(permission: PermissionKind): Promise<PermissionResult> {
    return this.bridge.requestPermission(permission);
  }

  public async pickFiles(options?: FilePickerOptions): Promise<PickerResult> {
    return this.bridge.pickFiles(options);
  }

  public async pickFolder(options?: FolderPickerOptions): Promise<PickerResult> {
    return this.bridge.pickFolder(options);
  }

  public async getFileMetadata(reference: FileReference): Promise<FileMetadata> {
    return this.bridge.getFileMetadata(reference);
  }

  public async readFile(reference: FileReference, offset: number, length: number): Promise<Uint8Array> {
    return this.bridge.readFile(reference, offset, length);
  }

  public async createFile(destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference> {
    return this.bridge.createFile(destination, metadata);
  }

  public async writeFile(reference: FileReference, offset: number, data: Uint8Array): Promise<number> {
    return this.bridge.writeFile(reference, offset, data);
  }

  public async finalizeFile(reference: FileReference): Promise<FileMetadata> {
    return this.bridge.finalizeFile(reference);
  }

  public async scanDirectory(reference: FileReference): Promise<DirectoryEntry[]> {
    return this.bridge.scanDirectory(reference);
  }

  public async resolveDestination(location: DestinationLocation): Promise<DestinationLocation> {
    return this.bridge.resolveDestination(location);
  }

  public async deleteTemporary(reference: FileReference): Promise<void> {
    return this.bridge.deleteTemporary(reference);
  }

  public async releaseReference(reference: FileReference): Promise<void> {
    return this.bridge.releaseReference(reference);
  }

  public static resetInstance(): void {
    NativeBridgeManager.instance = null;
  }
}
