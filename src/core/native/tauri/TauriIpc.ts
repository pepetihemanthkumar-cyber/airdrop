/**
 * NearShare Tauri v2 IPC Client
 *
 * Provides typed frontend communication with the Rust host shell.
 * Includes safe web browser fallback when running outside the desktop shell.
 */

export interface TauriRuntimeDiagnostics {
  runtime: 'tauri';
  platform: 'macos' | 'windows' | 'unknown';
  tauriVersion: string;
  nativeNetworking: boolean;
  nativeFilesystem: boolean;
}

export interface TauriPickedFile {
  id: string;
  name: string;
  size: number;
  kind: 'file';
  extension?: string;
  mimeType?: string;
}

export interface NativeChunkReadResult {
  referenceId: string;
  offset: number;
  length: number;
  bytesRead: number;
  bytes: Uint8Array;
  isEof: boolean;
}

export interface NativeChunkWriteResult {
  referenceId: string;
  offset: number;
  bytesWritten: number;
}

/**
 * Checks if running inside the Tauri v2 webview desktop runtime.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
}

/**
 * Invokes the Rust get_runtime_diagnostics command through Tauri IPC.
 * In a standard web browser, gracefully returns null without throwing.
 */
export async function getRuntimeDiagnostics(): Promise<TauriRuntimeDiagnostics | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {
      const result = await internals.invoke('get_runtime_diagnostics');
      return result as TauriRuntimeDiagnostics;
    }

    const tauriGlobal = (window as any).__TAURI__;
    if (tauriGlobal && typeof tauriGlobal.invoke === 'function') {
      const result = await tauriGlobal.invoke('get_runtime_diagnostics');
      return result as TauriRuntimeDiagnostics;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke get_runtime_diagnostics:', err);
    return null;
  }
}

/**
 * Invokes the native macOS file picker via the Rust pick_files command.
 * In a standard web browser, gracefully returns an empty array.
 */
export async function pickFiles(): Promise<TauriPickedFile[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {
      const result = await internals.invoke('pick_files');
      return (result as TauriPickedFile[] | null) ?? [];
    }

    const tauriGlobal = (window as any).__TAURI__;
    if (tauriGlobal && typeof tauriGlobal.invoke === 'function') {
      const result = await tauriGlobal.invoke('pick_files');
      return (result as TauriPickedFile[] | null) ?? [];
    }

    return [];
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke pick_files:', err);
    return [];
  }
}

/**
 * Prompts user with native Save File dialog and creates a destination file in Rust session registry.
 * Returns safe metadata or null if user cancelled.
 */
export async function createNativeFile(suggestedName?: string): Promise<TauriPickedFile | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('create_native_file', { suggestedName });
      return (result as TauriPickedFile | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke create_native_file:', err);
    return null;
  }
}

/**
 * Reads a bounded chunk of bytes from a native file reference.
 * Returns Uint8Array wrapped in NativeChunkReadResult.
 */
export async function readNativeFileChunk(
  referenceId: string,
  offset: number,
  length: number = 4 * 1024 * 1024
): Promise<NativeChunkReadResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const rawResult = await invoker('read_native_file_chunk', {
        referenceId,
        offset,
        length,
      });

      if (!rawResult) return null;

      const bytesArray = rawResult.bytes instanceof Uint8Array
        ? rawResult.bytes
        : new Uint8Array(rawResult.bytes ?? []);

      return {
        referenceId: rawResult.referenceId,
        offset: rawResult.offset,
        length: rawResult.length,
        bytesRead: rawResult.bytesRead,
        bytes: bytesArray,
        isEof: rawResult.isEof,
      };
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke read_native_file_chunk:', err);
    throw err;
  }
}

/**
 * Writes a bounded byte chunk (up to 4 MiB) to an opaque native destination file at an explicit offset.
 */
export async function writeNativeFileChunk(
  referenceId: string,
  offset: number,
  bytes: Uint8Array | number[]
): Promise<NativeChunkWriteResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const bytePayload = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
      const result = await invoker('write_native_file_chunk', {
        referenceId,
        offset,
        bytes: bytePayload,
      });

      return (result as NativeChunkWriteResult | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke write_native_file_chunk:', err);
    throw err;
  }
}

