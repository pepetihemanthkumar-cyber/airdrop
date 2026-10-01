/**
 * NearShare Application Version & Release Metadata
 *
 * Central source of truth for the NearShare desktop and web application version.
 * Distinct from the underlying wire protocol version (1.0).
 */

export const APP_NAME = 'NearShare' as const;
export const APP_VERSION = '0.1.0' as const;
export const APP_BUILD_TYPE = (typeof import.meta !== 'undefined' && import.meta.env?.PROD) || (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'production')
  ? 'release'
  : 'development';

export const APP_METADATA = {
  name: APP_NAME,
  version: APP_VERSION,
  buildType: APP_BUILD_TYPE,
  protocolVersion: '1.0',
  tauriVersion: '2.12.0',
  license: 'Proprietary',
} as const;
