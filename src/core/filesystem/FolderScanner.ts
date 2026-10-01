/**
 * NearShare Folder Scanner
 *
 * Recursively enumerates folders via the platform-neutral FileSystemAdapter,
 * validates path security, preserves folder hierarchy, and produces canonical
 * relative paths for transfer manifests without exposing host absolute paths.
 */

import type { FileReference, DirectoryEntry } from './types';
import type { FileSystemAdapter } from './FileSystemAdapter';
import { normalizeSafeRelativePath, isSafeRelativePath } from './PathSafety';
import { FileSystemException, createFileSystemError } from './errors';

export class FolderScanner {
  private adapter: FileSystemAdapter;

  constructor(adapter: FileSystemAdapter) {
    this.adapter = adapter;
  }

  /**
   * Recursively scans a root folder reference and generates a flattened,
   * hierarchical list of DirectoryEntry items with relative paths.
   */
  async scanFolder(rootReference: FileReference): Promise<DirectoryEntry[]> {
    if (rootReference.kind !== 'folder') {
      throw new FileSystemException(
        createFileSystemError('DIRECTORY_SCAN_FAILED', `Reference '${rootReference.name}' is not a directory`)
      );
    }

    const results: DirectoryEntry[] = [];
    const seenPaths = new Set<string>();

    const basePrefix = rootReference.name.replace(/[/\\]/g, '_');
    if (!isSafeRelativePath(basePrefix)) {
      throw new FileSystemException(
        createFileSystemError('INVALID_PATH', `Unsafe root folder name: '${rootReference.name}'`)
      );
    }

    // Add root folder entry
    const rootRelativePath = `${normalizeSafeRelativePath(basePrefix)}/`;
    results.push({
      name: rootReference.name,
      kind: 'folder',
      size: 0,
      relativePath: rootRelativePath,
      modifiedAt: rootReference.modifiedAt,
      nativeReferenceId: rootReference.nativeReferenceId,
    });
    seenPaths.add(rootRelativePath);

    // Scan children from adapter
    const rawEntries = await this.adapter.scanDirectory(rootReference);

    for (const entry of rawEntries) {
      if (!isSafeRelativePath(entry.relativePath)) {
        // Skip or reject unsafe paths
        continue;
      }

      const normalized = normalizeSafeRelativePath(entry.relativePath);
      const fullRelativePath = normalized.startsWith(rootRelativePath)
        ? normalized
        : `${rootRelativePath}${normalized}`;

      if (!seenPaths.has(fullRelativePath)) {
        seenPaths.add(fullRelativePath);
        results.push({
          name: entry.name,
          kind: entry.kind,
          size: entry.size,
          relativePath: entry.kind === 'folder' && !fullRelativePath.endsWith('/')
            ? `${fullRelativePath}/`
            : fullRelativePath,
          modifiedAt: entry.modifiedAt,
          nativeReferenceId: entry.nativeReferenceId,
        });
      }
    }

    return results;
  }
}