/**
 * Queries current byte length on disk for an active native file reference.
 */
export async function getNativeFileSize(referenceId: string): Promise<number | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('get_native_file_size', { referenceId });
      return typeof result === 'number' ? result : null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke get_native_file_size:', err);
    return null;
  }
}

/**
 * Closes the native file reference handle in the Rust session registry.
 */
export async function closeNativeFile(referenceId: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return true;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('close_native_file', { referenceId });
      return Boolean(result);
    }

    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke close_native_file:', err);
    return false;
  }
}

export interface NativePickedFolder {
  id: string;
  name: string;
  kind: 'folder';
}

export interface NativeFolderScanEntry {
  id: string;
  relativePath: string;
  name: string;
  size: number;
  kind: 'file' | 'folder';
  modifiedAt?: number;
  extension?: string;
  mimeType?: string;
}

export interface NativeFolderScanResult {
  folderReferenceId: string;
  folderName: string;
  fileCount: number;
  totalBytes: number;
  entries: NativeFolderScanEntry[];
  truncated: boolean;
  durationMs: number;
}

/**
 * Invokes the native macOS folder picker via the Rust pick_folder command.
 * Returns safe metadata with an opaque folderReferenceId or null if cancelled.
 */
export async function pickFolder(): Promise<NativePickedFolder | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('pick_folder');
      return (result as NativePickedFolder | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke pick_folder:', err);
    return null;
  }
}

/**
 * Recursively scans a selected native folder in Rust and returns a flat relative manifest.
 */
export async function scanNativeFolder(
  folderReferenceId: string,
  options?: { maxFiles?: number; maxDepth?: number }
): Promise<NativeFolderScanResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('scan_native_folder', {
        folderReferenceId,
        maxFiles: options?.maxFiles,
        maxDepth: options?.maxDepth,
      });

      return (result as NativeFolderScanResult | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke scan_native_folder:', err);
    throw err;
  }
}

/**
 * Closes the native folder reference handle in the Rust session registry.
 */
export async function closeNativeFolder(folderReferenceId: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return true;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('close_native_folder', { folderReferenceId });
      return Boolean(result);
    }

    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke close_native_folder:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// STEP 38: Native Local TCP Transport Spike IPC
// -----------------------------------------------------------------------------

export interface TcpServerInfo {
  serverId: string;
  port: number;
  hostDisplay: string;
}

export interface TcpConnectResult {
  connectionId: string;
  state: string;
  port: number;
  hostDisplay: string;
}

export interface TcpMessageEvent {
  connectionId: string;
  bytes: number[] | Uint8Array;
  isServer: boolean;
}

export interface TcpConnectionStateEvent {
  connectionId: string;
  state: 'connected' | 'disconnected' | 'error';
  message?: string;
  remoteAddr?: string;
  isServer: boolean;
}

/**
 * Starts a native TCP listener on the specified port (or OS-assigned dynamic port).
 */
export async function startTcpServer(
  port?: number,
  bindLan?: boolean
): Promise<TcpServerInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('start_tcp_server', { port, bindLan });
      return (result as TcpServerInfo | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke start_tcp_server:', err);
    throw err;
  }
}

/**
 * Stops an active native TCP server.
 */
export async function stopTcpServer(serverId: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('stop_tcp_server', { serverId });
      return Boolean(result);
    }

    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke stop_tcp_server:', err);
    return false;
  }
}

/**
 * Connects to a remote or local TCP server host:port.
 */
export async function connectTcp(
  host: string,
  port: number
): Promise<TcpConnectResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('connect_tcp', { host, port });
      return (result as TcpConnectResult | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke connect_tcp:', err);
    throw err;
  }
}

/**
 * Sends a binary payload up to 1 MiB across an active TCP connection.
 */
