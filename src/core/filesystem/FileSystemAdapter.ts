/**
 * NearShare Filesystem Adapter Interface Contract
 *
 * Defines the central platform-neutral interface that native platform implementations
 * (macOS, Windows, Android, iOS) or simulated mock adapters must implement.
 *
 * ARCHITECTURAL ISOLATION RULES:
 * - Adapter owns native filesystem interaction.
 * - FileEngine remains platform-neutral.
 * - UI never talks directly to this adapter.
 * - Transport never talks directly to this adapter.
 * - Protocol never receives native paths.
 */

import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from './types';
import type { FileSystemCapabilities } from './FileSystemCapabilities';

export interface FileSystemAdapter {
  readonly platform: string;

  /**
   * Reports capabilities supported by this filesystem adapter.
   */
  getCapabilities(): FileSystemCapabilities;

  /**
   * Retrieves sanitized metadata for a referenced file.
   */
  getFileMetadata(reference: FileReference): Promise<FileMetadata>;

  /**
   * Reads a byte segment at the given offset.
   */
  read(reference: FileReference, offset: number, length: number): Promise<Uint8Array>;

  /**
   * Allocates a new destination file handle in the target location.
   */
  createFile(destination: DestinationLocation, metadata: FileMetadata): Promise<FileReference>;

  /**
   * Writes data into the file reference at the specified offset.
   */
  write(reference: FileReference, offset: number, data: Uint8Array): Promise<number>;

  /**
   * Finalizes writing and commits the file to permanent destination storage.
   */
  finalizeFile(reference: FileReference): Promise<FileMetadata>;

  /**
   * Creates a directory structure at the target destination.
   */
  createDirectory(destination: DestinationLocation, name: string): Promise<FileReference>;

  /**
   * Recursively or shallowly scans a directory reference and returns its entries.
   */
  scanDirectory(reference: FileReference): Promise<DirectoryEntry[]>;

  /**
   * Deletes temporary fragments or aborted staging files for the reference.
   */
  deleteTemporary(reference: FileReference): Promise<void>;

  /**
   * Resolves a destination location into an accessible staging target descriptor.
   */
  resolveDestination(location: DestinationLocation): Promise<DestinationLocation>;

  /**
   * Checks if the referenced file exists and is accessible.
   */
  exists(reference: FileReference): Promise<boolean>;

  /**
   * Releases allocated resources or security bookmarks associated with the reference.
   */
  release(reference: FileReference): Promise<void>;
}
