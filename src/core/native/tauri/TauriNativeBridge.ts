/**
 * NearShare Tauri Native Bridge Implementation (v2 Spike)
 *
 * Implements the NativeBridge boundary for the Tauri v2 desktop host environment.
 * Proves that the React core can interface with Tauri without falsely claiming
 * implemented native transport or filesystem access.
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
import type { NativeBridgeCapabilities } from '../NativeBridgeCapabilities';
import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from '../../filesystem/types';
import { NativeException, createNativeError } from '../NativeError';
import {
  type TauriRuntimeDiagnostics,
  type TauriPickedFile,
  type NativeChunkReadResult,
  getRuntimeDiagnostics,
  isTauriRuntime,
  pickFiles,
  createNativeFile,
  readNativeFileChunk,
  writeNativeFileChunk,
  getNativeFileSize,
  closeNativeFile,
  pickFolder,
  scanNativeFolder,
  closeNativeFolder,
} from './TauriIpc';

export interface TauriRuntimeInfo {
  platform: NativePlatform;
  architecture: string;
  runtime: 'tauri';
  runtimeVersion: string;
}

export class TauriNativeBridge implements NativeBridge {
  readonly platform: NativePlatform;

  constructor(platform?: NativePlatform) {
    this.platform = platform || this.detectPlatform();
  }

  /**
   * Helper to check if the Tauri v2 webview injection is present.
   */
  static isTauriDetected(): boolean {
    return isTauriRuntime();
  }

  /**
   * Diagnostic IPC call executing get_runtime_diagnostics in Rust.
   */
  async fetchDiagnostics(): Promise<TauriRuntimeDiagnostics | null> {
    return getRuntimeDiagnostics();
  }

  getPlatform(): NativePlatform {
    return this.platform;
  }

  detectPlatform(): NativePlatform {
    if (typeof window === 'undefined') return 'unknown';

    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('macintosh') || ua.includes('mac os x')) return 'macos';
    if (ua.includes('windows')) return 'windows';
    return 'unknown';
  }

  /**
   * Honest capability reporting:
   * filePicker, folderPicker, streamingRead, streamingWrite, randomAccessRead, and randomAccessWrite are 'supported' on macOS Tauri.
   * All other filesystem and networking capabilities remain 'notImplemented'.
   */
  getCapabilities(): NativeBridgeCapabilities {
    const isMacTauri = this.isAvailable() && this.platform === 'macos';

    return {
      filesystem: 'notImplemented',
      filePicker: isMacTauri ? 'supported' : 'notImplemented',
      folderPicker: isMacTauri ? 'supported' : 'notImplemented',
      streamingRead: isMacTauri ? 'supported' : 'notImplemented',
      streamingWrite: isMacTauri ? 'supported' : 'notImplemented',
      randomAccessRead: isMacTauri ? 'supported' : 'notImplemented',
      randomAccessWrite: isMacTauri ? 'supported' : 'notImplemented',
      persistentAccess: 'notImplemented',
      backgroundExecution: 'notImplemented',
      notifications: 'notImplemented',
      secureStorage: 'notImplemented',
      bluetooth: 'notImplemented',
      directNearbyNetworking: 'notImplemented',
      localNetworkNetworking: 'notImplemented',
    };
  }

  isAvailable(): boolean {
    return TauriNativeBridge.isTauriDetected();
  }

  getRuntimeInfo(): TauriRuntimeInfo {
    return {
      platform: this.getPlatform(),
      architecture: 'arm64/x64',
      runtime: 'tauri',
      runtimeVersion: '2.12.0',
    };
  }

  async requestPermission(permission: PermissionKind): Promise<PermissionResult> {
    return {
      permission,
      state: 'unsupported',
      granted: false,
      canPrompt: false,
      updatedAt: Date.now(),
    };
  }

  /**
   * Opens the native macOS file selection dialog via Tauri IPC.
   * Returns opaque references with zero path leakage.
   */
  async pickFiles(_options?: FilePickerOptions): Promise<PickerResult> {
    if (!this.isAvailable()) {
      return { cancelled: true, references: [] };
    }

    const pickedFiles: TauriPickedFile[] = await pickFiles();

    if (pickedFiles.length === 0) {
      return { cancelled: true, references: [] };
    }

    const references = pickedFiles.map((file) => ({
      id: file.id,
      name: file.name,
      kind: 'file' as const,
      size: file.size,
      mimeType: file.mimeType,
      modifiedAt: Date.now(),
      nativeReferenceId: file.id,
    }));

    return {
      cancelled: false,
      references,
    };
  }

  /**
   * Opens the native macOS folder selection dialog via Tauri IPC.
   * Returns opaque folder reference with zero path leakage.
   */
  async pickFolder(_options?: FolderPickerOptions): Promise<PickerResult> {
    if (!this.isAvailable()) {
      return { cancelled: true, references: [] };
    }

    const folder = await pickFolder();
    if (!folder) {
      return { cancelled: true, references: [] };
    }

    return {
      cancelled: false,
      references: [
        {
          id: folder.id,
          name: folder.name,
          kind: 'folder' as const,
          size: 0,
          modifiedAt: Date.now(),
          nativeReferenceId: folder.id,
        },
      ],
    };
  }

  async getFileMetadata(reference: FileReference): Promise<FileMetadata> {
    let actualSize = reference.size ?? 0;
    if (this.isAvailable() && reference.id && reference.kind === 'file') {
      const liveSize = await getNativeFileSize(reference.id);
      if (typeof liveSize === 'number') actualSize = liveSize;
    }

    return {
      name: reference.name || 'unnamed',
      kind: reference.kind || 'file',
      size: actualSize,
      mimeType: reference.mimeType,
      modifiedAt: reference.modifiedAt ?? Date.now(),
      relativePath: reference.relativePath || reference.name || 'unnamed',
    };
  }

  /**
   * Reads a bounded byte chunk from an opaque native file reference.
   */
  async readFile(reference: FileReference, offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0) {
      throw new NativeException(
        createNativeError('INVALID_REFERENCE', 'Offset cannot be negative', {
          operation: 'readFile',
        })
      );
    }
    if (length <= 0) {
      throw new NativeException(
        createNativeError('INVALID_REFERENCE', 'Requested length must be greater than 0', {
          operation: 'readFile',
        })
      );
    }
    if (length > 4 * 1024 * 1024) {
      throw new NativeException(
        createNativeError('INVALID_REFERENCE', 'Requested length exceeds maximum chunk size of 4 MiB', {
          operation: 'readFile',
        })
      );
    }

    if (!this.isAvailable()) {
      throw new NativeException(
        createNativeError('PLATFORM_FAILURE', 'Tauri desktop runtime is not available', {
          operation: 'readFile',
        })
      );
    }

    try {
      const refId = reference.id;
      const chunkResult: NativeChunkReadResult | null = await readNativeFileChunk(refId, offset, length);

      if (!chunkResult) {
        throw new NativeException(
          createNativeError('NOT_FOUND', 'Native file reference not found or session was closed', {
            operation: 'readFile',
          })
        );
      }

      return chunkResult.bytes;
    } catch (err) {
      if (err instanceof NativeException) throw err;
      throw new NativeException(
        createNativeError('NOT_FOUND', err instanceof Error ? err.message : String(err), {
          operation: 'readFile',
        })
      );
    }
  }

  /**
   * Prompts user with native Save Dialog and allocates a new file handle in destination storage.
   */
  async createFile(_destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference> {
    if (!this.isAvailable()) {
      throw new NativeException(
        createNativeError('PLATFORM_FAILURE', 'Tauri desktop runtime is not available', {
          operation: 'createFile',
        })
      );
    }

    const created = await createNativeFile(metadata.name);
    if (!created) {
      throw new NativeException(
        createNativeError('CANCELLED', 'Destination file creation cancelled by user', {
          operation: 'createFile',
        })
      );
    }

    return {
      id: created.id,
      name: created.name,
      kind: 'file',
      size: created.size,
      mimeType: created.mimeType,
      modifiedAt: Date.now(),
      nativeReferenceId: created.id,
    };
  }

  /**
   * Writes data into the native destination file reference at the specified offset.
   */
  async writeFile(reference: FileReference, offset: number, data: Uint8Array): Promise<number> {
    if (offset < 0) {
      throw new NativeException(
        createNativeError('INVALID_REFERENCE', 'Offset cannot be negative', {
          operation: 'writeFile',
        })
      );
    }
    if (data.length > 4 * 1024 * 1024) {
      throw new NativeException(
        createNativeError('INVALID_REFERENCE', 'Payload exceeds maximum chunk size of 4 MiB', {
          operation: 'writeFile',
        })
      );
    }
    if (!this.isAvailable()) {
      throw new NativeException(
        createNativeError('PLATFORM_FAILURE', 'Tauri desktop runtime is not available', {
          operation: 'writeFile',
        })
      );
    }

    try {
      const result = await writeNativeFileChunk(reference.id, offset, data);
      if (!result) {
        throw new NativeException(
          createNativeError('NOT_FOUND', 'Native file reference not found or session was closed', {
            operation: 'writeFile',
          })
        );
      }
      return result.bytesWritten;
    } catch (err) {
      if (err instanceof NativeException) throw err;
      throw new NativeException(
        createNativeError('NOT_FOUND', err instanceof Error ? err.message : String(err), {
          operation: 'writeFile',
        })
      );
    }
  }

  async finalizeFile(reference: FileReference): Promise<FileMetadata> {
    if (!this.isAvailable()) {
      throw new NativeException(
        createNativeError('PLATFORM_FAILURE', 'Tauri desktop runtime is not available', {
          operation: 'finalizeFile',
        })
      );
    }
    const currentSize = (await getNativeFileSize(reference.id)) ?? reference.size ?? 0;
    return {
      name: reference.name || 'unnamed',
      kind: 'file',
      size: currentSize,
      mimeType: reference.mimeType,
      modifiedAt: Date.now(),
      relativePath: reference.relativePath || reference.name || 'unnamed',
    };
  }

  /**
   * Recursively scans an opaque native folder reference via Rust.
   * Returns a list of safe DirectoryEntry items with canonical relative paths.
   */
  async scanDirectory(reference: FileReference): Promise<DirectoryEntry[]> {
    if (!this.isAvailable()) {
      throw new NativeException(
        createNativeError('PLATFORM_FAILURE', 'Tauri desktop runtime is not available', {
          operation: 'scanDirectory',
        })
      );
    }

    try {
      const scanResult = await scanNativeFolder(reference.id);
      if (!scanResult) {
        throw new NativeException(
          createNativeError('NOT_FOUND', 'Folder reference not found or session was closed', {
            operation: 'scanDirectory',
          })
        );
      }

      return scanResult.entries.map((entry) => ({
        name: entry.name,
        kind: entry.kind as 'file' | 'folder',
        size: entry.size,
        relativePath: entry.relativePath,
        modifiedAt: entry.modifiedAt,
        nativeReferenceId: entry.id,
      }));
    } catch (err) {
      if (err instanceof NativeException) throw err;
      throw new NativeException(
        createNativeError('PLATFORM_FAILURE', err instanceof Error ? err.message : String(err), {
          operation: 'scanDirectory',
        })
      );
    }
  }

  async resolveDestination(location: DestinationLocation): Promise<DestinationLocation> {
    return location;
  }

  async deleteTemporary(_reference: FileReference): Promise<void> {
    // No-op in spike
  }

  /**
   * Releases allocated native file or folder handle from session registry.
   */
  async releaseReference(reference: FileReference): Promise<void> {
    if (this.isAvailable()) {
      if (reference.kind === 'folder' || reference.id.startsWith('native-folder-')) {
        await closeNativeFolder(reference.id);
      } else {
        await closeNativeFile(reference.id);
      }
    }
  }
}
