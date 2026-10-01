/**
 * NearShare Native Runtime Implementation Audit — Report Generator
 *
 * Generates formatted markdown tables and reports based on the audit database.
 */

import { NativeImplementationAudit } from './NativeImplementationAudit';

export class NativeImplementationAuditReportGenerator {
  public static generateMarkdownTable(): string {
    const entries = NativeImplementationAudit.getAllEntries();
    const rows: string[] = [
      '| Platform | Subsystem | Feature | Native Code Present | Production Path | Runtime Verified | Physical Verified | Status |',
      '|:---|:---|:---|:---|:---|:---|:---|:---|',
    ];

    for (const e of entries) {
      const nativeCode = e.nativeFiles.length > 0 ? e.nativeFiles.map((f) => `\`${f}\``).join(', ') : 'None (TS/Docs Only)';
      const runtimeVer = e.runtimeVerified ? 'Yes' : 'No';
      const physicalVer = e.physicalVerified ? 'Yes' : 'No (Pending HW)';

      rows.push(
        `| ${e.platform} | ${e.subsystem} | ${e.feature} | ${nativeCode} | ${e.productionPath} | ${runtimeVer} | ${physicalVer} | \`${e.status}\` |`
      );
    }

    return rows.join('\n');
  }

  public static generateSummaryReport(): string {
    const summary = NativeImplementationAudit.generateSummary();
    const table = NativeImplementationAuditReportGenerator.generateMarkdownTable();

    return `# NearShare Native Runtime Implementation Audit Report

> **Audited Version**: \`0.1.0\`  
> **Host Environment**: \`macOS Apple Silicon (Darwin arm64)\`  
> **Total Audited Subsystems**: \`${summary.totalEntries}\`

---

## 1. Implementation Status Breakdown

| Status Classification | Subsystems Count | Percentage |
|:---|:---|:---|
| **REAL_NATIVE_IMPLEMENTATION** | ${summary.realNativeCount} | ${((summary.realNativeCount / summary.totalEntries) * 100).toFixed(1)}% |
| **UNVERIFIED_RUNTIME** | ${summary.unverifiedRuntimeCount} | ${((summary.unverifiedRuntimeCount / summary.totalEntries) * 100).toFixed(1)}% |
| **SCAFFOLD** | ${summary.scaffoldCount} | ${((summary.scaffoldCount / summary.totalEntries) * 100).toFixed(1)}% |
| **ARCHITECTURAL_ONLY** | ${summary.architecturalCount} | ${((summary.architecturalCount / summary.totalEntries) * 100).toFixed(1)}% |
| **PARTIAL_IMPLEMENTATION** | ${summary.partialCount} | ${((summary.partialCount / summary.totalEntries) * 100).toFixed(1)}% |
| **MOCK_ONLY** | ${summary.mockOnlyCount} | ${((summary.mockOnlyCount / summary.totalEntries) * 100).toFixed(1)}% |
| **NOT_IMPLEMENTED** | ${summary.notImplementedCount} | ${((summary.notImplementedCount / summary.totalEntries) * 100).toFixed(1)}% |

---

## 2. Comprehensive Subsystem Audit Table

${table}
`;
  }
}
