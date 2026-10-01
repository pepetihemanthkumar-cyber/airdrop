import React, { createContext, useContext, useState, useEffect } from 'react';

export type DefaultTransferMode = 'direct' | 'wifi';
export type DownloadLocation = 'Downloads' | 'Desktop' | 'Documents' | 'Pictures';
export type DeviceVisibilitySetting = 'visible' | 'hidden';

export interface SettingsState {
  defaultTransferMode: DefaultTransferMode;
  downloadLocation: DownloadLocation;
  autoAcceptTrusted: boolean;
  autoReconnect: boolean;
  notifications: boolean;
  deviceVisibility: DeviceVisibilitySetting;
  allowUnknownDevices: boolean;
  showDistance: boolean;
  trustedOnly: boolean;
  incomingApproval: boolean;
  unknownDeviceProtection: boolean;
  reducedMotion: boolean;
  soundEffects: boolean;
  compactDeviceCards: boolean;
  saveHistory: boolean;
  runInBackground: boolean;
  showTrayIcon: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
  defaultTransferMode: 'direct',
  downloadLocation: 'Downloads',
  autoAcceptTrusted: false,
  autoReconnect: true,
  notifications: true,
  deviceVisibility: 'visible',
  allowUnknownDevices: true,
  showDistance: true,
  trustedOnly: false,
  incomingApproval: true,
  unknownDeviceProtection: true,
  reducedMotion: false,
  soundEffects: true,
  compactDeviceCards: false,
  saveHistory: true,
  runInBackground: true,
  showTrayIcon: true,
  notifyOnComplete: true,
  notifyOnFailure: true,
};

interface SettingsContextType {
  settings: SettingsState;
  updateSettings: (updated: Partial<SettingsState>) => void;
  resetSettings: () => void;
}

const SETTINGS_STORAGE_KEY = 'nearshare_user_settings_v1';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  const updateSettings = (updated: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updated }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