export async function sendTcpMessage(
  connectionId: string,
  bytes: Uint8Array | number[]
): Promise<number> {
  if (!isTauriRuntime()) {
    throw new Error('TCP_SEND_FAILED: Native TCP is not available in browser mode');
  }

  const payloadArray = Array.isArray(bytes) ? bytes : Array.from(bytes);

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('send_tcp_message', {
        connectionId,
        bytes: payloadArray,
      });
      return Number(result);
    }

    throw new Error('TCP_SEND_FAILED: Tauri IPC not available');
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke send_tcp_message:', err);
    throw err;
  }
}

/**
 * Disconnects and releases an active TCP connection.
 */
export async function disconnectTcp(connectionId: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('disconnect_tcp', { connectionId });
      return Boolean(result);
    }

    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke disconnect_tcp:', err);
    return false;
  }
}

/**
 * Queries the connection state of a connection ID.
 */
export async function getTcpConnectionState(connectionId: string): Promise<string> {
  if (!isTauriRuntime()) {
    return 'unsupported';
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('get_tcp_connection_state', { connectionId });
      return String(result);
    }

    return 'disconnected';
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke get_tcp_connection_state:', err);
    return 'disconnected';
  }
}

/**
 * Subscribes to incoming framed TCP binary messages.
 */
export async function onTcpMessage(
  callback: (event: { connectionId: string; bytes: Uint8Array; isServer: boolean }) => void
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const listener = internals?.listen ?? (window as any).__TAURI__?.event?.listen;

    if (typeof listener === 'function') {
      const unlisten = await listener('native-tcp-message', (evt: any) => {
        const payload = evt.payload as TcpMessageEvent;
        const u8 = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes);
        callback({
          connectionId: payload.connectionId,
          bytes: u8,
          isServer: payload.isServer,
        });
      });
      return typeof unlisten === 'function' ? unlisten : () => {};
    }
  } catch (err) {
    console.warn('[TauriIpc] Failed to register onTcpMessage listener:', err);
  }

  return () => {};
}

/**
 * Subscribes to TCP connection state changes.
 */
export async function onTcpConnectionState(
  callback: (event: TcpConnectionStateEvent) => void
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const listener = internals?.listen ?? (window as any).__TAURI__?.event?.listen;

    if (typeof listener === 'function') {
      const unlisten = await listener('native-tcp-connection-state', (evt: any) => {
        callback(evt.payload as TcpConnectionStateEvent);
      });
      return typeof unlisten === 'function' ? unlisten : () => {};
    }
  } catch (err) {
    console.warn('[TauriIpc] Failed to register onTcpConnectionState listener:', err);
  }

  return () => {};
}

// -----------------------------------------------------------------------------
// STEP 46: Native Local UDP Multicast Discovery IPC Client
// -----------------------------------------------------------------------------

export interface UdpDiscoveryInfo {
  multicastGroup: string;
  port: number;
  isRunning: boolean;
}

export interface IpcDiscoveredPeer {
  deviceId: string;
  profileId?: string;
  deviceName: string;
  platform: string;
  ipAddress: string;
  tcpPort: number;
  capabilities: string[];
  firstSeen: number;
  lastSeen: number;
  expiresAt: number;
}

/**
 * Starts the native UDP discovery multicast listener in the Rust host shell.
 */
export async function startUdpDiscovery(
  multicastGroup?: string,
  port?: number
): Promise<UdpDiscoveryInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('start_udp_discovery', { multicastGroup, port });
      return (result as UdpDiscoveryInfo | null) ?? null;
    }

    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke start_udp_discovery:', err);
    throw err;
  }
}

/**
 * Stops the active native UDP discovery listener.
 */
export async function stopUdpDiscovery(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('stop_udp_discovery');
      return Boolean(result);
    }

    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke stop_udp_discovery:', err);
    return false;
  }
}

/**
 * Dispatches a discovery advertisement packet to the LAN multicast group.
 */
export async function sendDiscoveryAdvertisement(advertisement: any): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('send_discovery_advertisement', { advertisement });
      return Boolean(result);
    }

    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke send_discovery_advertisement:', err);
    return false;
  }
}

/**
 * Queries the list of currently cached peers discovered by the Rust host.
 */
export async function getDiscoveredPeers(): Promise<IpcDiscoveredPeer[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('get_discovered_peers');
      return (result as IpcDiscoveredPeer[] | null) ?? [];
    }

    return [];
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke get_discovered_peers:', err);
    return [];
  }
}

