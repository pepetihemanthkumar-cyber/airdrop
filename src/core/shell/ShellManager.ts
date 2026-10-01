/**
 * NearShare Native Shell Manager
 *
 * Singleton manager coordinating the active host application shell,
 * lifecycle state changes, background transitions, and system integration.
 */

import type { NativeShell } from './NativeShell';
import type { NativeShellPlatform, ShellLifecycle, ShellNotificationOptions } from './types';
import type { ShellCapabilities } from './ShellCapabilities';
import { ShellRegistry } from './ShellRegistry';
import { ShellFactory } from './ShellFactory';

export class ShellManager {
  private static instance: ShellManager | null = null;
  private shell: NativeShell;
  private platform: NativeShellPlatform;

  private constructor(customShell?: NativeShell) {
    this.platform = ShellFactory.detectPlatform();
    this.shell = customShell ?? ShellRegistry.getInstance().resolve(this.platform);
  }

  public static getInstance(customShell?: NativeShell): ShellManager {
    if (!ShellManager.instance) {
      ShellManager.instance = new ShellManager(customShell);
    }
    return ShellManager.instance;
  }

  public setShell(shell: NativeShell): void {
    this.shell = shell;
    this.platform = shell.getPlatform();
  }

  public getShell(): NativeShell {
    return this.shell;
  }

  public getPlatform(): NativeShellPlatform {
    return this.platform;
  }

  public getCapabilities(): ShellCapabilities {
    return this.shell.getCapabilities();
  }

  public getLifecycleState(): ShellLifecycle {
    return this.shell.getLifecycleState();
  }

  public async start(): Promise<void> {
    return this.shell.start();
  }

  public async stop(): Promise<void> {
    return this.shell.stop();
  }

  public async enterBackground(): Promise<void> {
    return this.shell.enterBackground();
  }

  public async enterForeground(): Promise<void> {
    return this.shell.enterForeground();
  }

  public async showNotification(title: string, body: string, options?: ShellNotificationOptions): Promise<void> {
    return this.shell.showNotification(title, body, options);
  }

  public async getClipboard(): Promise<string> {
    return this.shell.getClipboard();
  }

  public async setClipboard(text: string): Promise<void> {
    return this.shell.setClipboard(text);
  }

  public async openExternal(url: string): Promise<boolean> {
    return this.shell.openExternal(url);
  }

  public static resetInstance(): void {
    ShellManager.instance = null;
  }
}
