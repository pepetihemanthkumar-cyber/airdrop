/**
 * NearShare Filesystem Context
 *
 * Exposes the active FileSystemAdapter and FileSystemManager APIs to the application
 * without coupling React UI components to concrete mock or native classes.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { FileSystemManager } from '../core/filesystem/FileSystemManager';
import type { FileSystemAdapter } from '../core/filesystem/FileSystemAdapter';
import type {
  FileReference,
  FileMetadata,
  DirectoryEntry,
  DestinationLocation,
} from '../core/filesystem/types';
import type { FileSystemCapabilities } from '../core/filesystem/FileSystemCapabilities';
import { runMockFileSystemTestSuite, type FsTestSuiteSummary } from '../core/filesystem/mock/mockFileSystemTestSuite';

interface FileSystemContextType {
  manager: FileSystemManager;
  adapter: FileSystemAdapter;
  capabilities: FileSystemCapabilities;
  readMetadata: (reference: FileReference) => Promise<FileMetadata>;
  read: (reference: FileReference, offset: number, length: number) => Promise<Uint8Array>;
  createFile: (destination: DestinationLocation, metadata: FileMetadata) => Promise<FileReference>;
  write: (reference: FileReference, offset: number, data: Uint8Array) => Promise<number>;
  scanDirectory: (reference: FileReference) => Promise<DirectoryEntry[]>;
  resolveDestination: (location: DestinationLocation) => Promise<DestinationLocation>;
  finalizeFile: (reference: FileReference) => Promise<FileMetadata>;
  cleanup: (reference: FileReference) => Promise<void>;
  runTestSuite: () => Promise<FsTestSuiteSummary>;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => FileSystemManager.getInstance(), []);
  const adapter = useMemo(() => manager.getAdapter(), [manager]);
  const capabilities = useMemo(() => manager.getCapabilities(), [manager]);

  const readMetadata = useCallback((reference: FileReference) => manager.getFileMetadata(reference), [manager]);
  const read = useCallback((reference: FileReference, offset: number, length: number) => manager.read(reference, offset, length), [manager]);
  const createFile = useCallback((destination: DestinationLocation, metadata: FileMetadata) => manager.createFile(destination, metadata), [manager]);
  const write = useCallback((reference: FileReference, offset: number, data: Uint8Array) => manager.write(reference, offset, data), [manager]);
  const scanDirectory = useCallback((reference: FileReference) => manager.scanDirectory(reference), [manager]);
  const resolveDestination = useCallback((location: DestinationLocation) => manager.resolveDestination(location), [manager]);
  const finalizeFile = useCallback((reference: FileReference) => manager.finalizeFile(reference), [manager]);
  const cleanup = useCallback((reference: FileReference) => manager.deleteTemporary(reference), [manager]);
  const runTestSuite = useCallback(() => runMockFileSystemTestSuite(), []);

  const value: FileSystemContextType = useMemo(
    () => ({
      manager,
      adapter,
      capabilities,
      readMetadata,
      read,
      createFile,
      write,
      scanDirectory,
      resolveDestination,
      finalizeFile,
      cleanup,
      runTestSuite,
    }),
    [
      manager,
      adapter,
      capabilities,
      readMetadata,
      read,
      createFile,
      write,
      scanDirectory,
      resolveDestination,
      finalizeFile,
      cleanup,
      runTestSuite,
    ]
  );

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>;
};

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
};