/**
 * Subscribes to peer discovery events from the native UDP listener.
 */
export async function onUdpPeerDiscovered(
  callback: (peer: IpcDiscoveredPeer) => void
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const listener = internals?.listen ?? (window as any).__TAURI__?.event?.listen;

    if (typeof listener === 'function') {
      const unlisten = await listener('native-udp-peer-discovered', (evt: any) => {
        callback(evt.payload as IpcDiscoveredPeer);
      });
      return typeof unlisten === 'function' ? unlisten : () => {};
    }
  } catch (err) {
    console.warn('[TauriIpc] Failed to register onUdpPeerDiscovered listener:', err);
  }

  return () => {};
}

/**
 * Subscribes to peer lost events from the native UDP discovery engine.
 */
export async function onUdpPeerLost(
  callback: (event: { deviceId: string; reason?: string }) => void
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const listener = internals?.listen ?? (window as any).__TAURI__?.event?.listen;

    if (typeof listener === 'function') {
      const unlisten = await listener('native-udp-peer-lost', (evt: any) => {
        callback(evt.payload as { deviceId: string; reason?: string });
      });
      return typeof unlisten === 'function' ? unlisten : () => {};
    }
  } catch (err) {
    console.warn('[TauriIpc] Failed to register onUdpPeerLost listener:', err);
  }

  return () => {};
}

// -----------------------------------------------------------------------------
// STEP 48: Native Durable Checkpoint Storage IPC
// -----------------------------------------------------------------------------

/**
 * Durably saves a transfer checkpoint JSON payload in the native application data store.
 */
export async function saveTransferCheckpointIpc(checkpointJson: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('save_transfer_checkpoint', { checkpointJson });
      return Boolean(result);
    }
    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke save_transfer_checkpoint:', err);
    return false;
  }
}

/**
 * Loads a persisted checkpoint JSON string by transfer ID from native application data store.
 */
export async function loadTransferCheckpointIpc(transferId: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('load_transfer_checkpoint', { transferId });
      return (result as string | null) ?? null;
    }
    return null;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke load_transfer_checkpoint:', err);
    return null;
  }
}

/**
 * Lists all incomplete / recoverable checkpoint JSON strings discovered in native storage.
 */
export async function listIncompleteCheckpointsIpc(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('list_incomplete_checkpoints');
      return (result as string[] | null) ?? [];
    }
    return [];
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke list_incomplete_checkpoints:', err);
    return [];
  }
}

/**
 * Deletes a checkpoint from native application data store.
 */
