/**
 * NearShare Platform Adapter Registry
 *
 * Provides platform adapters for macOS, Windows, Android, iOS, and a Web development fallback.
 * Integrates platform capability resolution and candidate native strategies.
 *
 * IMPORTANT:
 * - The Web adapter is strictly a development fallback preview.
 * - The browser is never represented as a native platform.
 */

import type {
  PlatformAdapter,
  PlatformType,
  PlatformCapabilities,
  PlatformStorageInfo,
  PlatformFileDescriptor,
} from './PlatformAdapter';
import type { PlatformCapability } from './capabilities';
import type { PlatformTransferStrategy } from './PlatformStrategy';
import {
  MACOS_CAPABILITIES,
  MACOS_STRATEGY,
  WINDOWS_CAPABILITIES,
  WINDOWS_STRATEGY,
  ANDROID_CAPABILITIES,
  ANDROID_STRATEGY,
  IOS_CAPABILITIES,
  IOS_STRATEGY,
  WEB_CAPABILITIES,
  WEB_STRATEGY,
} from './platformCapabilities';

export class MockMacOSAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'macOS';

  getPlatform(): PlatformType {
    return 'macOS';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fileAccess: true,
      notifications: true,
      backgroundTransfer: true,
      localNetwork: true,
      nearbyDevices: true,
      storageAccess: true,
    };
  }

  getPlatformCapabilities(): PlatformCapability {
    return MACOS_CAPABILITIES;
  }

  getStrategy(): PlatformTransferStrategy {
    return MACOS_STRATEGY;
  }

  canPickFiles(): boolean {
    return true;
  }

  canPickFolders(): boolean {
    return true;
  }

  canOpenFiles(): boolean {
    return true;
  }

  canRevealInFolder(): boolean {
    return true;
  }

  async requestPermission(_permission: string): Promise<boolean> {
    return true;
  }

  async getStorageInfo(): Promise<PlatformStorageInfo> {
    return {
      availableBytes: 142 * 1024 * 1024 * 1024,
      totalBytes: 512 * 1024 * 1024 * 1024,
      availableFormatted: '142 GB',
      totalFormatted: '512 GB',
    };
  }

  async getDownloadLocation(): Promise<string> {
    return 'Downloads';
  }

  async showFilePicker(): Promise<PlatformFileDescriptor[]> {
    return [
      {
        id: `f-${Date.now()}`,
        name: 'Design_System_Spec.pdf',
        size: 14.8 * 1024 * 1024,
        type: 'document',
      },
    ];
  }

  async showFolderPicker(): Promise<PlatformFileDescriptor | null> {
    return {
      id: `fld-${Date.now()}`,
      name: 'Project_Assets_Folder',
      size: 1.2 * 1024 * 1024 * 1024,
      type: 'folder',
    };
  }

  async openFile(_fileIdentifier: string): Promise<boolean> {
    return true;
  }

  async revealInFolder(_fileIdentifier: string): Promise<boolean> {
    return true;
  }
}

export class MockWindowsAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'Windows';

  getPlatform(): PlatformType {
    return 'Windows';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fileAccess: true,
      notifications: true,
      backgroundTransfer: true,
      localNetwork: true,
      nearbyDevices: true,
      storageAccess: true,
    };
  }

  getPlatformCapabilities(): PlatformCapability {
    return WINDOWS_CAPABILITIES;
  }

  getStrategy(): PlatformTransferStrategy {
    return WINDOWS_STRATEGY;
  }

  canPickFiles(): boolean {
    return true;
  }

  canPickFolders(): boolean {
    return true;
  }

  canOpenFiles(): boolean {
    return true;
  }

  canRevealInFolder(): boolean {
    return true;
  }

  async requestPermission(_permission: string): Promise<boolean> {
    return true;
  }

  async getStorageInfo(): Promise<PlatformStorageInfo> {
    return {
      availableBytes: 250 * 1024 * 1024 * 1024,
      totalBytes: 1024 * 1024 * 1024 * 1024,
      availableFormatted: '250 GB',
      totalFormatted: '1 TB',
    };
  }

  async getDownloadLocation(): Promise<string> {
    return 'Downloads';
  }

  async showFilePicker(): Promise<PlatformFileDescriptor[]> {
    return [
      {
        id: `f-${Date.now()}`,
        name: 'Studio_Build.zip',
        size: 420 * 1024 * 1024,
        type: 'archive',
      },
    ];
  }

  async showFolderPicker(): Promise<PlatformFileDescriptor | null> {
    return {
      id: `fld-${Date.now()}`,
      name: 'Exports',
      size: 512 * 1024 * 1024,
      type: 'folder',
    };
  }

  async openFile(_fileIdentifier: string): Promise<boolean> {
    return true;
  }

  async revealInFolder(_fileIdentifier: string): Promise<boolean> {
    return true;
  }
}

