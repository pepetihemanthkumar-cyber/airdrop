/**
 * NearShare File Writer Abstraction
 *
 * Defines the write boundary interface for staging and reassembling file chunks.
 * Concrete implementations (MockFileWriter, NativeFileWriter) implement this interface.
 */

import type { FileSource, FileWriteHandle, FileTransferResult } from './types';

export interface FileWriter {
  readonly file: FileSource;
  readonly handle: FileWriteHandle;

  /**
   * Opens the staging target for receiving chunks.
   */
  open(): Promise<void>;

  /**
   * Writes data at the specified offset.
   */
  write(offset: number, data: Uint8Array | string): Promise<number>;

  /**
   * Finalizes the staged file, moves it to the target destination, and validates integrity.
   */
  finalize(): Promise<FileTransferResult>;

  /**
   * Aborts writing and purges any staged temporary fragments.
   */
  abort(): Promise<void>;

  /**
   * Returns current count of bytes written.
   */
  getBytesWritten(): number;
}
