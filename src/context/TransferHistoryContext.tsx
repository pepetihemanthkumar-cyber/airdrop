import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSettings } from './SettingsContext';
import { formatBytes } from '../services/mockTransferEngine';

export type HistoryDirection = 'sent' | 'received';
export type HistoryStatus = 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type HistoryMode = 'direct' | 'wifi';

export interface HistoryParticipant {
  profileId: string;
  name: string;
  username: string;
  avatar: string;
  deviceId: string;
  deviceName: string;
  platform: string;
}

export interface HistoryFile {
  id: string;
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string; // 'video' | 'document' | 'archive' | 'audio' | 'image' | 'apk' | 'folder' | 'code' | 'other'
  typeLabel?: string;
  isFolder?: boolean;
}

export interface TransferHistoryItem {
  id: string;
  direction: HistoryDirection;
  status: HistoryStatus;
  fileCount: number;
  files: HistoryFile[];
  totalBytes: number;
  totalSizeFormatted?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  averageSpeedMBps: number;
  peakSpeedMBps: number;
  mode: HistoryMode;
  sender: HistoryParticipant;
  receiver: HistoryParticipant;
  securityState: string;
  retryable: boolean;
  destination: string;
  errorReason?: string;
  createdAt: string;
  connectionQuality?: 'Excellent' | 'Good';
  relativeDate?: string; // For grouping like 'Today', 'Yesterday', 'This week'
  interrupted?: boolean;
  resumed?: boolean;
  reconnectAttempts?: number;
  bytesBeforeInterruption?: number;
  bytesAfterResume?: number;
}

export interface HistoryFilterOptions {
  direction: 'all' | 'sent' | 'received';
  status: 'all' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  mode: 'all' | 'direct' | 'wifi';
  date: 'all' | 'today' | 'this_week' | 'this_month';
}

export type HistorySortOption =
  | 'newest'
  | 'oldest'
  | 'largest'
  | 'smallest'
  | 'recent_activity';

interface TransferHistoryContextType {
  history: TransferHistoryItem[];
  addHistoryItem: (item: TransferHistoryItem) => void;
  updateHistoryItem: (id: string, updates: Partial<TransferHistoryItem>) => void;
  removeHistoryItem: (id: string) => void;
  clearHistory: () => void;
  getHistoryItemById: (id: string) => TransferHistoryItem | undefined;
}

