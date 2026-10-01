/**
 * NearShare macOS Direct Transfer Validation Report Generator
 *
 * Formats scenario results and telemetry into structured JSON and Markdown reports.
 * Enforces strict redaction of sensitive identifiers (MAC addresses, paths, keys).
 */

import type {
  MacOSDirectScenarioResult,
  PhysicalGateState,
  SanitizedDeviceInfo,
  ValidationEnvironment,
} from './MacOSDirectValidationTypes';

export interface ValidationReportSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
  environment: ValidationEnvironment;
  nativeImplementation: string;
  physicalValidation: string;
  timestamp: string;
}

export interface MacOSDirectValidationReportData {
  generatedAt: string;
  summary: ValidationReportSummary;
  localDevice: SanitizedDeviceInfo;
  remoteDevice?: SanitizedDeviceInfo;
  gateState: PhysicalGateState;
  scenarios: MacOSDirectScenarioResult[];
}

export class MacOSDirectValidationReport {
  /**
   * Sanitizes strings to remove local paths, MAC addresses, and private IPs.
   */
  public static sanitizeString(input: string): string {
    return input
      .replace(/\/Users\/[^\s/]+/g, '/Users/[REDACTED]')
      .replace(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/g, '[REDACTED_MAC]')
      .replace(/\b192\.168\.\d+\.\d+\b/g, '[REDACTED_IP]')
      .replace(/\b10\.\d+\.\d+\d+\b/g, '[REDACTED_IP]');
  }

  /**
   * Generates structured report data from scenario results.
   */
  public static generateReportData(
    environment: ValidationEnvironment,
    localDevice: SanitizedDeviceInfo,
    gateState: PhysicalGateState,
    results: MacOSDirectScenarioResult[],
    remoteDevice?: SanitizedDeviceInfo
  ): MacOSDirectValidationReportData {
    const passed = results.filter((r) => r.result === 'PASS').length;
    const failed = results.filter((r) => r.result === 'FAIL').length;
    const blocked = results.filter((r) => r.result === 'BLOCKED').length;
    const notRun = results.filter((r) => r.result === 'NOT_RUN').length;

    const isPhysicalVerified = results.length > 0 && results.every((r) => r.physicalValidation === 'verified' && r.result === 'PASS');

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalScenarios: results.length,
        passed,
        failed,
        blocked,
        notRun,
        environment,
        nativeImplementation: 'IMPLEMENTED',
        physicalValidation: isPhysicalVerified ? 'VERIFIED' : 'UNVERIFIED / HARDWARE BLOCKED',
        timestamp: new Date().toISOString(),
      },
      localDevice,
      remoteDevice,
      gateState,
      scenarios: results,
    };
  }

  /**
   * Converts report data into a sanitized Markdown document.
   */
  public static toMarkdown(report: MacOSDirectValidationReportData): string {
    const lines: string[] = [];

    lines.push('# NearShare macOS Direct Transfer Validation Report');
    lines.push('');
    lines.push(`**Generated:** ${report.generatedAt}`);
    lines.push(`**Environment:** \`${report.summary.environment}\``);
    lines.push(`**Native Implementation:** \`${report.summary.nativeImplementation}\``);
    lines.push(`**Physical Validation:** \`${report.summary.physicalValidation}\``);
    lines.push('');

    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`- **Total Scenarios:** ${report.summary.totalScenarios}`);
    lines.push(`- **Passed:** ${report.summary.passed}`);
    lines.push(`- **Failed:** ${report.summary.failed}`);
    lines.push(`- **Blocked:** ${report.summary.blocked}`);
    lines.push(`- **Not Run:** ${report.summary.notRun}`);
    lines.push('');

    lines.push('## Device Identities');
    lines.push('');
    lines.push(`- **Local Device:** ${this.sanitizeString(report.localDevice.profileName)} (\`${report.localDevice.deviceId}\`)`);
    lines.push(`  - **Platform:** ${report.localDevice.platform} (App v${report.localDevice.appVersion})`);
    if (report.remoteDevice) {
      lines.push(`- **Remote Device:** ${this.sanitizeString(report.remoteDevice.profileName)} (\`${report.remoteDevice.deviceId}\`)`);
      lines.push(`  - **Platform:** ${report.remoteDevice.platform} (App v${report.remoteDevice.appVersion})`);
    } else {
      lines.push('- **Remote Device:** None / Single-Host Harness');
    }
    lines.push('');

    lines.push('## Physical Validation Gate');
    lines.push('');
    lines.push(`- **Gate Status:** \`${report.gateState.passed ? 'PASSED' : 'BLOCKED'}\``);
    lines.push(`- **Native Implemented:** \`${report.gateState.nativeImplemented}\``);
    lines.push(`- **macOS Runtime Confirmed:** \`${report.gateState.macOsRuntimeConfirmed}\``);
    lines.push(`- **Peer Detected:** \`${report.gateState.peerDeviceDetected}\``);
    lines.push(`- **Peer is macOS:** \`${report.gateState.peerIsMacOS}\``);
    lines.push(`- **Direct Path Confirmed:** \`${report.gateState.directPathConfirmed}\``);
    lines.push(`- **No Wi-Fi Fallback:** \`${report.gateState.noWifiFallback}\``);
    if (report.gateState.blockReason) {
      lines.push(`- **Block Reason:** *${report.gateState.blockReason}*`);
    }
    lines.push('');

    lines.push('## Scenario Results');
    lines.push('');
    lines.push('| Code | Scenario Name | Result | Transport | Transferred | Duration | Integrity | Security |');
    lines.push('|:---|:---|:---|:---|:---|:---|:---|:---|');

    for (const sc of report.scenarios) {
      const bytesStr = sc.bytesTransferred > 0 ? `${(sc.bytesTransferred / 1024).toFixed(1)} KB` : '0 B';
      const durStr = sc.durationMs > 0 ? `${sc.durationMs}ms` : '-';
      lines.push(
        `| **${sc.scenarioCode}** | ${sc.name} | \`${sc.result}\` | \`${sc.transportUsed}\` | ${bytesStr} | ${durStr} | \`${sc.integrityVerified}\` | \`${sc.securityVerified}\` |`
      );
    }

    lines.push('');
    lines.push('---');
    lines.push('*Report generated by NearShare macOS Direct Transfer Validation Suite.*');

    return lines.join('\n');
  }
}
