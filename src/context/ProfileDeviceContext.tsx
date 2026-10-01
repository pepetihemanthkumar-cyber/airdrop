import React, { createContext, useContext, useState } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  profileId: string;
  bio?: string;
}

export interface Device {
  id: string;
  name: string;
  ownerName?: string;
  userHandle?: string;
  avatar?: string;
  platform: 'macOS' | 'Android' | 'iOS' | 'Windows';
  deviceName: string;
  status: 'connected' | 'nearby' | 'offline';
  lastSeen: string;
  distance?: string;
  connectionQuality?: 'Excellent' | 'Good' | 'Weak' | 'Unavailable';
  isTrusted: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
  isUnknown?: boolean;
  deviceId: string;
  transfersCount: number;
  totalTransferredFormatted: string;
}

interface ProfileDeviceContextType {
  userProfile: UserProfile;
  devices: Device[];
  isDeviceVisible: boolean;
  activeDeviceId: string;
  updateUserProfile: (updated: Partial<UserProfile>) => void;
  updateDevice: (deviceId: string, updated: Partial<Device>) => void;
  renameDevice: (deviceId: string, newName: string) => void;
  toggleDeviceTrust: (deviceId: string) => void;
  toggleDeviceFavorite: (deviceId: string) => void;
  toggleDeviceBlock: (deviceId: string) => void;
  toggleDeviceVisibility: () => void;
  getActiveDevice: () => Device;
}

const INITIAL_PROFILE: UserProfile = {
  id: 'usr-hemanth-01',
  name: 'Hemanth',
  username: '@hemanth',
  avatar: 'H',
  profileId: 'NS-HEMANTH-8492',
  bio: 'Lead Engineer & Designer',
};

const INITIAL_DEVICES: Device[] = [
  {
    id: 'dev-mac-01',
    name: "Hemanth's MacBook Air",
    ownerName: 'Hemanth',
    userHandle: '@hemanth',
    avatar: 'H',
    deviceName: 'MacBook Air M3',
    platform: 'macOS',
    status: 'connected',
    lastSeen: 'Just now',
    distance: '8 m',
    connectionQuality: 'Excellent',
    isTrusted: true,
    isFavorite: true,
    isBlocked: false,
    deviceId: 'NS-DEV-MAC-8491',
    transfersCount: 24,
    totalTransferredFormatted: '18.4 GB',
  },
  {
    id: 'dev-android-01',
    name: "Hemanth's Android",
    ownerName: 'Hemanth',
    userHandle: '@hemanth',
    avatar: 'H',
    deviceName: 'Pixel 9 Pro',
    platform: 'Android',
    status: 'nearby',
    lastSeen: '2 min ago',
    distance: '14 m',
    connectionQuality: 'Excellent',
    isTrusted: true,
    isFavorite: true,
    isBlocked: false,
    deviceId: 'NS-DEV-AND-4210',
    transfersCount: 19,
    totalTransferredFormatted: '14.2 GB',
  },
  {
    id: 'dev-iphone-01',
    name: 'Personal iPhone',
    ownerName: 'Elena Rostova',
    userHandle: '@elena',
    avatar: 'E',
    deviceName: 'iPhone 17 Pro',
    platform: 'iOS',
    status: 'nearby',
    lastSeen: '1 min ago',
    distance: '22 m',
    connectionQuality: 'Good',
    isTrusted: true,
    isFavorite: false,
    isBlocked: false,
    deviceId: 'NS-DEV-IOS-9932',
    transfersCount: 8,
    totalTransferredFormatted: '4.8 GB',
  },
  {
    id: 'dev-unknown-01',
    name: 'Unknown Device',
    deviceName: 'Nearby Android Device',
    platform: 'Android',
    status: 'nearby',
    lastSeen: 'Just now',
    distance: '28 m',
    connectionQuality: 'Weak',
    isTrusted: false,
    isFavorite: false,
    isBlocked: false,
    isUnknown: true,
    deviceId: 'NS-DEV-UNK-7712',
    transfersCount: 0,
    totalTransferredFormatted: '0 B',
  },
  {
    id: 'dev-win-01',
    name: 'Workstation PC',
    ownerName: 'Studio Workstation',
    userHandle: '@studio',
    avatar: 'S',
    deviceName: 'Windows 11 Custom',
    platform: 'Windows',
    status: 'offline',
    lastSeen: '3 days ago',
    distance: '30 m',
    connectionQuality: 'Weak',
    isTrusted: false,
    isFavorite: false,
    isBlocked: false,
    deviceId: 'NS-DEV-WIN-1029',
    transfersCount: 3,
    totalTransferredFormatted: '2.1 GB',
  },
  {
    id: 'dev-blocked-01',
    name: 'Unknown Android-92',
    deviceName: 'Redmi Note 12',
    platform: 'Android',
    status: 'nearby',
    lastSeen: 'Sep 20',
    distance: '12 m',
    connectionQuality: 'Good',
    isTrusted: false,
    isFavorite: false,
    isBlocked: true,
    deviceId: 'NS-DEV-AND-0082',
    transfersCount: 0,
    totalTransferredFormatted: '0 B',
  },
];

const ProfileDeviceContext = createContext<ProfileDeviceContextType | undefined>(undefined);

export const ProfileDeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [isDeviceVisible, setIsDeviceVisible] = useState<boolean>(true);
  const [activeDeviceId] = useState<string>('dev-mac-01');

  const updateUserProfile = (updated: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updated }));
  };

  const updateDevice = (deviceId: string, updated: Partial<Device>) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, ...updated } : d))
    );
  };

  const renameDevice = (deviceId: string, newName: string) => {
    updateDevice(deviceId, { name: newName });
  };

  const toggleDeviceTrust = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, isTrusted: !d.isTrusted } : d))
    );
  };

  const toggleDeviceFavorite = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, isFavorite: !d.isFavorite } : d))
    );
  };

  const toggleDeviceBlock = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, isBlocked: !d.isBlocked } : d))
    );
  };

  const toggleDeviceVisibility = () => {
    setIsDeviceVisible((prev) => !prev);
  };

  const getActiveDevice = (): Device => {
    return devices.find((d) => d.id === activeDeviceId) || devices[0];
  };

  return (
    <ProfileDeviceContext.Provider
      value={{
        userProfile,
        devices,
        isDeviceVisible,
        activeDeviceId,
        updateUserProfile,
        updateDevice,
        renameDevice,
        toggleDeviceTrust,
        toggleDeviceFavorite,
        toggleDeviceBlock,
        toggleDeviceVisibility,
        getActiveDevice,
      }}
    >
      {children}
    </ProfileDeviceContext.Provider>
  );
};

export const useProfileDevice = () => {
  const context = useContext(ProfileDeviceContext);
  if (!context) {
    throw new Error('useProfileDevice must be used within a ProfileDeviceProvider');
  }
  return context;
};
