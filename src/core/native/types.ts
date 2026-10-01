/**
 * NearShare Native Bridge Types & Contracts
 *
 * Defines platform identifiers, permission models, picker contracts,
 * and event signatures for the native bridge boundary.
 */

export type NativePlatform = 'macos' | 'windows' | 'android' | 'ios' | 'web' | 'unknown';

export type PermissionState =
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'expired'
  | 'revoked'
  | 'unsupported';

export type PermissionKind =
  | 'fileAccess'
  | 'network'
  | 'bluetooth'
  | 'notifications'
  | 'background';

export interface PermissionRequest {
  permission: PermissionKind;
  purpose?: string;
}

export interface PermissionResult {
  permission: PermissionKind;
  state: PermissionState;
  granted: boolean;
  canPrompt: boolean;
  updatedAt: number;
}

export interface FilePickerOptions {
  multiple?: boolean;
  allowedExtensions?: string[];
  title?: string;
}

export interface FolderPickerOptions {
  title?: string;
  allowCreateNew?: boolean;
}

export interface PickerResult {
  cancelled: boolean;
  references: Array<{
    id: string;
    name: string;
    kind: 'file' | 'folder';
    size?: number;
    mimeType?: string;
    modifiedAt?: number;
    nativeReferenceId?: string;
  }>;
}

export type NativeBridgeEvent =
  | 'permissionChanged'
  | 'fileAccessChanged'
  | 'connectionChanged'
  | 'backgroundStateChanged';
