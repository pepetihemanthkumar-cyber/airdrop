/**
 * NearShare Path Safety Utilities
 *
 * Enforces strict transfer-relative path security to prevent directory traversal,
 * absolute path exposure, UNC/drive injection, and malicious path payloads.
 *
 * NOTE: These utilities govern transfer protocol path validation, NOT host OS filesystem paths.
 */

import { FileSystemException, createFileSystemError } from './errors';

const TRAVERSAL_PATTERN = /(\.\.[/\\]|[/\\]\.\.)/;
const DRIVE_LETTER_PATTERN = /^[a-zA-Z]:/;
const UNC_PATTERN = /^[/\\]{2}/;
const ABSOLUTE_PATTERN = /^[/\\]/;
const NULL_BYTE_PATTERN = /\0/;
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/**
 * Checks if a relative path string is strictly safe and free from traversal attacks.
 */
export function isSafeRelativePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;

  const trimmed = path.trim();
  if (trimmed.length === 0) return false;

  // 1. Null-byte injection check
  if (NULL_BYTE_PATTERN.test(trimmed)) return false;

  // 2. Traversal check (../ or ..\ or ..)
  if (trimmed === '..' || trimmed.startsWith('../') || trimmed.startsWith('..\\')) return false;
  if (TRAVERSAL_PATTERN.test(trimmed)) return false;

  // 3. Absolute path check
  if (ABSOLUTE_PATTERN.test(trimmed)) return false;

  // 4. Drive letter (e.g. C:) check
  if (DRIVE_LETTER_PATTERN.test(trimmed)) return false;

  // 5. UNC network share check (\\server\share)
  if (UNC_PATTERN.test(trimmed)) return false;

  // 6. URL / URI scheme check (file://, http://, etc.)
  if (URL_SCHEME_PATTERN.test(trimmed)) return false;

  // 7. Segment-level normalization check
  const segments = trimmed.replace(/\\/g, '/').split('/');
  for (const segment of segments) {
    if (segment === '..') return false;
    // Allow empty trailing segment for folders (e.g. "Project/src/")
  }

  return true;
}

/**
 * Normalizes a safe relative path string into forward-slash canonical form.
 * Throws FileSystemException if the path is unsafe.
 */
export function normalizeSafeRelativePath(path: string): string {
  if (!isSafeRelativePath(path)) {
    throw new FileSystemException(
      createFileSystemError('INVALID_PATH', `Unsafe or invalid relative path rejected: '${path}'`, {
        details: { path },
      })
    );
  }

  // Replace backslashes with forward slashes and collapse duplicate slashes
  const normalized = path
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');

  // Strip leading slash if any slipped through
  return normalized.replace(/^\//, '');
}

/**
 * Asserts that a relative path is valid and safe.
 */
export function assertSafePath(path: string): void {
  if (!isSafeRelativePath(path)) {
    throw new FileSystemException(
      createFileSystemError('INVALID_PATH', `Path validation failed for '${path}'`, {
        details: { path },
      })
    );
  }
}
