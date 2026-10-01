/**
 * NearShare Platform Strategy Model
 *
 * Defines the concrete strategy bindings for native OS integration.
 * Uses strategy identifiers for future native adapter resolution without hardcoding premature native implementations.
 */

import type { PlatformType } from './PlatformAdapter';

export interface PlatformTransferStrategy {
  platform: PlatformType;

  /**
   * Strategy identifier for ad-hoc peer-to-peer direct wireless transport.
   * e.g. "future-macos-awdl", "future-windows-wifidirect", "future-android-nearby"
   */
  directTransport: string;

  /**
   * Strategy identifier for local Wi-Fi subnet TCP/UDP socket transport.
   * e.g. "future-macos-local-network", "future-windows-local-network"
   */
  wifiTransport: string;

  /**
   * Strategy identifier for proximity/mDNS device discovery.
   * e.g. "future-macos-discovery", "future-android-nsd"
   */
  discoveryStrategy: string;

  /**
   * Strategy identifier for identity verification & cryptographic pairing.
   * e.g. "future-macos-pairing", "future-android-pairing"
   */
  pairingStrategy: string;

  /**
   * Strategy identifier for OS filesystem access and security-scoped URLs.
   * e.g. "future-macos-security-scoped-bookmarks", "future-android-saf"
   */
  fileStrategy: string;

  /**
   * Strategy identifier for process execution persistence and background task assertions.
   * e.g. "future-macos-app-nap-assertion", "future-android-foreground-service"
   */
  backgroundStrategy: string;

  /**
   * Strategy identifier for platform permission requests and authorization gates.
   * e.g. "future-macos-tcc", "future-android-runtime-permissions"
   */
  permissionStrategy: string;
}
