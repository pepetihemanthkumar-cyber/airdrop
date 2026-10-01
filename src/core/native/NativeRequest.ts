/**
 * NearShare Native Request Model
 *
 * Defines the generic IPC envelope for invoking platform operations from React/Core.
 * Ensures payloads contain only opaque references or normalized descriptors.
 */

export interface NativeRequest<T = unknown> {
  requestId: string;
  operation: string;
  payload: T;
  timestamp: number;
}

export function createNativeRequest<T = unknown>(
  operation: string,
  payload: T,
  requestId?: string
): NativeRequest<T> {
  return {
    requestId: requestId ?? `nreq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
    operation,
    payload,
    timestamp: Date.now(),
  };
}
