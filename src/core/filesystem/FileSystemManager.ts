/**
 * NearShare Filesystem Manager
 *
 * Singleton manager exposing high-level operations on the active FileSystemAdapter.
 * Pure TypeScript core — free from React dependencies.
 */

import type { FileSystemAdapter } from './FileSystemAdapter';
import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from './types';
import type { FileSystemCapabilities } from './FileSystemCapabilities';
import { FileSystemRegistry } from './FileSystemRegistry';
import { FolderScanner } from './FolderScanner';

export class FileSystemManager {
  private static instance: FileSystemManager | null = null;
  private adapter: FileSystemAdapter;
  private folderScanner: FolderScanner;

  private constructor(customAdapter?: FileSystemAdapter) {
    this.adapter = customAdapter ?? FileSystemRegistry.getInstance().getAdapter();
    this.folderScanner = new FolderScanner(this.adapter);
  }

  public static getInstance(customAdapter?: FileSystemAdapter): FileSystemManager {
    if (!FileSystemManager.instance) {
      FileSystemManager.instance = new FileSystemManager(customAdapter);
    }
    return FileSystemManager.instance;
  }

  public setAdapter(adapter: FileSystemAdapter): void {
    this.adapter = adapter;
    this.folderScanner = new FolderScanner(adapter);
  }

  public getAdapter(): FileSystemAdapter {
    return this.adapter;
  }

  public getCapabilities(): FileSystemCapabilities {
    return this.adapter.getCapabilities();
  }

  public async getFileMetadata(reference: FileReference): Promise<FileMetadata> {
    return this.adapter.getFileMetadata(reference);
  }

  public async read(reference: FileReference, offset: number, length: number): Promise<Uint8Array> {
    return this.adapter.read(reference, offset, length);
  }

  public async createFile(destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference> {
    return this.adapter.createFile(destination, metadata);
  }

  public async write(reference: FileReference, offset: number, data: Uint8Array): Promise<number> {
    return this.adapter.write(reference, offset, data);
  }

  public async finalizeFile(reference: FileReference): Promise<FileMetadata> {
    return this.adapter.finalizeFile(reference);
  }

  public async scanDirectory(reference: FileReference): Promise<DirectoryEntry[]> {
    return this.folderScanner.scanFolder(reference);
  }

  public async deleteTemporary(reference: FileReference): Promise<void> {
    return this.adapter.deleteTemporary(reference);
  }

  public async resolveDestination(location: DestinationLocation): Promise<DestinationLocation> {
    return this.adapter.resolveDestination(location);
  }

  public async exists(reference: FileReference): Promise<boolean> {
    return this.adapter.exists(reference);
  }

  public async release(reference: FileReference): Promise<void> {
    return this.adapter.release(reference);
  }

  public static resetInstance(): void {
    FileSystemManager.instance = null;
  }
}
