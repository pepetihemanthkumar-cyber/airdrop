import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { 
  Zap, 
  Wifi, 
  ChevronDown, 
  ArrowLeft, 
  Check, 
  Plus, 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  Package, 
  Paperclip, 
  X, 
  Trash2, 
  ArrowRight, 
  Laptop, 
  Smartphone, 
  Tablet, 
  ShieldCheck, 
  Eye, 
  Sparkles,
  Info,
  Send,
  HardDrive
} from 'lucide-react';
import type { NearbyDevice } from './DirectDiscoveryScreen';
import type { TransferMode } from './ModeSelectionScreen';

interface FileSelectionScreenProps {
  receiverDevice: NearbyDevice;
  onBack: () => void;
  onSwitchMode: (mode: TransferMode) => void;
  onDisconnect: () => void;
  onProceedToReview?: (selectedFiles: SelectedFileItem[]) => void;
}

export interface SelectedFileItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'apk' | 'folder' | 'other';
  typeLabel: string;
  sizeBytes: number;
  sizeFormatted: string;
  itemCount?: number; // for folders
  previewUrl?: string;
  apkNote?: boolean;
}

const SAMPLE_FILES: SelectedFileItem[] = [
  {
    id: 'f-1',
    name: 'vacation.jpg',
    type: 'image',
    typeLabel: 'Image',
    sizeBytes: 4.8 * 1024 * 1024,
    sizeFormatted: '4.8 MB',
    previewUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'f-2',
    name: 'travel-video.mp4',
    type: 'video',
    typeLabel: 'Video',
    sizeBytes: 1.7 * 1024 * 1024 * 1024,
    sizeFormatted: '1.7 GB',
    previewUrl: 'video-sample',
  },
  {
    id: 'f-3',
    name: 'project-report.pdf',
    type: 'document',
    typeLabel: 'Document',
    sizeBytes: 12.4 * 1024 * 1024,
    sizeFormatted: '12.4 MB',
  },
  {
    id: 'f-4',
    name: 'app-release.apk',
    type: 'apk',
    typeLabel: 'APK • Android application package',
    sizeBytes: 1.1 * 1024 * 1024 * 1024,
    sizeFormatted: '1.1 GB',
    apkNote: true,
  },
];

type ScreenStage = 'selecting' | 'review_transfer';

