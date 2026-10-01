import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FilePlus,
  FolderPlus,
  UploadCloud,
  X,
  ArrowRight,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  Package,
  Layers,
  Check,
  Eye,
  Info,
} from 'lucide-react';
import { useTransferComposer, type TransferItem } from '../context/TransferComposerContext';
import type { TransferMode } from './FloatingNavPill';

interface NewTransferScreenProps {
  currentMode: TransferMode;
  onProceedToDestination: () => void;
  onBackToDiscovery?: () => void;
}

const MOCK_PICKER_FILES: TransferItem[] = [
  {
    id: 'pk-1',
    name: 'Cinematic_Cut.mp4',
    type: 'video',
    size: 2.4 * 1024 * 1024 * 1024,
    sizeFormatted: '2.4 GB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Today, 2:15 PM',
  },
  {
    id: 'pk-2',
    name: 'Project_Source.zip',
    type: 'archive',
    size: 846 * 1024 * 1024,
    sizeFormatted: '846 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Yesterday, 6:40 PM',
  },
  {
    id: 'pk-3',
    name: 'Presentation.pdf',
    type: 'document',
    size: 12.4 * 1024 * 1024,
    sizeFormatted: '12.4 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 24, 11:30 AM',
  },
  {
    id: 'pk-4',
    name: 'IMG_2048.jpg',
    type: 'image',
    size: 4.8 * 1024 * 1024,
    sizeFormatted: '4.8 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 25, 9:12 AM',
  },
  {
    id: 'pk-5',
    name: 'Song_Master.wav',
    type: 'audio',
    size: 92 * 1024 * 1024,
    sizeFormatted: '92 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 22, 4:50 PM',
  },
  {
    id: 'pk-6',
    name: 'app-release.apk',
    type: 'apk',
    size: 184 * 1024 * 1024,
    sizeFormatted: '184 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 20, 1:00 PM',
  },
  {
    id: 'pk-7',
    name: 'dataset_weights.bin',
    type: 'other',
    size: 1.2 * 1024 * 1024 * 1024,
    sizeFormatted: '1.2 GB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 18, 5:22 PM',
  },
  {
    id: 'pk-8',
    name: 'UI_Mockups_Final.fig',
    type: 'code',
    size: 340 * 1024 * 1024,
    sizeFormatted: '340 MB',
    status: 'ready',
    progress: 0,
    modifiedDate: 'Sep 23, 10:15 AM',
  },
];

const MOCK_PICKER_FOLDERS: { name: string; filesCount: number; sizeFormatted: string; sizeBytes: number }[] = [
  { name: 'Project Files', filesCount: 124, sizeFormatted: '2.8 GB', sizeBytes: 2.8 * 1024 * 1024 * 1024 },
  { name: 'Photos', filesCount: 84, sizeFormatted: '1.4 GB', sizeBytes: 1.4 * 1024 * 1024 * 1024 },
  { name: 'Videos', filesCount: 12, sizeFormatted: '6.2 GB', sizeBytes: 6.2 * 1024 * 1024 * 1024 },
  { name: 'Documents', filesCount: 38, sizeFormatted: '142 MB', sizeBytes: 142 * 1024 * 1024 },
  { name: 'Android Build', filesCount: 412, sizeFormatted: '920 MB', sizeBytes: 920 * 1024 * 1024 },
  { name: 'Music', filesCount: 56, sizeFormatted: '480 MB', sizeBytes: 480 * 1024 * 1024 },
];

