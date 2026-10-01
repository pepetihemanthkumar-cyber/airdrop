/**
 * NearShare File Metadata Reader
 *
 * Converts and normalizes native adapter results into protocol-safe metadata.
 * Enforces path safety, validates filenames, infers MIME types, and produces
 * descriptors compatible with protocol FileManifestEntry.
 */

import type { FileReference, FileMetadata, DirectoryEntry } from './types';
import type { FileManifestEntry } from '../protocol/messageTypes';
import { normalizeSafeRelativePath, isSafeRelativePath } from './PathSafety';
import { FileSystemException, createFileSystemError } from './errors';

export class FileMetadataReader {
  /**
   * Sanitizes and normalizes raw FileMetadata into safe protocol-ready metadata.
   */
  static normalize(raw: Partial<FileMetadata> & { name: string }): FileMetadata {
    if (!raw.name || typeof raw.name !== 'string' || raw.name.trim().length === 0) {
      throw new FileSystemException(
        createFileSystemError('INVALID_PATH', 'File name cannot be empty')
      );
    }

    const sanitizedName = raw.name.trim().replace(/[/\\]/g, '_');
    const rawPath = raw.relativePath || sanitizedName;

    if (!isSafeRelativePath(rawPath)) {
      throw new FileSystemException(
        createFileSystemError('INVALID_PATH', `Unsafe relative path: '${rawPath}'`)
      );
    }

    const relativePath = normalizeSafeRelativePath(rawPath);
    const size = typeof raw.size === 'number' && raw.size >= 0 ? raw.size : 0;
    const kind = raw.kind === 'folder' ? 'folder' : 'file';
    const mimeType = raw.mimeType || this.inferMimeType(sanitizedName);

    return {
      name: sanitizedName,
      kind,
      size,
      mimeType,
      modifiedAt: raw.modifiedAt ?? Date.now(),
      relativePath,
    };
  }

  /**
   * Converts a FileReference or DirectoryEntry into a protocol FileManifestEntry.
   */
  static toManifestEntry(item: FileReference | DirectoryEntry, fallbackId?: string): FileManifestEntry {
    const fileId = ('id' in item && item.id) ? item.id : (fallbackId ?? `f_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`);
    const sanitizedName = item.name.trim().replace(/[/\\]/g, '_');
    const relativePath = item.relativePath ? normalizeSafeRelativePath(item.relativePath) : sanitizedName;
    const size = typeof item.size === 'number' && item.size >= 0 ? item.size : 0;
    const fileType = item.kind === 'folder' ? 'folder' : (sanitizedName.split('.').pop() || 'bin').toLowerCase();
    const mimeType = ('mimeType' in item && item.mimeType) ? item.mimeType : this.inferMimeType(sanitizedName);

    return {
      fileId,
      name: sanitizedName,
      relativePath,
      size,
      mimeType,
      fileType,
      modifiedAt: item.modifiedAt ?? Date.now(),
    };
  }

  /**
   * Infers standard MIME types from file extensions.
   */
  static inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'json':
        return 'application/json';
      case 'txt':
      case 'log':
        return 'text/plain';
      case 'zip':
        return 'application/zip';
      case 'tar':
        return 'application/x-tar';
      case 'apk':
        return 'application/vnd.android.package-archive';
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return 'text/javascript';
      default:
        return 'application/octet-stream';
    }
  }
}
