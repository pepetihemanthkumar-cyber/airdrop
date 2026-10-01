/**
 * NearShare Low-Level Platform Bridge Contract
 *
 * Defines the generic low-level asynchronous message-passing interface between
 * the JavaScript runtime and any native desktop/mobile shell.
 */

import type { NativeRequest } from './NativeRequest';
import type { NativeResponse } from './NativeResponse';
import type { NativeBridgeEvent } from './types';

export type NativeBridgeEventListener<T = unknown> = (eventData: T) => void;

export interface PlatformBridge {
  readonly platformName: string;

  /**
   * Invokes an asynchronous native operation across the bridge.
   */
  invoke<TReq = unknown, TRes = unknown>(
    request: NativeRequest<TReq>
  ): Promise<NativeResponse<TRes>>;

  /**
   * Subscribes to native lifecycle, permission, or hardware events.
   * @returns Unsubscribe cleanup callback.
   */
  subscribe<T = unknown>(
    event: NativeBridgeEvent | string,
    callback: NativeBridgeEventListener<T>
  ): () => void;
}
