/**
 * NearShare Mock Filesystem Adapter
 *
 * Deterministic in-memory simulated filesystem implementing FileSystemAdapter.
 * Seeded with realistic files and folders for development, unit testing, and UI preview.
 */

import type { FileSystemAdapter } from '../FileSystemAdapter';
import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from '../types';
import { type FileSystemCapabilities, DEFAULT_MOCK_CAPABILITIES } from '../FileSystemCapabilities';
import { FileSystemException, createFileSystemError } from '../errors';
import { isSafeRelativePath, normalizeSafeRelativePath } from '../PathSafety';

interface MockStoredItem {
  id: string;
  name: string;
  kind: 'file' | 'folder';
  size: number;
  relativePath: string;
  mimeType?: string;
  modifiedAt: number;
  data?: Uint8Array;
}

export class MockFileSystemAdapter implements FileSystemAdapter {
  readonly platform = 'mock';
  private capabilities: FileSystemCapabilities = { ...DEFAULT_MOCK_CAPABILITIES };
  private storage = new Map<string, MockStoredItem>();
  private temporaryStorage = new Map<string, MockStoredItem>();

  constructor() {
    this.seedDefaultFilesystem();
  }

  private seedDefaultFilesystem(): void {
    const now = Date.now();

    const seedEntries: Array<{
      id: string;
      name: string;
      kind: 'file' | 'folder';
      size: number;
      relativePath: string;
      mimeType?: string;
    }> = [
      { id: 'fs_seed_01', name: 'photo.jpg', kind: 'file', size: 2516582, relativePath: 'photo.jpg', mimeType: 'image/jpeg' },
      { id: 'fs_seed_02', name: 'video.mp4', kind: 'file', size: 8912896, relativePath: 'video.mp4', mimeType: 'video/mp4' },
      { id: 'fs_seed_03', name: 'document.pdf', kind: 'file', size: 1258291, relativePath: 'document.pdf', mimeType: 'application/pdf' },
      { id: 'fs_seed_04', name: 'archive.zip', kind: 'file', size: 5347737, relativePath: 'archive.zip', mimeType: 'application/zip' },
      { id: 'fs_seed_05', name: 'application.apk', kind: 'file', size: 15728640, relativePath: 'application.apk', mimeType: 'application/vnd.android.package-archive' },
      { id: 'fs_seed_06', name: 'project', kind: 'folder', size: 0, relativePath: 'project/' },
      { id: 'fs_seed_07', name: 'App.tsx', kind: 'file', size: 4890, relativePath: 'project/src/App.tsx', mimeType: 'text/javascript' },
      { id: 'fs_seed_08', name: 'main.tsx', kind: 'file', size: 1240, relativePath: 'project/src/main.tsx', mimeType: 'text/javascript' },
      { id: 'fs_seed_09', name: 'package.json', kind: 'file', size: 780, relativePath: 'project/package.json', mimeType: 'application/json' },
    ];

    for (const item of seedEntries) {
      const data = item.kind === 'file' ? generateDeterministicBytes(item.id, item.size) : undefined;
      this.storage.set(item.id, {
        ...item,
        modifiedAt: now - 3600000,
        data,
      });
    }
  }

  getCapabilities(): FileSystemCapabilities {
    return { ...this.capabilities };
  }

  async getFileMetadata(reference: FileReference): Promise<FileMetadata> {
    const item = this.storage.get(reference.id) || this.temporaryStorage.get(reference.id);
    if (!item) {
      throw new FileSystemException(
        createFileSystemError('NOT_FOUND', `File reference not found: '${reference.id}'`)
      );
    }

    return {
      name: item.name,
      kind: item.kind,
      size: item.size,
      mimeType: item.mimeType,
      modifiedAt: item.modifiedAt,
      relativePath: item.relativePath,
    };
  }

  async read(reference: FileReference, offset: number, length: number): Promise<Uint8Array> {
    const item = this.storage.get(reference.id) || this.temporaryStorage.get(reference.id);
    if (!item) {
      throw new FileSystemException(
        createFileSystemError('NOT_FOUND', `Cannot read missing reference '${reference.id}'`)
      );
    }

    if (item.kind === 'folder') {
      throw new FileSystemException(
        createFileSystemError('UNSUPPORTED_OPERATION', `Cannot read raw bytes from directory '${item.name}'`)
      );
    }

    if (offset < 0 || offset > item.size) {
      throw new FileSystemException(
        createFileSystemError('INVALID_OFFSET', `Offset ${offset} out of file bounds (${item.size})`)
      );
    }

    const data = item.data ?? new Uint8Array(0);
    const end = Math.min(data.length, offset + length);
    return data.slice(offset, end);
  }

