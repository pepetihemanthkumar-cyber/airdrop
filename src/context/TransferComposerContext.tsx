import React, { createContext, useContext, useState } from 'react';
import type { Device } from './ProfileDeviceContext';
import type { TransferMode } from '../components/FloatingNavPill';

export interface TransferItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'apk' | 'other';
  size: number;
  sizeFormatted: string;
  status: 'queued' | 'ready' | 'transferring' | 'paused' | 'completed' | 'failed';
  progress: number;
  itemCount?: number;
  isFolder?: boolean;
  modifiedDate?: string;
  thumbnailUrl?: string;
}

export const INITIAL_COMPOSER_FILES: TransferItem[] = [
  {
    id: 'comp-1',
    name: 'Cinematic_Cut.mp4',
    type: 'video',
    size: 2.4 * 1024 * 1024 * 1024,
    sizeFormatted: '2.4 GB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Today, 2:15 PM',
  },
  {
    id: 'comp-2',
    name: 'Project_Source.zip',
    type: 'archive',
    size: 846 * 1024 * 1024,
    sizeFormatted: '846 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Yesterday, 6:40 PM',
  },
  {
    id: 'comp-3',
    name: 'Presentation.pdf',
    type: 'document',
    size: 12.4 * 1024 * 1024,
    sizeFormatted: '12.4 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 24, 11:30 AM',
  },
];

interface TransferComposerContextType {
  selectedFiles: TransferItem[];
  destinationDevice: Device | null;
  direction: 'send' | 'receive';
  transferMode: TransferMode;
  totalPayloadBytes: number;
  totalPayloadFormatted: string;
  addFiles: (files: TransferItem[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  selectFolder: (folderItem: TransferItem) => void;
  selectDestination: (device: Device | null) => void;
  setDirection: (dir: 'send' | 'receive') => void;
  setTransferMode: (mode: TransferMode) => void;
  resetTransfer: () => void;
}

const TransferComposerContext = createContext<TransferComposerContextType | undefined>(undefined);

export const TransferComposerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedFiles, setSelectedFiles] = useState<TransferItem[]>(INITIAL_COMPOSER_FILES);
  const [destinationDevice, setDestinationDevice] = useState<Device | null>(null);
  const [direction, setDirection] = useState<'send' | 'receive'>('send');
  const [transferMode, setTransferMode] = useState<TransferMode>('direct');

  const totalPayloadBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const addFiles = (newFiles: TransferItem[]) => {
    setSelectedFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const filtered = newFiles.filter((f) => !existingIds.has(f.id));
      return [...prev, ...filtered];
    });
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  const selectFolder = (folderItem: TransferItem) => {
    setSelectedFiles([folderItem]);
  };

  const selectDestination = (device: Device | null) => {
    setDestinationDevice(device);
  };

  const resetTransfer = () => {
    setSelectedFiles(INITIAL_COMPOSER_FILES);
    setDestinationDevice(null);
    setDirection('send');
  };

  return (
    <TransferComposerContext.Provider
      value={{
        selectedFiles,
        destinationDevice,
        direction,
        transferMode,
        totalPayloadBytes,
        totalPayloadFormatted: formatBytes(totalPayloadBytes),
        addFiles,
        removeFile,
        clearFiles,
        selectFolder,
        selectDestination,
        setDirection,
        setTransferMode,
        resetTransfer,
      }}
    >
      {children}
    </TransferComposerContext.Provider>
  );
};

export const useTransferComposer = () => {
  const context = useContext(TransferComposerContext);
  if (!context) {
    throw new Error('useTransferComposer must be used within a TransferComposerProvider');
  }
  return context;
};
