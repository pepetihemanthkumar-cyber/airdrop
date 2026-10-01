/**
 * NearShare File Engine Manager
 *
 * Singleton registry that manages the active FileEngine instance and provides
 * a unified interface for the entire application.
 */

import type { FileEngine } from './FileEngine';
import { MockFileEngine } from './mock/MockFileEngine';
import { TransferFileManager } from './TransferFileManager';

export class FileEngineManager {
  private static instance: FileEngineManager | null = null;
  private engine: FileEngine;
  private transferFileManager: TransferFileManager;

  private constructor(customEngine?: FileEngine) {
    this.engine = customEngine ?? new MockFileEngine();
    this.transferFileManager = new TransferFileManager(this.engine);
  }

  public static getInstance(customEngine?: FileEngine): FileEngineManager {
    if (!FileEngineManager.instance) {
      FileEngineManager.instance = new FileEngineManager(customEngine);
    }
    return FileEngineManager.instance;
  }

  /**
   * Replaces the active FileEngine implementation (e.g. for future native platform adapter).
   */
  public setEngine(engine: FileEngine): void {
    this.engine = engine;
    this.transferFileManager = new TransferFileManager(engine);
  }

  public getEngine(): FileEngine {
    return this.engine;
  }

  public getTransferFileManager(): TransferFileManager {
    return this.transferFileManager;
  }

  /**
   * Resets the singleton instance (useful for testing or full application resets).
   */
  public static resetInstance(): void {
    FileEngineManager.instance = null;
  }
}
