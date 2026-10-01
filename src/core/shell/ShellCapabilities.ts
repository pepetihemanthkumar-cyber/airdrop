/**
 * NearShare Native Shell Capabilities
 *
 * Defines granular capability indicators for host application shell features.
 * Capabilities honestly reflect the active shell implementation.
 */

export type ShellSupportLevel =
  | 'supported'
  | 'unsupported'
  | 'restricted'
  | 'notImplemented'
  | 'mockOnly';

export interface ShellCapabilities {
  filesystem: ShellSupportLevel;
  networking: ShellSupportLevel;
  backgroundTransfer: ShellSupportLevel;
  notifications: ShellSupportLevel;
  systemTray: ShellSupportLevel;
  deepLinks: ShellSupportLevel;
  autostart: ShellSupportLevel;
  secureStorage: ShellSupportLevel;
  clipboard: ShellSupportLevel;
  shareSheet: ShellSupportLevel;
  fileAssociation: ShellSupportLevel;
  localNetwork: ShellSupportLevel;
  bluetooth: ShellSupportLevel;
  directNearby: ShellSupportLevel;
  powerManagement: ShellSupportLevel;
}

export const DEFAULT_MOCK_SHELL_CAPABILITIES: ShellCapabilities = {
  filesystem: 'mockOnly',
  networking: 'mockOnly',
  backgroundTransfer: 'restricted',
  notifications: 'mockOnly',
  systemTray: 'mockOnly',
  deepLinks: 'mockOnly',
  autostart: 'mockOnly',
  secureStorage: 'mockOnly',
  clipboard: 'mockOnly',
  shareSheet: 'mockOnly',
  fileAssociation: 'mockOnly',
  localNetwork: 'mockOnly',
  bluetooth: 'notImplemented',
  directNearby: 'notImplemented',
  powerManagement: 'mockOnly',
};
