/**
 * NearShare Mock Native Bridge
 *
 * In-memory simulation of the NativeBridge contract using MockFileSystemAdapter.
 * Simulates native file/folder pickers, permission grants, and native capabilities.
 */

import type { NativeBridge } from '../NativeBridge';
import type {
  NativePlatform,
  PermissionKind,
  PermissionResult,
  FilePickerOptions,
  FolderPickerOptions,
  PickerResult,
} from '../types';
import { type NativeBridgeCapabilities, DEFAULT_MOCK_BRIDGE_CAPABILITIES } from '../NativeBridgeCapabilities';
import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from '../../filesystem/types';
import { MockFileSystemAdapter } from '../../filesystem/mock/MockFileSystemAdapter';

export class MockNativeBridge implements NativeBridge {
  readonly platform: NativePlatform = 'web';
  private capabilities: NativeBridgeCapabilities = { ...DEFAULT_MOCK_BRIDGE_CAPABILITIES };
  private fsAdapter: MockFileSystemAdapter;
  private permissions = new Map<PermissionKind, boolean>();

  constructor(fsAdapter?: MockFileSystemAdapter) {
    this.fsAdapter = fsAdapter ?? new MockFileSystemAdapter();
    // Default mock permissions to granted for testing
    this.permissions.set('fileAccess', true);
    this.permissions.set('network', true);
    this.permissions.set('bluetooth', false);
    this.permissions.set('notifications', true);
    this.permissions.set('background', true);
  }

  getPlatform(): NativePlatform {
    return this.platform;
  }

  getCapabilities(): NativeBridgeCapabilities {
    return { ...this.capabilities };
  }

  isAvailable(): boolean {
    return true; // Mock bridge is always available in simulation
  }

  async requestPermission(permission: PermissionKind): Promise<PermissionResult> {
    this.permissions.set(permission, true);
    return {
      permission,
      state: 'granted',
      granted: true,
      canPrompt: true,
      updatedAt: Date.now(),
    };
  }

  async pickFiles(_options?: FilePickerOptions): Promise<PickerResult> {
    return {
      cancelled: false,
      references: [
        {
          id: 'fs_seed_01',
          name: 'photo.jpg',
          kind: 'file',
          size: 2516582,
          mimeType: 'image/jpeg',
          modifiedAt: Date.now() - 3600000,
          nativeReferenceId: 'mock_native_seed_01',
        },
        {
          id: 'fs_seed_03',
          name: 'document.pdf',
          kind: 'file',
          size: 1258291,
          mimeType: 'application/pdf',
          modifiedAt: Date.now() - 1800000,
          nativeReferenceId: 'mock_native_seed_03',
        },
      ],
    };
  }

  async pickFolder(_options?: FolderPickerOptions): Promise<PickerResult> {
    return {
      cancelled: false,
      references: [
        {
          id: 'fs_seed_06',
          name: 'project',
          kind: 'folder',
          size: 0,
          modifiedAt: Date.now() - 7200000,
          nativeReferenceId: 'mock_native_seed_06',
        },
      ],
    };
  }

  async getFileMetadata(reference: FileReference): Promise<FileMetadata> {
    return this.fsAdapter.getFileMetadata(reference);
  }

  async readFile(reference: FileReference, offset: number, length: number): Promise<Uint8Array> {
    return this.fsAdapter.read(reference, offset, length);
  }

  async createFile(destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference> {
    return this.fsAdapter.createFile(destination, metadata);
  }

  async writeFile(reference: FileReference, offset: number, data: Uint8Array): Promise<number> {
    return this.fsAdapter.write(reference, offset, data);
  }

  async finalizeFile(reference: FileReference): Promise<FileMetadata> {
    return this.fsAdapter.finalizeFile(reference);
  }

  async scanDirectory(reference: FileReference): Promise<DirectoryEntry[]> {
    return this.fsAdapter.scanDirectory(reference);
  }

  async resolveDestination(location: DestinationLocation): Promise<DestinationLocation> {
    return this.fsAdapter.resolveDestination(location);
  }

  async deleteTemporary(reference: FileReference): Promise<void> {
    return this.fsAdapter.deleteTemporary(reference);
  }

  async releaseReference(reference: FileReference): Promise<void> {
    return this.fsAdapter.release(reference);
  }
}
