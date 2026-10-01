import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Zap,
  Wifi,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Trash2,
  Info,
  CheckCircle2,
  Folder,
  FileText,
  Package,
  Video,
  Music,
  Image as ImageIcon,
  Code,
  File,
  ArrowLeft,
  Share2,
  ShieldCheck,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ExternalLink,
  FolderOpen,
  Activity,
  AlertCircle,
  XCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useTransferHistory, type TransferHistoryItem, type HistoryFilterOptions, type HistorySortOption } from '../context/TransferHistoryContext';
import { useTransferQueue } from '../context/TransferQueueContext';
import { useConnectionHealth } from '../context/ConnectionHealthContext';
import { useSettings } from '../context/SettingsContext';
import { GlassCloseButton } from './common/GlassCloseButton';

interface TransferHistoryScreenProps {
  onBack: () => void;
  onStartNewTransfer: () => void;
  onRetryTransfer?: (item: TransferHistoryItem) => void;
}

export const TransferHistoryScreen: React.FC<TransferHistoryScreenProps> = ({
  onBack,
  onStartNewTransfer,
  onRetryTransfer,
}) => {
  const { history, removeHistoryItem, clearHistory } = useTransferHistory();
  const { addTransfer } = useTransferQueue();
  const { openPanel, setConnection } = useConnectionHealth();
  const { settings } = useSettings();

  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<HistoryFilterOptions>({
    direction: 'all',
    status: 'all',
    mode: 'all',
    date: 'all',
  });
  const [sortBy, setSortBy] = useState<HistorySortOption>('newest');

  // Modals & Panels state
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<TransferHistoryItem | null>(null);
  const [selectedFileListModalItem, setSelectedFileListModalItem] = useState<TransferHistoryItem | null>(null);
  const [fileListSearchQuery, setFileListSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Toast feedback for abstract actions (Open / Reveal in folder)
  const [actionFeedbackToast, setActionFeedbackToast] = useState<{ message: string; subtext: string } | null>(null);

  const showActionFeedback = (message: string, subtext: string) => {
    setActionFeedbackToast({ message, subtext });
    setTimeout(() => {
      setActionFeedbackToast(null);
    }, 3200);
  };

  // Helper to render file icon
  const renderFileIcon = (type: string, isFolder?: boolean) => {
    if (isFolder || type === 'folder') {
      return <Folder className="w-4 h-4 text-[#F5F5F5]" />;
    }
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-[#F5F5F5]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-[#F5F5F5]" />;
      case 'apk':
        return <Package className="w-4 h-4 text-[#F5F5F5]" />;
      case 'archive':
        return <Package className="w-4 h-4 text-[#F5F5F5]" />;
      case 'audio':
        return <Music className="w-4 h-4 text-[#F5F5F5]" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#F5F5F5]" />;
      case 'code':
        return <Code className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <File className="w-4 h-4 text-[#F5F5F5]" />;
    }
  };

  // Handle Retry Transfer
  const handleRetry = (item: TransferHistoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);
    setSelectedDetailsItem(null);

    if (onRetryTransfer) {
      onRetryTransfer(item);
      return;
    }

    // Requeue transfer via TransferQueueContext
    addTransfer({
      id: `tr-retry-${Date.now()}`,
      direction: item.direction === 'sent' ? 'send' : 'receive',
      mode: item.mode,
      sourceDevice: {
        id: item.sender.deviceId,
        userName: item.sender.name,
        userHandle: item.sender.username,
        deviceName: item.sender.deviceName,
        platform: item.sender.platform,
      },
      destinationDevice: {
        id: item.receiver.deviceId,
        userName: item.receiver.name,
        userHandle: item.receiver.username,
        deviceName: item.receiver.deviceName,
        platform: item.receiver.platform,
      },
      files: item.files.map((f) => ({
        id: f.id || `f-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: f.name,
        sizeBytes: f.sizeBytes,
        sizeFormatted: f.sizeFormatted,
        type: f.type as any,
        typeLabel: f.typeLabel || f.type,
        status: 'queued',
        progress: 0,
      })),
      totalSize: item.totalBytes,
      status: 'queued',
    });

    showActionFeedback('Transfer requeued', `${item.files[0]?.name || 'Payload'} added to transfer queue`);
  };

  // Handle Open File Mock
  const handleOpenFile = (item: TransferHistoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const primaryName = item.files[0]?.name || 'Transferred file';
    showActionFeedback(
      `Opening ${primaryName}`,
      `Abstract launch signal dispatched to native runtime.`
    );
  };

  // Handle Reveal in Folder Mock
  const handleRevealInFolder = (item: TransferHistoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetFolder = item.destination || settings.downloadLocation || 'Downloads';
    showActionFeedback(
      `Revealing in ${targetFolder}`,
      `File location signaled to system file manager.`
    );
  };

  // Open Recorded Connection in ConnectionHealthPanel
  const handleOpenConnectionHealth = (item: TransferHistoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const partner = item.direction === 'sent' ? item.receiver : item.sender;
    setConnection(
      {
        id: partner.deviceId,
        name: partner.deviceName,
        ownerName: partner.name,
        userHandle: partner.username,
        platform: partner.platform,
      },
      item.mode
    );
    openPanel();
  };

  // Filter and Search computation
  const filteredAndSortedHistory = useMemo(() => {
    return history
      .filter((item) => {
        // 1. Search filter across person, username, device, filename, folder
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchesPerson =
            item.sender.name.toLowerCase().includes(q) ||
            item.sender.username.toLowerCase().includes(q) ||
            item.receiver.name.toLowerCase().includes(q) ||
            item.receiver.username.toLowerCase().includes(q);
          const matchesDevice =
            item.sender.deviceName.toLowerCase().includes(q) ||
            item.receiver.deviceName.toLowerCase().includes(q);
          const matchesFiles = item.files.some((f) => f.name.toLowerCase().includes(q));

          if (!matchesPerson && !matchesDevice && !matchesFiles) {
            return false;
          }
        }

        // 2. Direction filter
        if (filters.direction !== 'all' && item.direction !== filters.direction) {
          return false;
        }

        // 3. Status filter
        if (filters.status !== 'all' && item.status !== filters.status) {
          return false;
        }

        // 4. Mode filter
        if (filters.mode !== 'all' && item.mode !== filters.mode) {
          return false;
        }

        // 5. Date filter
        if (filters.date !== 'all') {
          if (filters.date === 'today' && item.relativeDate !== 'Today') {
            return false;
          }
          if (
            filters.date === 'this_week' &&
            item.relativeDate !== 'Today' &&
            item.relativeDate !== 'Yesterday' &&
            item.relativeDate !== 'This week'
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'largest') {
          return b.totalBytes - a.totalBytes;
        }
        if (sortBy === 'smallest') {
          return a.totalBytes - b.totalBytes;
        }
        if (sortBy === 'recent_activity') {
          return b.durationMs - a.durationMs;
        }
        return 0;
      });
  }, [history, searchQuery, filters, sortBy]);

  // Count of active filters
  const activeFilterCount =
    (filters.direction !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.mode !== 'all' ? 1 : 0) +
    (filters.date !== 'all' ? 1 : 0);

  const isReducedMotion = settings.reducedMotion;

  return (
    <motion.div
      initial={isReducedMotion ? undefined : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={isReducedMotion ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-5xl flex flex-col items-center my-auto px-3 sm:px-6 py-4 pointer-events-auto"
      onClick={() => {
        setActiveMenuId(null);
        setIsSortDropdownOpen(false);
      }}
    >
      {/* ========================================================= */}
      {/* 1. HERO HEADER & PRIMARY ACTION CONTROLS                   */}
      {/* ========================================================= */}
      <header className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 mb-3 border-b border-white/[0.08]">
        {/* Title, Back & Subtitle */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/30"
            title="Back to Transfers"
            aria-label="Back to Transfers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5]">
                Transfer History
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[10px] font-mono text-[#A6A8AD]">
                {history.length} records
              </span>
            </div>
            <p className="text-xs text-[#A6A8AD] mt-0.5">
              Everything you've sent and received.
            </p>
          </div>
        </div>

        {/* Top Action CTAs */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {history.length > 0 && (
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="px-3 py-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Clear transfer history"
              aria-label="Clear transfer history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          )}

          <button
            onClick={onStartNewTransfer}
            className="px-4 py-2 rounded-2xl smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 transition-all"
            aria-label="Start new transfer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Start a Transfer</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. SEARCH, FILTER PILLS & SORTING BAR                     */}
      {/* ========================================================= */}
      <section className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5" aria-label="History search and filters">
        {/* Full-width Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#686B72]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search person, @username, device, or file..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-white/25 text-xs text-[#F5F5F5] placeholder-[#686B72] focus:outline-none transition-all"
            aria-label="Search history"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[#A6A8AD] hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter Trigger Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFilterSheetOpen(!isFilterSheetOpen);
            }}
            className={`px-3.5 py-2 rounded-2xl border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              activeFilterCount > 0 || isFilterSheetOpen
                ? 'bg-white/[0.12] border-white/25 text-[#F5F5F5]'
                : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5]'
            }`}
            aria-label="Open filter settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#08090B] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSortDropdownOpen(!isSortDropdownOpen);
              }}
              className="px-3.5 py-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] transition-all flex items-center gap-1.5 cursor-pointer"
              aria-label="Change sort order"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#686B72]" />
              <span className="capitalize">{sortBy.replace('_', ' ')}</span>
            </button>

            {/* Sort Popover Dropdown */}
            <AnimatePresence>
              {isSortDropdownOpen && (
                <motion.div
                  initial={isReducedMotion ? undefined : { opacity: 0, scale: 0.95, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={isReducedMotion ? undefined : { opacity: 0, scale: 0.95, y: 6 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#12141A] border border-white/15 shadow-2xl p-1.5 z-40 flex flex-col space-y-0.5"
                >
                  {[
                    { key: 'newest', label: 'Newest first' },
                    { key: 'oldest', label: 'Oldest first' },
                    { key: 'largest', label: 'Largest first' },
                    { key: 'smallest', label: 'Smallest first' },
                    { key: 'recent_activity', label: 'Most recent activity' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        setSortBy(option.key as HistorySortOption);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        sortBy === option.key
                          ? 'bg-white/[0.12] text-[#F5F5F5] font-semibold'
                          : 'text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortBy === option.key && <CheckCircle2 className="w-3.5 h-3.5 text-[#F5F5F5]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. FILTER SHEET / BAR EXPANDABLE                          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isFilterSheetOpen && (
          <motion.div
            initial={isReducedMotion ? undefined : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={isReducedMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full mb-5 overflow-hidden"
          >
            <div className="w-full p-4 sm:p-5 rounded-3xl bg-white/[0.035] border border-white/[0.12] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#F5F5F5]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]">
                    Filter Transfers
                  </span>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() =>
                      setFilters({
                        direction: 'all',
                        status: 'all',
                        mode: 'all',
                        date: 'all',
                      })
                    }
                    className="text-[11px] font-medium text-[#A6A8AD] hover:text-white underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Direction Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[#A6A8AD]">Direction</label>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {(['all', 'sent', 'received'] as const).map((dir) => (
                      <button
                        key={dir}
                        onClick={() => setFilters((prev) => ({ ...prev, direction: dir }))}
                        className={`py-1.5 text-[11px] font-medium rounded-lg capitalize transition-all cursor-pointer ${
                          filters.direction === dir
                            ? 'bg-white/[0.15] text-[#F5F5F5] font-semibold'
                            : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                        }`}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[#A6A8AD]">Status</label>
                  <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {(['all', 'completed', 'failed', 'cancelled', 'interrupted'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() => setFilters((prev) => ({ ...prev, status: st }))}
                          className={`px-2 py-1 text-[10px] font-medium rounded-lg capitalize transition-all cursor-pointer ${
                            filters.status === st
                              ? 'bg-white/[0.15] text-[#F5F5F5] font-semibold'
                              : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Mode Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[#A6A8AD]">Transfer Mode</label>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {(['all', 'direct', 'wifi'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setFilters((prev) => ({ ...prev, mode: m }))}
                        className={`py-1.5 text-[11px] font-medium rounded-lg capitalize transition-all cursor-pointer ${
                          filters.mode === m
                            ? 'bg-white/[0.15] text-[#F5F5F5] font-semibold'
                            : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                        }`}
                      >
                        {m === 'wifi' ? 'Wi-Fi' : m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[#A6A8AD]">Date Period</label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {(
                      [
                        { key: 'all', label: 'All time' },
                        { key: 'today', label: 'Today' },
                        { key: 'this_week', label: 'This week' },
                        { key: 'this_month', label: 'This month' },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.key}
                        onClick={() => setFilters((prev) => ({ ...prev, date: d.key }))}
                        className={`py-1.5 text-[10px] font-medium rounded-lg transition-all cursor-pointer ${
                          filters.date === d.key
                            ? 'bg-white/[0.15] text-[#F5F5F5] font-semibold'
                            : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* 4. HISTORY RECORDS LIST & EMPTY STATES                    */}
      {/* ========================================================= */}
      {filteredAndSortedHistory.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={isReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full py-16 flex flex-col items-center text-center p-6 rounded-[36px] bg-white/[0.025] border border-white/[0.08] my-4"
        >
          <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4 text-[#F5F5F5]">
            <span className="text-2xl font-light">↔</span>
          </div>
          <h2 className="text-lg font-semibold text-[#F5F5F5] tracking-tight">
            {searchQuery || activeFilterCount > 0 ? 'No transfers found' : 'No transfers yet'}
          </h2>
          <p className="text-xs text-[#A6A8AD] max-w-sm mt-1 mb-5">
            {searchQuery || activeFilterCount > 0
              ? 'Try another name, device, or file.'
              : 'Files you send and receive will appear here.'}
          </p>
          <button
            onClick={onStartNewTransfer}
            className="px-5 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow-lg hover:scale-105 transition-all"
          >
            Start a Transfer →
          </button>
        </motion.div>
      ) : (
        <div className="w-full space-y-3">
          {filteredAndSortedHistory.map((item) => {
            const isSent = item.direction === 'sent';
            const partner = isSent ? item.receiver : item.sender;
            const primaryFile = item.files[0];
            const isMultiFile = item.fileCount > 1;

            return (
              <motion.div
                key={item.id}
                layout={!isReducedMotion}
                initial={isReducedMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={isReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedDetailsItem(item)}
                className="group relative w-full p-4 sm:p-4.5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.055] border border-white/[0.08] hover:border-white/[0.2] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 cursor-pointer shadow-sm"
                tabIndex={0}
                role="button"
                aria-label={`Transfer ${primaryFile?.name || 'Item'} ${item.status}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDetailsItem(item);
                  }
                }}
              >
                {/* Left Section: Avatar + Direction Indicator + File Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Avatar with Direction Badge */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-sm font-semibold text-[#F5F5F5] group-hover:scale-105 transition-transform shadow-inner">
                      {partner.avatar || partner.name[0] || 'U'}
                    </div>
                    {/* Direction Icon: Silver/White ONLY */}
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#17191D] border border-white/20 flex items-center justify-center text-[#F5F5F5]"
                      title={isSent ? 'Sent' : 'Received'}
                      aria-label={isSent ? 'Sent' : 'Received'}
                    >
                      {isSent ? (
                        <ArrowUp className="w-2.5 h-2.5 text-[#F5F5F5]" />
                      ) : (
                        <ArrowDown className="w-2.5 h-2.5 text-[#F5F5F5]" />
                      )}
                    </div>
                  </div>

                  {/* File & Participant Meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#F5F5F5] truncate max-w-[220px] sm:max-w-[320px] group-hover:text-white">
                        {primaryFile?.name || 'Payload'}
                      </span>

                      {/* Multi-file badge */}
                      {isMultiFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFileListModalItem(item);
                          }}
                          className="px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[10px] font-mono text-[#F5F5F5] flex items-center gap-1 cursor-pointer transition-colors"
                          title="View all files"
                        >
                          <Folder className="w-3 h-3 text-[#A6A8AD]" />
                          <span>{item.fileCount} files</span>
                        </button>
                      )}

                      {/* File Size */}
                      <span className="text-[11px] font-mono text-[#A6A8AD] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
                        {item.totalSizeFormatted || `${(item.totalBytes / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    </div>

                    {/* Participant Details & Route */}
                    <div className="text-xs text-[#A6A8AD] flex items-center gap-2 mt-1 truncate">
                      <span className="font-medium text-[#F5F5F5]">{partner.name}</span>
                      <span className="text-[#686B72]">{partner.username}</span>
                      <span className="text-[#686B72]">•</span>
                      <span className="truncate">{partner.deviceName}</span>
                      {!isSent && item.status === 'completed' && (
                        <>
                          <span className="text-[#686B72]">•</span>
                          <span className="text-[11px] text-[#A6A8AD]">Saved to {item.destination}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Section: Mode + Recorded Connection + Status + Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-white/[0.05]">
                  {/* Mode Badge */}
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] text-[#A6A8AD]"
                    title={item.mode === 'direct' ? 'Nearby • Up to 30 m' : 'Local network'}
                  >
                    {item.mode === 'direct' ? (
                      <Zap className="w-3 h-3 text-[#F5F5F5]" />
                    ) : (
                      <Wifi className="w-3 h-3 text-[#A6A8AD]" />
                    )}
                    <span>{item.mode === 'direct' ? 'Direct Nearby' : 'Local Wi-Fi'}</span>
                  </div>

                  {/* Recorded Connection Quality Pill */}
                  {item.status === 'completed' && (
                    <button
                      onClick={(e) => handleOpenConnectionHealth(item, e)}
                      className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-[10px] text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                      title="Recorded connection diagnostics"
                    >
                      <Activity className="w-3 h-3 text-[#A6A8AD]" />
                      <span>Recorded: {item.connectionQuality || 'Excellent'}</span>
                    </button>
                  )}

                  {/* Status Indicator (Monochrome glass ONLY) */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-medium text-[#F5F5F5]">
                    {item.status === 'completed' && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span>Completed</span>
                      </>
                    )}
                    {item.status === 'failed' && (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-[#A6A8AD]" />
                        <span className="text-[#A6A8AD]">Failed</span>
                      </>
                    )}
                    {item.status === 'cancelled' && (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-[#686B72]" />
                        <span className="text-[#A6A8AD]">Cancelled</span>
                      </>
                    )}
                    {item.status === 'interrupted' && (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-[#A6A8AD]" />
                        <span className="text-[#A6A8AD]">Interrupted</span>
                      </>
                    )}
                  </div>

                  {/* Date/Time */}
                  <div className="text-[11px] text-[#686B72] font-mono min-w-[70px] text-right">
                    {item.startedAt || item.relativeDate || 'Today'}
                  </div>

                  {/* More Actions Context Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                      }}
                      className="p-1.5 rounded-xl hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                      aria-label="Transfer options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Action Menu */}
                    <AnimatePresence>
                      {activeMenuId === item.id && (
                        <motion.div
                          initial={isReducedMotion ? undefined : { opacity: 0, scale: 0.9, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={isReducedMotion ? undefined : { opacity: 0, scale: 0.9, y: 5 }}
                          transition={{ duration: 0.15 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-44 rounded-2xl bg-[#12141A] border border-white/15 shadow-2xl p-1.5 z-40 flex flex-col space-y-0.5"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDetailsItem(item);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5 text-[#A6A8AD]" />
                            <span>View details</span>
                          </button>

                          {isMultiFile && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFileListModalItem(item);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <Folder className="w-3.5 h-3.5 text-[#A6A8AD]" />
                              <span>View {item.fileCount} files</span>
                            </button>
                          )}

                          {!isSent && item.status === 'completed' && (
                            <>
                              <button
                                onClick={(e) => {
                                  handleOpenFile(item, e);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[#A6A8AD]" />
                                <span>Open file</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  handleRevealInFolder(item, e);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-[#A6A8AD]" />
                                <span>Reveal in folder</span>
                              </button>
                            </>
                          )}

                          {(item.status === 'failed' ||
                            item.status === 'cancelled' ||
                            item.status === 'interrupted') && (
                            <button
                              onClick={(e) => handleRetry(item, e)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-[#A6A8AD]" />
                              <span>Retry transfer</span>
                            </button>
                          )}

                          <div className="h-[1px] bg-white/[0.08] my-1" />

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeHistoryItem(item.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete record</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TRANSFER DETAILS MODAL (TransferDetailsPanel)          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedDetailsItem && (
          <div
            onClick={() => setSelectedDetailsItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-20 sm:pt-24 bg-black/75 backdrop-blur-md"
          >
            <motion.div
              initial={isReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg p-5 sm:p-6 rounded-[32px] smoked-glass-card border border-white/20 shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/10 text-[#F5F5F5]">
                    {renderFileIcon(
                      selectedDetailsItem.files[0]?.type || 'file',
                      selectedDetailsItem.files[0]?.isFolder
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#F5F5F5] truncate max-w-[240px] sm:max-w-[280px]">
                      {selectedDetailsItem.files[0]?.name || 'Transfer Payload'}
                    </h3>
                    <div className="text-xs text-[#A6A8AD] flex items-center gap-2 mt-0.5">
                      <span className="font-mono tabular-nums">{selectedDetailsItem.totalSizeFormatted}</span>
                      <span>•</span>
                      <span className="font-mono tabular-nums">{selectedDetailsItem.fileCount} {selectedDetailsItem.fileCount === 1 ? 'file' : 'files'}</span>
                    </div>
                  </div>
                </div>
                <GlassCloseButton
                  onClose={() => setSelectedDetailsItem(null)}
                  ariaLabel="Close transfer details"
                />
              </div>

              {/* Status & Error Banner if any */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                <span className="text-xs text-[#A6A8AD]">Transfer Status</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F5]">
                  {selectedDetailsItem.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  {selectedDetailsItem.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-[#A6A8AD]" />}
                  {selectedDetailsItem.status === 'cancelled' && <XCircle className="w-3.5 h-3.5 text-[#686B72]" />}
                  {selectedDetailsItem.status === 'interrupted' && <RefreshCw className="w-3.5 h-3.5 text-[#A6A8AD]" />}
                  <span className="capitalize">{selectedDetailsItem.status}</span>
                </span>
              </div>

              {selectedDetailsItem.errorReason && (
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-xs text-[#A6A8AD] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#686B72]">Termination Cause</span>
                  <p className="text-[#F5F5F5]">{selectedDetailsItem.errorReason}</p>
                </div>
              )}

              {/* Sender & Receiver Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-[#686B72]">Sender</div>
                  <div className="text-xs font-semibold text-[#F5F5F5]">
                    {selectedDetailsItem.sender.name} ({selectedDetailsItem.sender.username})
                  </div>
                  <div className="text-[11px] text-[#A6A8AD]">
                    {selectedDetailsItem.sender.deviceName} • {selectedDetailsItem.sender.platform}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/[0.06] space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-[#686B72]">Receiver</div>
                  <div className="text-xs font-semibold text-[#F5F5F5]">
                    {selectedDetailsItem.receiver.name} ({selectedDetailsItem.receiver.username})
                  </div>
                  <div className="text-[11px] text-[#A6A8AD]">
                    {selectedDetailsItem.receiver.deviceName} • {selectedDetailsItem.receiver.platform}
                  </div>
                </div>
              </div>

              {/* Transfer Metrics & Mode Grid */}
              <div className="space-y-2 text-xs text-[#A6A8AD]">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                  <span>Transfer Mode</span>
                  <span className="text-[#F5F5F5] font-medium flex items-center gap-1.5">
                    {selectedDetailsItem.mode === 'direct' ? (
                      <Zap className="w-3.5 h-3.5" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {selectedDetailsItem.mode === 'direct'
                        ? 'Direct Nearby (Up to 30 m)'
                        : 'Local Wi-Fi Network'}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                  <span>Speed & Duration</span>
                  <span className="text-[#F5F5F5] font-mono">
                    avg {selectedDetailsItem.averageSpeedMBps} MB/s (peak {selectedDetailsItem.peakSpeedMBps} MB/s) • {Math.round(selectedDetailsItem.durationMs / 1000)}s
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                  <span>Security & Stream Integrity</span>
                  <span className="flex items-center gap-1.5 text-[#F5F5F5] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#A6A8AD]" />
                    <span>{selectedDetailsItem.securityState}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                  <span>Storage Destination</span>
                  <span className="text-[#F5F5F5] font-mono">
                    {selectedDetailsItem.destination}
                  </span>
                </div>

                {/* Recorded Connection Diagnostic trigger */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.05]">
                  <span>Recorded Connection</span>
                  <button
                    onClick={(e) => {
                      handleOpenConnectionHealth(selectedDetailsItem, e);
                      setSelectedDetailsItem(null);
                    }}
                    className="flex items-center gap-1 text-[#F5F5F5] hover:underline cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#A6A8AD]" />
                    <span>{selectedDetailsItem.connectionQuality || 'Excellent'} (View Diagnostic)</span>
                  </button>
                </div>
              </div>

              {/* Multi-file preview trigger */}
              {selectedDetailsItem.fileCount > 1 && (
                <button
                  onClick={() => {
                    setSelectedFileListModalItem(selectedDetailsItem);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-[#F5F5F5] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-[#A6A8AD]" />
                    <span>View all {selectedDetailsItem.fileCount} files in this payload</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#A6A8AD]" />
                </button>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    removeHistoryItem(selectedDetailsItem.id);
                    setSelectedDetailsItem(null);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.05] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  {!selectedDetailsItem.direction.includes('sent') &&
                    selectedDetailsItem.status === 'completed' && (
                      <>
                        <button
                          onClick={(e) => {
                            handleRevealInFolder(selectedDetailsItem, e);
                            setSelectedDetailsItem(null);
                          }}
                          className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-[#F5F5F5] cursor-pointer"
                        >
                          Reveal in Folder
                        </button>
                        <button
                          onClick={(e) => {
                            handleOpenFile(selectedDetailsItem, e);
                            setSelectedDetailsItem(null);
                          }}
                          className="px-3.5 py-2 rounded-xl smoked-btn-primary text-xs font-semibold cursor-pointer"
                        >
                          Open File
                        </button>
                      </>
                    )}

                  {(selectedDetailsItem.status === 'failed' ||
                    selectedDetailsItem.status === 'cancelled' ||
                    selectedDetailsItem.status === 'interrupted') && (
                    <button
                      onClick={(e) => handleRetry(selectedDetailsItem, e)}
                      className="px-4 py-2 rounded-xl smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Transfer</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* 6. MULTI-FILE PREVIEW MODAL                               */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedFileListModalItem && (
          <div
            onClick={() => {
              setSelectedFileListModalItem(null);
              setFileListSearchQuery('');
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-20 sm:pt-24 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={isReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.22 }}
              className="relative w-full max-w-lg p-5 sm:p-6 rounded-[32px] smoked-glass-card border border-white/20 shadow-2xl flex flex-col space-y-4 max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white/[0.06] border border-white/10 text-[#F5F5F5]">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      Transfer File Manifest
                    </h3>
                    <p className="text-xs text-[#A6A8AD]">
                      {selectedFileListModalItem.fileCount} items • {selectedFileListModalItem.totalSizeFormatted}
                    </p>
                  </div>
                </div>
                <GlassCloseButton
                  onClose={() => {
                    setSelectedFileListModalItem(null);
                    setFileListSearchQuery('');
                  }}
                  ariaLabel="Close file manifest"
                />
              </div>

              {/* File Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#686B72]" />
                <input
                  type="text"
                  value={fileListSearchQuery}
                  onChange={(e) => setFileListSearchQuery(e.target.value)}
                  placeholder="Filter files in this payload..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#F5F5F5] placeholder-[#686B72] focus:outline-none focus:border-white/25 transition-all"
                />
              </div>

              {/* File List Scroll Container */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-72">
                {selectedFileListModalItem.files
                  .filter((f) =>
                    f.name.toLowerCase().includes(fileListSearchQuery.toLowerCase())
                  )
                  .map((file, idx) => (
                    <div
                      key={file.id || idx}
                      className="p-2.5 rounded-xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[#F5F5F5] shrink-0">
                          {renderFileIcon(file.type, file.isFolder)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[#F5F5F5] truncate">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-[#A6A8AD] capitalize">
                            {file.typeLabel || file.type}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#A6A8AD] shrink-0">
                        {file.sizeFormatted}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end pt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setSelectedFileListModalItem(null);
                    setFileListSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* 7. CLEAR HISTORY CONFIRMATION MODAL                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isClearModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={isReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm p-6 rounded-[32px] smoked-glass-card border border-white/20 shadow-2xl flex flex-col items-center text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/15 flex items-center justify-center text-[#F5F5F5]">
                <Trash2 className="w-6 h-6 text-[#A6A8AD]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F5F5]">
                  Clear transfer history?
                </h3>
                <p className="text-xs text-[#A6A8AD] mt-1.5 leading-relaxed">
                  Your transfer records will be removed from NearShare. Actual transferred files on your device will not be deleted.
                </p>
              </div>

              <div className="w-full grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => setIsClearModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearHistory();
                    setIsClearModalOpen(false);
                    showActionFeedback('History cleared', 'All transfer records removed from library');
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/[0.14] hover:bg-white/[0.22] border border-white/25 text-xs font-semibold text-white transition-colors cursor-pointer shadow-lg"
                >
                  Clear History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* 8. FLOATING ACTION TOAST FEEDBACK                         */}
      {/* ========================================================= */}
      <AnimatePresence>
        {actionFeedbackToast && (
          <motion.div
            initial={isReducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={isReducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-[#12141A]/95 border border-white/20 shadow-2xl backdrop-blur-lg flex items-center gap-3 pointer-events-auto"
          >
            <Sparkles className="w-4 h-4 text-[#F5F5F5]" />
            <div>
              <div className="text-xs font-semibold text-[#F5F5F5]">
                {actionFeedbackToast.message}
              </div>
              <div className="text-[11px] text-[#A6A8AD]">
                {actionFeedbackToast.subtext}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
