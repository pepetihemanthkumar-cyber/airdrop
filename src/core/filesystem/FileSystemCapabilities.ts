/**
 * NearShare Filesystem Capabilities Contract
 *
 * Defines platform capability declarations for filesystem access,
 * streaming, random access, and permission constraints.
 */

export type CapabilitySupportLevel = 'supported' | 'unsupported' | 'restricted' | 'mockOnly';

export interface FileSystemCapabilities {
  readFiles: boolean;
  writeFiles: boolean;
  readFolders: boolean;
  writeFolders: boolean;
  streamingRead: boolean;
  streamingWrite: boolean;
  randomAccessRead: boolean;
  randomAccessWrite: boolean;
  filePicker: boolean;
  directoryPicker: boolean;
  persistentAccess: boolean;
  backgroundAccess: boolean;
  customDestination: boolean;
}

export const DEFAULT_MOCK_CAPABILITIES: FileSystemCapabilities = {
  readFiles: true,
  writeFiles: true,
  readFolders: true,
  writeFolders: true,
  streamingRead: true,
  streamingWrite: true,
  randomAccessRead: true,
  randomAccessWrite: true,
  filePicker: true,
  directoryPicker: true,
  persistentAccess: true,
  backgroundAccess: true,
  customDestination: true,
};