const INITIAL_HISTORY_ITEMS: TransferHistoryItem[] = [
  {
    id: 'hist-item-1',
    direction: 'sent',
    status: 'completed',
    fileCount: 1,
    files: [
      {
        id: 'f-cine-1',
        name: 'Cinematic_Cut.mp4',
        sizeBytes: 2.4 * 1024 * 1024 * 1024,
        sizeFormatted: '2.4 GB',
        type: 'video',
        typeLabel: 'Video',
      },
    ],
    totalBytes: 2.4 * 1024 * 1024 * 1024,
    totalSizeFormatted: '2.4 GB',
    startedAt: 'Today, 10:14 AM',
    completedAt: 'Today, 10:15 AM',
    durationMs: 58000,
    averageSpeedMBps: 42.4,
    peakSpeedMBps: 52.8,
    mode: 'direct',
    sender: {
      profileId: 'NS-HEMANTH-8492',
      name: 'Hemanth',
      username: '@hemanth',
      avatar: 'H',
      deviceId: 'dev-mac-01',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    receiver: {
      profileId: 'NS-ALEX-9921',
      name: 'Alex',
      username: '@alex',
      avatar: 'A',
      deviceId: 'dev-alex-mbp',
      deviceName: 'MacBook Pro',
      platform: 'macOS',
    },
    securityState: 'Verified direct peer stream',
    retryable: false,
    destination: 'Downloads',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    connectionQuality: 'Excellent',
    relativeDate: 'Today',
  },
  {
    id: 'hist-item-2',
    direction: 'received',
    status: 'completed',
    fileCount: 124,
    files: [
      {
        id: 'f-proj-fld',
        name: 'Project_Source_Assets',
        sizeBytes: 2.8 * 1024 * 1024 * 1024,
        sizeFormatted: '2.8 GB',
        type: 'folder',
        typeLabel: 'Folder',
        isFolder: true,
      },
      {
        id: 'f-proj-1',
        name: 'App.tsx',
        sizeBytes: 12 * 1024,
        sizeFormatted: '12 KB',
        type: 'code',
        typeLabel: 'Code',
      },
      {
        id: 'f-proj-2',
        name: 'design_tokens.json',
        sizeBytes: 45 * 1024,
        sizeFormatted: '45 KB',
        type: 'document',
        typeLabel: 'JSON Document',
      },
      {
        id: 'f-proj-3',
        name: 'hero_render_4k.png',
        sizeBytes: 8.4 * 1024 * 1024,
        sizeFormatted: '8.4 MB',
        type: 'image',
        typeLabel: 'Image',
      },
      {
        id: 'f-proj-4',
        name: 'soundtrack_lossless.flac',
        sizeBytes: 42 * 1024 * 1024,
        sizeFormatted: '42 MB',
        type: 'audio',
        typeLabel: 'Audio',
      },
    ],
    totalBytes: 2.8 * 1024 * 1024 * 1024,
    totalSizeFormatted: '2.8 GB',
    startedAt: 'Today, 09:30 AM',
    completedAt: 'Today, 09:31 AM',
    durationMs: 74000,
    averageSpeedMBps: 38.6,
    peakSpeedMBps: 46.2,
    mode: 'wifi',
    sender: {
      profileId: 'NS-SARAH-4129',
      name: 'Sarah Chen',
      username: '@sarahc',
      avatar: 'S',
      deviceId: 'dev-sarah-pc',
      deviceName: "Sarah's Studio PC",
      platform: 'Windows',
    },
    receiver: {
      profileId: 'NS-HEMANTH-8492',
      name: 'Hemanth',
      username: '@hemanth',
      avatar: 'H',
      deviceId: 'dev-mac-01',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    securityState: 'Verified local network stream',
    retryable: false,
    destination: 'Downloads',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    connectionQuality: 'Good',
    relativeDate: 'Today',
  },
  {
    id: 'hist-item-3',
    direction: 'sent',
    status: 'interrupted',
    fileCount: 1,
    files: [
      {
        id: 'f-arch-1',
        name: 'Firmware_Kernel_v2.tar.gz',
        sizeBytes: 1.4 * 1024 * 1024 * 1024,
        sizeFormatted: '1.4 GB',
        type: 'archive',
        typeLabel: 'Archive',
      },
    ],
    totalBytes: 1.4 * 1024 * 1024 * 1024,
    totalSizeFormatted: '1.4 GB',
    startedAt: 'Yesterday, 04:45 PM',
    completedAt: 'Yesterday, 04:46 PM',
    durationMs: 22000,
    averageSpeedMBps: 31.0,
    peakSpeedMBps: 41.5,
    mode: 'direct',
    sender: {
      profileId: 'NS-HEMANTH-8492',
      name: 'Hemanth',
      username: '@hemanth',
      avatar: 'H',
      deviceId: 'dev-mac-01',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    receiver: {
      profileId: 'NS-POCO-8812',
      name: 'Hemanth',
      username: '@hemanth',
      avatar: 'H',
      deviceId: 'dev-poco-01',
      deviceName: 'Poco F7',
      platform: 'Android',
    },
    securityState: 'Direct channel disconnected',
    retryable: true,
    destination: 'Downloads',
    errorReason: 'Connection interrupted: peer moved out of direct range.',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    connectionQuality: 'Good',
    relativeDate: 'Yesterday',
  },
  {
    id: 'hist-item-4',
    direction: 'received',
    status: 'completed',
    fileCount: 3,
    files: [
      {
        id: 'f-doc-1',
        name: 'Quarterly_Design_Audit.pdf',
        sizeBytes: 18.5 * 1024 * 1024,
        sizeFormatted: '18.5 MB',
        type: 'document',
        typeLabel: 'Document',
      },
      {
        id: 'f-doc-2',
        name: 'Component_Matrix.csv',
        sizeBytes: 4.2 * 1024 * 1024,
        sizeFormatted: '4.2 MB',
        type: 'document',
        typeLabel: 'Spreadsheet',
      },
      {
        id: 'f-doc-3',
        name: 'Interactive_Spec.fig',
        sizeBytes: 85 * 1024 * 1024,
        sizeFormatted: '85 MB',
        type: 'document',
        typeLabel: 'Design File',
      },
    ],
    totalBytes: 107.7 * 1024 * 1024,
    totalSizeFormatted: '107.7 MB',
    startedAt: '3 days ago, 11:20 AM',
    completedAt: '3 days ago, 11:20 AM',
    durationMs: 3200,
    averageSpeedMBps: 48.2,
    peakSpeedMBps: 54.0,
    mode: 'direct',
    sender: {
      profileId: 'NS-ELENA-5512',
      name: 'Elena Rostova',
      username: '@elena',
      avatar: 'E',
      deviceId: 'dev-ipad-01',
      deviceName: "Elena's iPad Pro",
      platform: 'iOS',
    },
    receiver: {
      profileId: 'NS-HEMANTH-8492',
      name: 'Hemanth',
      username: '@hemanth',
      avatar: 'H',
      deviceId: 'dev-mac-01',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    securityState: 'Verified direct peer stream',
    retryable: false,
    destination: 'Downloads',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    connectionQuality: 'Excellent',
    relativeDate: 'This week',
  },
  {
    id: 'hist-item-5',
    direction: 'sent',
    status: 'cancelled',
    fileCount: 1,
    files: [
      {
        id: 'f-raw-1',
        name: 'RAW_Camera_Roll_8K.zip',
        sizeBytes: 14.2 * 1024 * 1024 * 1024,
        sizeFormatted: '14.2 GB',
        type: 'archive',
        typeLabel: 'Archive',
      },
    ],
    totalBytes: 14.2 * 1024 * 1024 * 1024,
    totalSizeFormatted: '14.2 GB',
    startedAt: '5 days ago, 02:15 PM',
    completedAt: '5 days ago, 02:16 PM',
    durationMs: 8000,
    averageSpeedMBps: 0,
    peakSpeedMBps: 45.0,
    mode: 'direct',
    sender: {
      profileId: 'NS-HEMANTH-8492',
      name: 'Hemanth',
      username: '@hemanth',
      avatar: 'H',
      deviceId: 'dev-mac-01',
      deviceName: "Hemanth's MacBook Air",
      platform: 'macOS',
    },
    receiver: {
      profileId: 'NS-ALEX-9921',
      name: 'Alex',
      username: '@alex',
      avatar: 'A',
      deviceId: 'dev-alex-mbp',
      deviceName: 'MacBook Pro',
      platform: 'macOS',
    },
    securityState: 'Cancelled by sender',
    retryable: true,
    destination: 'Downloads',
    errorReason: 'Transfer cancelled by user.',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    connectionQuality: 'Good',
    relativeDate: 'This week',
  },
];

const TransferHistoryContext = createContext<TransferHistoryContextType | undefined>(undefined);

export const TransferHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [history, setHistory] = useState<TransferHistoryItem[]>(INITIAL_HISTORY_ITEMS);

  // Add history item with duplicate protection (using transferId as unique key)
  const addHistoryItem = useCallback((item: TransferHistoryItem) => {
    setHistory((prev) => {
      const existingIndex = prev.findIndex((h) => h.id === item.id);
      const itemWithDestination: TransferHistoryItem = {
        ...item,
        destination: item.destination || settings.downloadLocation || 'Downloads',
        totalSizeFormatted: item.totalSizeFormatted || formatBytes(item.totalBytes),
      };

      if (existingIndex !== -1) {
        // Update existing record instead of appending duplicate
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...itemWithDestination,
        };
        return updated;
      }
      return [itemWithDestination, ...prev];
    });
  }, [settings.downloadLocation]);

  const updateHistoryItem = useCallback((id: string, updates: Partial<TransferHistoryItem>) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getHistoryItemById = useCallback(
    (id: string) => history.find((item) => item.id === id),
    [history]
  );

  return (
    <TransferHistoryContext.Provider
      value={{
        history,
        addHistoryItem,
        updateHistoryItem,
        removeHistoryItem,
        clearHistory,
        getHistoryItemById,
      }}
    >
      {children}
    </TransferHistoryContext.Provider>
  );
};

export const useTransferHistory = () => {
  const context = useContext(TransferHistoryContext);
  if (!context) {
    throw new Error('useTransferHistory must be used within a TransferHistoryProvider');
  }
  return context;
};
