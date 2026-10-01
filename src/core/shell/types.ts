/**
 * NearShare Native Shell Types
 *
 * Defines platform identifiers, availability states, lifecycle phases,
 * and service descriptors for the desktop and mobile application shells.
 */

export type NativeShellPlatform =
  | 'macos'
  | 'windows'
  | 'android'
  | 'ios'
  | 'web'
  | 'mock'
  | 'unknown';

export type ShellAvailability =
  | 'available'
  | 'unavailable'
  | 'placeholder'
  | 'mockOnly';

export type ShellLifecycle =
  | 'starting'
  | 'ready'
  | 'background'
  | 'foreground'
  | 'suspending'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface ShellNotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface ShellClipboardResult {
  text: string;
  hasText: boolean;
  updatedAt: number;
}