export async function deleteTransferCheckpointIpc(transferId: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const internals = (window as any).__TAURI_INTERNALS__;
    const invoker = internals?.invoke ?? (window as any).__TAURI__?.invoke;

    if (typeof invoker === 'function') {
      const result = await invoker('delete_transfer_checkpoint', { transferId });
      return Boolean(result);
    }
    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to invoke delete_transfer_checkpoint:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// Step 51: Desktop Shell Lifecycle, System Tray & Notification IPC
// -----------------------------------------------------------------------------

export type TrayStatusKind =
  | 'Idle'
  | 'Transferring'
  | 'Receiving'
  | 'Paused'
  | 'Interrupted'
  | 'Reconnecting'
  | 'Completed'
  | 'Failed';

export interface TrayStatusPayload {
  status: TrayStatusKind | string;
  activeCount: number;
  tooltip?: string;
}

export interface DesktopNotificationPayload {
  title: string;
  body: string;
  timestamp?: number;
}

/**
 * Shows and focuses the main desktop application window.
 */
export async function showMainWindow(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const invoker = (window as any).__TAURI_INTERNALS__?.invoke ?? (window as any).__TAURI__?.invoke;
    if (typeof invoker === 'function') {
      await invoker('show_main_window');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to show main window:', err);
    return false;
  }
}

/**
 * Hides the main desktop window to background/tray while keeping transfers alive.
 */
export async function hideMainWindow(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const invoker = (window as any).__TAURI_INTERNALS__?.invoke ?? (window as any).__TAURI__?.invoke;
    if (typeof invoker === 'function') {
      await invoker('hide_main_window');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to hide main window:', err);
    return false;
  }
}

/**
 * Updates the native system tray status, tooltip, and badge text.
 */
export async function updateTrayStatusIpc(
  status: TrayStatusKind | string,
  activeCount: number = 0,
  tooltip?: string
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const invoker = (window as any).__TAURI_INTERNALS__?.invoke ?? (window as any).__TAURI__?.invoke;
    if (typeof invoker === 'function') {
      await invoker('update_tray_status', { status, activeCount, tooltip });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to update tray status:', err);
    return false;
  }
}

/**
 * Dispatches a native desktop notification through the Tauri shell.
 * Redacts sensitive paths and limits length to avoid system notification truncation.
 */
export async function sendDesktopNotificationIpc(
  title: string,
  body: string
): Promise<boolean> {
  if (!isTauriRuntime()) {
    // Web Fallback: Use browser Notification API if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    const invoker = (window as any).__TAURI_INTERNALS__?.invoke ?? (window as any).__TAURI__?.invoke;
    if (typeof invoker === 'function') {
      await invoker('send_desktop_notification', { title, body });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[TauriIpc] Failed to send desktop notification:', err);
    return false;
  }
}

/**
 * Quits the Tauri desktop application.
 */
export async function quitApplicationIpc(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const invoker = (window as any).__TAURI_INTERNALS__?.invoke ?? (window as any).__TAURI__?.invoke;
    if (typeof invoker === 'function') {
      await invoker('quit_application');
    }
  } catch (err) {
    console.warn('[TauriIpc] Failed to quit application:', err);
  }
}

// Universal event target supporting browser and Node test runtimes
const globalEventTarget = {
  listeners: new Map<string, Set<(ev: any) => void>>(),
  addEventListener(type: string, listener: (ev: any) => void) {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener(type, listener);
      return;
    }
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  },
  removeEventListener(type: string, listener: (ev: any) => void) {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener(type, listener);
      return;
    }
    this.listeners.get(type)?.delete(listener);
  },
  dispatchEvent(type: string, detail?: any) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(type, { detail }));
      return;
    }
    const set = this.listeners.get(type);
    if (set) {
      for (const fn of set) {
        try {
          fn({ type, detail });
        } catch {}
      }
    }
  },
};

export { globalEventTarget };

/**
 * Listens for navigation events emitted by the native system tray menu.
 */
export function onTrayNavigate(callback: (target: 'home' | 'new_transfer' | 'queue' | 'settings') => void): () => void {
  const handler = (event: any) => {
    if (event?.detail) {
      callback(event.detail as any);
    }
  };

  globalEventTarget.addEventListener('tauri-tray-navigate', handler);

  // If Tauri event listener is available, attach to window
  const unlistenPromise = typeof window !== 'undefined' && (window as any).__TAURI_EVENT__?.listen
    ? (window as any).__TAURI_EVENT__.listen('tray_navigate', (ev: any) => {
        callback(ev.payload);
      })
    : null;

  return () => {
    globalEventTarget.removeEventListener('tauri-tray-navigate', handler);
    if (unlistenPromise && typeof unlistenPromise.then === 'function') {
      unlistenPromise.then((unlisten: any) => unlisten && unlisten());
    }
  };
}

/**
 * Listens for application quit requests (e.g. from Tray menu Quit) to trigger safe checkpoint flushing.
 */
export function onAppQuitRequested(callback: () => void): () => void {
  const handler = () => callback();
  globalEventTarget.addEventListener('tauri-app-quit-requested', handler);

  const unlistenPromise = typeof window !== 'undefined' && (window as any).__TAURI_EVENT__?.listen
    ? (window as any).__TAURI_EVENT__.listen('app_quit_requested', () => {
        callback();
      })
    : null;

  return () => {
    globalEventTarget.removeEventListener('tauri-app-quit-requested', handler);
    if (unlistenPromise && typeof unlistenPromise.then === 'function') {
      unlistenPromise.then((unlisten: any) => unlisten && unlisten());
    }
  };
}



