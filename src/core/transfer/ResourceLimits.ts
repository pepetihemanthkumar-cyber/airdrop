/**
 * NearShare Transfer Pipeline Resource Limits
 *
 * Explicitly defines resource boundaries, concurrency caps, buffer quotas,
 * and manifest constraints to prevent unbounded memory allocation and CPU exhaustion.
 */

export interface ResourceLimits {
  /** Maximum number of transfers actively sending/receiving simultaneously (default: 1) */
  readonly maxConcurrentTransfers: number;

  /** Maximum number of transfers held in the queue before rejecting new submissions (default: 100) */
  readonly maxQueuedTransfers: number;

  /** Maximum number of unacknowledged in-flight chunks permitted before backpressure stalls reading (default: 16) */
  readonly maxInFlightChunks: number;

  /** Maximum aggregate memory allocated to in-flight chunk buffers (default: 64 MiB) */
  readonly maxChunkBufferBytes: number;

  /** Maximum number of distinct file entries allowed in a single multi-file manifest (default: 25,000) */
  readonly maxManifestFiles: number;

  /** Maximum serialized byte size of a transfer protocol manifest (default: 10 MiB) */
  readonly maxManifestBytes: number;

  /** Maximum nested directory depth for folder structures (default: 32) */
  readonly maxPathDepth: number;

  /** Maximum allowed single path component / filename character length (default: 255) */
  readonly maxFilenameLength: number;

  /** Maximum logical aggregate byte size for a single transfer (default: 10 TiB) */
  readonly maxFolderTransferBytes: number;

  /** Maximum high-resolution telemetry snapshots retained per transfer session (default: 60) */
  readonly maxTelemetrySamples: number;

  /** Maximum sequential retry attempts for a transient chunk/socket failure before marking transfer failed (default: 5) */
  readonly maxRetryAttempts: number;
}

/**
 * Production-hardened default resource limits.
 * Calibrated for smooth operation across resource-constrained desktop and mobile environments.
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxConcurrentTransfers: 1,
  maxQueuedTransfers: 100,
  maxInFlightChunks: 16,
  maxChunkBufferBytes: 64 * 1024 * 1024, // 64 MiB
  maxManifestFiles: 25000,
  maxManifestBytes: 10 * 1024 * 1024, // 10 MiB
  maxPathDepth: 32,
  maxFilenameLength: 255,
  maxFolderTransferBytes: 10 * 1024 * 1024 * 1024 * 1024, // 10 TiB logical
  maxTelemetrySamples: 60,
  maxRetryAttempts: 5,
};

/**
 * Validates whether a file path respects maximum depth and filename length constraints.
 */
export function validatePathConstraints(
  relativePath: string,
  limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS
): { valid: boolean; reason?: string } {
  if (!relativePath || relativePath.trim().length === 0) {
    return { valid: false, reason: 'Relative path cannot be empty' };
  }

  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((s) => s.length > 0);

  if (segments.length > limits.maxPathDepth) {
    return {
      valid: false,
      reason: `Path depth (${segments.length}) exceeds maximum limit (${limits.maxPathDepth})`,
    };
  }

  for (const segment of segments) {
    if (segment.length > limits.maxFilenameLength) {
      return {
        valid: false,
        reason: `Filename/segment length (${segment.length}) exceeds maximum limit (${limits.maxFilenameLength})`,
      };
    }
  }

  return { valid: true };
}
