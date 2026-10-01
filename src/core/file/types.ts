/**
 * NearShare File Engine Core Types
 *
 * Defines platform-neutral file representation, read/write handles,
 * chunk descriptors, resume checkpoints, and transfer staging contracts.
 */

export interface FileSource {
  fileId: string;
  name: string;
  size: number;
  type: string;
  mimeType?: string;
  relativePath?: string; // Logical relative path for folder structures
  modifiedAt?: number;
}

export interface FileReadHandle {
  fileId: string;
  size: number;
  position: number;
  source: FileSource;
  openedAt: number;
}

export interface FileChunk {
  transferId: string;
  fileId: string;
  chunkIndex: number;
  offset: number;
  length: number;
  totalChunks: number;
  data: Uint8Array | string; // Binary byte array or deterministic base64/hex representation
  checksum?: string;
}

export interface FileWriteHandle {
  fileId: string;
  temporaryId: string;
  expectedSize: number;
  bytesWritten: number;
  destinationPath?: string; // Logical target folder/destination descriptor
  openedAt: number;
}

export interface ResumeCheckpoint {
  transferId: string;
  fileId: string;
  nextChunkIndex: number;
  bytesReceived: number;
  updatedAt: number;
}

export interface FileTransferResult {
  transferId: string;
  fileId: string;
  bytesProcessed: number;
  verified: boolean;
  checksum?: string;
}
