/**
 * NearShare Transfer Manifest Hardener
 *
 * Enforces deterministic ordering, relative path safety, duplicate name disambiguation,
 * empty file handling, and resource quota limits for multi-file folder manifests.
 */

import { isSafeRelativePath, normalizeSafeRelativePath } from '../filesystem/PathSafety';
import { type ResourceLimits, DEFAULT_RESOURCE_LIMITS, validatePathConstraints } from './ResourceLimits';

export interface HardenedManifestItem {
  readonly fileId: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly mimeType?: string;
  readonly isZeroByte: boolean;
  readonly orderIndex: number;
}

export interface HardenedManifestResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly totalFiles: number;
  readonly totalBytes: number;
  readonly zeroByteFilesCount: number;
  readonly items: HardenedManifestItem[];
}

export interface RawManifestInputItem {
  fileId: string;
  relativePath: string;
  sizeBytes: number;
  mimeType?: string;
}

export class TransferManifestHardener {
  /**
   * Sanitizes, validates, deduplicates, and deterministically sorts a collection of files into a hardened manifest.
   */
  public static harden(
    items: RawManifestInputItem[],
    limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
  ): HardenedManifestResult {
    const errors: string[] = [];

    if (!items || items.length === 0) {
      return {
        valid: false,
        errors: ['Manifest contains zero files'],
        totalFiles: 0,
        totalBytes: 0,
        zeroByteFilesCount: 0,
        items: [],
      };
    }

    if (items.length > limits.maxManifestFiles) {
      errors.push(
        `Manifest file count (${items.length}) exceeds maximum limit (${limits.maxManifestFiles})`
      );
    }

    let totalBytes = 0;
    let zeroByteFilesCount = 0;
    const seenRelativePaths = new Set<string>();
    const seenFileIds = new Set<string>();
    const processedItems: HardenedManifestItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Validate fileId
      if (!item.fileId || typeof item.fileId !== 'string' || item.fileId.trim().length === 0) {
        errors.push(`File at index ${i} has an invalid or missing fileId`);
        continue;
      }
      if (seenFileIds.has(item.fileId)) {
        errors.push(`Duplicate fileId detected: '${item.fileId}'`);
      }
      seenFileIds.add(item.fileId);

      // Validate relative path safety
      if (!item.relativePath || !isSafeRelativePath(item.relativePath)) {
        errors.push(`Path traversal or unsafe absolute path detected for file '${item.fileId}': '${item.relativePath}'`);
        continue;
      }

      const normalizedPath = normalizeSafeRelativePath(item.relativePath);

      // Validate path depth and filename length constraints
      const constraintCheck = validatePathConstraints(normalizedPath, limits);
      if (!constraintCheck.valid) {
        errors.push(`Path constraint violation for '${normalizedPath}': ${constraintCheck.reason}`);
        continue;
      }

      // Check duplicate relative paths
      if (seenRelativePaths.has(normalizedPath)) {
        errors.push(`Duplicate relative path in manifest: '${normalizedPath}'`);
      }
      seenRelativePaths.add(normalizedPath);

      // Validate sizeBytes
      const size = Math.max(0, item.sizeBytes ?? 0);
      if (size === 0) {
        zeroByteFilesCount += 1;
      }
      totalBytes += size;

      processedItems.push({
        fileId: item.fileId,
        relativePath: normalizedPath,
        sizeBytes: size,
        mimeType: item.mimeType,
        isZeroByte: size === 0,
        orderIndex: i,
      });
    }

    if (totalBytes > limits.maxFolderTransferBytes) {
      errors.push(
        `Aggregate manifest byte size (${totalBytes} B) exceeds maximum limit (${limits.maxFolderTransferBytes} B)`
      );
    }

    // Sort deterministically by relativePath (case-sensitive Unicode collation)
    processedItems.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    // Re-index sorted manifest
    const sortedHardenedItems: HardenedManifestItem[] = processedItems.map((item, idx) => ({
      ...item,
      orderIndex: idx,
    }));

    return {
      valid: errors.length === 0,
      errors,
      totalFiles: sortedHardenedItems.length,
      totalBytes,
      zeroByteFilesCount,
      items: sortedHardenedItems,
    };
  }
}
