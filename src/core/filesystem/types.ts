/**
 * NearShare Platform-Neutral Filesystem Types
 *
 * Defines core contracts for native file references, metadata, directory entries,
 * read/write requests, and destination locations.
 *
 * IMPORTANT SECURITY RULES:
 * 1. nativeReferenceId is strictly opaque to the protocol and UI layers.
 * 2. Never expose native absolute filesystem paths (/Users/..., C:\..., /storage/...)
 *    to protocol messages or React components.
 * 3. relativePath is transfer-relative only (e.g., "Project/src/App.tsx").
 */

export type FileKind = 'file' | 'folder';

export interface FileReference {
  id: string;
  name: string;
  kind: FileKind;
  size?: number;
  relativePath?: string; // Transfer-relative path only
  mimeType?: string;
  modifiedAt?: number;
  nativeReferenceId?: string; // Opaque native handle (scoped inside platform adapter)
}

export interface FileMetadata {
  name: string;
  kind: FileKind;
  size: number;
  mimeType?: string;
  modifiedAt?: number;
  relativePath: string; // Transfer-relative path
}

export interface DirectoryEntry {
  name: string;
  kind: FileKind;
  size: number;
  relativePath: string; // Transfer-relative path
  modifiedAt?: number;
  nativeReferenceId?: string;
}

export interface FileReadRequest {
  referenceId: string;
  offset: number;
  length: number;
}

export interface FileWriteRequest {
  referenceId: string;
  offset: number;
  data: Uint8Array;
}

export type DestinationLocationKind = 'downloads' | 'desktop' | 'documents' | 'pictures' | 'custom';

export interface DestinationLocation {
  id: string;
  name: string;
  kind: DestinationLocationKind;
  pathDescriptor?: string; // Opaque destination description or user-selected label
}
