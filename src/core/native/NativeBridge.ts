/**
 * NearShare High-Level Native Bridge Contract
 *
 * Defines the platform-neutral bridge API connecting React/Core layers to native platform services.
 *
 * CRITICAL RULE:
 * React receives only opaque references and normalized metadata.
 * Platform-specific paths, bookmarks, and security handles remain encapsulated.
 */

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

export interface NativeBridge {
  readonly platform: NativePlatform;

  /**
   * Returns the current native platform identifier.
   */
  getPlatform(): NativePlatform;

  /**
   * Reports capabilities supported by the active native shell.
   */
  getCapabilities(): NativeBridgeCapabilities;

  /**
   * Checks if the native bridge host is active and responding.
   */
  isAvailable(): boolean;

  /**
   * Requests runtime permission from the host operating system.
   */
  requestPermission(permission: PermissionKind): Promise<PermissionResult>;

  /**
   * Opens the native OS file picker to select one or more files.
   */
  pickFiles(options?: FilePickerOptions): Promise<PickerResult>;

  /**
   * Opens the native OS directory picker to select a folder.
   */
  pickFolder(options?: FolderPickerOptions): Promise<PickerResult>;

  /**
   * Retrieves sanitized metadata for a referenced file.
   */
  getFileMetadata(reference: FileReference): Promise<FileMetadata>;

  /**
   * Reads raw bytes from a file reference at the specified offset.
   */
  readFile(reference: FileReference, offset: number, length: number): Promise<Uint8Array>;

  /**
   * Allocates a new file handle in destination storage.
   */
  createFile(destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference>;

  /**
   * Writes data into the file reference at offset.
   */
  writeFile(reference: FileReference, offset: number, data: Uint8Array): Promise<number>;

  /**
   * Finalizes writing and commits the file.
   */
  finalizeFile(reference: FileReference): Promise<FileMetadata>;

  /**
   * Scans a directory reference and returns its entries.
   */
  scanDirectory(reference: FileReference): Promise<DirectoryEntry[]>;

  /**
   * Resolves a destination location into an accessible descriptor.
   */
  resolveDestination(location: DestinationLocation): Promise<DestinationLocation>;

  /**
   * Deletes temporary staging fragments.
   */
  deleteTemporary(reference: FileReference): Promise<void>;

  /**
   * Releases allocated resources or security-scoped handles.
   */
  releaseReference(reference: FileReference): Promise<void>;
}
