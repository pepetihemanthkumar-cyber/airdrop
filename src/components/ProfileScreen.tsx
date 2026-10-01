import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop,
  Smartphone,
  Monitor,
  ShieldCheck,
  Star,
  MoreVertical,
  Edit3,
  Eye,
  EyeOff,
  Check,
  ArrowLeft,
  Share2,
  Ban,
  Info,
  Lock,
} from 'lucide-react';
import { useProfileDevice } from '../context/ProfileDeviceContext';
import { useDeviceTrust, type DeviceRelationship } from '../context/DeviceTrustContext';
import { DeviceTrustDetailsPanel } from './DeviceTrustDetailsPanel';
import { GlassCloseButton } from './common/GlassCloseButton';

interface ProfileScreenProps {
  onBack: () => void;
  onStartTransfer?: (deviceId?: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onStartTransfer,
}) => {
  const {
    userProfile,
    isDeviceVisible,
    updateUserProfile,
    toggleDeviceVisibility,
  } = useProfileDevice();

  const {
    deviceRelationships,
    toggleFavorite,
    setTrustState,
    blockDevice,
    unblockDevice,
  } = useDeviceTrust();

  const [activeTab, setActiveTab] = useState<'all' | 'trusted' | 'favorites' | 'blocked'>('all');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editUsername, setEditUsername] = useState(userProfile.username);
  const [editBio, setEditBio] = useState(userProfile.bio || '');

  // Selected device for full trust details vessel panel
  const [selectedDeviceRelationship, setSelectedDeviceRelationship] = useState<DeviceRelationship | null>(null);
  const [activeMenuDeviceId, setActiveMenuDeviceId] = useState<string | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      updateUserProfile({
        name: editName.trim(),
        username: editUsername.trim().startsWith('@') ? editUsername.trim() : `@${editUsername.trim()}`,
        bio: editBio.trim(),
      });
      setIsEditingProfile(false);
    }
  };

  const renderPlatformIcon = (platform: DeviceRelationship['platform']) => {
    switch (platform) {
      case 'macOS':
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Android':
      case 'iOS':
        return <Smartphone className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Windows':
        return <Monitor className="w-5 h-5 text-[#F5F5F5]" />;
      default:
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
    }
  };

  const filteredDevices = deviceRelationships.filter((d) => {
    if (activeTab === 'blocked') return d.blocked;
    if (d.blocked) return false;
    if (activeTab === 'trusted') return d.trustState === 'trusted';
    if (activeTab === 'favorites') return d.favorite;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-4xl flex flex-col items-center my-auto px-3 sm:px-4 py-2 pointer-events-auto"
      onClick={() => setActiveMenuDeviceId(null)}
    >
      {/* ========================================================= */}
      {/* 1. TOP HEADER                                             */}
      {/* ========================================================= */}
      <div className="w-full flex items-center justify-between pb-4 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] transition-all cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5]">
              Profile & Devices
            </h2>
            <p className="text-xs text-[#A6A8AD] mt-0.5">
              Manage your personal identity and verified device mesh.
            </p>
          </div>
        </div>

        {onStartTransfer && (
          <button
            type="button"
            onClick={() => onStartTransfer()}
            className="px-4 py-2 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Send Files</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. PROFILE HERO VESSEL & LIVE PREVIEW (2-Column Grid)    */}
      {/* ========================================================= */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* Main Smoked-Glass Profile Vessel (Span 2) */}
        <div className="md:col-span-2 p-6 sm:p-7 rounded-[36px] smoked-glass-hero flex flex-col justify-between relative overflow-hidden border border-white/[0.14] shadow-2xl">
          {/* Subtle reflection glint */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Large Profile Avatar */}
            <div className="relative group">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-gradient-to-br from-white/15 to-white/5 border border-white/25 flex items-center justify-center text-3xl font-extrabold text-[#F5F5F5] shadow-[0_0_28px_rgba(255,255,255,0.18)]">
                {userProfile.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white text-[#08090B] flex items-center justify-center shadow-md">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-bold text-[#F5F5F5] tracking-tight truncate">
                  {userProfile.name}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-[#F5F5F5]">
                  <ShieldCheck className="w-3 h-3 text-[#A6A8AD]" />
                  <span>Verified</span>
                </span>
              </div>
              <div className="text-xs text-[#A6A8AD] font-mono">
                {userProfile.username}
              </div>
              <div className="text-[11px] text-[#686B72] font-mono pt-0.5">
                Profile ID: <span className="text-[#A6A8AD]">{userProfile.profileId}</span>
              </div>
            </div>
          </div>

          {/* Edit Profile Action */}
          <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/[0.08]">
            <span className="text-xs text-[#A6A8AD]">
              Identity is shared peer-to-peer with nearby devices.
            </span>
            <button
              onClick={() => {
                setEditName(userProfile.name);
                setEditUsername(userProfile.username);
                setEditBio(userProfile.bio || '');
                setIsEditingProfile(true);
              }}
              className="px-4 py-1.5 rounded-full smoked-btn-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-white/[0.08] transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#A6A8AD]" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Live Profile Appearance Preview (Span 1) */}
        <div className="p-5 sm:p-6 rounded-[36px] smoked-glass-card flex flex-col justify-between border border-white/[0.10] shadow-xl text-center relative overflow-hidden">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#686B72] mb-3">
            Nearby Preview
          </div>

          <div className="flex flex-col items-center space-y-2.5 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-xl font-bold text-[#F5F5F5] shadow-inner">
              {userProfile.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#F5F5F5]">{userProfile.name}</div>
              <div className="text-xs text-[#A6A8AD] font-mono">{userProfile.username}</div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-[#A6A8AD]">
              <Laptop className="w-3 h-3 text-[#F5F5F5]" />
              <span>MacBook Air • macOS</span>
            </div>
          </div>

          <div className="text-[10px] text-[#686B72] pt-3 border-t border-white/[0.06]">
            Visible when scanning nearby
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. DEVICE VISIBILITY & TRUST SETTINGS                     */}
      {/* ========================================================= */}
      <div className="w-full p-4 sm:p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/10 text-[#F5F5F5] shrink-0">
            {isDeviceVisible ? <Eye className="w-5 h-5 text-white" /> : <EyeOff className="w-5 h-5 text-[#A6A8AD]" />}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#F5F5F5] flex items-center gap-2">
              <span>Device Visibility</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${isDeviceVisible ? 'bg-white/10 text-white border border-white/20' : 'bg-white/[0.04] text-[#686B72]'}`}>
                {isDeviceVisible ? '● Visible Nearby' : '○ Hidden'}
              </span>
            </div>
            <p className="text-xs text-[#A6A8AD] mt-0.5">
              Control whether other nearby NearShare devices can discover you directly.
            </p>
          </div>
        </div>

        <button
          onClick={toggleDeviceVisibility}
          className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
            isDeviceVisible
              ? 'smoked-btn-primary shadow-md'
              : 'smoked-btn-secondary text-[#A6A8AD]'
          }`}
        >
          {isDeviceVisible ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Visible</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hidden</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* 4. MY DEVICES SECTION & TABS                              */}
      {/* ========================================================= */}
      <div className="w-full space-y-4">
        {/* Section Header & Filter Pills */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#F5F5F5] tracking-tight">
              My Devices
            </h3>
            <p className="text-xs text-[#A6A8AD]">
              Paired devices with authorized direct channels and trust profiles.
            </p>
          </div>

          {/* Segment Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white/[0.12] text-[#F5F5F5] font-semibold'
                  : 'text-[#A6A8AD] hover:text-white'
              }`}
            >
              All ({deviceRelationships.filter((d) => !d.blocked).length})
            </button>
            <button
              onClick={() => setActiveTab('trusted')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'trusted'
                  ? 'bg-white/[0.12] text-[#F5F5F5] font-semibold'
                  : 'text-[#A6A8AD] hover:text-white'
              }`}
            >
              Trusted ({deviceRelationships.filter((d) => d.trustState === 'trusted' && !d.blocked).length})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-white/[0.12] text-[#F5F5F5] font-semibold'
                  : 'text-[#A6A8AD] hover:text-white'
              }`}
            >
              Favorites ({deviceRelationships.filter((d) => d.favorite && !d.blocked).length})
            </button>
            <button
              onClick={() => setActiveTab('blocked')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'blocked'
                  ? 'bg-white/[0.12] text-[#F5F5F5] font-semibold'
                  : 'text-[#A6A8AD] hover:text-white'
              }`}
            >
              Blocked ({deviceRelationships.filter((d) => d.blocked).length})
            </button>
          </div>
        </div>

        {/* Device Cards Grid / List */}
        <div className="w-full space-y-2.5">
          {filteredDevices.map((device) => (
            <motion.div
              key={device.deviceId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setSelectedDeviceRelationship(device)}
              className="group relative w-full p-4 rounded-2xl bg-white/[0.025] hover:bg-white/[0.055] border border-white/[0.08] hover:border-white/[0.18] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-all duration-200 cursor-pointer shadow-sm overflow-visible"
            >
              {/* Left: Platform Icon + Details */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#F5F5F5] group-hover:scale-105 transition-transform shrink-0">
                  {renderPlatformIcon(device.platform)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#F5F5F5] truncate group-hover:text-white">
                      {device.deviceName}
                    </span>
                    {device.favorite && (
                      <Star className="w-3.5 h-3.5 text-[#F5F5F5] fill-white shrink-0" />
                    )}
                    {device.trustState === 'trusted' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#F5F5F5] font-mono px-1.5 py-0.2 rounded bg-white/[0.08] border border-white/[0.15]">
                        <ShieldCheck className="w-2.5 h-2.5 text-white" />
                        <span>✓ Trusted</span>
                      </span>
                    )}
                    {device.trustState === 'paired' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#A6A8AD] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] border border-white/[0.08]">
                        <Check className="w-2.5 h-2.5 text-[#A6A8AD]" />
                        <span>Paired</span>
                      </span>
                    )}
                    {device.trustState === 'unknown' && !device.blocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#686B72] font-mono px-1.5 py-0.2 rounded bg-white/[0.03] border border-white/[0.06]">
                        <Lock className="w-2.5 h-2.5 text-[#686B72]" />
                        <span>Pairing required</span>
                      </span>
                    )}
                    {device.blocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#686B72] font-mono px-1.5 py-0.2 rounded bg-white/[0.03] border border-white/[0.06]">
                        <Ban className="w-2.5 h-2.5 text-[#686B72]" />
                        <span>Blocked</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-[#A6A8AD] truncate flex items-center gap-2 mt-0.5">
                    <span>{device.ownerName}</span>
                    <span className="text-[#686B72]">({device.ownerUsername})</span>
                    <span className="text-[#686B72]">•</span>
                    <span>{device.platform}</span>
                    <span className="text-[#686B72]">•</span>
                    <span className="font-mono text-[#686B72]">Last seen: {device.lastSeenAt}</span>
                  </div>
                </div>
              </div>

              {/* Right: Status + Context Menu */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                {/* Connection Status Badge (Monochrome subtle dots) */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.07] text-xs font-mono text-[#A6A8AD]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      device.blocked
                        ? 'bg-white/15'
                        : device.status === 'connected'
                        ? 'bg-white animate-pulse'
                        : device.status === 'discovered'
                        ? 'bg-white/70'
                        : 'bg-white/20'
                    }`}
                  />
                  <span className="capitalize text-[#F5F5F5] text-[11px]">
                    {device.blocked ? 'Blocked' : device.status}
                  </span>
                </div>

                {/* Favorite Toggle Quick Action */}
                {!device.blocked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(device.deviceId);
                    }}
                    className="p-1.5 rounded-lg text-[#A6A8AD] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                    title={device.favorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        device.favorite ? 'text-white fill-white' : 'text-[#686B72]'
                      }`}
                    />
                  </button>
                )}

                {/* Context Menu ••• */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuDeviceId(activeMenuDeviceId === device.deviceId ? null : device.deviceId);
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {activeMenuDeviceId === device.deviceId && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-[#12141A] border border-white/15 shadow-2xl p-1 z-50 flex flex-col space-y-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeviceRelationship(device);
                            setActiveMenuDeviceId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-[#A6A8AD]" />
                          <span>Device Trust Profile</span>
                        </button>
                        {!device.blocked && (
                          <button
                            type="button"
                            onClick={() => {
                              setTrustState(
                                device.deviceId,
                                device.trustState === 'trusted' ? 'paired' : 'trusted'
                              );
                              setActiveMenuDeviceId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#A6A8AD]" />
                            <span>{device.trustState === 'trusted' ? 'Remove Trust' : 'Trust Device'}</span>
                          </button>
                        )}
                        <div className="h-[1px] bg-white/[0.08] my-0.5" />
                        <button
                          type="button"
                          onClick={() => {
                            if (device.blocked) {
                              unblockDevice(device.deviceId);
                            } else {
                              blockDevice(device.deviceId);
                            }
                            setActiveMenuDeviceId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs text-[#F5F5F5] hover:bg-white/[0.08] transition-colors cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5 text-[#A6A8AD]" />
                          <span>{device.blocked ? 'Unblock device' : 'Block device'}</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredDevices.length === 0 && (
            <div className="py-8 text-center text-xs text-[#686B72] border border-dashed border-white/10 rounded-2xl">
              No devices found in this category.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. EDIT PROFILE MODAL                                     */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isEditingProfile && (
          <div
            onClick={() => setIsEditingProfile(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              className="relative w-full max-w-md p-6 rounded-[32px] smoked-glass-card border border-white/20 shadow-2xl flex flex-col space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h3 className="text-base font-bold text-[#F5F5F5]">Edit Profile</h3>
                <GlassCloseButton onClose={() => setIsEditingProfile(false)} ariaLabel="Close edit profile modal" />
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#A6A8AD]">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-[#F5F5F5] focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#A6A8AD]">Handle / Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-[#F5F5F5] font-mono focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#A6A8AD]">Bio / Description</label>
                  <input
                    type="text"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-[#F5F5F5] focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#A6A8AD] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl smoked-btn-primary text-xs font-semibold shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* 6. FULL DEVICE TRUST DETAILS VESSEL PANEL                 */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedDeviceRelationship && (
          <DeviceTrustDetailsPanel
            device={selectedDeviceRelationship}
            onClose={() => setSelectedDeviceRelationship(null)}
            onStartTransfer={onStartTransfer}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
