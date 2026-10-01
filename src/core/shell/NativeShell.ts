/**
 * NearShare Native Shell Interface Contract
 *
 * Defines the platform-neutral contract for host application lifecycle,
 * system notifications, clipboard integration, secure key storage,
 * and deep link registrations across desktop and mobile shells.
 */

import type {
  NativeShellPlatform,
  ShellLifecycle,
  ShellNotificationOptions,
} from './types';
import type { ShellCapabilities } from './ShellCapabilities';

export interface NativeShell {
  readonly platform: NativeShellPlatform;

  getPlatform(): NativeShellPlatform;
  getCapabilities(): ShellCapabilities;
  getLifecycleState(): ShellLifecycle;

  start(): Promise<void>;
  stop(): Promise<void>;
  enterBackground(): Promise<void>;
  enterForeground(): Promise<void>;

  openExternal(url: string): Promise<boolean>;
  showNotification(title: string, body: string, options?: ShellNotificationOptions): Promise<void>;
  registerFileAssociation(extension: string): Promise<boolean>;
  registerDeepLink(scheme: string): Promise<boolean>;

  getSecureStorage(key: string): Promise<string | null>;
  setSecureStorage(key: string, value: string): Promise<void>;

  getClipboard(): Promise<string>;
  setClipboard(text: string): Promise<void>;

  getShareSheet(files: unknown[]): Promise<boolean>;
}
