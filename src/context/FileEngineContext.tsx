/**
 * NearShare File Engine Context
 *
 * Provides a React context interface for file operations, manifest creation,
 * chunk reads/writes, resume checkpointing, and diagnostic test suite execution.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { FileEngineManager } from '../core/file/FileEngineManager';
import type { FileEngine } from '../core/file/FileEngine';
import type {
  FileSource,
  FileReadHandle,
  FileWriteHandle,
  FileChunk,
  ResumeCheckpoint,
  FileTransferResult,
} from '../core/file/types';
import type { FileManifestPayload } from '../core/protocol/messageTypes';
import type { ChunkAssemblyStatus } from '../core/file/FileAssembler';
import type {
  OutgoingTransferPreparation,
  IncomingTransferPreparation,
} from '../core/file/TransferFileManager';
import { runMockFileTestSuite, type TestSuiteSummary } from '../core/file/mock/mockFileTestSuite';

interface FileEngineContextType {
  engine: FileEngine;
  prepareOutgoingTransfer: (
    files: FileSource[],
    options?: { transferId?: string }
  ) => Promise<OutgoingTransferPreparation>;
  prepareIncomingTransfer: (
    manifest: FileManifestPayload,
    options?: { destinationPath?: string }
  ) => Promise<IncomingTransferPreparation>;
  getMetadata: (source: FileSource) => Promise<FileSource>;
  createManifest: (transferId: string, files: FileSource[]) => FileManifestPayload;
  openRead: (source: FileSource) => Promise<FileReadHandle>;
  readChunk: (
    handle: FileReadHandle,
    chunkIndex: number,
    transferId: string,
    chunkSize?: number
  ) => Promise<FileChunk>;
  closeRead: (handle: FileReadHandle) => Promise<void>;
  createWrite: (
    transferId: string,
    file: FileSource,
    destinationPath?: string
  ) => Promise<FileWriteHandle>;
  writeChunk: (handle: FileWriteHandle, chunk: FileChunk) => Promise<ChunkAssemblyStatus>;
  finalizeWrite: (handle: FileWriteHandle, expectedChecksum?: string) => Promise<FileTransferResult>;
  abortWrite: (handle: FileWriteHandle) => Promise<void>;
  getCheckpoint: (transferId: string, fileId: string) => ResumeCheckpoint | null;
  verifyFile: (file: FileSource, checksum?: string) => Promise<boolean>;
  cleanupTransfer: (transferId: string) => Promise<void>;
  runTestSuite: () => Promise<TestSuiteSummary>;
}

const FileEngineContext = createContext<FileEngineContextType | undefined>(undefined);

export const FileEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const manager = useMemo(() => FileEngineManager.getInstance(), []);
  const engine = useMemo(() => manager.getEngine(), [manager]);
  const transferFileManager = useMemo(() => manager.getTransferFileManager(), [manager]);

  const prepareOutgoingTransfer = useCallback(
    (files: FileSource[], options?: { transferId?: string }) =>
      transferFileManager.prepareOutgoingTransfer(files, options),
    [transferFileManager]
  );

  const prepareIncomingTransfer = useCallback(
    (manifest: FileManifestPayload, options?: { destinationPath?: string }) =>
      transferFileManager.prepareIncomingTransfer(manifest, options),
    [transferFileManager]
  );

  const getMetadata = useCallback((source: FileSource) => engine.getMetadata(source), [engine]);

  const createManifest = useCallback(
    (transferId: string, files: FileSource[]) => transferFileManager.createManifest(transferId, files),
    [transferFileManager]
  );

  const openRead = useCallback((source: FileSource) => engine.openRead(source), [engine]);

  const readChunk = useCallback(
    (handle: FileReadHandle, chunkIndex: number, transferId: string, chunkSize?: number) =>
      engine.readChunk(handle, chunkIndex, transferId, chunkSize),
    [engine]
  );

  const closeRead = useCallback((handle: FileReadHandle) => engine.closeRead(handle), [engine]);

  const createWrite = useCallback(
    (transferId: string, file: FileSource, destinationPath?: string) =>
      engine.createWrite(transferId, file, destinationPath),
    [engine]
  );

  const writeChunk = useCallback(
    (handle: FileWriteHandle, chunk: FileChunk) => engine.writeChunk(handle, chunk),
    [engine]
  );

  const finalizeWrite = useCallback(
    (handle: FileWriteHandle, expectedChecksum?: string) => engine.finalizeWrite(handle, expectedChecksum),
    [engine]
  );

  const abortWrite = useCallback((handle: FileWriteHandle) => engine.abortWrite(handle), [engine]);

  const getCheckpoint = useCallback(
    (transferId: string, fileId: string) => engine.getCheckpoint(transferId, fileId),
    [engine]
  );

  const verifyFile = useCallback(
    (file: FileSource, checksum?: string) => engine.verifyFile(file, checksum),
    [engine]
  );

  const cleanupTransfer = useCallback(
    (transferId: string) => engine.cleanupTransfer(transferId),
    [engine]
  );

  const runTestSuite = useCallback(() => runMockFileTestSuite(), []);

  const value: FileEngineContextType = useMemo(
    () => ({
      engine,
      prepareOutgoingTransfer,
      prepareIncomingTransfer,
      getMetadata,
      createManifest,
      openRead,
      readChunk,
      closeRead,
      createWrite,
      writeChunk,
      finalizeWrite,
      abortWrite,
      getCheckpoint,
      verifyFile,
      cleanupTransfer,
      runTestSuite,
    }),
    [
      engine,
      prepareOutgoingTransfer,
      prepareIncomingTransfer,
      getMetadata,
      createManifest,
      openRead,
      readChunk,
      closeRead,
      createWrite,
      writeChunk,
      finalizeWrite,
      abortWrite,
      getCheckpoint,
      verifyFile,
      cleanupTransfer,
      runTestSuite,
    ]
  );

  return <FileEngineContext.Provider value={value}>{children}</FileEngineContext.Provider>;
};

export const useFileEngine = () => {
  const context = useContext(FileEngineContext);
  if (!context) {
    throw new Error('useFileEngine must be used within a FileEngineProvider');
  }
  return context;
};