  async createFile(_destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference> {
    if (!isSafeRelativePath(metadata.relativePath)) {
      throw new FileSystemException(
        createFileSystemError('INVALID_PATH', `Unsafe destination relative path '${metadata.relativePath}'`)
      );
    }

    const id = `fs_tmp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const buffer = new Uint8Array(metadata.size);

    const tempItem: MockStoredItem = {
      id,
      name: metadata.name,
      kind: metadata.kind,
      size: metadata.size,
      relativePath: normalizeSafeRelativePath(metadata.relativePath),
      mimeType: metadata.mimeType,
      modifiedAt: Date.now(),
      data: buffer,
    };

    this.temporaryStorage.set(id, tempItem);

    return {
      id,
      name: metadata.name,
      kind: metadata.kind,
      size: metadata.size,
      relativePath: tempItem.relativePath,
      mimeType: metadata.mimeType,
      modifiedAt: tempItem.modifiedAt,
      nativeReferenceId: `mock_ref_${id}`,
    };
  }

  async write(reference: FileReference, offset: number, data: Uint8Array): Promise<number> {
    const item = this.temporaryStorage.get(reference.id);
    if (!item) {
      throw new FileSystemException(
        createFileSystemError('NOT_FOUND', `Temporary write target not found: '${reference.id}'`)
      );
    }

    if (!item.data) {
      item.data = new Uint8Array(item.size);
    }

    const end = Math.min(item.data.length, offset + data.length);
    item.data.set(data.subarray(0, end - offset), offset);
    item.modifiedAt = Date.now();

    return data.byteLength;
  }

  async finalizeFile(reference: FileReference): Promise<FileMetadata> {
    const tempItem = this.temporaryStorage.get(reference.id);
    if (!tempItem) {
      throw new FileSystemException(
        createFileSystemError('NOT_FOUND', `Cannot finalize missing staging reference '${reference.id}'`)
      );
    }

    // Move from temporary storage to primary storage
    this.storage.set(tempItem.id, tempItem);
    this.temporaryStorage.delete(tempItem.id);

    return {
      name: tempItem.name,
      kind: tempItem.kind,
      size: tempItem.size,
      mimeType: tempItem.mimeType,
      modifiedAt: tempItem.modifiedAt,
      relativePath: tempItem.relativePath,
    };
  }

  async createDirectory(_destination: DestinationLocation, name: string): Promise<FileReference> {
    const id = `fs_dir_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const relativePath = normalizeSafeRelativePath(`${name}/`);

    const dirItem: MockStoredItem = {
      id,
      name,
      kind: 'folder',
      size: 0,
      relativePath,
      modifiedAt: Date.now(),
    };

    this.storage.set(id, dirItem);

    return {
      id,
      name,
      kind: 'folder',
      size: 0,
      relativePath,
      nativeReferenceId: `mock_ref_${id}`,
    };
  }

  async scanDirectory(reference: FileReference): Promise<DirectoryEntry[]> {
    const root = this.storage.get(reference.id);
    if (!root) {
      throw new FileSystemException(
        createFileSystemError('NOT_FOUND', `Directory reference '${reference.id}' not found`)
      );
    }

    const prefix = root.relativePath.endsWith('/') ? root.relativePath : `${root.relativePath}/`;
    const entries: DirectoryEntry[] = [];

    for (const item of Array.from(this.storage.values())) {
      if (item.id !== root.id && item.relativePath.startsWith(prefix)) {
        entries.push({
          name: item.name,
          kind: item.kind,
          size: item.size,
          relativePath: item.relativePath,
          modifiedAt: item.modifiedAt,
          nativeReferenceId: `mock_ref_${item.id}`,
        });
      }
    }

    return entries;
  }

  async deleteTemporary(reference: FileReference): Promise<void> {
    this.temporaryStorage.delete(reference.id);
  }

  async resolveDestination(location: DestinationLocation): Promise<DestinationLocation> {
    return {
      ...location,
      pathDescriptor: `[MockStorage:/${location.kind}/${location.name}]`,
    };
  }

  async exists(reference: FileReference): Promise<boolean> {
    return this.storage.has(reference.id) || this.temporaryStorage.has(reference.id);
  }

  async release(_reference: FileReference): Promise<void> {
    // Release in-memory handle references if any
  }

  seedItem(item: {
    id: string;
    name: string;
    kind?: 'file' | 'folder';
    size: number;
    relativePath: string;
    mimeType?: string;
    data?: Uint8Array;
  }): void {
    const data = item.data ?? (item.kind !== 'folder' ? generateDeterministicBytes(item.id, item.size) : undefined);
    this.storage.set(item.id, {
      id: item.id,
      name: item.name,
      kind: item.kind ?? 'file',
      size: item.size,
      relativePath: item.relativePath,
      mimeType: item.mimeType,
      modifiedAt: Date.now(),
      data,
    });
  }
}

function generateDeterministicBytes(seed: string, size: number): Uint8Array {
  if (size <= 0) return new Uint8Array(0);
  const arr = new Uint8Array(size);
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s + seed.charCodeAt(i)) % 256;
  }
  for (let i = 0; i < size; i++) {
    arr[i] = (s + i) % 256;
  }
  return arr;
}
