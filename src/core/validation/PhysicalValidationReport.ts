/**
 * NearShare Physical Multi-Device Validation Report Generator
 *
 * Generates structured, evidence-based reports from validation records.
 */

import { PhysicalValidationRunner } from './PhysicalValidationRunner';

export interface ReportSummary {
  generatedAt: string;
  totalPairs: number;
  totalScenarios: number;
  physicalEvidencesRecorded: number;
  devicePairStatuses: Array<{
    pairId: string;
    sender: string;
    receiver: string;
    wifiStatus: string;
    directStatus: string;
    scenariosPassed: number;
    scenariosBlocked: number;
  }>;
}

export class PhysicalValidationReportGenerator {
  public static generateSummary(runner: PhysicalValidationRunner = PhysicalValidationRunner.getInstance()): ReportSummary {
    const pairs = runner.getDevicePairs();
    const scenarios = runner.getScenarios();
    const allEvidence = runner.getAllEvidence();

    const devicePairStatuses = pairs.map((pair) => {
      const wifiEval = runner.evaluateDevicePair(pair.senderPlatform, pair.receiverPlatform, 'wifi');
      const directEval = runner.evaluateDevicePair(pair.senderPlatform, pair.receiverPlatform, 'direct');

      return {
        pairId: pair.id,
        sender: pair.senderPlatform,
        receiver: pair.receiverPlatform,
        wifiStatus: wifiEval.overallStatus,
        directStatus: directEval.overallStatus,
        scenariosPassed: wifiEval.passed + directEval.passed,
        scenariosBlocked: wifiEval.blocked + directEval.blocked,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totalPairs: pairs.length,
      totalScenarios: scenarios.length,
      physicalEvidencesRecorded: allEvidence.filter((e) => e.environment === 'PHYSICAL').length,
      devicePairStatuses,
    };
  }

  public static generateMarkdownTable(runner: PhysicalValidationRunner = PhysicalValidationRunner.getInstance()): string {
    const pairs = runner.getDevicePairs();
    const rows: string[] = [
      '| Pair | Mode | Test ID | Result | Environment | Evidence / Notes |',
      '|:---|:---|:---|:---|:---|:---|',
    ];

    const physicalEvidence = runner.getAllEvidence().filter((e) => e.environment === 'PHYSICAL');

    for (const pair of pairs) {
      const wifiEvs = physicalEvidence.filter(
        (e) => e.senderPlatform === pair.senderPlatform && e.receiverPlatform === pair.receiverPlatform && e.transportMode === 'wifi'
      );
      if (wifiEvs.length > 0) {
        for (const ev of wifiEvs) {
          rows.push(`| ${pair.senderPlatform} ↔ ${pair.receiverPlatform} | Wi-Fi/LAN | ${ev.testId} | ${ev.result} | PHYSICAL | ${ev.notes || ev.error || 'N/A'} |`);
        }
      } else {
        rows.push(`| ${pair.senderPlatform} ↔ ${pair.receiverPlatform} | Wi-Fi/LAN | PHYS-001..032 | BLOCKED | PHYSICAL | BLOCKED — SECOND PHYSICAL DEVICE REQUIRED |`);
      }

      const directEvs = physicalEvidence.filter(
        (e) => e.senderPlatform === pair.senderPlatform && e.receiverPlatform === pair.receiverPlatform && e.transportMode === 'direct'
      );
      if (directEvs.length > 0) {
        for (const ev of directEvs) {
          rows.push(`| ${pair.senderPlatform} ↔ ${pair.receiverPlatform} | Direct | ${ev.testId} | ${ev.result} | PHYSICAL | ${ev.notes || ev.error || 'N/A'} |`);
        }
      } else {
        const directRes = pair.directStatus === 'NOT_SUPPORTED' ? 'NOT_AVAILABLE' : 'BLOCKED';
        const directNote = pair.directStatus === 'NOT_SUPPORTED' ? 'NOT_SUPPORTED across radio technologies' : 'BLOCKED — PHYSICAL RADIO HARDWARE REQUIRED';
        rows.push(`| ${pair.senderPlatform} ↔ ${pair.receiverPlatform} | Direct | PHYS-001..032 | ${directRes} | PHYSICAL | ${directNote} |`);
      }
    }

    return rows.join('\n');
  }
}