export const NewTransferScreen: React.FC<NewTransferScreenProps> = ({
  onProceedToDestination,
}) => {
  const {
    selectedFiles,
    totalPayloadFormatted,
    addFiles,
    removeFile,
    clearFiles,
    selectFolder,
  } = useTransferComposer();

  // Modals & UI States
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<TransferItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tempCheckedFiles, setTempCheckedFiles] = useState<string[]>([]);

  const renderFileIcon = (type: TransferItem['type'], isFolder?: boolean) => {
    if (isFolder) return <Layers className="w-5 h-5 text-[#F5F5F5]" />;
    switch (type) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-[#F5F5F5]" />;
      case 'video':
        return <Video className="w-5 h-5 text-[#F5F5F5]" />;
      case 'audio':
        return <Music className="w-5 h-5 text-[#F5F5F5]" />;
      case 'document':
        return <FileText className="w-5 h-5 text-[#F5F5F5]" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-[#F5F5F5]" />;
      case 'apk':
        return <Package className="w-5 h-5 text-[#F5F5F5]" />;
      case 'code':
        return <FileText className="w-5 h-5 text-[#F5F5F5]" />;
      default:
        return <File className="w-5 h-5 text-[#A6A8AD]" />;
    }
  };

  const handleOpenPicker = () => {
    setTempCheckedFiles(selectedFiles.map((f) => f.id));
    setIsFilePickerOpen(true);
  };

  const handleTogglePickerFile = (id: string) => {
    setTempCheckedFiles((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleConfirmPickerFiles = () => {
    const chosen = MOCK_PICKER_FILES.filter((f) => tempCheckedFiles.includes(f.id));
    addFiles(chosen);
    setIsFilePickerOpen(false);
  };

  const handleSelectMockFolder = (folder: typeof MOCK_PICKER_FOLDERS[0]) => {
    const folderItem: TransferItem = {
      id: `folder-${Date.now()}`,
      name: folder.name,
      type: 'archive',
      size: folder.sizeBytes,
      sizeFormatted: folder.sizeFormatted,
      status: 'ready',
      progress: 0,
      itemCount: folder.filesCount,
      isFolder: true,
      modifiedDate: 'Today',
    };
    selectFolder(folderItem);
    setIsFolderPickerOpen(false);
  };

  // Drag & drop simulation
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Simulate adding dropped files
    addFiles([
      {
        id: `dropped-${Date.now()}`,
        name: 'DropZone_Transfer_Payload.mov',
        type: 'video',
        size: 1.8 * 1024 * 1024 * 1024,
        sizeFormatted: '1.8 GB',
        status: 'ready',
        progress: 0,
        modifiedDate: 'Just now',
      },
    ]);
  };

  return (
    <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center space-y-6 py-6 px-4 pointer-events-auto">
      
      {/* ========================================================= */}
      {/* 1. HERO HEADLINE                                          */}
      {/* ========================================================= */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F5F5F5]">
          New Transfer
        </h1>
        <p className="text-sm sm:text-base font-light text-[#A6A8AD]">
          Choose what you want to send.
        </p>
      </div>

      {/* ========================================================= */}
      {/* 2. CENTRAL LIQUID-GLASS WORKSPACE VESSEL                  */}
      {/* ========================================================= */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-2xl p-6 sm:p-8 rounded-[36px] smoked-glass-hero flex flex-col space-y-6 shadow-2xl border border-white/[0.14] overflow-hidden"
      >
        {/* Subtle internal reflective light glint */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-28 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

        {/* PRIMARY ACTIONS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Action 1: Add Files */}
          <button
            onClick={handleOpenPicker}
            className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/20 transition-all flex items-center gap-3 text-left group cursor-pointer shadow-sm"
          >
            <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10 group-hover:bg-white text-white group-hover:text-[#08090B] transition-colors">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#F5F5F5]">Add Files</div>
              <div className="text-xs text-[#A6A8AD]">Photos, videos, documents</div>
            </div>
          </button>

          {/* Action 2: Add Folder */}
          <button
            onClick={() => setIsFolderPickerOpen(true)}
            className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/20 transition-all flex items-center gap-3 text-left group cursor-pointer shadow-sm"
          >
            <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10 group-hover:bg-white text-white group-hover:text-[#08090B] transition-colors">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#F5F5F5]">Add Folder</div>
              <div className="text-xs text-[#A6A8AD]">Send an entire folder</div>
            </div>
          </button>
        </div>

        {/* Action 3: Interactive Smoked-Glass Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleOpenPicker}
          className={`relative w-full py-8 sm:py-10 px-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center space-y-2 text-center cursor-pointer ${
            isDragging
              ? 'border-white bg-white/[0.08] scale-[1.01]'
              : 'border-white/15 bg-white/[0.015] hover:border-white/30 hover:bg-white/[0.03]'
          }`}
        >
          <div className="p-3 rounded-full bg-white/[0.05] border border-white/10 text-white shadow-inner">
            <UploadCloud className={`w-6 h-6 ${isDragging ? 'animate-bounce' : ''}`} />
          </div>
          <div className="text-sm font-semibold text-[#F5F5F5]">
            {isDragging ? 'Release to add files' : 'Drop files here'}
          </div>
          <div className="text-xs text-[#A6A8AD]">
            or click to browse from device • Any file type
          </div>
        </div>

        {/* ======================================================= */}
        {/* 3. SELECTED FILES LIST                                  */}
        {/* ======================================================= */}
        {selectedFiles.length > 0 ? (
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#A6A8AD]">
                Selected Items ({selectedFiles.length})
              </span>
              <button
                onClick={() => setIsClearModalOpen(true)}
                className="text-xs text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {selectedFiles.map((file) => {
                const isLarge = file.size > 1024 * 1024 * 1024;
                return (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between gap-3 group transition-colors cursor-pointer"
                    onClick={() => setPreviewFile(file)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 shrink-0 text-[#F5F5F5]">
                        {renderFileIcon(file.type, file.isFolder)}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#A6A8AD]">
                          <span className="capitalize">{file.isFolder ? `${file.itemCount} files` : file.type}</span>
                          <span>•</span>
                          <span className="font-mono">{file.sizeFormatted}</span>
                          {isLarge && (
                            <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-mono text-[#F5F5F5] border border-white/10 ml-1">
                              Large File
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(file);
                        }}
                        className="p-1.5 rounded-full text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/10 transition-colors"
                        title="Preview details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="p-1.5 rounded-full text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/10 transition-colors"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Large File Architecture Note */}
            {selectedFiles.some((f) => f.size > 1024 * 1024 * 1024) && (
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-start gap-2 text-xs text-[#A6A8AD]">
                <Info className="w-4 h-4 text-[#F5F5F5] shrink-0 mt-0.5" />
                <span>
                  NearShare will transfer large files in chunks and support resume in the native transfer engine.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center space-y-1">
            <div className="text-sm font-semibold text-[#F5F5F5]">Add something to send</div>
            <div className="text-xs text-[#A6A8AD]">
              Files, folders, photos, videos, documents and more.
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* 4. FOOTER SUMMARY & CONTINUE CTA                        */}
        {/* ======================================================= */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <div>
            <div className="text-xs text-[#686B72] uppercase font-mono">Total Payload</div>
            <div className="text-sm font-bold text-[#F5F5F5]">
              {selectedFiles.length} {selectedFiles.length === 1 ? 'item' : 'items'} • {totalPayloadFormatted}
            </div>
          </div>

          <button
            onClick={onProceedToDestination}
            disabled={selectedFiles.length === 0}
            className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100"
          >
            <span>Choose Destination</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* MODAL 1: SMOKED-GLASS MOCK FILE PICKER                    */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isFilePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-lg p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <FilePlus className="w-5 h-5 text-[#F5F5F5]" />
                  <h3 className="text-base font-semibold text-[#F5F5F5]">Select Files</h3>
                </div>
                <button
                  onClick={() => setIsFilePickerOpen(false)}
                  className="p-1 rounded-full text-[#A6A8AD] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {MOCK_PICKER_FILES.map((file) => {
                  const isChecked = tempCheckedFiles.includes(file.id);
                  return (
                    <div
                      key={file.id}
                      onClick={() => handleTogglePickerFile(file.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-white/[0.08] border-white/30'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                          {renderFileIcon(file.type)}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-semibold text-[#F5F5F5] truncate">{file.name}</div>
                          <div className="text-[11px] text-[#A6A8AD]">{file.type} • {file.sizeFormatted}</div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-white border-white text-[#08090B]'
                            : 'border-white/20 bg-white/[0.03]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-xs text-[#A6A8AD]">
                  {tempCheckedFiles.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFilePickerOpen(false)}
                    className="px-4 py-1.5 rounded-full smoked-btn-secondary text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPickerFiles}
                    className="px-5 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow"
                  >
                    Add Selected
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: SMOKED-GLASS MOCK FOLDER PICKER                  */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isFolderPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-md p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-[#F5F5F5]" />
                  <h3 className="text-base font-semibold text-[#F5F5F5]">Select Folder</h3>
                </div>
                <button
                  onClick={() => setIsFolderPickerOpen(false)}
                  className="p-1 rounded-full text-[#A6A8AD] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {MOCK_PICKER_FOLDERS.map((folder) => (
                  <button
                    key={folder.name}
                    onClick={() => handleSelectMockFolder(folder)}
                    className="w-full p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F5F5F5]">{folder.name}</div>
                        <div className="text-[11px] text-[#A6A8AD]">{folder.filesCount} files • {folder.sizeFormatted}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#A6A8AD]" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: FILE PREVIEW & DETAILS                           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-md p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-4 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-white shadow-inner">
                {renderFileIcon(previewFile.type, previewFile.isFolder)}
              </div>

              <div>
                <h3 className="text-base font-bold text-[#F5F5F5] truncate px-2">
                  {previewFile.name}
                </h3>
                <p className="text-xs text-[#A6A8AD] capitalize mt-0.5">
                  {previewFile.isFolder ? 'Folder' : previewFile.type}
                </p>
              </div>

              {/* Mock Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 text-left pt-2">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">Size</div>
                  <div className="text-xs font-semibold text-[#F5F5F5]">{previewFile.sizeFormatted}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">Modified</div>
                  <div className="text-xs font-semibold text-[#F5F5F5]">{previewFile.modifiedDate || 'Recent'}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">Queue Status</div>
                  <div className="text-xs font-semibold text-[#F5F5F5] capitalize">{previewFile.status}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">Engine Prep</div>
                  <div className="text-xs font-semibold text-[#F5F5F5]">Ready for Stream</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-6 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: CLEAR ALL CONFIRMATION                           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isClearModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-sm p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-4 text-center"
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F5F5F5]">
                  Clear selected files?
                </h3>
                <p className="text-xs text-[#A6A8AD]">
                  This will remove all files from this transfer.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearFiles();
                    setIsClearModalOpen(false);
                  }}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