export const FileSelectionScreen: React.FC<FileSelectionScreenProps> = ({
  receiverDevice,
  onBack,
  onSwitchMode,
  onDisconnect,
  onProceedToReview,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [files, setFiles] = useState<SelectedFileItem[]>(SAMPLE_FILES);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItem, setPreviewItem] = useState<SelectedFileItem | null>(null);
  const [screenStage, setScreenStage] = useState<ScreenStage>('selecting');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Sender info (Current device mock)
  const senderInfo = {
    userName: 'Hemanth',
    platform: 'Android',
    deviceName: 'Pixel 9 Pro',
  };

  // Compute total size
  const totalSizeBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
  const formatTotalSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Remove file
  const handleRemoveFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    setFiles([]);
  };

  // Load sample files
  const handleLoadSamples = () => {
    setFiles(SAMPLE_FILES);
  };

  // Add category sample
  const handleAddCategorySample = (cat: SelectedFileItem['type']) => {
    const newId = `f-${Date.now()}`;
    switch (cat) {
      case 'image':
        setFiles(p => [...p, { id: newId, name: `photo_${Math.floor(Math.random() * 899 + 100)}.png`, type: 'image', typeLabel: 'Image', sizeBytes: 6.2 * 1024 * 1024, sizeFormatted: '6.2 MB', previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80' }]);
        break;
      case 'video':
        setFiles(p => [...p, { id: newId, name: `clip_${Math.floor(Math.random() * 899 + 100)}.mov`, type: 'video', typeLabel: 'Video', sizeBytes: 850 * 1024 * 1024, sizeFormatted: '850 MB' }]);
        break;
      case 'audio':
        setFiles(p => [...p, { id: newId, name: 'podcast_track.flac', type: 'audio', typeLabel: 'Audio', sizeBytes: 48 * 1024 * 1024, sizeFormatted: '48 MB' }]);
        break;
      case 'document':
        setFiles(p => [...p, { id: newId, name: 'presentation.key', type: 'document', typeLabel: 'Document', sizeBytes: 34 * 1024 * 1024, sizeFormatted: '34 MB' }]);
        break;
      case 'folder':
        setFiles(p => [...p, { id: newId, name: 'MyProject', type: 'folder', typeLabel: 'Folder (127 files)', sizeBytes: 3.4 * 1024 * 1024 * 1024, sizeFormatted: '3.4 GB', itemCount: 127 }]);
        break;
      case 'archive':
        setFiles(p => [...p, { id: newId, name: 'backup_archive.tar.gz', type: 'archive', typeLabel: 'Archive', sizeBytes: 2.1 * 1024 * 1024 * 1024, sizeFormatted: '2.1 GB' }]);
        break;
      case 'apk':
        setFiles(p => [...p, { id: newId, name: 'syntra-engine.apk', type: 'apk', typeLabel: 'APK • Android application package', sizeBytes: 94 * 1024 * 1024, sizeFormatted: '94 MB', apkNote: true }]);
        break;
      default:
        setFiles(p => [...p, { id: newId, name: 'dataset.json', type: 'other', typeLabel: 'File', sizeBytes: 15 * 1024 * 1024, sizeFormatted: '15 MB' }]);
    }
  };

  // Handle native file input fallback
  const handleNativeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added: SelectedFileItem[] = Array.from(e.target.files).map((f, i) => {
        let type: SelectedFileItem['type'] = 'other';
        let typeLabel = 'File';
        if (f.type.startsWith('image/')) {
          type = 'image';
          typeLabel = 'Image';
        } else if (f.type.startsWith('video/')) {
          type = 'video';
          typeLabel = 'Video';
        } else if (f.type.startsWith('audio/')) {
          type = 'audio';
          typeLabel = 'Audio';
        } else if (f.type.includes('pdf') || f.type.includes('document')) {
          type = 'document';
          typeLabel = 'Document';
        } else if (f.name.endsWith('.apk')) {
          type = 'apk';
          typeLabel = 'APK • Android application package';
        }

        const sizeFmt = f.size >= 1024 * 1024 * 1024 
          ? `${(f.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
          : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;

        return {
          id: `f-native-${Date.now()}-${i}`,
          name: f.name,
          type,
          typeLabel,
          sizeBytes: f.size,
          sizeFormatted: sizeFmt,
          previewUrl: type === 'image' ? URL.createObjectURL(f) : undefined,
          apkNote: type === 'apk',
        };
      });
      setFiles(prev => [...prev, ...added]);
    }
  };

  // Drag & drop handlers
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // simulate adding dropped files
      handleAddCategorySample('image');
      handleAddCategorySample('document');
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.04,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.25, ease: 'easeInOut' },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' },
    },
  };

  // Render file icon
  const renderFileIcon = (type: SelectedFileItem['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-sky-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-pink-400" />;
      case 'document':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-amber-400" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-orange-400" />;
      case 'apk':
        return <Package className="w-4 h-4 text-lime-400" />;
      default:
        return <Paperclip className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative z-10 w-full h-full min-h-screen flex flex-col justify-between px-4 sm:px-8 py-5 md:py-7 select-none overflow-x-hidden"
    >
      {/* Hidden file inputs */}
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={handleNativeFiles} 
        className="hidden" 
      />
      <input 
        type="file" 
        multiple 
        // @ts-expect-error webkitdirectory is standard in browsers
        webkitdirectory="true" 
        ref={folderInputRef} 
        onChange={handleNativeFiles} 
        className="hidden" 
      />

      {/* HEADER */}
      <motion.header variants={itemVariants} className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Top-Left: Brand & Mode Pill */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-white/95 font-sans">
            NearShare
          </span>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/25 text-[11px] font-medium text-sky-300">
            <Zap className="w-3 h-3 fill-sky-400/40 text-sky-400" />
            <span>Direct</span>
          </div>
        </div>

        {/* Top-Right: Back & Mode Switch Dropdown */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={screenStage === 'review_transfer' ? () => setScreenStage('selecting') : onBack}
            className="px-3 py-1.5 rounded-xl apple-glass-pill hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {/* Mode Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_-3px_rgba(56,189,248,0.25)] cursor-pointer"
            >
              <Zap className="w-3 h-3 fill-sky-400/40" />
              <span>⚡ Direct</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 rounded-2xl apple-glass-card border border-white/15 p-1.5 z-50 shadow-2xl backdrop-blur-3xl bg-[#090b10]/95"
                  >
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold bg-sky-500/15 text-sky-200 border border-sky-400/30 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-sky-400 fill-sky-400/30" />
                        <span>⚡ Direct</span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-sky-400" />
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onSwitchMode('wifi');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium hover:bg-white/[0.06] text-slate-300 text-left mt-1 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Wifi className="w-3.5 h-3.5 text-purple-400" />
                        <span>📶 Wi-Fi</span>
                      </div>
                    </button>

                    <div className="my-1 border-t border-white/[0.08]" />

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onDisconnect();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 text-left cursor-pointer transition-colors"
                    >
                      <span>Disconnect session</span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* STAGE 1: MAIN FILE SELECTION */}
      <AnimatePresence mode="wait">
        {screenStage === 'selecting' && (
          <motion.main
            key="file-selecting-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center py-2 sm:py-4 my-auto"
          >
            {/* Top Heading */}
            <div className="text-center mb-4 sm:mb-5">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-tight">
                Ready to send
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 font-normal">
                Choose anything you want to share with <span className="text-white font-medium">{receiverDevice.userName}'s {receiverDevice.deviceName}</span>.
              </p>
            </div>

            {/* TRANSFER CONNECTION CARD */}
            <div className="w-full mb-4 p-3.5 sm:p-4 rounded-2xl apple-glass-pill border border-white/[0.08] flex items-center justify-between">
              {/* Sender */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sender
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {senderInfo.userName} <span className="text-slate-400 font-normal">• {senderInfo.platform}</span>
                  </div>
                </div>
              </div>

              {/* Animated Direction Bridge & Status: ↓ ⚡ ↓ ● Connected */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20">
                  <span className="text-sky-300 text-xs font-bold font-mono">↓</span>
                  <Zap className="w-3.5 h-3.5 fill-sky-400/40 text-sky-300 animate-pulse" />
                  <span className="text-sky-300 text-xs font-bold font-mono">↓</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Connected</span>
                </div>
              </div>

              {/* Receiver */}
              <div className="flex items-center gap-2.5 text-right">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Receiver
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {receiverDevice.userName} <span className="text-slate-400 font-normal">• {receiverDevice.deviceName}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  {receiverDevice.iconType === 'laptop' && <Laptop className="w-4 h-4" />}
                  {receiverDevice.iconType === 'phone' && <Smartphone className="w-4 h-4" />}
                  {receiverDevice.iconType === 'tablet' && <Tablet className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {/* MAIN CONTENT GRID: Left Dropzone & Shortcuts | Right Selected Files List */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
              
              {/* LEFT COLUMN: DROP ZONE & CATEGORIES (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between p-5 sm:p-6 rounded-3xl apple-glass-card border border-white/[0.1] shadow-2xl">
                <div>
                  {/* Large Premium Dropzone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-2xl p-6 border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-sky-400 bg-sky-500/15 scale-[1.01]'
                        : 'border-white/15 hover:border-sky-400/40 bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl apple-glass-pill flex items-center justify-center text-sky-300 mb-3 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </div>

                    <h2 className="text-sm sm:text-base font-semibold text-white">
                      Drop files here
                    </h2>

                    <p className="text-xs text-slate-400 mt-1">
                      or choose files from your device
                    </p>

                    {/* Action Buttons inside Drop Zone */}
                    <div className="mt-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2 px-3.5 rounded-xl apple-glass-button-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Choose Files</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        className="py-2 px-3.5 rounded-xl apple-glass-button-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-300" />
                        <span>Choose Folder</span>
                      </button>
                    </div>

                    {/* Format hint */}
                    <div className="text-[10px] text-slate-500 font-medium mt-3.5 tracking-wide">
                      Files • Folders • Photos • Videos • Audio • Documents • Archives • APK
                    </div>
                  </div>

                  {/* CATEGORY SHORTCUTS */}
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Quick Add by Category
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('image')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-sky-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>🖼</span>
                        <span>Photos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('video')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-purple-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>🎥</span>
                        <span>Videos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('audio')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-pink-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>🎵</span>
                        <span>Audio</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('document')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-emerald-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>📄</span>
                        <span>Docs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('folder')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-amber-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>📁</span>
                        <span>Folders</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('archive')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-orange-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>🗜</span>
                        <span>Archives</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('apk')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-lime-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>📦</span>
                        <span>APK</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddCategorySample('other')}
                        className="p-2 rounded-xl apple-glass-pill hover:bg-white/[0.08] hover:border-slate-400/30 text-[11px] font-medium text-slate-300 hover:text-white flex flex-col items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>📎</span>
                        <span>Other</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* LARGE FILE SUPPORT INFO */}
                <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-2.5">
                  <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Large files supported
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                      Files are transferred in optimized chunks and can resume if interrupted.
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: SELECTED FILES LIST & TRANSFER SUMMARY (7 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-between p-5 sm:p-6 rounded-3xl apple-glass-card border border-white/[0.1] shadow-2xl">
                <div>
                  {/* Selected Files Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Selected files
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-[11px] font-semibold text-white">
                        {files.length} {files.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-slate-400">
                        Total size: <span className="font-semibold text-white">{formatTotalSize(totalSizeBytes)}</span>
                      </div>
                      {files.length > 0 && (
                        <button
                          onClick={handleClearAll}
                          className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear all</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable / Stacked File List */}
                  {files.length > 0 ? (
                    <div className="max-h-[260px] sm:max-h-[300px] overflow-y-auto pr-1 space-y-2">
                      <AnimatePresence>
                        {files.map((file) => (
                          <motion.div
                            key={file.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="group p-3 rounded-2xl apple-glass-pill border border-white/[0.07] hover:border-white/20 flex items-center justify-between transition-all"
                          >
                            {/* File Info */}
                            <div 
                              onClick={() => setPreviewItem(file)}
                              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                            >
                              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                                {renderFileIcon(file.type)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-sky-300 transition-colors">
                                  {file.name}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{file.typeLabel}</span>
                                  <span>•</span>
                                  <span className="font-medium text-slate-300">{file.sizeFormatted}</span>
                                  {file.itemCount && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-400/90 text-[10px]">Folder structure preserved</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions (Preview & Remove) */}
                            <div className="flex items-center gap-1.5 ml-2">
                              <button
                                type="button"
                                onClick={() => setPreviewItem(file)}
                                title="Preview file"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveFile(file.id)}
                                title="Remove item"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    /* EMPTY STATE */
                    <div className="py-12 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01]">
                      <div className="w-12 h-12 rounded-2xl apple-glass-pill flex items-center justify-center text-slate-500 mb-3">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">
                        Ready to share
                      </h3>
                      <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                        Choose files or folders to begin.
                      </p>
                      <button
                        type="button"
                        onClick={handleLoadSamples}
                        className="py-2 px-4 rounded-xl apple-glass-pill hover:bg-white/[0.08] text-xs font-semibold text-sky-300 border border-sky-400/30 transition-all cursor-pointer"
                      >
                        Use sample files
                      </button>
                    </div>
                  )}
                </div>

                {/* BOTTOM TRANSFER SUMMARY & ACTION */}
                <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Summary Details */}
                  <div className="text-left w-full sm:w-auto">
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <span>Ready to send:</span>
                      <span className="text-sky-300 font-bold">{files.length} {files.length === 1 ? 'item' : 'items'} ({formatTotalSize(totalSizeBytes)})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      To: <span className="text-slate-300 font-medium">{receiverDevice.userName} ({receiverDevice.deviceName})</span>
                    </div>
                  </div>

                  {/* Primary Button: Review Transfer → */}
                  <button
                    disabled={files.length === 0}
                    onClick={() => {
                      if (onProceedToReview) {
                        onProceedToReview(files);
                      } else {
                        setScreenStage('review_transfer');
                      }
                    }}
                    className={`w-full sm:w-auto py-3 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      files.length > 0
                        ? 'apple-glass-button-primary cursor-pointer shadow-lg hover:shadow-xl'
                        : 'bg-white/[0.04] text-slate-600 border border-white/[0.06] cursor-not-allowed'
                    }`}
                  >
                    <span>Review Transfer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </motion.main>
        )}

        {/* STAGE 2: TRANSFER REVIEW PLACEHOLDER STAGE */}
        {screenStage === 'review_transfer' && (
          <motion.main
            key="review-transfer-main"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-center py-4 my-auto"
          >
            <div className="w-full p-7 sm:p-8 rounded-3xl apple-glass-card border border-white/[0.1] shadow-2xl flex flex-col">
              
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    Review Transfer
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Confirm transfer parameters before sending
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Direct Pipe</span>
                </div>
              </div>

              {/* Transfer Manifest Breakdown */}
              <div className="space-y-3 mb-6">
                {/* Route Card */}
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">From</span>
                    <div className="font-semibold text-white">{senderInfo.userName} ({senderInfo.deviceName})</div>
                  </div>
                  <div className="p-1.5 rounded-full bg-sky-500/20 text-sky-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">To</span>
                    <div className="font-semibold text-white">{receiverDevice.userName} ({receiverDevice.deviceName})</div>
                  </div>
                </div>

                {/* Transfer Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Items</div>
                    <div className="text-base font-bold text-white mt-0.5">{files.length}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Payload Size</div>
                    <div className="text-base font-bold text-sky-300 mt-0.5">{formatTotalSize(totalSizeBytes)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Speed Est.</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">~65 MB/s</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => onProceedToReview ? onProceedToReview(files) : setScreenStage('selecting')}
                  className="w-full py-3.5 px-5 rounded-2xl apple-glass-button-primary font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>Start Transfer →</span>
                </button>

                <button
                  onClick={() => setScreenStage('selecting')}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Edit selected files
                </button>
              </div>

            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* FILE PREVIEW MODAL */}
      <AnimatePresence>
        {previewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative z-10 w-full max-w-md p-6 rounded-3xl apple-glass-card border border-white/20 bg-[#090b10] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  {renderFileIcon(previewItem.type)}
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Preview
                  </span>
                </div>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1 rounded-lg bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview Body */}
              <div className="w-full h-48 rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center justify-center overflow-hidden mb-4 relative">
                {previewItem.type === 'image' && previewItem.previewUrl ? (
                  <img 
                    src={previewItem.previewUrl} 
                    alt={previewItem.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : previewItem.type === 'video' ? (
                  <div className="flex flex-col items-center justify-center text-purple-300 gap-2">
                    <Video className="w-10 h-10" />
                    <span className="text-xs text-slate-300">Video Player Simulation</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Info className="w-8 h-8" />
                    <span className="text-xs font-medium">Preview unavailable</span>
                  </div>
                )}
              </div>

              {/* File details */}
              <div className="space-y-1 mb-4">
                <div className="text-sm font-semibold text-white truncate">{previewItem.name}</div>
                <div className="text-xs text-slate-400">
                  {previewItem.typeLabel} • <span className="text-slate-300 font-medium">{previewItem.sizeFormatted}</span>
                </div>
                {previewItem.apkNote && (
                  <div className="text-[11px] text-lime-400 bg-lime-500/10 p-2 rounded-xl border border-lime-400/20 mt-2">
                    Android application package: Transfers APK binary only without silent auto-install.
                  </div>
                )}
              </div>

              <button
                onClick={() => setPreviewItem(null)}
                className="w-full py-2.5 rounded-xl apple-glass-pill hover:bg-white/[0.08] text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <motion.footer variants={itemVariants} className="w-full max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/[0.04]">
        <span>NearShare Multi-File Engine</span>
        <div className="flex items-center gap-3">
          <span>Chunked Resumable Stream</span>
          <span>•</span>
          <span>Zero Compression Loss</span>
        </div>
      </motion.footer>
    </motion.div>
  );
};
