/**
 * NearShare Native File Reference Abstraction
 *
 * Defines the opaque native handle representation.
 *
 * CRITICAL BOUNDARY RULE:
 * Native paths and platform security descriptors are encapsulated strictly within
 * the platform adapter. Protocol messages only see opaque identifiers and transfer-relative paths.
 */

export type NativePlatformKind = 'macos' | 'windows' | 'android' | 'ios' | 'web' | 'unknown';

export interface NativeFileReference {
  id: string;
  platform: NativePlatformKind;
  kind: 'file' | 'folder';
  displayName: string;
  size?: number;
  mimeType?: string;
  modifiedAt?: number;
  // Opaque adapter-internal token (e.g. security-scoped bookmark or SAF URI)
  opaqueHandle?: string;
}

/**
 * Creates an opaque NativeFileReference descriptor.
 */
export function createNativeFileReference(
  id: string,
  displayName: string,
  kind: 'file' | 'folder',
  platform: NativePlatformKind = 'unknown',
  options?: {
    size?: number;
    mimeType?: string;
    modifiedAt?: number;
    opaqueHandle?: string;
  }
): NativeFileReference {
  return {
    id,
    platform,
    kind,
    displayName,
    size: options?.size,
    mimeType: options?.mimeType,
    modifiedAt: options?.modifiedAt,
    opaqueHandle: options?.opaqueHandle,
  };
}
