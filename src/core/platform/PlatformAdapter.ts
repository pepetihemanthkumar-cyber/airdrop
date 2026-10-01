/**
 * NearShare Native Platform Adapter Contract
 *
 * Defines the contract through which NearShare interacts with OS-level platform capabilities:
 * - Storage metrics and default download folders
 * - System permissions (local network, nearby devices, notifications, background access)
 * - Native system file and directory pickers
 * - System open and reveal in folder actions
 * - Platform capabilities & native transfer strategy resolution
 *
 * NOTE: UI and state layers must communicate through this contract rather than invoking browser
 * or proprietary OS APIs directly.
 */

import type { PlatformCapability } from './capabilities';
import type { PlatformTransferStrategy } from './PlatformStrategy';

export type PlatformType = 'macOS' | 'Windows' | 'Android' | 'iOS' | 'Web';

export interface PlatformCapabilities {
  fileAccess: boolean;
  notifications: boolean;
  backgroundTransfer: boolean;
  localNetwork: boolean;
  nearbyDevices: boolean;
  storageAccess: boolean;
}

export interface PlatformStorageInfo {
  availableBytes: number;
  totalBytes: number;
  availableFormatted: string;
  totalFormatted: string;
}

export interface PlatformFileDescriptor {
  id: string;
  name: string;
  size: number;
  type: string;
  path?: string;
  relativePath?: string;
}

export interface PlatformAdapter {
  readonly platform: PlatformType;

  /**
   * Returns current active OS platform name.
   */
  getPlatform(): PlatformType;

  /**
   * Returns permission and hardware capability flags for this platform.
   */
  getCapabilities(): PlatformCapabilities;

  /**
   * Returns the architectural platform capability matrix.
   */
  getPlatformCapabilities(): PlatformCapability;

  /**
   * Returns the platform transfer strategy.
   */
  getStrategy(): PlatformTransferStrategy;

  /**
   * Checks if single/multiple file picking is supported.
   */
  canPickFiles(): boolean;

  /**
   * Checks if directory/folder picking is supported.
   */
  canPickFolders(): boolean;

  /**
   * Checks if launching/opening files in external viewer is supported.
   */
  canOpenFiles(): boolean;

  /**
   * Checks if revealing file in OS file explorer is supported.
   */
  canRevealInFolder(): boolean;

  /**
   * Requests an OS-level permission (e.g. 'nearby_devices', 'local_network', 'notifications').
   */
  requestPermission(permission: string): Promise<boolean>;

  /**
   * Inspects available disk storage quota for incoming file downloads.
   */
  getStorageInfo(): Promise<PlatformStorageInfo>;

  /**
   * Returns default incoming download directory name or path.
   */
  getDownloadLocation(): Promise<string>;

  /**
   * Invokes native system file picker dialog.
   */
  showFilePicker(options?: { allowMultiple?: boolean; acceptedTypes?: string[] }): Promise<PlatformFileDescriptor[]>;

  /**
   * Invokes native system folder picker dialog.
   */
  showFolderPicker(): Promise<PlatformFileDescriptor | null>;

  /**
   * Dispatches abstract signal to launch or preview a transferred file.
   */
  openFile(fileIdentifier: string): Promise<boolean>;

  /**
   * Dispatches abstract signal to highlight the file in the OS file manager.
   */
  revealInFolder(fileIdentifier: string): Promise<boolean>;
}
