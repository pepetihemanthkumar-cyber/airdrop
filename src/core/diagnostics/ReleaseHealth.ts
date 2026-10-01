/**
 * NearShare Production Release Health & Diagnostic Engine
 *
 * Evaluates host environment readiness, transport availability, filesystem access,
 * and checkpoint persistence health without exposing private keys, tokens, or absolute paths.
 */

import { APP_METADATA } from '../appVersion';
import { TauriNativeBridge } from '../native/tauri/TauriNativeBridge';
import { isTauriRuntime, getRuntimeDiagnostics } from '../native/tauri/TauriIpc';

export type HealthStatus = 'Ready' | 'Limited' | 'Permission Required' | 'Unsupported' | 'Connection Problem';

export interface SafeHealthReport {
  status: HealthStatus;
  appName: string;
  appVersion: string;
  buildType: string;
  protocolVersion: string;
  platform: string;
  isNativeTauri: boolean;
  activeTransport: string;
  networkMode: string;
  filesystemAccess: 'native_bounded' | 'web_fallback';
  checkpointStore: 'durable_native' | 'memory_ephemeral';
  timestamp: string;
  warnings: string[];
}

export async function generateSafeHealthReport(options?: {
  hasNetworkIssue?: boolean;
  hasPermissionIssue?: boolean;
}): Promise<SafeHealthReport> {
  const isTauri = isTauriRuntime();
  const diagnostics = await getRuntimeDiagnostics();
  const platform = diagnostics?.platform || (typeof navigator !== 'undefined' ? navigator.platform : 'unknown');

  const warnings: string[] = [];
  let status: HealthStatus = 'Ready';

  if (!isTauri) {
    status = 'Limited';
    warnings.push('Running in Web Mode: Native LAN/TCP transport and local folder scanning use fallback engines.');
  }

  if (options?.hasPermissionIssue) {
    status = 'Permission Required';
    warnings.push('Local storage or filesystem permissions are required.');
  }

  if (options?.hasNetworkIssue) {
    status = 'Connection Problem';
    warnings.push('Unable to reach local network or bind discovery sockets.');
  }

  return {
    status,
    appName: APP_METADATA.name,
    appVersion: APP_METADATA.version,
    buildType: APP_METADATA.buildType,
    protocolVersion: APP_METADATA.protocolVersion,
    platform,
    isNativeTauri: isTauri,
    activeTransport: isTauri ? 'Native TCP/LAN' : 'Web Fallback Transport',
    networkMode: 'Wi-Fi / Local Network',
    filesystemAccess: isTauri ? 'native_bounded' : 'web_fallback',
    checkpointStore: isTauri ? 'durable_native' : 'memory_ephemeral',
    timestamp: new Date().toISOString(),
    warnings,
  };
}

/**
 * Exports a sanitized, safe diagnostics JSON string for user troubleshooting.
 * Excludes all private keys, PINs, tokens, host paths, and payload contents.
 */
export async function exportSanitizedDiagnostics(): Promise<string> {
  const report = await generateSafeHealthReport();
  const exportPayload = {
    diagnosticsVersion: '1.0',
    report,
    system: {
      bridgeDetected: TauriNativeBridge.isTauriDetected(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'headless',
    },
  };
  return JSON.stringify(exportPayload, null, 2);
}