export class MockAndroidAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'Android';

  getPlatform(): PlatformType {
    return 'Android';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fileAccess: true,
      notifications: true,
      backgroundTransfer: true,
      localNetwork: true,
      nearbyDevices: true,
      storageAccess: true,
    };
  }

  getPlatformCapabilities(): PlatformCapability {
    return ANDROID_CAPABILITIES;
  }

  getStrategy(): PlatformTransferStrategy {
    return ANDROID_STRATEGY;
  }

  canPickFiles(): boolean {
    return true;
  }

  canPickFolders(): boolean {
    return true;
  }

  canOpenFiles(): boolean {
    return true;
  }

  canRevealInFolder(): boolean {
    return false;
  }

  async requestPermission(_permission: string): Promise<boolean> {
    return true;
  }

  async getStorageInfo(): Promise<PlatformStorageInfo> {
    return {
      availableBytes: 64 * 1024 * 1024 * 1024,
      totalBytes: 256 * 1024 * 1024 * 1024,
      availableFormatted: '64 GB',
      totalFormatted: '256 GB',
    };
  }

  async getDownloadLocation(): Promise<string> {
    return 'Download/NearShare';
  }

  async showFilePicker(): Promise<PlatformFileDescriptor[]> {
    return [
      {
        id: `f-${Date.now()}`,
        name: 'Camera_DCIM_001.jpg',
        size: 4.8 * 1024 * 1024,
        type: 'image',
      },
    ];
  }

  async showFolderPicker(): Promise<PlatformFileDescriptor | null> {
    return null;
  }

  async openFile(_fileIdentifier: string): Promise<boolean> {
    return true;
  }

  async revealInFolder(_fileIdentifier: string): Promise<boolean> {
    return false;
  }
}

export class MockIOSAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'iOS';

  getPlatform(): PlatformType {
    return 'iOS';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fileAccess: true,
      notifications: true,
      backgroundTransfer: false, // iOS sandbox background restrictions
      localNetwork: true,
      nearbyDevices: true,
      storageAccess: true,
    };
  }

  getPlatformCapabilities(): PlatformCapability {
    return IOS_CAPABILITIES;
  }

  getStrategy(): PlatformTransferStrategy {
    return IOS_STRATEGY;
  }

  canPickFiles(): boolean {
    return true;
  }

  canPickFolders(): boolean {
    return false;
  }

  canOpenFiles(): boolean {
    return true;
  }

  canRevealInFolder(): boolean {
    return false;
  }

  async requestPermission(_permission: string): Promise<boolean> {
    return true;
  }

  async getStorageInfo(): Promise<PlatformStorageInfo> {
    return {
      availableBytes: 45 * 1024 * 1024 * 1024,
      totalBytes: 128 * 1024 * 1024 * 1024,
      availableFormatted: '45 GB',
      totalFormatted: '128 GB',
    };
  }

  async getDownloadLocation(): Promise<string> {
    return 'Files/NearShare';
  }

  async showFilePicker(): Promise<PlatformFileDescriptor[]> {
    return [
      {
        id: `f-${Date.now()}`,
        name: 'Recorded_Audio.m4a',
        size: 12.4 * 1024 * 1024,
        type: 'audio',
      },
    ];
  }

  async showFolderPicker(): Promise<PlatformFileDescriptor | null> {
    return null;
  }

  async openFile(_fileIdentifier: string): Promise<boolean> {
    return true;
  }

  async revealInFolder(_fileIdentifier: string): Promise<boolean> {
    return false;
  }
}

export class MockWebAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'Web';

  getPlatform(): PlatformType {
    return 'Web';
  }

  getCapabilities(): PlatformCapabilities {
    return {
      fileAccess: true,
      notifications: false,
      backgroundTransfer: false,
      localNetwork: false,
      nearbyDevices: false,
      storageAccess: true,
    };
  }

  getPlatformCapabilities(): PlatformCapability {
    return WEB_CAPABILITIES;
  }

  getStrategy(): PlatformTransferStrategy {
    return WEB_STRATEGY;
  }

  canPickFiles(): boolean {
    return true;
  }

  canPickFolders(): boolean {
    return false;
  }

  canOpenFiles(): boolean {
    return false;
  }

  canRevealInFolder(): boolean {
    return false;
  }

  async requestPermission(_permission: string): Promise<boolean> {
    return true;
  }

  async getStorageInfo(): Promise<PlatformStorageInfo> {
    return {
      availableBytes: 120 * 1024 * 1024 * 1024,
      totalBytes: 500 * 1024 * 1024 * 1024,
      availableFormatted: '120 GB',
      totalFormatted: '500 GB',
    };
  }

  async getDownloadLocation(): Promise<string> {
    return 'Downloads';
  }

  async showFilePicker(): Promise<PlatformFileDescriptor[]> {
    return [
      {
        id: `f-${Date.now()}`,
        name: 'Payload_Archive.zip',
        size: 84 * 1024 * 1024,
        type: 'archive',
      },
    ];
  }

  async showFolderPicker(): Promise<PlatformFileDescriptor | null> {
    return null;
  }

  async openFile(_fileIdentifier: string): Promise<boolean> {
    return false;
  }

  async revealInFolder(_fileIdentifier: string): Promise<boolean> {
    return false;
  }
}

export class PlatformRegistry {
  private static instance: PlatformRegistry;
  private currentAdapter: PlatformAdapter;

  private constructor() {
    // Detect environment or default to macOS simulation adapter
    this.currentAdapter = new MockMacOSAdapter();
  }

  public static getInstance(): PlatformRegistry {
    if (!PlatformRegistry.instance) {
      PlatformRegistry.instance = new PlatformRegistry();
    }
    return PlatformRegistry.instance;
  }

  public getAdapter(): PlatformAdapter {
    return this.currentAdapter;
  }

  public setAdapter(adapter: PlatformAdapter): void {
    this.currentAdapter = adapter;
  }
}
