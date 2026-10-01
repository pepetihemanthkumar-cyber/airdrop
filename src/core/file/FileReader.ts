/**
 * NearShare File Reader Abstraction
 *
 * Defines the read boundary interface for streaming chunks from disk/memory.
 * Concrete implementations (MockFileReader, NativeFileReader) implement this interface.
 */

import type { FileSource, FileReadHandle } from './types';

export interface FileReader {
  readonly source: FileSource;
  readonly handle: FileReadHandle;

  /**
   * Opens the file resource for streaming reads.
   */
  open(): Promise<void>;

  /**
   * Reads a byte segment at the specified offset.
   */
  read(offset: number, length: number): Promise<Uint8Array | string>;

  /**
   * Closes the file reader handle and frees associated handles.
   */
  close(): Promise<void>;

  /**
   * Returns the total declared file size in bytes.
   */
  getSize(): number;
}
