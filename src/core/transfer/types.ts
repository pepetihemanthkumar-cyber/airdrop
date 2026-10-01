/**
 * NearShare Transfer Payload Contract
 *
 * Defines the canonical transfer file item and payload boundaries.
 *
 * IMPORTANT: File paths are strictly optional and meant for future native adapters.
 * UI components must never depend on or expose local filesystem paths directly.
 */

import type { TransportMode, TransportDevice } from '../transport/types';

export interface TransferFile {
  id: string;
  name: string;
  path?: string;
  size: number;
  type: string;
  mimeType?: string;
  relativePath?: string;
}

export interface TransferPayload {
  transferId: string;
  files: TransferFile[];
  totalBytes: number;
  direction: 'send' | 'receive';
  sourceDevice: Partial<TransportDevice> & { id: string; deviceName?: string; name?: string };
  destinationDevice: Partial<TransportDevice> & { id: string; deviceName?: string; name?: string };
  mode: TransportMode;
}
