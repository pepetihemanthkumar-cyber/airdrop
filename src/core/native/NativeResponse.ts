/**
 * NearShare Native Response Model
 *
 * Defines the generic, serializable response envelope returned from the native shell.
 */

import type { NativeError } from './NativeError';

export interface NativeResponse<T = unknown> {
  requestId: string;
  success: boolean;
  payload?: T;
  error?: NativeError;
}

export function createSuccessResponse<T>(requestId: string, payload: T): NativeResponse<T> {
  return {
    requestId,
    success: true,
    payload,
  };
}

export function createErrorResponse(requestId: string, error: NativeError): NativeResponse<never> {
  return {
    requestId,
    success: false,
    error,
  };
}
