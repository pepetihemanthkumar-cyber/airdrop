/**
 * NearShare Mock Native Shell
 *
 * In-memory simulation of NativeShell lifecycle, notification dispatch,
 * clipboard access, and secure storage for testing and browser runtime.
 */

import type { NativeShell } from '../NativeShell';
import type {
  NativeShellPlatform,
  ShellLifecycle,
  ShellNotificationOptions,
} from '../types';
import { type ShellCapabilities, DEFAULT_MOCK_SHELL_CAPABILITIES } from '../ShellCapabilities';

export class MockNativeShell implements NativeShell {
  readonly platform: NativeShellPlatform = 'mock';
  private lifecycle: ShellLifecycle = 'ready';
  private capabilities: ShellCapabilities = { ...DEFAULT_MOCK_SHELL_CAPABILITIES };
  private secureStore = new Map<string, string>();
  private clipboardText = '';
  private notificationHistory: Array<{ title: string; body: string; timestamp: number }> = [];

  getPlatform(): NativeShellPlatform {
    return this.platform;
  }

  getCapabilities(): ShellCapabilities {
    return { ...this.capabilities };
  }

  getLifecycleState(): ShellLifecycle {
    return this.lifecycle;
  }

  async start(): Promise<void> {
    this.lifecycle = 'starting';
    // Simulate async startup
    this.lifecycle = 'ready';
  }

  async stop(): Promise<void> {
    this.lifecycle = 'stopping';
    this.lifecycle = 'stopped';
  }

  async enterBackground(): Promise<void> {
    this.lifecycle = 'background';
  }

  async enterForeground(): Promise<void> {
    this.lifecycle = 'foreground';
  }

  async openExternal(url: string): Promise<boolean> {
    if (!url || !url.startsWith('http')) return false;
    return true;
  }

  async showNotification(title: string, body: string, _options?: ShellNotificationOptions): Promise<void> {
    this.notificationHistory.push({
      title,
      body,
      timestamp: Date.now(),
    });
  }

  async registerFileAssociation(_extension: string): Promise<boolean> {
    return true;
  }

  async registerDeepLink(_scheme: string): Promise<boolean> {
    return true;
  }

  async getSecureStorage(key: string): Promise<string | null> {
    return this.secureStore.get(key) ?? null;
  }

  async setSecureStorage(key: string, value: string): Promise<void> {
    this.secureStore.set(key, value);
  }

  async getClipboard(): Promise<string> {
    return this.clipboardText;
  }

  async setClipboard(text: string): Promise<void> {
    this.clipboardText = text;
  }

  async getShareSheet(_files: unknown[]): Promise<boolean> {
    return true;
  }

  getNotificationHistory() {
    return [...this.notificationHistory];
  }
}
