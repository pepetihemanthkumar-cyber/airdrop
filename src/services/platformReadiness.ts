export type PlatformType = 'macos' | 'windows' | 'android' | 'ios' | 'unknown';

export type PermissionState =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'not-requested'
  | 'unavailable';

export type StorageState = 'healthy' | 'low' | 'insufficient';

export interface PlatformPermission {
  id: 'file-access' | 'nearby-devices' | 'local-network' | 'notifications' | 'background-transfer';
  name: string;
  description: string;
  state: PermissionState;
  required: boolean;
  requiredForMode?: 'direct' | 'wifi' | 'all';
  platforms: PlatformType[];
  whyNeeded: string;
  deniedConsequence: string;
  supportedModes: string;
  platformNotes: Record<PlatformType, string>;
}

export interface PlatformReadiness {
  platform: PlatformType;
  fileAccess: PermissionState;
  nearbyDevices: PermissionState;
  localNetwork: PermissionState;
  notifications: PermissionState;
  backgroundTransfer: PermissionState;
  storageAccess: PermissionState;
  availableStorageBytes: number;
  overallReady: boolean;
}

export const INITIAL_PERMISSIONS: PlatformPermission[] = [
  {
    id: 'file-access',
    name: 'Files & Storage',
    description: 'Allows NearShare to read files you choose and save received files.',
    state: 'granted',
    required: true,
    requiredForMode: 'all',
    platforms: ['macos', 'windows', 'android', 'ios'],
    whyNeeded: 'NearShare reads selected files to transmit them securely and writes incoming transfers to your designated download directory.',
    deniedConsequence: 'You will not be able to select files for outbound sending or save received items locally.',
    supportedModes: 'Direct Nearby & Local Wi-Fi',
    platformNotes: {
      macos: 'NearShare uses macOS document selection and sandbox permissions for designated directories.',
      windows: 'NearShare uses standard Windows file access capabilities available to the application.',
      android: 'Android controls storage access through granular media and document permissions.',
      ios: 'iOS uses standard document pickers and security-scoped URLs for file transfers.',
      unknown: 'Standard platform file read/write access required.',
    },
  },
  {
    id: 'nearby-devices',
    name: 'Nearby Devices',
    description: 'Allows NearShare to discover nearby devices for Direct transfers.',
    state: 'granted',
    required: true,
    requiredForMode: 'direct',
    platforms: ['macos', 'windows', 'android', 'ios'],
    whyNeeded: 'Required for high-speed device-to-device discovery without an existing shared network infrastructure.',
    deniedConsequence: 'Direct Nearby mode will not be able to scan or broadcast to surrounding devices.',
    supportedModes: '⚡ Direct Nearby only',
    platformNotes: {
      macos: 'NearShare will use Bluetooth and Wi-Fi Direct protocols managed by macOS.',
      windows: 'NearShare uses Windows Nearby Share and Wi-Fi Direct platform capabilities.',
      android: 'Android requires Nearby Devices permission (Bluetooth / Wi-Fi Direct discovery).',
      ios: 'iOS uses CoreBluetooth and Multipeer Connectivity platform frameworks.',
      unknown: 'Nearby radio access required for direct device discovery.',
    },
  },
  {
    id: 'local-network',
    name: 'Local Network',
    description: 'Allows NearShare to communicate with devices on the same Wi-Fi network.',
    state: 'granted',
    required: true,
    requiredForMode: 'wifi',
    platforms: ['macos', 'windows', 'android', 'ios'],
    whyNeeded: 'Discovers and establishes high-throughput local socket conduits with peers on the same local Wi-Fi subnet.',
    deniedConsequence: 'Wi-Fi mode will not be able to locate or connect with devices on your local router.',
    supportedModes: '📶 Local Wi-Fi only',
    platformNotes: {
      macos: 'macOS requests local network discovery permission when browsing the local subnet.',
      windows: 'Windows Defender firewall allows private local network connectivity.',
      android: 'Android permits multicast DNS and local network socket discovery.',
      ios: 'iOS requires explicit Local Network permission dialog approval.',
      unknown: 'Local subnet broadcasting and socket binding required.',
    },
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Allows NearShare to notify you when transfers need attention.',
    state: 'granted',
    required: false,
    requiredForMode: 'all',
    platforms: ['macos', 'windows', 'android', 'ios'],
    whyNeeded: 'Alerts you of incoming transfer requests, verification PINs, and completed batch downloads.',
    deniedConsequence: 'You will only see transfer requests and status while the NearShare window is active.',
    supportedModes: 'All transfer modes',
    platformNotes: {
      macos: 'macOS Notification Center presents native alert banners.',
      windows: 'Windows Action Center displays transfer notifications and completion badges.',
      android: 'Android posting notifications keep you informed in the status shade.',
      ios: 'iOS UserNotifications framework delivers lock-screen and banner alerts.',
      unknown: 'Desktop and mobile notification service support.',
    },
  },
  {
    id: 'background-transfer',
    name: 'Background Transfer',
    description: 'Allows transfers to continue when supported by the platform.',
    state: 'granted',
    required: false,
    requiredForMode: 'all',
    platforms: ['macos', 'windows', 'android', 'ios'],
    whyNeeded: 'Allows large multi-gigabyte transfers to continue uninterrupted when NearShare is minimized.',
    deniedConsequence: 'Transfers may pause if the app is placed in the background or the screen locks.',
    supportedModes: 'Direct Nearby & Local Wi-Fi',
    platformNotes: {
      macos: 'macOS App Nap and background task assertions keep active transfers running.',
      windows: 'Windows background execution prevents socket suspension.',
      android: 'Android foreground transfer service with persistent notification.',
      ios: 'iOS Background URLSession / background task assertions where supported.',
      unknown: 'Background task assertion and sleep prevention.',
    },
  },
];

export const PLATFORM_EXPLANATORY_NOTES: Record<PlatformType, string> = {
  macos: 'NearShare will use the permissions provided by macOS for files, nearby communication, and local network access.',
  windows: 'NearShare will use Windows file access and network capabilities available to the desktop application.',
  android: 'Android controls nearby-device and file access through system permissions.',
  ios: 'iOS controls nearby communication, local-network access, and file selection through system permissions and platform APIs.',
  unknown: 'NearShare uses standard operating system permissions for device discovery, file access, and networking.',
};

export const DEFAULT_STORAGE_BYTES = 128 * 1024 * 1024 * 1024; // 128 GB

export const formatStorageDisplay = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 * 1024 ? 0 : 2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
};
