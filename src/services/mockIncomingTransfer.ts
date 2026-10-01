// Mock Incoming Transfer Service for NearShare
// Generates realistic mock incoming transfer requests from nearby devices (Trusted & Unknown)
// NOTE: Frontend simulation only. No real networking, WebSockets, or native device APIs.

import type { TransferMode } from '../components/FloatingNavPill';
import type { TransferFile } from '../context/TransferQueueContext';
import { formatBytes } from './mockTransferEngine';

export interface IncomingSenderProfile {
  id: string;
  name: string;
  username: string;
  avatarInitial: string;
  avatarBg?: string;
  deviceName: string;
  platform: 'macOS' | 'Android' | 'iOS' | 'Windows';
  isTrusted: boolean;
  distanceFormatted: string;
}

export interface IncomingTransferRequest {
  id: string;
  senderProfile: IncomingSenderProfile;
  files: TransferFile[];
  totalSize: number;
  totalSizeFormatted: string;
  mode: TransferMode;
  createdAt: string;
  expiresInSeconds: number;
  requiresPairing: boolean;
  isTrustedSender: boolean;
  status: 'pending' | 'verifying' | 'accepted' | 'rejected' | 'expired';
}

export function createMockIncomingRequest(
  preset: 'trusted' | 'unknown' | 'multi_file' | 'large_file' = 'trusted'
): IncomingTransferRequest {
  const timestamp = Date.now();
  const id = `inc-${timestamp}-${Math.random().toString(36).substring(2, 5)}`;

  if (preset === 'unknown') {
    const files: TransferFile[] = [
      {
        id: `inc-f-${timestamp}-1`,
        name: 'Design_Tokens_2026.fig',
        type: 'document',
        typeLabel: 'Figma Document',
        sizeBytes: 480 * 1024 * 1024,
        sizeFormatted: '480 MB',
        status: 'queued',
        progress: 0,
      },
      {
        id: `inc-f-${timestamp}-2`,
        name: 'Camera_RAW_0042.dng',
        type: 'image',
        typeLabel: 'RAW Image',
        sizeBytes: 1.4 * 1024 * 1024 * 1024,
        sizeFormatted: '1.4 GB',
        status: 'queued',
        progress: 0,
      },
    ];

    const totalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    return {
      id,
      senderProfile: {
        id: 'dev-alex-01',
        name: 'Alex Chen',
        username: '@alex',
        avatarInitial: 'A',
        deviceName: 'Pixel 9 Pro',
        platform: 'Android',
        isTrusted: false,
        distanceFormatted: '~2m nearby',
      },
      files,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      mode: 'direct',
      createdAt: 'Just now',
      expiresInSeconds: 60,
      requiresPairing: true,
      isTrustedSender: false,
      status: 'pending',
    };
  }

  if (preset === 'multi_file') {
    const files: TransferFile[] = [
      {
        id: `inc-f-${timestamp}-1`,
        name: 'Cinematic_Cut.mp4',
        type: 'video',
        typeLabel: 'Video',
        sizeBytes: 2.4 * 1024 * 1024 * 1024,
        sizeFormatted: '2.4 GB',
        status: 'queued',
        progress: 0,
      },
      {
        id: `inc-f-${timestamp}-2`,
        name: 'Project_Source.zip',
        type: 'archive',
        typeLabel: 'Archive',
        sizeBytes: 846 * 1024 * 1024,
        sizeFormatted: '846 MB',
        status: 'queued',
        progress: 0,
      },
      {
        id: `inc-f-${timestamp}-3`,
        name: 'Presentation.pdf',
        type: 'document',
        typeLabel: 'Document',
        sizeBytes: 12.4 * 1024 * 1024,
        sizeFormatted: '12.4 MB',
        status: 'queued',
        progress: 0,
      },
      {
        id: `inc-f-${timestamp}-4`,
        name: 'IMG_2048.jpg',
        type: 'image',
        typeLabel: 'Image',
        sizeBytes: 4.8 * 1024 * 1024,
        sizeFormatted: '4.8 MB',
        status: 'queued',
        progress: 0,
      },
      {
        id: `inc-f-${timestamp}-5`,
        name: 'Audio_Track_Final.wav',
        type: 'audio',
        typeLabel: 'Audio',
        sizeBytes: 88 * 1024 * 1024,
        sizeFormatted: '88 MB',
        status: 'queued',
        progress: 0,
      },
      {
        id: `inc-f-${timestamp}-6`,
        name: 'Brand_Guidelines.pdf',
        type: 'document',
        typeLabel: 'Document',
        sizeBytes: 24 * 1024 * 1024,
        sizeFormatted: '24 MB',
        status: 'queued',
        progress: 0,
      },
    ];

    const totalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

    return {
      id,
      senderProfile: {
        id: 'dev-mac-01',
        name: 'Hemanth',
        username: '@hemanth',
        avatarInitial: 'H',
        deviceName: "Hemanth's MacBook Air",
        platform: 'macOS',
        isTrusted: true,
        distanceFormatted: '~1m nearby',
      },
      files,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      mode: 'direct',
      createdAt: 'Just now',
      expiresInSeconds: 60,
      requiresPairing: false,
      isTrustedSender: true,
      status: 'pending',
    };
  }

  // Default Standard Trusted Sender Preset
  const files: TransferFile[] = [
    {
      id: `inc-f-${timestamp}-1`,
      name: 'Cinematic_Cut.mp4',
      type: 'video',
      typeLabel: 'Video',
      sizeBytes: 2.4 * 1024 * 1024 * 1024,
      sizeFormatted: '2.4 GB',
      status: 'queued',
      progress: 0,
    },
    {
      id: `inc-f-${timestamp}-2`,
      name: 'Project_Source.zip',
      type: 'archive',
      typeLabel: 'Archive',
      sizeBytes: 846 * 1024 * 1024,
      sizeFormatted: '846 MB',
      status: 'queued',
      progress: 0,
    },
    {
      id: `inc-f-${timestamp}-3`,
      name: 'Presentation.pdf',
      type: 'document',
      typeLabel: 'Document',
      sizeBytes: 12.4 * 1024 * 1024,
      sizeFormatted: '12.4 MB',
      status: 'queued',
      progress: 0,
    },
  ];

  const totalSize = files.reduce((acc, f) => acc + f.sizeBytes, 0);

  return {
    id,
    senderProfile: {
      id: 'dev-mac-01',
      name: 'Hemanth',
      username: '@hemanth',
      avatarInitial: 'H',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
      isTrusted: true,
      distanceFormatted: '~1m nearby',
    },
    files,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    mode: 'direct',
    createdAt: 'Just now',
    expiresInSeconds: 60,
    requiresPairing: false,
    isTrustedSender: true,
    status: 'pending',
  };
}
